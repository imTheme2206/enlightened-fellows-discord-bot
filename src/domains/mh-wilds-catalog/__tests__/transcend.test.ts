import { describe, expect, it } from 'vitest'
import { transcendSlots } from '../transcend'

describe('transcendSlots', () => {
  describe('rarity 5 — +1 to all three positions, empties fill', () => {
    it('fills empty positions from a single base slot (①,-,- → ②,①,①)', () => {
      expect(transcendSlots([1], 5)).toEqual([2, 1, 1])
    })

    it('bumps three level-1 slots to three level-2 slots', () => {
      expect(transcendSlots([1, 1, 1], 5)).toEqual([2, 2, 2])
    })

    it('fills a fully empty piece to three level-1 slots', () => {
      expect(transcendSlots([], 5)).toEqual([1, 1, 1])
    })

    it('caps existing level-3 slots while still upgrading the rest', () => {
      expect(transcendSlots([3, 2, 1], 5)).toEqual([3, 3, 2])
    })
  })

  describe('rarity 6 — +1 to the first two positions only', () => {
    it('reproduces the worked example ③,-,- → ③,①,-', () => {
      expect(transcendSlots([3], 6)).toEqual([3, 1])
    })

    it('upgrades first two, leaves the third untouched', () => {
      expect(transcendSlots([2, 1, 1], 6)).toEqual([3, 2, 1])
    })

    it('fills an empty piece to two level-1 slots (G. Fulgur Helm α)', () => {
      expect(transcendSlots([], 6)).toEqual([1, 1])
    })

    it('caps at level 3 on the first two positions', () => {
      expect(transcendSlots([3, 2, 1], 6)).toEqual([3, 3, 1])
    })
  })

  describe('rarity 7 / 8 — no slot change', () => {
    it('leaves rarity 7 slots unchanged', () => {
      expect(transcendSlots([3, 1], 7)).toEqual([3, 1])
    })

    it('leaves rarity 8 slots unchanged', () => {
      expect(transcendSlots([2, 2, 2], 8)).toEqual([2, 2, 2])
    })
  })

  describe('rarity 1–4 — treated as no change (unconfirmed)', () => {
    it.each([1, 2, 3, 4])('leaves rarity %i slots unchanged', (rarity) => {
      expect(transcendSlots([1], rarity)).toEqual([1])
      expect(transcendSlots([], rarity)).toEqual([])
    })
  })

  it('never mutates the input array', () => {
    const base = [1, 1, 1]
    transcendSlots(base, 5)
    expect(base).toEqual([1, 1, 1])
  })

  it('never produces an illegal loadout (>3 levels or >3 slots)', () => {
    for (const rarity of [1, 2, 3, 4, 5, 6, 7, 8]) {
      for (const base of [[], [1], [2], [3], [1, 1], [2, 2], [3, 2, 1], [2, 1, 1]]) {
        const out = transcendSlots(base, rarity)
        expect(out.length).toBeLessThanOrEqual(3)
        expect(out.every((s) => s >= 1 && s <= 3)).toBe(true)
      }
    }
  })
})
