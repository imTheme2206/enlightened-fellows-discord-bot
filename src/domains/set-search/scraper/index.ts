import { createHash } from "crypto"
import { CatalogIngestionService } from "../../mh-wilds-catalog/ingestion/service"
import { OrphanedTalismanSkillError, ScrapeConflictError } from "../../mh-wilds-catalog/ingestion/errors"
import { deKira } from "../../mh-wilds-catalog/ingestion/names"
import { mapMhdbWeapons } from "../../mh-wilds-catalog/ingestion/weapons"
import { mapMhdbMonsters } from "../../mh-wilds-catalog/ingestion/monsters"
import { MonsterIngestionService } from "../../mh-wilds-catalog/ingestion/monster-service"
import { CatalogSyncStateService } from "../../mh-wilds-catalog/ingestion/sync-state"
import { SeedDataSchema, transformSeedData } from "../../mh-wilds-catalog/ingestion/transform"
import logger from "../../../infra/logger"
import { JobLogService } from "../../job-logs/service"
import { refresh } from "../runtime"
import type {
  MhdbArmorPiece,
  MhdbArmorSet,
  MhdbCharmGroup,
  MhdbDecoration,
  MhdbMonster,
  MhdbSkill,
  MhdbWeapon,
} from "../../mh-wilds-catalog/ingestion/mhdb-types"

// Re-exported so existing callers (db-init, any future operator tooling) can
// keep importing these errors from the scraper entry point.
export { OrphanedTalismanSkillError, ScrapeConflictError }

const BASE_URL = "https://wilds.mhdb.io/en"

function getBaseName(names: string[]): string {
  const suffixRegex = /\s(I|II)\s*$/
  const stripped = names.map((n) => n.replace(suffixRegex, "").trim())
  return new Set(stripped).size === 1 ? stripped[0] : names.join("/")
}

type Fetched<T> = { data: T; hash: string }

/** Fetches one upstream endpoint, hashing the raw body so unchanged feeds can be skipped (ADR-0016). */
async function fetchJson<T>(url: string): Promise<Fetched<T>> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  const body = await res.text()
  return { data: JSON.parse(body) as T, hash: createHash("sha256").update(body).digest("hex") }
}

const EQUIPMENT_ENDPOINTS = ["armor", "skills", "armor/sets", "charms", "decorations", "weapons"] as const
const syncKey = (endpoint: string) => `equipment:${endpoint}`
const MONSTERS_SYNC_KEY = "monsters"

/**
 * Set-search-agnostic fetch + transform of the upstream wilds.mhdb.io feed.
 * Ownership: this stays in `set-search/scraper` because it is the only module
 * that speaks the MHDB wire format; persistence and reconciliation belong to
 * the MH Wilds Catalog domain (ADR-0009) and are delegated to
 * `CatalogIngestionService`.
 */
async function fetchEquipmentPayloads() {
  const [armor, skills, armorSets, charms, decorations, weapons] = await Promise.all([
    fetchJson<MhdbArmorPiece[]>(`${BASE_URL}/armor`),
    fetchJson<MhdbSkill[]>(`${BASE_URL}/skills`),
    fetchJson<MhdbArmorSet[]>(`${BASE_URL}/armor/sets`),
    fetchJson<MhdbCharmGroup[]>(`${BASE_URL}/charms`),
    fetchJson<MhdbDecoration[]>(`${BASE_URL}/decorations`),
    fetchJson<MhdbWeapon[]>(`${BASE_URL}/weapons`),
  ])
  const hashes: Record<string, string> = {}
  EQUIPMENT_ENDPOINTS.forEach((endpoint, i) => {
    hashes[syncKey(endpoint)] = [armor, skills, armorSets, charms, decorations, weapons][i].hash
  })
  return {
    hashes,
    lists: {
      armorList: armor.data,
      skillList: skills.data,
      armorSetList: armorSets.data,
      charmList: charms.data,
      decorationList: decorations.data,
      weaponList: weapons.data,
    },
  }
}

type EquipmentLists = Awaited<ReturnType<typeof fetchEquipmentPayloads>>["lists"]

