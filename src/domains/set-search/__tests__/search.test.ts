import { beforeAll, describe, expect, it } from 'vitest'
import { ARMOR_SLOT_TYPES, DEFENSE_BAND, type PieceEntry } from '../logic/constants'
import { armorCombo, testCombo } from '../logic/combo'
import { computeMaxPotential, getBestArmor } from '../logic/candidate-pool'
import { rollCombosDfs, rollTopCombosDfs } from '../logic/dfs'
import { reorder } from '../logic/reorder'
import { search } from '../logic/search'
import type { SearchInput, SearchResult } from '../types'
import { deserializeIndex, type SerializedIndex } from './fixtures/index-serde'
import searchIndexFixture from './fixtures/search-index.json'

// The index is a committed snapshot of the production index (see
// fixtures/generate-fixture.ts) so the suite runs hermetically — no database.
const index = deserializeIndex(searchIndexFixture as unknown as SerializedIndex)

describe('set-search', () => {
  it('keeps only the correctly ranked top results for a broad minimal-skill search', () => {
    const skills = { Agitator: 1 }
    const gear = getBestArmor(skills, {}, {}, [], [], index.byType, index.decorations, 'high')
    const maxPotential = computeMaxPotential(gear, Object.keys(skills))
    const skillMaxMap = Object.fromEntries(Array.from(index.skills, ([name, meta]) => [name, meta.maxLevel]))

    const exhaustive = reorder(rollCombosDfs(gear, skills, {}, {}, {}, {}, maxPotential), skillMaxMap).slice(0, 200)
    const bounded = rollTopCombosDfs(gear, skills, {}, {}, {}, {}, maxPotential, skillMaxMap, 200)

    expect(bounded).toEqual(exhaustive)
  }, 15_000)

  it('prunes without dropping any combo that fulfills a many-skill search', () => {
    const skills = { Agitator: 4, Flayer: 1, Earplugs: 1, Antivirus: 3, 'Maximum Might': 3, 'Weakness Exploit': 5, 'Speed Eating': 2, Burst: 1 }
    const fullGear = getBestArmor(skills, {}, {}, [], [], index.byType, index.decorations, 'high')
    // Trim each slot so brute force stays small; the DFS must still find every fulfilling combo.
    const gear = { ...fullGear }
    for (const slot of ARMOR_SLOT_TYPES) gear[slot] = Object.fromEntries(Object.entries(fullGear[slot]).slice(0, 6))
    const maxPotential = computeMaxPotential(gear, Object.keys(skills))

    const bruteForce: string[] = []
    const walk = (i: number, picked: PieceEntry[]): void => {
      if (i === ARMOR_SLOT_TYPES.length) {
        if (testCombo(armorCombo(picked), gear.decos, skills)) bruteForce.push(picked.map(([n]) => n).join('|'))
        return
      }
      for (const entry of Object.entries(gear[ARMOR_SLOT_TYPES[i]])) {
        if (entry[0] !== 'None' && picked.some(([n]) => n === entry[0])) continue
        walk(i + 1, [...picked, entry])
      }
    }
    walk(0, [])

    const found = rollCombosDfs(gear, skills, {}, {}, {}, {}, maxPotential).map((r) => r.armorNames.join('|'))
    expect(bruteForce.length).toBeGreaterThan(0)
    expect(found.sort()).toEqual(bruteForce.sort())
  })

  // ── Gore Magala (set skill) + Lord's Soul (group skill) weapon ───────────

  describe("Gore Magala's Tyranny + Lord's Soul weapon build", () => {
    /**
     * The weapon equips Gore Magala's Tyranny (set skill, 2-piece activation)
     * and Lord's Soul (group skill, 3-piece activation).
     * Weapon counts as 1 piece toward each, so armor needs:
     *   - 1 more Gore Magala piece (set skill)
     *   - 2 more Lord's Soul pieces (group skill)
     */
    const input: SearchInput = {
      skills: {
        Antivirus: 3,
        'Speed Eating': 2,
        'Maximum Might': 3,
        Earplugs: 1,
        Agitator: 4,
        'Weakness Exploit': 5,
        Burst: 1,
      },
      setSkills: {
        "Gore Magala's Tyranny": 1,
      },
      groupSkills: {
        "Lord's Soul": 1,
      },
      initialSetCounts: {
        "Gore Magala's Tyranny": 1,
      },
      initialGroupCounts: {
        "Lord's Soul": 1,
      },
      rank: 'high',
    }

    let results: SearchResult[]

    // Lord's Soul is a 3-piece group skill; the DFS explores a larger combination
    // space and the full enumeration takes ~15 seconds.
    beforeAll(() => {
      results = search(input, index)
    }, 60_000)

    it('finds at least one valid build', () => {
      expect(results.length).toBeGreaterThan(0)
    })

    it('every result has 6 armor pieces', () => {
      expect(results.length).toBeGreaterThan(0)
      for (const result of results) {
        expect(result.armorNames).toHaveLength(6)
      }
    })

    it.each([
      ['Antivirus', 3],
      ['Speed Eating', 2],
      ['Maximum Might', 3],
      ['Earplugs', 1],
      ['Agitator', 4],
      ['Weakness Exploit', 5],
      ['Burst', 1],
    ])('every result satisfies %s %i', (skill, level) => {
      expect(results.length).toBeGreaterThan(0)
      for (const result of results) {
        expect(result.skills[skill] ?? 0).toBeGreaterThanOrEqual(level)
      }
    })

    it("every result activates Gore Magala's Tyranny (2-piece set skill with weapon)", () => {
      expect(results.length).toBeGreaterThan(0)
      for (const result of results) {
        expect(result.setSkills["Gore Magala's Tyranny"] ?? 0).toBeGreaterThanOrEqual(1)
      }
    })

    it("every result activates Lord's Soul (3-piece group skill with weapon)", () => {
      expect(results.length).toBeGreaterThan(0)
      for (const result of results) {
        expect(result.groupSkills["Lord's Soul"] ?? 0).toBeGreaterThanOrEqual(1)
      }
    })

    it('normalizes armor and weapon bonus piece counts together', () => {
      const armorByName = new Map(index.allArmor.map((piece) => [piece.name, piece]))
      for (const result of results) {
        const body = result.armorNames.slice(0, 5).map((name) => armorByName.get(name))
        const gorePieces = body.filter((piece) => piece?.setSkills.includes("Gore Magala's Tyranny")).length + 1
        const lordPieces = body.filter((piece) => piece?.groupSkills.includes("Lord's Soul")).length + 1
        expect(result.setSkills["Gore Magala's Tyranny"]).toBe(Math.floor(gorePieces / 2))
        expect(result.groupSkills["Lord's Soul"]).toBe(Math.floor(lordPieces / 3))
      }
    })

    it('no skill in any result exceeds its maximum level', () => {
      expect(results.length).toBeGreaterThan(0)
      for (const result of results) {
        for (const [sk, lv] of Object.entries(result.skills)) {
          const max = index.skills.get(sk)?.maxLevel
          if (max !== undefined) {
            expect(lv).toBeLessThanOrEqual(max)
          }
        }
      }
    })

    it('top-tier results (within the defense band) come before all lower-defense results', () => {
      expect(results.length).toBeGreaterThan(0)
      const maxDefense = Math.max(...results.map((r) => r.defense))
      const threshold = maxDefense - DEFENSE_BAND
      const firstLowTier = results.findIndex((r) => r.defense < threshold)
      if (firstLowTier !== -1) {
        for (const result of results.slice(firstLowTier)) {
          expect(result.defense).toBeLessThan(threshold)
        }
      }
    })

    it('top-tier results are ordered by free slots (size 3, size 2, count) descending', () => {
      expect(results.length).toBeGreaterThan(0)
      const maxDefense = Math.max(...results.map((r) => r.defense))
      const topTier = results.filter((r) => r.defense >= maxDefense - DEFENSE_BAND)
      const slotRank = (r: SearchResult): [number, number, number] => [r.freeSlots.filter((s) => s === 3).length, r.freeSlots.filter((s) => s === 2).length, r.freeSlots.length]
      for (let i = 1; i < topTier.length; i++) {
        const [prev3, prev2, prevN] = slotRank(topTier[i - 1])
        const [cur3, cur2, curN] = slotRank(topTier[i])
        const ordered = cur3 < prev3 || (cur3 === prev3 && (cur2 < prev2 || (cur2 === prev2 && curN <= prevN)))
        expect(ordered).toBe(true)
      }
    })

    it('below-band results are ordered by defense descending', () => {
      expect(results.length).toBeGreaterThan(0)
      const maxDefense = Math.max(...results.map((r) => r.defense))
      const lowTier = results.filter((r) => r.defense < maxDefense - DEFENSE_BAND)
      for (let i = 1; i < lowTier.length; i++) {
        expect(lowTier[i].defense).toBeLessThanOrEqual(lowTier[i - 1].defense)
      }
    })

    it('decorations used only cover the skill gap left by innate armor skills', () => {
      expect(results.length).toBeGreaterThan(0)
      for (const result of results) {
        // Build a deco-skills map for this result
        const decoSkills: Record<string, number> = {}
        for (const decoName of result.decoNames) {
          const deco = index.decorations.find((d) => d.name === decoName)
          if (!deco) continue
          for (const [sk, lv] of Object.entries(deco.skills)) {
            decoSkills[sk] = (decoSkills[sk] ?? 0) + lv
          }
        }

        // Decos should only fill the gap left by innate armor skills
        for (const [sk, needed] of Object.entries(input.skills ?? {})) {
          const decoContrib = decoSkills[sk] ?? 0
          const innateContrib = (result.skills[sk] ?? 0) - decoContrib
          const gap = Math.max(0, needed - innateContrib)
          expect(decoContrib).toBeLessThanOrEqual(gap)
        }
      }
    })

    // ── Ground truth: known-good sets verified against an external set builder ──
    //
    // Each pinned search must reproduce the reference solution exactly:
    // same armor, same decoration loadout, same activated skills.

    const groundTruthSets: Array<{
      armor: string[]
      decos: string[]
      skills: Record<string, number>
    }> = [
      {
        armor: ['Udra Mirehelm Gamma', 'Dahaad Shardmail Gamma', 'Arkvulcan Vambraces Gamma', 'Numinous Overlay Beta', 'Gore Greaves Beta', 'Exploiter Charm III'],
        decos: ['Earplugs Jewel 2', 'Gobbler Jewel 1', 'Gobbler Jewel 1', 'Mighty Jewel 2', 'Mighty Jewel 2', 'Mighty Jewel 2', 'Sane Jewel 1', 'Sane Jewel 1'],
        skills: {
          'Weakness Exploit': 5,
          Agitator: 4,
          Antivirus: 3,
          Burst: 3,
          'Maximum Might': 3,
          Flayer: 2,
          'Speed Eating': 2,
          Coalescence: 1,
          Earplugs: 1,
          'Flinch Free': 1,
        },
      },
      {
        armor: ['Udra Mirehelm Gamma', 'Dahaad Shardmail Gamma', 'Rey Sandbraces Gamma', 'Numinous Overlay Beta', 'Gore Greaves Beta', 'Exploiter Charm III'],
        decos: ['Earplugs Jewel 2', 'Gobbler Jewel 1', 'Gobbler Jewel 1', 'Mighty Jewel 2', 'Mighty Jewel 2', 'Mighty Jewel 2', 'Sane Jewel 1', 'Sane Jewel 1', 'Tenderizer Jewel 3', 'Tenderizer Jewel 3'],
        skills: {
          'Weakness Exploit': 5,
          Agitator: 4,
          Antivirus: 3,
          Burst: 3,
          'Maximum Might': 3,
          'Evade Extender': 2,
          'Speed Eating': 2,
          Coalescence: 1,
          Earplugs: 1,
          'Flinch Free': 1,
        },
      },
      {
        armor: ['Udra Mirehelm Gamma', 'Dahaad Shardmail Gamma', 'Gogmazios Vambraces Alpha', 'Duna Wildcoil Gamma', 'Gore Greaves Beta', 'Exploiter Charm III'],
        decos: ['Challenger Jewel 3', 'Earplugs Jewel 2', 'Gobbler Jewel 1', 'Gobbler Jewel 1', 'Mighty Jewel 2', 'Sane Jewel 1', 'Sane Jewel 1', 'Tenderizer Jewel 3', 'Tenderizer Jewel 3'],
        skills: {
          'Weakness Exploit': 5,
          Agitator: 4,
          Antivirus: 3,
          Burst: 3,
          'Maximum Might': 3,
          'Speed Eating': 2,
          'Tool Specialist': 2,
          Earplugs: 1,
          'Flinch Free': 1,
        },
      },
    ]

    it.each(groundTruthSets.map((set, i) => [i + 1, set] as const))('pinning ground-truth set #%i reproduces the reference solution exactly', (_n, groundTruth) => {
      const pinned = search({ ...input, mandatoryArmor: groundTruth.armor }, index)
      expect(pinned.length).toBeGreaterThan(0)

      const top = pinned[0]
      expect([...top.armorNames].sort()).toEqual([...groundTruth.armor].sort())
      expect([...top.decoNames].sort()).toEqual([...groundTruth.decos].sort())
      expect(top.skills).toEqual(groundTruth.skills)
      expect(top.setSkills["Gore Magala's Tyranny"]).toBeGreaterThanOrEqual(1)
      expect(top.groupSkills["Lord's Soul"]).toBeGreaterThanOrEqual(1)
    })
  })
})
