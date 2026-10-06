import { randomUUID } from 'crypto'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../../infra/db/client'
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
  weapon,
  weaponSkill,
} from '../../../infra/db/schema'
import { OrphanedTalismanSkillError, ScrapeConflictError } from './errors'
import { reconcileCatalog, type ExistingCatalog } from './reconcile'
import { weaponKey, type TransformResult, type WeaponInsert } from './transform'

/** Counts of genuinely new identities inserted this run (0 on a no-op scrape). */
export interface IngestResult {
  armorCount: number
  skillCount: number
  decoCount: number
  bonusCount: number
  weaponCount: number
}

/**
 * MH Wilds Catalog ingestion (ADR-0007/ADR-0009): the catalog domain owns
 * scrape reconciliation and insert-only persistence, not `set-search`. Callers
 * (the scraper's fetch+transform step) hand in an already-transformed payload;
 * this module diffs it against the current catalog and applies only new
 * identities inside a single transaction.
 */
export abstract class CatalogIngestionService {
  /**
   * ADR-0007 step 1: every Custom Talisman skill reference must resolve to a
   * catalog skill before a scrape proceeds. In the stable model skill UUIDs
   * never change, so this can only fail if the catalog is already corrupt — in
   * which case ingestion refuses to run until an operator repairs the orphaned
   * references.
   */
  static async assertCustomTalismanIntegrity(): Promise<void> {
    const talismans = await db.select({ skills: customTalisman.skills }).from(customTalisman)
    const referenced = [...new Set(talismans.flatMap((t) => t.skills.map((s) => s.skillId)))]
    if (referenced.length === 0) return

    const found = await db.select({ id: skill.id }).from(skill).where(inArray(skill.id, referenced))
    const foundIds = new Set(found.map((r) => r.id))
    const orphans = referenced.filter((id) => !foundIds.has(id))
    if (orphans.length > 0) throw new OrphanedTalismanSkillError(orphans)
  }

  /** Loads the full catalog keyed by name, plus name→UUID maps for FK resolution. */
  static async loadExistingCatalog(): Promise<{
    catalog: ExistingCatalog
    ids: {
      skill: Map<string, string>
      bonus: Map<string, string>
      armor: Map<string, string>
      decoration: Map<string, string>
      weapon: Map<string, string>
    }
  }> {
    const skillRows = await db.select().from(skill)
    const bonusRows = await db.select().from(bonus)
    const armorRows = await db.select().from(armor)
    const decoRows = await db.select().from(decoration)
    const weaponRows = await db.select().from(weapon)

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

    const weaponSkillRows = await db
      .select({ weaponId: weaponSkill.weaponId, skillName: skill.name, level: weaponSkill.level })
      .from(weaponSkill)
      .innerJoin(skill, eq(weaponSkill.skillId, skill.id))
    const weaponKeyById = new Map(weaponRows.map((w) => [w.id, weaponKey(w)]))

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
        weapons: weaponRows.map(
          (w): WeaponInsert => ({
            gameId: w.gameId,
            name: w.name,
            kind: w.kind,
            rarity: w.rarity,
            raw: w.raw,
            display: w.display,
            affinity: w.affinity,
            specials: w.specials,
            sharpness: w.sharpness,
            handicraft: w.handicraft,
            slots: w.slots,
            elderseal: w.elderseal,
            defenseBonus: w.defenseBonus,
            series: w.series,
            kindSpecific: w.kindSpecific,
          }),
        ),
        weaponSkills: weaponSkillRows.map((r) => ({ weaponKey: weaponKeyById.get(r.weaponId)!, skillName: r.skillName, level: r.level })),
      },
      ids: {
        skill: new Map(skillRows.map((s) => [s.name, s.id])),
        bonus: new Map(bonusRows.map((b) => [b.name, b.id])),
        armor: new Map(armorRows.map((a) => [a.name, a.id])),
        decoration: new Map(decoRows.map((d) => [d.name, d.id])),
        weapon: new Map(weaponRows.map((w) => [weaponKey(w), w.id])),
      },
    }
  }

  /**
   * Reconciles a transformed scrape payload against the current catalog and
   * persists only the new identities in one transaction. Rejects the whole
   * transaction (inserts nothing) if any existing identity conflicts — the
   * caller receives the thrown `ScrapeConflictError` for operator-review
   * logging. Also runs the Custom Talisman integrity guard first (ADR-0007).
   */
  static async reconcileAndPersist(transformed: TransformResult): Promise<IngestResult> {
    await CatalogIngestionService.assertCustomTalismanIntegrity()

    const { catalog, ids } = await CatalogIngestionService.loadExistingCatalog()
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

      const weaponId = new Map(ids.weapon)
      for (const w of plan.weapons) weaponId.set(weaponKey(w), randomUUID())
      // Chunked: 1,000+ rows x 15 columns would exceed Postgres' bind-parameter limit in one statement.
      for (let i = 0; i < plan.weapons.length; i += 200) {
        await tx.insert(weapon).values(plan.weapons.slice(i, i + 200).map((w) => ({ id: weaponId.get(weaponKey(w))!, ...w })))
      }
      const weaponSkillRows = plan.weaponSkills.map((l) => ({ weaponId: weaponId.get(l.weaponKey)!, skillId: skillId.get(l.skillName)!, level: l.level }))
      for (let i = 0; i < weaponSkillRows.length; i += 500) {
        await tx.insert(weaponSkill).values(weaponSkillRows.slice(i, i + 500))
      }
    })

    return {
      armorCount: plan.armor.length,
      skillCount: plan.skills.length,
      decoCount: plan.decorations.length,
      bonusCount: plan.bonuses.length,
      weaponCount: plan.weapons.length,
    }
  }
}