function buildSeedData({
  armorList,
  skillList,
  armorSetList,
  charmList,
  decorationList,
  weaponList,
}: EquipmentLists) {

  const pieceSetSkills = new Map<string, string[]>()
  const pieceGroupSkills = new Map<string, string[]>()

  for (const armorSet of armorSetList) {
    const setBonusName = armorSet.bonus?.skill?.name
    const groupBonusName = armorSet.groupBonus?.skill?.name

    for (const piece of armorSet.pieces) {
      if (setBonusName) {
        const arr = pieceSetSkills.get(piece.name) ?? []
        if (!arr.includes(setBonusName)) arr.push(setBonusName)
        pieceSetSkills.set(piece.name, arr)
      }
      if (groupBonusName) {
        const arr = pieceGroupSkills.get(piece.name) ?? []
        if (!arr.includes(groupBonusName)) arr.push(groupBonusName)
        pieceGroupSkills.set(piece.name, arr)
      }
    }
  }

  for (const piece of armorList) {
    const directSetSkills = piece.skills
      .filter((s) => s.skill.kind === "set")
      .map((s) => s.skill.name)
    if (directSetSkills.length > 0) {
      const arr = pieceSetSkills.get(piece.name) ?? []
      for (const sk of directSetSkills) {
        if (!arr.includes(sk)) arr.push(sk)
      }
      pieceSetSkills.set(piece.name, arr)
    }
  }

  const armorData: Record<string, Record<string, unknown[]>> = {
    head: {},
    chest: {},
    arms: {},
    waist: {},
    legs: {},
  }

  for (const piece of armorList) {
    const cleanName = deKira(piece.name)
    const skills: Record<string, number> = {}
    for (const s of piece.skills) {
      if (s.skill.kind === "armor") skills[s.skill.name] = s.level
    }
    armorData[piece.kind][cleanName] = [
      piece.kind,
      skills,
      pieceGroupSkills.get(piece.name) ?? [],
      piece.slots,
      piece.defense.base,
      [
        piece.resistances.fire,
        piece.resistances.water,
        piece.resistances.thunder,
        piece.resistances.ice,
        piece.resistances.dragon,
      ],
      piece.rank,
      pieceSetSkills.get(piece.name) ?? [],
      piece.rarity,
    ]
  }

  const talisman: Record<string, unknown[]> = {}
  for (const group of charmList) {
    for (const charm of group.ranks) {
      const skills: Record<string, number> = {}
      for (const s of charm.skills) skills[s.skill.name] = s.level
      talisman[deKira(charm.name)] = ["talisman", skills]
    }
  }

  const decorationData: Record<string, unknown[]> = {}
  for (const deco of decorationList) {
    const rawName = deco.name
      .replace(/\[/g, "")
      .replace(/\]/g, "")
      .replace(/\//g, "-")
    const skills: Record<string, number> = {}
    for (const s of deco.skills) skills[s.skill.name] = s.level
    decorationData[deKira(rawName)] = [deco.kind, skills, deco.slot]
  }

  const skillsData: Record<string, number> = {}
  const setSkills: Record<string, unknown[]> = {}
  const groupSkills: Record<string, unknown[]> = {}
  const setMap: Record<string, string> = {}
  const armorSkills: string[] = []
  const weaponSkills: string[] = []
  const skillIcons: Record<string, string> = {}

  for (const s of skillList) {
    const cleanName = deKira(s.name)
    if (s.icon?.kind) skillIcons[cleanName] = s.icon.kind
    switch (s.kind) {
      case "armor":
        skillsData[cleanName] = s.ranks.length
        if (s.kind === "armor") armorSkills.push(cleanName)
        break
      case "weapon":
        skillsData[cleanName] = s.ranks.length
        if (s.kind === "weapon") weaponSkills.push(cleanName)
        break
      case "set": {
        const effectName = getBaseName(s.ranks.map((r) => r.name))
        const thresholds = s.ranks.map((r) => r.setPiecesRequired ?? 2)
        setSkills[cleanName] = [effectName, thresholds[0] ?? 2, thresholds]
        setMap[cleanName] = effectName
        break
      }
      case "group": {
        const effectName = getBaseName(s.ranks.map((r) => r.name))
        groupSkills[cleanName] = [effectName, 1, 3]
        setMap[cleanName] = effectName
        break
      }
    }
  }

  const raw = {
    armor: armorData,
    talisman,
    decoration: decorationData,
    skills: skillsData,
    setSkills,
    groupSkills,
    setMap,
    armorSkills,
    weaponSkills,
    skillIcons,
    weapons: mapMhdbWeapons(weaponList),
  }
  const parsed = SeedDataSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      `Fetched data validation failed: ${JSON.stringify(parsed.error.flatten())}`,
    )
  }
  return parsed.data
}

