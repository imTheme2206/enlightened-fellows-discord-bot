export type ArmorType = 'head' | 'chest' | 'arms' | 'waist' | 'legs'

/**
 * Compact armor format from seed JSON:
 * [type, skills, groupSkills, slots, defense, resists, rank, setSkills, rarity]
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
  number, // [8] rarity
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

export const WEAPON_KINDS = [
  'great-sword',
  'long-sword',
  'sword-shield',
  'dual-blades',
  'hammer',
  'hunting-horn',
  'lance',
  'gunlance',
  'switch-axe',
  'charge-blade',
  'insect-glaive',
  'bow',
  'light-bowgun',
  'heavy-bowgun',
] as const
export type WeaponKind = (typeof WEAPON_KINDS)[number]

export type SeedWeaponSpecial = {
  kind: 'element' | 'status'
  name: string
  damage: { raw: number; display: number }
  hidden: boolean
}

export type SeedWeaponSharpness = {
  red: number
  orange: number
  yellow: number
  green: number
  blue: number
  white: number
  purple: number
}

/** A weapon normalised from the MHDB wire format (names already de-kira'd). */
export type SeedWeapon = {
  gameId: number
  name: string
  kind: WeaponKind
  rarity: number
  damage: { raw: number; display: number }
  affinity: number
  specials: SeedWeaponSpecial[]
  sharpness: SeedWeaponSharpness | null
  handicraft: number[] | null
  slots: number[]
  skills: Record<string, number> // skill name → level
  elderseal: string | null
  defenseBonus: number
  series: string | null
  /** Weapon-kind-only fields (phial, shell, coatings, ammo, melody, ...). */
  kindSpecific: Record<string, unknown>
}

export interface SeedData {
  armor: Record<ArmorType, Record<string, CompactArmor>>
  talisman: Record<string, CompactTalisman>
  decoration: Record<string, CompactDecoration>
  skills: Record<string, number> // name → maxLevel
  setSkills: Record<string, CompactSetSkill>
  groupSkills: Record<string, CompactGroupSkill>
  setMap: Record<string, string> // setName → skillName
  armorSkills: string[] // array of armor skill names
  weaponSkills?: string[] // array of weapon skill names (subset of `skills`)
  // Raw MHDB icon category keyed by clean skill/set/group name, e.g. {"Attack Boost": "offense"}.
  skillIcons?: Record<string, string>
  weapons?: SeedWeapon[]
}
