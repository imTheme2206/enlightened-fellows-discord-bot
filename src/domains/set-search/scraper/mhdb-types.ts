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
