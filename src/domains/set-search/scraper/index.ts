import { randomUUID } from "crypto"
import { eq, inArray } from "drizzle-orm"
import { db } from "../../../infra/db/client"
import {
  armor,
  armorBonus,
  armorSkill,
  bonus,
  bonusThreshold,
  customTalisman,
  decoration,
  decorationSkill,
  skill,
} from "../../../infra/db/schema"
import logger from "../../../infra/logger"
import { JobLogService } from "../../job-logs/service"
import { initSearchIndex } from "../service"
import type {
  MhdbArmorPiece,
  MhdbArmorSet,
  MhdbCharmGroup,
  MhdbDecoration,
  MhdbSkill,
} from "./mhdb-types"
import { reconcileCatalog, type Conflict, type ExistingCatalog } from "./reconcile"
import { SeedDataSchema, transformSeedData } from "./transform"

/** Raised when a scrape's values conflict with an existing catalog identity. */
export class ScrapeConflictError extends Error {
  constructor(readonly conflicts: Conflict[]) {
    super(`Scrape rejected: ${conflicts.length} conflict(s) with existing catalog identities`)
    this.name = "ScrapeConflictError"
  }
}

/** Raised when a custom talisman references a skill absent from the catalog. */
export class OrphanedTalismanSkillError extends Error {
  constructor(readonly skillIds: string[]) {
    super(`Custom talisman(s) reference ${skillIds.length} skill id(s) not in the catalog; manual repair required`)
    this.name = "OrphanedTalismanSkillError"
  }
}

const BASE_URL = "https://wilds.mhdb.io/en"

