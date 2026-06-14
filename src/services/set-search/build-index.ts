import { eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { armor, armorGroupSkill, armorSetSkill, armorSkill, decoration, skill } from '../../db/schema'
import type { ArmorPiece, ArmorType, DecorationItem, GroupSkillMeta, SetSearchIndex, SetSkillMeta, SkillMeta } from './types'

export async function buildIndexFromDb(): Promise<SetSearchIndex> {
  const skillRows = await db.select().from(skill)
  const decoRows = await db
    .select({ name: decoration.name, slotSize: decoration.slotSize, skillName: skill.name, skillLevel: decoration.skillLevel })
    .from(decoration)
    .innerJoin(skill, eq(decoration.skillId, skill.id))
  const armorRows = await db.select().from(armor)
  const armorSkillRows = await db
    .select({ armorName: armor.name, skillName: skill.name, level: armorSkill.level })
    .from(armorSkill)
    .innerJoin(armor, eq(armorSkill.armorId, armor.id))
    .innerJoin(skill, eq(armorSkill.skillId, skill.id))
  const armorSetSkillRows = await db
    .select({ armorName: armor.name, skillName: skill.name })
    .from(armorSetSkill)
    .innerJoin(armor, eq(armorSetSkill.armorId, armor.id))
    .innerJoin(skill, eq(armorSetSkill.skillId, skill.id))
  const armorGroupSkillRows = await db
    .select({ armorName: armor.name, skillName: skill.name })
    .from(armorGroupSkill)
    .innerJoin(armor, eq(armorGroupSkill.armorId, armor.id))
    .innerJoin(skill, eq(armorGroupSkill.skillId, skill.id))

  const skills = new Map<string, SkillMeta>()
  const setSkills = new Map<string, SetSkillMeta>()
  const groupSkills = new Map<string, GroupSkillMeta>()

  for (const row of skillRows) {
    if (!row.isSetSkill && !row.isGroupSkill) {
      skills.set(row.name, { name: row.name, maxLevel: row.maxLevel })
    }
    if (row.isSetSkill) {
      setSkills.set(row.name, {
        name: row.name,
        skillName: row.effectName ?? row.name,
        piecesRequired: row.requiredPieces ?? 2,
        bonusLevels: [],
      })
    }
    if (row.isGroupSkill) {
      groupSkills.set(row.name, {
        name: row.name,
        skillName: row.effectName ?? row.name,
        levelGranted: 1,
        piecesRequired: row.requiredPieces ?? 2,
      })
    }
  }

  const decorations: DecorationItem[] = decoRows.map((row) => ({
    name: row.name,
    skills: { [row.skillName]: row.skillLevel },
    slotSize: row.slotSize,
  }))

  const armorMap = new Map<string, ArmorPiece>()
  for (const row of armorRows) {
    armorMap.set(row.name, {
      name: row.name,
      type: row.type as ArmorType,
      rank: row.rank.toLowerCase() as 'low' | 'high' | 'master',
      defense: row.defense,
      slots: row.slots as number[],
      resists: [row.fireRes, row.waterRes, row.thunderRes, row.iceRes, row.dragonRes],
      skills: {},
      setSkills: [],
      groupSkills: [],
    })
  }

  for (const row of armorSkillRows) {
    const piece = armorMap.get(row.armorName)
    if (piece) piece.skills[row.skillName] = row.level
  }
  for (const row of armorSetSkillRows) {
    armorMap.get(row.armorName)?.setSkills.push(row.skillName)
  }
  for (const row of armorGroupSkillRows) {
    armorMap.get(row.armorName)?.groupSkills.push(row.skillName)
  }

  const allArmor = Array.from(armorMap.values())
  const byType: Record<ArmorType, ArmorPiece[]> = { head: [], chest: [], arms: [], waist: [], legs: [], talisman: [] }
  for (const piece of allArmor) byType[piece.type].push(piece)

  return { version: '1.0.0', byType, allArmor, decorations, setSkills, groupSkills, skills }
}
