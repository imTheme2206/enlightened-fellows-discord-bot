export interface MhdbArmorPiece {
  name: string
  kind: 'head' | 'chest' | 'arms' | 'waist' | 'legs'
  rank: string
  rarity: number
  defense: { base: number }
  resistances: { fire: number; water: number; thunder: number; ice: number; dragon: number }
  slots: number[]
  skills: Array<{ skill: { name: string; kind: string }; level: number }>
  description: string
}

export interface MhdbSkill {
  name: string
  kind: 'armor' | 'weapon' | 'set' | 'group'
  icon: { kind: string }
  description: string
  ranks: Array<{ name: string; description: string; setPiecesRequired?: number }>
}

export interface MhdbArmorSet {
  name: string
  pieces: Array<{ name: string }>
  bonus?: { skill?: { name: string } } | null
  groupBonus?: { skill?: { name: string } } | null
}

export interface MhdbCharmGroup {
  ranks: Array<{
    name: string
    rarity: number
    description: string
    skills: Array<{ skill: { name: string }; level: number }>
  }>
}

export interface MhdbDecoration {
  name: string
  kind: string
  rarity: number
  slot: number
  description: string
  skills: Array<{ skill: { name: string }; level: number }>
}

export interface MhdbWeaponSpecial {
  kind: 'element' | 'status'
  element?: string
  status?: string
  damage: { raw: number; display: number }
  hidden: boolean
}

export interface MhdbWeapon {
  id: number
  name: string
  kind: string
  rarity: number
  damage: { raw: number; display: number }
  affinity: number
  specials: MhdbWeaponSpecial[]
  sharpness?: Record<string, number>
  handicraft?: number[]
  slots: number[]
  skills: Array<{ skill: { name: string }; level: number }>
  elderseal: string | null
  defenseBonus: number
  series: { name: string } | null
  // Kind-specific fields (only some kinds carry each).
  phial?: unknown
  shell?: unknown
  shellLevel?: unknown
  coatings?: unknown
  ammo?: unknown
  specialAmmo?: unknown
  kinsectLevel?: unknown
  melody?: unknown
  echoBubble?: unknown
  echoWave?: unknown
}