export interface ScraperResult {
  /** Counts of genuinely new identities inserted this run (0 on a no-op scrape). */
  armorCount: number
  skillCount: number
  decoCount: number
  weaponCount: number
  /** Monsters (ADR-0015): new, and replaced because upstream content changed. */
  monsterInsertedCount: number
  monsterUpdatedCount: number
  /** Upstream payloads matched the last successful sync, so reconcile was skipped (ADR-0016). */
  equipmentUnchanged?: boolean
  monstersUnchanged?: boolean
  /** Another catalog scrape was already running, so this trigger did nothing (ADR-0016). */
  skipped?: boolean
}

export type ScraperOptions = {
  source?: "cron" | "manual" | "boot"
  /** Skip a domain whose upstream payloads hash the same as the last successful sync. Cron sets this. */
  skipUnchanged?: boolean
}

type EquipmentResult = Pick<ScraperResult, "armorCount" | "skillCount" | "decoCount" | "weaponCount"> & {
  equipmentUnchanged?: boolean
}
type MonsterResult = Pick<ScraperResult, "monsterInsertedCount" | "monsterUpdatedCount"> & {
  monstersUnchanged?: boolean
  skipped?: boolean
}

const noEquipment: EquipmentResult = { armorCount: 0, skillCount: 0, decoCount: 0, weaponCount: 0 }
const noMonsters: MonsterResult = { monsterInsertedCount: 0, monsterUpdatedCount: 0 }

/** True when every source has a stored hash equal to the freshly fetched one. */
const allUnchanged = async (hashes: Record<string, string>): Promise<boolean> => {
  const stored = await CatalogSyncStateService.getHashes(Object.keys(hashes))
  return Object.entries(hashes).every(([source, hash]) => stored.get(source) === hash)
}

// A single in-process lock for every catalog scrape trigger (boot, cron, manual
// POST): overlapping runs would race on the same insert-only reconcile (ADR-0016).
let scrapeInFlight = false

const exclusive = async <T>(label: string, run: () => Promise<T>, onBusy: () => T): Promise<T> => {
  if (scrapeInFlight) {
    logger.warn(`[scraperService] ${label}: a catalog scrape is already running, skipping this trigger`)
    return onBusy()
  }
  scrapeInFlight = true
  try {
    return await run()
  } finally {
    scrapeInFlight = false
  }
}

const errorDetail = (err: unknown): string => {
  const message = err instanceof Error ? err.message : String(err)
  // Structured operator-review payload for conflicts (ADR-0007) / orphans.
  if (err instanceof ScrapeConflictError)
    return JSON.stringify({ conflicts: err.conflicts.slice(0, 50), total: err.conflicts.length })
  if (err instanceof OrphanedTalismanSkillError)
    return JSON.stringify({ orphanedSkillIds: err.skillIds })
  return message
}

/**
 * Armor / decoration / skill / weapon ingestion (ADR-0007/0013): fetch +
 * transform, delegate insert-only persistence to the catalog domain, then
 * rebuild the set-search index.
 */
const scrapeEquipment = async (jobName: string, skipUnchanged: boolean): Promise<EquipmentResult> => {
  try {
    const { lists, hashes } = await fetchEquipmentPayloads()
    if (skipUnchanged && (await allUnchanged(hashes))) {
      logger.info("[scraperService] Equipment payloads unchanged since last sync, skipping reconcile")
      await JobLogService.log(jobName, "SUCCESS", JSON.stringify({ unchanged: true }))
      return { ...noEquipment, equipmentUnchanged: true }
    }

    const seedData = buildSeedData(lists)
    const transformed = transformSeedData(seedData)

    const ingestResult = await CatalogIngestionService.reconcileAndPersist(transformed)
    const result = {
      armorCount: ingestResult.armorCount,
      skillCount: ingestResult.skillCount,
      decoCount: ingestResult.decoCount,
      weaponCount: ingestResult.weaponCount,
    }

    logger.info(
      `[scraperService] Success (insert-only): +${ingestResult.skillCount} skills, +${ingestResult.bonusCount} bonuses, +${ingestResult.armorCount} armor, +${ingestResult.decoCount} decorations, +${ingestResult.weaponCount} weapons`,
    )
    await JobLogService.log(jobName, "SUCCESS", JSON.stringify({ inserted: result }))
    await recordHashes(hashes)

    try {
      await refresh()
      logger.info("[scraperService] Search index rebuilt successfully")
    } catch (indexErr) {
      logger.warn("[scraperService] Failed to rebuild search index (non-fatal):", { indexErr })
    }

    return result
  } catch (err) {
    logger.error(`[scraperService] Failed: ${err instanceof Error ? err.message : String(err)}`, { err })
    try {
      await JobLogService.log(jobName, "FAILED", errorDetail(err))
    } catch {
      // ignore logging failure
    }
    throw err
  }
}

