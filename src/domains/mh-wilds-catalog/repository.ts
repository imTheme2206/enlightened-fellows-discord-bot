import { asc, eq } from 'drizzle-orm'
import { db } from '../../infra/db/client'
import { armor, armorBonus, armorSkill, bonus, bonusThreshold, decoration, decorationSkill, skill, weapon, weaponSkill } from '../../infra/db/schema'
import type { CatalogIndexProjection } from './projection'
import type { ArmorCatalogItem, DecorationCatalogItem, SkillCatalogResponse, WeaponCatalogItem, WeaponCatalogQuery } from './schema'
import { transcendSlots } from './transcend'

/**
 * All catalog reads live here (ADR-0009): armor, decorations, ordinary skills,
 * and set/group bonuses. Nested grant/membership/threshold collections are
 * assembled in memory from the normalized rows. All items are currently active
 * (retirement is an operator-controlled future concern), so no active filter is
 * applied yet.
 */
export abstract class CatalogRepository {
  static async findArmorCatalog(): Promise<ArmorCatalogItem[]> {
    const armorRows = await db.select().from(armor).orderBy(asc(armor.name))
    const skillRows = await db
      .select({ armorId: armorSkill.armorId, skillId: skill.id, name: skill.name, level: armorSkill.level })
      .from(armorSkill)
      .innerJoin(skill, eq(armorSkill.skillId, skill.id))
    const bonusRows = await db
      .select({ armorId: armorBonus.armorId, bonusId: bonus.id, name: bonus.name, kind: bonus.kind })
      .from(armorBonus)
      .innerJoin(bonus, eq(armorBonus.bonusId, bonus.id))

    const skillsByArmor = new Map<string, ArmorCatalogItem['skills']>()
    for (const r of skillRows) {
      const list = skillsByArmor.get(r.armorId) ?? []
      list.push({ skillId: r.skillId, name: r.name, level: r.level })
      skillsByArmor.set(r.armorId, list)
    }
    const bonusesByArmor = new Map<string, ArmorCatalogItem['bonuses']>()
    for (const r of bonusRows) {
      const list = bonusesByArmor.get(r.armorId) ?? []
      list.push({ bonusId: r.bonusId, name: r.name, kind: r.kind as 'set' | 'group' })
      bonusesByArmor.set(r.armorId, list)
    }

    return armorRows.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type as ArmorCatalogItem['type'],
      rank: a.rank,
      rarity: a.rarity,
      defense: a.defense,
      resistances: { fire: a.fireRes, water: a.waterRes, thunder: a.thunderRes, ice: a.iceRes, dragon: a.dragonRes },
      // Endgame builds always assume a transcended piece: the /armors catalog reports
      // transcended slots (base stays canonical in the DB). Mirrors the set-search index,
      // which transcends at build-index.ts. NOTE: getIndexProjection() must keep base
      // slots — build-index transcends there, so transcending here too would double-apply.
      slots: transcendSlots(a.slots as number[], a.rarity),
      skills: skillsByArmor.get(a.id) ?? [],
      bonuses: bonusesByArmor.get(a.id) ?? [],
    }))
  }

  static async findDecorationCatalog(): Promise<DecorationCatalogItem[]> {
    const decoRows = await db.select().from(decoration).orderBy(asc(decoration.name))
    const grantRows = await db
      .select({ decorationId: decorationSkill.decorationId, skillId: skill.id, name: skill.name, level: decorationSkill.level })
      .from(decorationSkill)
      .innerJoin(skill, eq(decorationSkill.skillId, skill.id))

    const skillsByDeco = new Map<string, DecorationCatalogItem['skills']>()
    for (const r of grantRows) {
      const list = skillsByDeco.get(r.decorationId) ?? []
      list.push({ skillId: r.skillId, name: r.name, level: r.level })
      skillsByDeco.set(r.decorationId, list)
    }

    return decoRows.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type as DecorationCatalogItem['type'],
      slotSize: d.slotSize,
      skills: skillsByDeco.get(d.id) ?? [],
    }))
  }

  static async findWeaponCatalog(filter: WeaponCatalogQuery = {}): Promise<WeaponCatalogItem[]> {
    const weaponRows = await db
      .select()
      .from(weapon)
      .where(filter.kind ? eq(weapon.kind, filter.kind) : undefined)
      .orderBy(asc(weapon.kind), asc(weapon.rarity), asc(weapon.name))
    const grantRows = await db
      .select({ weaponId: weaponSkill.weaponId, skillId: skill.id, name: skill.name, level: weaponSkill.level })
      .from(weaponSkill)
      .innerJoin(skill, eq(weaponSkill.skillId, skill.id))

    const skillsByWeapon = new Map<string, WeaponCatalogItem['skills']>()
    for (const r of grantRows) {
      const list = skillsByWeapon.get(r.weaponId) ?? []
      list.push({ skillId: r.skillId, name: r.name, level: r.level })
      skillsByWeapon.set(r.weaponId, list)
    }

    return weaponRows.map((w) => ({
      id: w.id,
      name: w.name,
      kind: w.kind as WeaponCatalogItem['kind'],
      rarity: w.rarity,
      damage: { raw: w.raw, display: w.display },
      affinity: w.affinity,
      specials: w.specials,
      sharpness: w.sharpness,
      handicraft: w.handicraft,
      slots: w.slots,
      skills: skillsByWeapon.get(w.id) ?? [],
      elderseal: w.elderseal,
      defenseBonus: w.defenseBonus,
      series: w.series,
      kindSpecific: w.kindSpecific,
    }))
  }

  static async findSkillsAndBonuses(): Promise<SkillCatalogResponse> {
    const skillRows = await db
      .select({ id: skill.id, name: skill.name, kind: skill.type, maxLevel: skill.maxLevel, icon: skill.icon })
      .from(skill)
      .orderBy(asc(skill.name))
    const bonusRows = await db.select().from(bonus).orderBy(asc(bonus.name))
    const thresholdRows = await db
      .select({ bonusId: bonusThreshold.bonusId, piecesRequired: bonusThreshold.piecesRequired, effectName: bonusThreshold.effectName, level: bonusThreshold.level })
      .from(bonusThreshold)

    const thresholdsByBonus = new Map<string, SkillCatalogResponse['bonuses'][number]['thresholds']>()
    for (const r of thresholdRows) {
      const list = thresholdsByBonus.get(r.bonusId) ?? []
      list.push({ piecesRequired: r.piecesRequired, effectName: r.effectName, level: r.level })
      thresholdsByBonus.set(r.bonusId, list)
    }

    return {
      skills: skillRows.map((s) => ({ id: s.id, name: s.name, kind: s.kind as 'armor' | 'weapon', maxLevel: s.maxLevel, icon: s.icon })),
      bonuses: bonusRows.map((b) => ({
        id: b.id,
        name: b.name,
        kind: b.kind as 'set' | 'group',
        icon: b.icon,
        thresholds: (thresholdsByBonus.get(b.id) ?? []).sort((a, c) => a.piecesRequired - c.piecesRequired),
      })),
    }
  }

  /**
   * The fully-joined dataset consumers build an in-memory index from (today,
   * only `set-search/build-index.ts`). Keeps Drizzle joins and table types
   * inside the catalog domain — callers receive plain catalog-shaped rows.
   */
  static async findIndexProjection(): Promise<CatalogIndexProjection> {
    const skillRows = await db.select({ name: skill.name, maxLevel: skill.maxLevel }).from(skill)
    const bonusThresholdRows = await db
      .select({
        bonusName: bonus.name,
        kind: bonus.kind,
        piecesRequired: bonusThreshold.piecesRequired,
        effectName: bonusThreshold.effectName,
        level: bonusThreshold.level,
      })
      .from(bonusThreshold)
      .innerJoin(bonus, eq(bonusThreshold.bonusId, bonus.id))
    const decorationGrantRows = await db
      .select({ decorationName: decoration.name, slotSize: decoration.slotSize, skillName: skill.name, level: decorationSkill.level })
      .from(decorationSkill)
      .innerJoin(decoration, eq(decorationSkill.decorationId, decoration.id))
      .innerJoin(skill, eq(decorationSkill.skillId, skill.id))
    const armorRows = await db.select().from(armor)
    const armorSkillRows = await db
      .select({ armorName: armor.name, skillName: skill.name, level: armorSkill.level })
      .from(armorSkill)
      .innerJoin(armor, eq(armorSkill.armorId, armor.id))
      .innerJoin(skill, eq(armorSkill.skillId, skill.id))
    const armorBonusRows = await db
      .select({ armorName: armor.name, bonusName: bonus.name, kind: bonus.kind })
      .from(armorBonus)
      .innerJoin(armor, eq(armorBonus.armorId, armor.id))
      .innerJoin(bonus, eq(armorBonus.bonusId, bonus.id))

    return {
      skills: skillRows,
      bonusThresholds: bonusThresholdRows.map((r) => ({ ...r, kind: r.kind as 'set' | 'group' })),
      decorationGrants: decorationGrantRows,
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
      armorBonuses: armorBonusRows.map((r) => ({ ...r, kind: r.kind as 'set' | 'group' })),
    }
  }
}
