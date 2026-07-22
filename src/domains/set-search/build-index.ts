import type { CatalogIndexProjection } from '../mh-wilds-catalog/projection'
import { CatalogService } from '../mh-wilds-catalog/service'
import type { ArmorPiece, ArmorType, DecorationItem, GroupSkillMeta, SetSearchIndex, SetSkillMeta, SkillMeta } from './types'

/**
 * Pure shaping of a catalog projection into the `SetSearchIndex` the DFS
 * engine searches over. No DB access — split out from `buildIndexFromDb` so
 * this set-search-specific logic is unit-testable without a live database.
 * All storage/join knowledge (armor/skill/bonus/decoration tables) lives in
 * the MH Wilds Catalog domain (ADR-0009); this only consumes its projection.
 */
export function shapeIndexFromProjection(projection: CatalogIndexProjection): SetSearchIndex {
  const skills = new Map<string, SkillMeta>()
  for (const row of projection.skills) {
    skills.set(row.name, { name: row.name, maxLevel: row.maxLevel })
  }

  // Collect a bonus's ordered thresholds (piece-counts and the effect at each).
  const thresholdsByBonus = new Map<string, { kind: 'set' | 'group'; piecesRequired: number; effectName: string; level: number }[]>()
  for (const row of projection.bonusThresholds) {
    const list = thresholdsByBonus.get(row.bonusName) ?? []
    list.push(row)
    thresholdsByBonus.set(row.bonusName, list)
  }

  const setSkills = new Map<string, SetSkillMeta>()
  const groupSkills = new Map<string, GroupSkillMeta>()
  for (const [bonusName, rows] of thresholdsByBonus) {
    const thresholds = [...rows].sort((a, c) => a.piecesRequired - c.piecesRequired)
    const effectName = thresholds[0]?.effectName ?? bonusName
    const kind = thresholds[0]?.kind
    if (kind === 'set') {
      setSkills.set(bonusName, {
        name: bonusName,
        skillName: effectName,
        piecesRequired: thresholds[0]?.piecesRequired ?? 2,
        bonusLevels: thresholds.map((t) => t.piecesRequired),
      })
    } else if (kind === 'group') {
      groupSkills.set(bonusName, {
        name: bonusName,
        skillName: effectName,
        levelGranted: thresholds[0]?.level ?? 1,
        piecesRequired: thresholds[0]?.piecesRequired ?? 3,
      })
    }
  }

  // Decorations are multi-grant: fold every (skillName, level) into one map.
  const decoByName = new Map<string, DecorationItem>()
  for (const row of projection.decorationGrants) {
    const item = decoByName.get(row.decorationName) ?? { name: row.decorationName, skills: {}, slotSize: row.slotSize }
    item.skills[row.skillName] = row.level
    decoByName.set(row.decorationName, item)
  }
  const decorations = Array.from(decoByName.values())

  const armorMap = new Map<string, ArmorPiece>()
  for (const row of projection.armor) {
    armorMap.set(row.name, {
      name: row.name,
      type: row.type as ArmorType,
      rank: row.rank.toLowerCase() as 'low' | 'high' | 'master',
      rarity: row.rarity,
      defense: row.defense,
      slots: row.slots,
      resists: [row.fireRes, row.waterRes, row.thunderRes, row.iceRes, row.dragonRes],
      skills: {},
      setSkills: [],
      groupSkills: [],
    })
  }

  for (const row of projection.armorSkills) {
    const piece = armorMap.get(row.armorName)
    if (piece) piece.skills[row.skillName] = row.level
  }
  for (const row of projection.armorBonuses) {
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

/** Loads the catalog projection and shapes it into a `SetSearchIndex`. */
export async function buildIndexFromDb(): Promise<SetSearchIndex> {
  const projection = await CatalogService.getIndexProjection()
  return shapeIndexFromProjection(projection)
}
