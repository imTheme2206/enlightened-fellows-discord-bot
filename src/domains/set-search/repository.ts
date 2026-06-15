import { and, asc, eq, inArray, notInArray } from 'drizzle-orm'
import { db } from '../../infra/db/client'
import { decoration, skill } from '../../infra/db/schema'

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

type SkillOption = {
  label: string
  value: string
}

export type SetSkillData = {
  name: string
  effectName: string | null
  maxLevel: number
}

type GroupSkillOption = {
  label: string
  description: string
  value: string
}

export const loadWeaponSkills: () => Promise<SkillOption[]> = async () => {
  const rows = await db
    .selectDistinct({ name: skill.name })
    .from(decoration)
    .innerJoin(skill, eq(decoration.skillId, skill.id))
    .where(eq(decoration.type, 'weapon'))
    .orderBy(asc(skill.name))

  return rows.map((r) => ({ label: r.name, value: r.name }))
}

export async function loadArmorSkills(slot: 1 | 2 | 3): Promise<SkillOption[]> {
  const rows = await db
    .selectDistinct({ name: skill.name })
    .from(decoration)
    .innerJoin(skill, eq(decoration.skillId, skill.id))
    .where(and(eq(decoration.type, 'armor'), eq(decoration.slotSize, slot), notInArray(skill.name, EXCLUDE_SLOT_1_SKILLS)))
    .orderBy(asc(skill.name))

  return rows.map((r) => ({ label: r.name, value: r.name }))
}

export async function loadSetSkillOptions(): Promise<SetSkillData[]> {
  const rows = await db
    .select({ name: skill.name, effectName: skill.effectName, maxLevel: skill.maxLevel })
    .from(skill)
    .where(eq(skill.isSetSkill, true))
    .orderBy(asc(skill.name))

  return rows.map((r) => ({ name: r.name, effectName: r.effectName, maxLevel: r.maxLevel }))
}

export async function loadGroupSkillOptions(): Promise<GroupSkillOption[]> {
  const rows = await db
    .select({ name: skill.name, effectName: skill.effectName })
    .from(skill)
    .where(eq(skill.isGroupSkill, true))
    .orderBy(asc(skill.name))

  return rows.map((r) => ({
    label: r.name,
    description: r.effectName ? `→ ${r.effectName}` : r.name,
    value: r.name,
  }))
}

export async function getSkillMaxLevels(names: string[]): Promise<Map<string, number>> {
  if (names.length === 0) return new Map()
  const rows = await db.select({ name: skill.name, maxLevel: skill.maxLevel }).from(skill).where(inArray(skill.name, names))
  return new Map(rows.map((r) => [r.name, r.maxLevel]))
}
