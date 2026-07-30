import { describe, expect, it } from 'vitest'
import { shapeIndexFromProjection } from '../build-index'
import type { CatalogIndexProjection } from '../../mh-wilds-catalog/projection'

function emptyProjection(): CatalogIndexProjection {
  return { skills: [], bonusThresholds: [], decorationGrants: [], armor: [], armorSkills: [], armorBonuses: [] }
}

// A small but complete projection: 1 armor skill, 1 set bonus (2 thresholds),
// 1 group bonus (1 threshold), 1 armor piece in both, 1 multi-grant decoration.
function sampleProjection(): CatalogIndexProjection {
  return {
    skills: [{ name: 'Attack Boost', maxLevel: 5 }],
    bonusThresholds: [
      { bonusName: "Gore's Tyranny", kind: 'set', piecesRequired: 2, effectName: 'Antivirus', level: 1 },
      { bonusName: "Gore's Tyranny", kind: 'set', piecesRequired: 4, effectName: 'Antivirus', level: 2 },
      { bonusName: 'Fanged Exploiter', kind: 'group', piecesRequired: 3, effectName: 'Fanged Frenzy', level: 1 },
    ],
    decorationGrants: [
      { decorationName: 'Crit Jwl', slotSize: 3, skillName: 'Critical Status', level: 3 },
      { decorationName: 'Crit Jwl', slotSize: 3, skillName: 'Handicraft', level: 1 },
    ],
    armor: [
      {
        name: 'Gore Helm',
        type: 'head',
        rank: 'HIGH',
        rarity: 8,
        defense: 100,
        fireRes: 1,
        waterRes: 0,
        thunderRes: -2,
        iceRes: 0,
        dragonRes: 3,
        slots: [3, 1],
      },
    ],
    armorSkills: [{ armorName: 'Gore Helm', skillName: 'Attack Boost', level: 2 }],
    armorBonuses: [
      { armorName: 'Gore Helm', bonusName: "Gore's Tyranny", kind: 'set' },
      { armorName: 'Gore Helm', bonusName: 'Fanged Exploiter', kind: 'group' },
    ],
  }
}

describe('shapeIndexFromProjection', () => {
  it('empty projection → empty index in every bucket', () => {
    const index = shapeIndexFromProjection(emptyProjection())
    expect(index.allArmor).toEqual([])
    expect(index.decorations).toEqual([])
    expect(index.skills.size).toBe(0)
    expect(index.setSkills.size).toBe(0)
    expect(index.groupSkills.size).toBe(0)
    expect(index.byType).toEqual({ head: [], chest: [], arms: [], waist: [], legs: [], talisman: [] })
  })

  it('shapes skills into a name-keyed map', () => {
    const index = shapeIndexFromProjection(sampleProjection())
    expect(index.skills.get('Attack Boost')).toEqual({ name: 'Attack Boost', maxLevel: 5 })
  })

  it('shapes set bonus thresholds sorted ascending with bonusLevels as piece counts', () => {
    const index = shapeIndexFromProjection(sampleProjection())
    expect(index.setSkills.get("Gore's Tyranny")).toEqual({
      name: "Gore's Tyranny",
      skillName: 'Antivirus',
      piecesRequired: 2,
      bonusLevels: [2, 4],
    })
  })

  it('shapes group bonus threshold into levelGranted/piecesRequired', () => {
    const index = shapeIndexFromProjection(sampleProjection())
    expect(index.groupSkills.get('Fanged Exploiter')).toEqual({
      name: 'Fanged Exploiter',
      skillName: 'Fanged Frenzy',
      levelGranted: 1,
      piecesRequired: 3,
    })
  })

  it('folds multi-grant decoration rows into one item with all skills', () => {
    const index = shapeIndexFromProjection(sampleProjection())
    expect(index.decorations).toEqual([
      { name: 'Crit Jwl', slotSize: 3, skills: { 'Critical Status': 3, Handicraft: 1 } },
    ])
  })

  it('attaches armor skills, set/group bonus membership, and buckets by type', () => {
    const index = shapeIndexFromProjection(sampleProjection())
    expect(index.allArmor).toHaveLength(1)
    const piece = index.allArmor[0]
    expect(piece.name).toBe('Gore Helm')
    expect(piece.rank).toBe('high') // lowercased
    expect(piece.skills).toEqual({ 'Attack Boost': 2 })
    expect(piece.setSkills).toEqual(["Gore's Tyranny"])
    expect(piece.groupSkills).toEqual(['Fanged Exploiter'])
    expect(piece.resists).toEqual([1, 0, -2, 0, 3])
    expect(index.byType.head).toEqual([piece])
    expect(index.byType.chest).toEqual([])
  })

  it('builds the index from transcended slots, not base slots', () => {
    const projection = sampleProjection()
    // A rarity-6 piece whose base slots [2, 1] transcend to [3, 2].
    projection.armor[0].rarity = 6
    projection.armor[0].slots = [2, 1]
    const piece = shapeIndexFromProjection(projection).allArmor[0]
    expect(piece.slots).toEqual([3, 2])
  })

  it('leaves rarity 7/8 slots unchanged in the index', () => {
    // sampleProjection's Gore Helm is rarity 8 with base slots [3, 1].
    const piece = shapeIndexFromProjection(sampleProjection()).allArmor[0]
    expect(piece.slots).toEqual([3, 1])
  })

  it('armor/decoration rows referencing an unknown parent are dropped without throwing', () => {
    const projection = sampleProjection()
    projection.armorSkills.push({ armorName: 'Nonexistent Piece', skillName: 'Attack Boost', level: 1 })
    projection.armorBonuses.push({ armorName: 'Nonexistent Piece', bonusName: "Gore's Tyranny", kind: 'set' })
    expect(() => shapeIndexFromProjection(projection)).not.toThrow()
    expect(shapeIndexFromProjection(projection).allArmor).toHaveLength(1)
  })
})
