import { and, asc, eq, inArray, notInArray } from 'drizzle-orm'
import { db } from '../../infra/db/client'
import { bonus, bonusThreshold, decoration, decorationSkill, skill } from '../../infra/db/schema'

const EXCLUDE_SLOT_1_SKILLS = [
  'Survival Expert',
  'Jump Master',
  'Leap of Faith',
  'Cliffhanger',
  'Botanist',
  'Geologist',
  'Entomologist',
  'Outdoorsman',
  'Palico Rally',
  'Self-Improvement',
  'Fire Resistance',
  'Water Resistance',
  'Thunder Resistance',
  'Ice Resistance',
  'Dragon Resistance',
  'Hunger Resistance',
  'Bombardier',
  'Blindsider',
  'Iron Skin',
  'Flinch Free',
  'Blast Resistance',
  'Grillmaster',
  'Poison Resistance',
  'Paralysis Resistance',
]

/** A regular skill grantable by a decoration, domain-shaped (no Discord label/value). */
export type WeaponSkillOption = {
  name: string
}

export type ArmorSkillOption = {
  name: string
}

export type SetSkillData = {
  name: string
  effectName: string | null
  maxLevel: number
}

/** A Group Bonus option, domain-shaped (no Discord label/description/value). */
export type GroupSkillData = {
  name: string
  effectName: string | null
}

export const loadWeaponSkills: () => Promise<WeaponSkillOption[]> = async () => {
  const rows = await db
    .selectDistinct({ name: skill.name })
    .from(decoration)
    .innerJoin(decorationSkill, eq(decorationSkill.decorationId, decoration.id))
    .innerJoin(skill, eq(decorationSkill.skillId, skill.id))
    .where(eq(decoration.type, 'weapon'))
    .orderBy(asc(skill.name))

  return rows.map((r) => ({ name: r.name }))
}

export async function loadArmorSkills(slot: 1 | 2 | 3): Promise<ArmorSkillOption[]> {
  const rows = await db
    .selectDistinct({ name: skill.name })
    .from(decoration)
    .innerJoin(decorationSkill, eq(decorationSkill.decorationId, decoration.id))
    .innerJoin(skill, eq(decorationSkill.skillId, skill.id))
    .where(and(eq(decoration.type, 'armor'), eq(decoration.slotSize, slot), notInArray(skill.name, EXCLUDE_SLOT_1_SKILLS)))
    .orderBy(asc(skill.name))

  return rows.map((r) => ({ name: r.name }))
}

/**
 * Set Bonus options for the search UI. `effectName` is the granted effect and
 * `maxLevel` is the number of activation tiers (highest threshold `level`),
 * both folded from the bonus's ordered `bonusThreshold` rows (ADR-0011).
 */
export async function loadSetSkillOptions(): Promise<SetSkillData[]> {
  const rows = await db
    .select({ name: bonus.name, effectName: bonusThreshold.effectName, level: bonusThreshold.level })
    .from(bonus)
    .leftJoin(bonusThreshold, eq(bonusThreshold.bonusId, bonus.id))
    .where(eq(bonus.kind, 'set'))
    .orderBy(asc(bonus.name))

  const byName = new Map<string, SetSkillData>()
  for (const r of rows) {
    const existing = byName.get(r.name)
    if (!existing) {
      byName.set(r.name, { name: r.name, effectName: r.effectName ?? null, maxLevel: r.level ?? 1 })
    } else {
      if (r.level && r.level > existing.maxLevel) existing.maxLevel = r.level
      if (!existing.effectName && r.effectName) existing.effectName = r.effectName
    }
  }
  return Array.from(byName.values())
}

export async function loadGroupSkillOptions(): Promise<GroupSkillData[]> {
  const rows = await db
    .select({ name: bonus.name, effectName: bonusThreshold.effectName })
    .from(bonus)
    .leftJoin(bonusThreshold, eq(bonusThreshold.bonusId, bonus.id))
    .where(eq(bonus.kind, 'group'))
    .orderBy(asc(bonus.name))

  const byName = new Map<string, string | null>()
  for (const r of rows) {
    if (!byName.has(r.name)) byName.set(r.name, r.effectName ?? null)
  }
  return Array.from(byName.entries()).map(([name, effectName]) => ({ name, effectName }))
}

export async function getSkillMaxLevels(names: string[]): Promise<Map<string, number>> {
  if (names.length === 0) return new Map()
  const rows = await db.select({ name: skill.name, maxLevel: skill.maxLevel }).from(skill).where(inArray(skill.name, names))
  return new Map(rows.map((r) => [r.name, r.maxLevel]))
}
