export type ArmorType = 'head' | 'chest' | 'arms' | 'waist' | 'legs'

/**
 * Compact armor format from seed JSON:
 * [type, skills, groupSkills, slots, defense, resists, rank, setSkills]
 */
export type CompactArmor = [
  string, // [0] type: "head"|"chest"|"arms"|"waist"|"legs"
  Record<string, number>, // [1] skills: {skillName: level}
  string[], // [2] groupSkills: group names this piece belongs to
  number[], // [3] slots: [3, 2, 1] etc
  number, // [4] defense
  [number, number, number, number, number], // [5] resists: [fire, water, thunder, ice, dragon]
  string, // [6] rank: "low"|"high"|"master"
  string[], // [7] setSkills: set names this piece belongs to
]

/**
 * Compact talisman format from seed JSON:
 * [type, skills]  (no slots/defense/resists/rank/setSkills)
 */
export type CompactTalisman = [
  string, // [0] type: "talisman"
  Record<string, number>, // [1] skills: {skillName: level}
]

/**
 * Compact decoration format from seed JSON:
 * [type, skills, slotSize]
 */
export type CompactDecoration = [string, Record<string, number>, number]

/**
 * Set skill compact format: [skillName, piecesRequired, bonusLevels]
 */
export type CompactSetSkill = [string, number, number[]]

/**
 * Group skill compact format: [skillName, levelGranted, piecesRequired]
 */
export type CompactGroupSkill = [string, number, number]

export interface SeedData {
  armor: Record<ArmorType, Record<string, CompactArmor>>
  talisman: Record<string, CompactTalisman>
  decoration: Record<string, CompactDecoration>
  skills: Record<string, number> // name → maxLevel
  setSkills: Record<string, CompactSetSkill>
  groupSkills: Record<string, CompactGroupSkill>
  setMap: Record<string, string> // setName → skillName
  armorSkills: string[] // array of armor skill names
}