/**
 * Monster ingestion (ADR-0015): replace-on-change, in its own transaction and
 * job log entry so it is independent of the equipment scrape above.
 */
const scrapeMonstersUnlocked = async (
  source: string,
  skipUnchanged: boolean,
): Promise<MonsterResult> => {
  const jobName = `scraper:${source}:monsters`
  try {
    const { data: list, hash } = await fetchJson<MhdbMonster[]>(`${BASE_URL}/monsters`)
    if (skipUnchanged && (await allUnchanged({ [MONSTERS_SYNC_KEY]: hash }))) {
      logger.info("[scraperService] Monster payload unchanged since last sync, skipping reconcile")
      await JobLogService.log(jobName, "SUCCESS", JSON.stringify({ unchanged: true }))
      return { ...noMonsters, monstersUnchanged: true }
    }
    const records = mapMhdbMonsters(list)
    if (records.length === 0) throw new Error("Monster feed returned no large monsters")
    const r = await MonsterIngestionService.reconcileAndPersist(records)
    logger.info(
      `[scraperService] Monsters: +${r.inserted} new, ${r.updated} updated, ${r.unchanged} unchanged`,
    )
    await JobLogService.log(jobName, "SUCCESS", JSON.stringify(r))
    await recordHashes({ [MONSTERS_SYNC_KEY]: hash })
    return { monsterInsertedCount: r.inserted, monsterUpdatedCount: r.updated }
  } catch (err) {
    logger.error(`[scraperService] Monster scrape failed: ${err instanceof Error ? err.message : String(err)}`, { err })
    try {
      await JobLogService.log(jobName, "FAILED", errorDetail(err))
    } catch {
      // ignore logging failure
    }
    throw err
  }
}

/** Hash bookkeeping must never turn a committed sync into a failure; worst case the next run re-reconciles. */
const recordHashes = async (hashes: Record<string, string>): Promise<void> => {
  try {
    await CatalogSyncStateService.recordHashes(hashes)
  } catch (err) {
    logger.warn("[scraperService] Failed to record sync hashes (non-fatal):", { err })
  }
}

const skippedBusy = (source: string) => {
  JobLogService.log(`scraper:${source}`, "SKIPPED", "another catalog scrape was already running").catch(() => {})
}

/** Lock-guarded monster-only scrape (boot seeding of pre-monster catalogs). */
export const scrapeMonsters = (source: string = "manual"): Promise<MonsterResult> =>
  exclusive(
    "monsters",
    () => scrapeMonstersUnlocked(source, false),
    () => {
      skippedBusy(source)
      return { ...noMonsters, skipped: true }
    },
  )

/**
 * Public scraper entry point (boot seed, manual POST, scheduled refresh). Runs
 * the equipment scrape and the monster scrape independently: a failure (e.g. an
 * ADR-0007 conflict) in one never prevents the other from being applied. The
 * first failure is rethrown after both have run. Only one scrape runs at a
 * time per process; a concurrent trigger returns `{ skipped: true }`.
 */
export async function runScraper(options: ScraperOptions = {}): Promise<ScraperResult> {
  const source = options.source ?? "manual"
  const skipUnchanged = options.skipUnchanged ?? false

  return exclusive(
    "runScraper",
    async () => {
      logger.info(`[scraperService] Starting scraper (source: ${source})`)

      const [equipment, monsters] = await Promise.allSettled([
        scrapeEquipment(`scraper:${source}`, skipUnchanged),
        scrapeMonstersUnlocked(source, skipUnchanged),
      ])
      if (equipment.status === "rejected") throw equipment.reason
      if (monsters.status === "rejected") throw monsters.reason
      return { ...equipment.value, ...monsters.value }
    },
    () => {
      skippedBusy(source)
      return { ...noEquipment, ...noMonsters, skipped: true }
    },
  )
}
