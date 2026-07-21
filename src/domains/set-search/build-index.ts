import { eq } from 'drizzle-orm'
import { db } from '../../infra/db/client'
import { armor, armorBonus, armorSkill, bonus, bonusThreshold, decoration, decorationSkill, skill } from '../../infra/db/schema'
import type { ArmorPiece, ArmorType, DecorationItem, GroupSkillMeta, SetSearchIndex, SetSkillMeta, SkillMeta } from './types'

export async function buildIndexFromDb(): Promise<SetSearchIndex> {
  const skillRows = await db.select().from(skill)
  const bonusRows = await db.select().from(bonus)
  const thresholdRows = await db
    .select({
      bonusName: bonus.name,
      kind: bonus.kind,
      piecesRequired: bonusThreshold.piecesRequired,
      effectName: bonusThreshold.effectName,
      level: bonusThreshold.level,
    })
    .from(bonusThreshold)
    .innerJoin(bonus, eq(bonusThreshold.bonusId, bonus.id))
  const decoRows = await db
    .select({ name: decoration.name, slotSize: decoration.slotSize, skillName: skill.name, level: decorationSkill.level })
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

  const skills = new Map<string, SkillMeta>()
  for (const row of skillRows) {
    skills.set(row.name, { name: row.name, maxLevel: row.maxLevel })
  }

  // Collect a bonus's ordered thresholds (piece-counts and the effect at each).
  const thresholdsByBonus = new Map<string, { piecesRequired: number; effectName: string; level: number }[]>()
  for (const row of thresholdRows) {
    const list = thresholdsByBonus.get(row.bonusName) ?? []
    list.push({ piecesRequired: row.piecesRequired, effectName: row.effectName, level: row.level })
    thresholdsByBonus.set(row.bonusName, list)
  }

  const setSkills = new Map<string, SetSkillMeta>()
  const groupSkills = new Map<string, GroupSkillMeta>()
  for (const b of bonusRows) {
    const thresholds = (thresholdsByBonus.get(b.name) ?? []).sort((a, c) => a.piecesRequired - c.piecesRequired)
    const effectName = thresholds[0]?.effectName ?? b.name
    if (b.kind === 'set') {
      setSkills.set(b.name, {
        name: b.name,
        skillName: effectName,
        piecesRequired: thresholds[0]?.piecesRequired ?? 2,
        bonusLevels: thresholds.map((t) => t.piecesRequired),
      })
    } else if (b.kind === 'group') {
      groupSkills.set(b.name, {
        name: b.name,
        skillName: effectName,
        levelGranted: thresholds[0]?.level ?? 1,
        piecesRequired: thresholds[0]?.piecesRequired ?? 3,
      })
    }
  }

  // Decorations are multi-grant: fold every (skillName, level) into one map.
  const decoByName = new Map<string, DecorationItem>()
  for (const row of decoRows) {
    const item = decoByName.get(row.name) ?? { name: row.name, skills: {}, slotSize: row.slotSize }
    item.skills[row.skillName] = row.level
    decoByName.set(row.name, item)
  }
  const decorations = Array.from(decoByName.values())

  const armorMap = new Map<string, ArmorPiece>()
  for (const row of armorRows) {
    armorMap.set(row.name, {
      name: row.name,
      type: row.type as ArmorType,
      rank: row.rank.toLowerCase() as 'low' | 'high' | 'master',
      rarity: row.rarity,
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
  for (const row of armorBonusRows) {
    const piece = armorMap.get(row.armorName)
    if (!piece) continue
    if (row.kind === 'set') piece.setSkills.push(row.bonusName)
    else if (row.kind === 'group') piece.groupSkills.push(row.bonusName)
  }

  const allArmor = Array.from(armorMap.values())
  const byType: Record<ArmorType, ArmorPiece[]> = { head: [], chest: [], arms: [], waist: [], legs: [], talisman: [] }
  for (const piece of allArmor) byType[piece.type].push(piece)

  return { version: '1.0.0', byType, allArmor, decorations, setSkills, groupSkills, skills }
}