function deKira(name: string): string {
  return name
    .replace(/α/g, "Alpha")
    .replace(/β/g, "Beta")
    .replace(/γ/g, "Gamma")
    .replace(/"/g, "'")
    .replace(/G\. /g, "G ")
}

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

async function fetchSeedData() {
  const [armorList, skillList, armorSetList, charmList, decorationList] =
    await Promise.all([
      fetchJson<MhdbArmorPiece[]>(`${BASE_URL}/armor`),
      fetchJson<MhdbSkill[]>(`${BASE_URL}/skills`),
      fetchJson<MhdbArmorSet[]>(`${BASE_URL}/armor/sets`),
      fetchJson<MhdbCharmGroup[]>(`${BASE_URL}/charms`),
      fetchJson<MhdbDecoration[]>(`${BASE_URL}/decorations`),
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
}

/**
 * ADR-0007 step 1: every Custom Talisman skill reference must resolve to a
 * catalog skill before a scrape proceeds. In the stable model skill UUIDs never
 * change, so this can only fail if the catalog is already corrupt — in which
 * case we refuse to scrape until an operator repairs the orphaned references.
 */
async function assertCustomTalismanIntegrity(): Promise<void> {
  const talismans = await db.select({ skills: customTalisman.skills }).from(customTalisman)
  const referenced = [...new Set(talismans.flatMap((t) => t.skills.map((s) => s.skillId)))]
  if (referenced.length === 0) return

  const found = await db.select({ id: skill.id }).from(skill).where(inArray(skill.id, referenced))
  const foundIds = new Set(found.map((r) => r.id))
  const orphans = referenced.filter((id) => !foundIds.has(id))
  if (orphans.length > 0) throw new OrphanedTalismanSkillError(orphans)
}

/** Loads the full catalog keyed by name, plus name→UUID maps for FK resolution. */
async function loadExistingCatalog(): Promise<{
  catalog: ExistingCatalog
  ids: {
    skill: Map<string, string>
    bonus: Map<string, string>
    armor: Map<string, string>
    decoration: Map<string, string>
  }
}> {
  const skillRows = await db.select().from(skill)
  const bonusRows = await db.select().from(bonus)
  const armorRows = await db.select().from(armor)
  const decoRows = await db.select().from(decoration)

  const bonusThresholdRows = await db
    .select({ bonusName: bonus.name, piecesRequired: bonusThreshold.piecesRequired, effectName: bonusThreshold.effectName, level: bonusThreshold.level })
    .from(bonusThreshold)
    .innerJoin(bonus, eq(bonusThreshold.bonusId, bonus.id))
  const armorSkillRows = await db
    .select({ armorName: armor.name, skillName: skill.name, level: armorSkill.level })
    .from(armorSkill)
    .innerJoin(armor, eq(armorSkill.armorId, armor.id))
    .innerJoin(skill, eq(armorSkill.skillId, skill.id))
  const armorBonusRows = await db
    .select({ armorName: armor.name, bonusName: bonus.name })
    .from(armorBonus)
    .innerJoin(armor, eq(armorBonus.armorId, armor.id))
    .innerJoin(bonus, eq(armorBonus.bonusId, bonus.id))
  const decorationSkillRows = await db
    .select({ decorationName: decoration.name, skillName: skill.name, level: decorationSkill.level })
    .from(decorationSkill)
    .innerJoin(decoration, eq(decorationSkill.decorationId, decoration.id))
    .innerJoin(skill, eq(decorationSkill.skillId, skill.id))

  return {
    catalog: {
      skills: skillRows.map((s) => ({ name: s.name, cleanName: s.cleanName, type: s.type, maxLevel: s.maxLevel, icon: s.icon })),
      bonuses: bonusRows.map((b) => ({ name: b.name, cleanName: b.cleanName, kind: b.kind, icon: b.icon })),
      bonusThresholds: bonusThresholdRows,
      armor: armorRows.map((a) => ({
        name: a.name,
        type: a.type,
        rank: a.rank,
        rarity: a.rarity,
        defense: a.defense,
        fireRes: a.fireRes,
        waterRes: a.waterRes,
        thunderRes: a.thunderRes,
        iceRes: a.iceRes,
        dragonRes: a.dragonRes,
        slots: a.slots as number[],
      })),
      armorSkills: armorSkillRows,
      armorBonuses: armorBonusRows,
      decorations: decoRows.map((d) => ({ name: d.name, type: d.type, slotSize: d.slotSize })),
      decorationSkills: decorationSkillRows,
    },
    ids: {
      skill: new Map(skillRows.map((s) => [s.name, s.id])),
      bonus: new Map(bonusRows.map((b) => [b.name, b.id])),
      armor: new Map(armorRows.map((a) => [a.name, a.id])),
      decoration: new Map(decoRows.map((d) => [d.name, d.id])),
    },
  }
}

export async function runScraper(
  options: { source?: "cron" | "manual" | "boot" } = {},
): Promise<ScraperResult> {
  const source = options.source ?? "manual"
  const jobName = `scraper:${source}`

  logger.info(`[scraperService] Starting scraper (source: ${source})`)

  let result: ScraperResult = { armorCount: 0, skillCount: 0, decoCount: 0 }

  try {
    await assertCustomTalismanIntegrity()

    const seedData = await fetchSeedData()
    const transformed = transformSeedData(seedData)

    const { catalog, ids } = await loadExistingCatalog()
    const plan = reconcileCatalog(catalog, transformed)

    // ADR-0007 step 5: any conflict with an existing identity rejects the whole
    // scrape — nothing is inserted, and it is logged for operator review.
    if (plan.conflicts.length > 0) throw new ScrapeConflictError(plan.conflicts)

    // Insert-only: assign new UUIDs to new identities; existing identities keep
    // theirs. FK maps merge existing + newly-inserted names so children resolve.
    await db.transaction(async (tx) => {
      const skillId = new Map(ids.skill)
      for (const s of plan.skills) skillId.set(s.name, randomUUID())
      if (plan.skills.length)
        await tx.insert(skill).values(
          plan.skills.map((s) => ({ id: skillId.get(s.name)!, name: s.name, cleanName: s.cleanName, type: s.type, maxLevel: s.maxLevel, icon: s.icon ?? null })),
        )

      const bonusId = new Map(ids.bonus)
      for (const b of plan.bonuses) bonusId.set(b.name, randomUUID())
      if (plan.bonuses.length)
        await tx.insert(bonus).values(
          plan.bonuses.map((b) => ({ id: bonusId.get(b.name)!, name: b.name, cleanName: b.cleanName, kind: b.kind, icon: b.icon ?? null })),
        )
      if (plan.bonusThresholds.length)
        await tx.insert(bonusThreshold).values(
          plan.bonusThresholds.map((t) => ({ bonusId: bonusId.get(t.bonusName)!, piecesRequired: t.piecesRequired, effectName: t.effectName, level: t.level })),
        )

      const armorId = new Map(ids.armor)
      for (const a of plan.armor) armorId.set(a.name, randomUUID())
      if (plan.armor.length)
        await tx.insert(armor).values(
          plan.armor.map((a) => ({
            id: armorId.get(a.name)!,
            name: a.name,
            type: a.type,
            rank: a.rank,
            rarity: a.rarity,
            defense: a.defense,
            fireRes: a.fireRes,
            waterRes: a.waterRes,
            thunderRes: a.thunderRes,
            iceRes: a.iceRes,
            dragonRes: a.dragonRes,
            slots: a.slots,
          })),
        )
      if (plan.armorRegularSkills.length)
        await tx.insert(armorSkill).values(
          plan.armorRegularSkills.map((l) => ({ armorId: armorId.get(l.armorName)!, skillId: skillId.get(l.skillName)!, level: l.level })),
        )
      // Dedupe defensively — a piece may list a bonus more than once.
      const seenArmorBonus = new Set<string>()
      const armorBonusRows = plan.armorBonuses.flatMap((l) => {
        const key = `${l.armorName} ${l.bonusName}`
        if (seenArmorBonus.has(key)) return []
        seenArmorBonus.add(key)
        return [{ armorId: armorId.get(l.armorName)!, bonusId: bonusId.get(l.bonusName)! }]
      })
      if (armorBonusRows.length) await tx.insert(armorBonus).values(armorBonusRows)

      const decoId = new Map(ids.decoration)
      for (const d of plan.decorations) decoId.set(d.name, randomUUID())
      if (plan.decorations.length)
        await tx.insert(decoration).values(
          plan.decorations.map((d) => ({ id: decoId.get(d.name)!, name: d.name, type: d.type, slotSize: d.slotSize })),
        )
      if (plan.decorationSkills.length)
        await tx.insert(decorationSkill).values(
          plan.decorationSkills.map((l) => ({ decorationId: decoId.get(l.decorationName)!, skillId: skillId.get(l.skillName)!, level: l.level })),
        )
    })

    result = { armorCount: plan.armor.length, skillCount: plan.skills.length, decoCount: plan.decorations.length }

    logger.info(
      `[scraperService] Success (insert-only): +${plan.skills.length} skills, +${plan.bonuses.length} bonuses, +${plan.armor.length} armor, +${plan.decorations.length} decorations; unchanged ${plan.unchanged.skills} skills / ${plan.unchanged.bonuses} bonuses / ${plan.unchanged.armor} armor / ${plan.unchanged.decorations} decorations`,
    )
    await JobLogService.log(jobName, "SUCCESS", JSON.stringify({ inserted: result, unchanged: plan.unchanged }))

    try {
      await initSearchIndex()
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
