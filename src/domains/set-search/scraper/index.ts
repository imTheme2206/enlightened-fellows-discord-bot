import { CatalogIngestionService } from "../../mh-wilds-catalog/ingestion/service"
import { OrphanedTalismanSkillError, ScrapeConflictError } from "../../mh-wilds-catalog/ingestion/errors"
import { deKira } from "../../mh-wilds-catalog/ingestion/names"
import { mapMhdbWeapons } from "../../mh-wilds-catalog/ingestion/weapons"
import { mapMhdbMonsters } from "../../mh-wilds-catalog/ingestion/monsters"
import { MonsterIngestionService } from "../../mh-wilds-catalog/ingestion/monster-service"
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

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  return res.json() as Promise<T>
}

/**
 * Set-search-agnostic fetch + transform of the upstream wilds.mhdb.io feed.
 * Ownership: this stays in `set-search/scraper` because it is the only module
 * that speaks the MHDB wire format; persistence and reconciliation belong to
 * the MH Wilds Catalog domain (ADR-0009) and are delegated to
 * `CatalogIngestionService`.
 */
async function fetchSeedData() {
  const [armorList, skillList, armorSetList, charmList, decorationList, weaponList] =
    await Promise.all([
      fetchJson<MhdbArmorPiece[]>(`${BASE_URL}/armor`),
      fetchJson<MhdbSkill[]>(`${BASE_URL}/skills`),
      fetchJson<MhdbArmorSet[]>(`${BASE_URL}/armor/sets`),
      fetchJson<MhdbCharmGroup[]>(`${BASE_URL}/charms`),
      fetchJson<MhdbDecoration[]>(`${BASE_URL}/decorations`),
      fetchJson<MhdbWeapon[]>(`${BASE_URL}/weapons`),
    ])

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
}

type EquipmentResult = Pick<ScraperResult, "armorCount" | "skillCount" | "decoCount" | "weaponCount">
type MonsterResult = Pick<ScraperResult, "monsterInsertedCount" | "monsterUpdatedCount">

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
const scrapeEquipment = async (jobName: string): Promise<EquipmentResult> => {
  try {
    const seedData = await fetchSeedData()
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
export const scrapeMonsters = async (source: string = "manual"): Promise<MonsterResult> => {
  const jobName = `scraper:${source}:monsters`
  try {
    const list = await fetchJson<MhdbMonster[]>(`${BASE_URL}/monsters`)
    const records = mapMhdbMonsters(list)
    if (records.length === 0) throw new Error("Monster feed returned no large monsters")
    const r = await MonsterIngestionService.reconcileAndPersist(records)
    logger.info(
      `[scraperService] Monsters: +${r.inserted} new, ${r.updated} updated, ${r.unchanged} unchanged`,
    )
    await JobLogService.log(jobName, "SUCCESS", JSON.stringify(r))
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

/**
 * Public scraper entry point (called by `db-init.ts`). Runs the equipment
 * scrape and the monster scrape independently: a failure (e.g. an ADR-0007
 * conflict) in one never prevents the other from being applied. The first
 * failure is rethrown after both have run.
 */
export async function runScraper(
  options: { source?: "cron" | "manual" | "boot" } = {},
): Promise<ScraperResult> {
  const source = options.source ?? "manual"

  logger.info(`[scraperService] Starting scraper (source: ${source})`)

  const [equipment, monsters] = await Promise.allSettled([
    scrapeEquipment(`scraper:${source}`),
    scrapeMonsters(source),
  ])
  if (equipment.status === "rejected") throw equipment.reason
  if (monsters.status === "rejected") throw monsters.reason
  return { ...equipment.value, ...monsters.value }
}
