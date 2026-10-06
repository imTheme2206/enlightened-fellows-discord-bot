import { CatalogIngestionService } from "../../mh-wilds-catalog/ingestion/service"
import { OrphanedTalismanSkillError, ScrapeConflictError } from "../../mh-wilds-catalog/ingestion/errors"
import { deKira } from "../../mh-wilds-catalog/ingestion/names"
import { mapMhdbWeapons } from "../../mh-wilds-catalog/ingestion/weapons"
import { SeedDataSchema, transformSeedData } from "../../mh-wilds-catalog/ingestion/transform"
import logger from "../../../infra/logger"
import { JobLogService } from "../../job-logs/service"
import { refresh } from "../runtime"
import type {
  MhdbArmorPiece,
  MhdbArmorSet,
  MhdbCharmGroup,
  MhdbDecoration,
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
}

/**
 * Public scraper entry point (called by `db-init.ts`). Fetches + transforms
 * the upstream feed (set-search-agnostic), delegates reconciliation and
 * insert-only persistence to the MH Wilds Catalog domain, then triggers the
 * set-search index rebuild.
 */
export async function runScraper(
  options: { source?: "cron" | "manual" | "boot" } = {},
): Promise<ScraperResult> {
  const source = options.source ?? "manual"
  const jobName = `scraper:${source}`

  logger.info(`[scraperService] Starting scraper (source: ${source})`)

  let result: ScraperResult = { armorCount: 0, skillCount: 0, decoCount: 0, weaponCount: 0 }

  try {
    const seedData = await fetchSeedData()
    const transformed = transformSeedData(seedData)

    const ingestResult = await CatalogIngestionService.reconcileAndPersist(transformed)
    result = { armorCount: ingestResult.armorCount, skillCount: ingestResult.skillCount, decoCount: ingestResult.decoCount, weaponCount: ingestResult.weaponCount }

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
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[scraperService] Failed: ${message}`, { err })
    try {
      // Structured operator-review payload for conflicts (ADR-0007) / orphans.
      const detail =
        err instanceof ScrapeConflictError
          ? JSON.stringify({ conflicts: err.conflicts.slice(0, 50), total: err.conflicts.length })
          : err instanceof OrphanedTalismanSkillError
            ? JSON.stringify({ orphanedSkillIds: err.skillIds })
            : message
      await JobLogService.log(jobName, "FAILED", detail)
    } catch {
      // ignore logging failure
    }
    throw err
  }
}
