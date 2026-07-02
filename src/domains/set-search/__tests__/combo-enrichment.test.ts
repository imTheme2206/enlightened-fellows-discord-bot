import { describe, expect, it } from 'vitest'
import { armorCombo, testCombo } from '../logic/combo'
import type { PieceEntry } from '../logic/constants'
import type { ArmorPiece, ArmorType } from '../types'

function piece(name: string, type: ArmorType, overrides: Partial<ArmorPiece> = {}): ArmorPiece {
  return {
    name,
    type,
    skills: {},
    groupSkills: [],
    setSkills: [],
    slots: [],
    defense: 10,
    resists: [1, 2, 3, 4, 5],
    rank: 'high',
    rarity: 8,
    ...overrides,
  }
}

// head, chest, arms, waist, legs, talisman
const pieces: PieceEntry[] = [
  ['Head', piece('Head', 'head', { rarity: 8, resists: [1, 0, 0, 0, 0] })],
  ['Chest', piece('Chest', 'chest', { rarity: 7, resists: [0, 2, 0, 0, 0] })],
  ['Arms', piece('Arms', 'arms', { rarity: 6, resists: [0, 0, 3, 0, 0] })],
  ['Waist', piece('Waist', 'waist', { rarity: 5, resists: [0, 0, 0, 4, 0] })],
  ['Legs', piece('Legs', 'legs', { rarity: 4, resists: [0, 0, 0, 0, 5] })],
  // Talisman carries a (nonsense) rarity/resist to prove it's excluded from aggregates
  ['Talisman', piece('Talisman', 'talisman', { rarity: 0, defense: 999, resists: [99, 99, 99, 99, 99] })],
]

describe('combo enrichment', () => {
  const combo = armorCombo(pieces)

  it('rarities align 1:1 with armor names (all 6 pieces)', () => {
    expect(combo.names).toEqual(['Head', 'Chest', 'Arms', 'Waist', 'Legs', 'Talisman'])
    expect(combo.rarities).toEqual([8, 7, 6, 5, 4, 0])
  })

  it('elemental defenses sum only the 5 body pieces (talisman excluded)', () => {
    expect(combo.elementalDefenses).toEqual({ fire: 1, water: 2, thunder: 3, ice: 4, dragon: 5 })
  })

  it('defense and elemental defenses cover the same piece set (talisman excluded)', () => {
    expect(combo.defense).toBe(50) // 5 body pieces × 10, talisman's 999 excluded
  })

  it('testCombo propagates rarities and elemental defenses into the result', () => {
    const result = testCombo(combo, {}, {})
    expect(result).not.toBeNull()
    expect(result?.rarities).toEqual([8, 7, 6, 5, 4, 0])
    expect(result?.elementalDefenses).toEqual({ fire: 1, water: 2, thunder: 3, ice: 4, dragon: 5 })
  })
})
