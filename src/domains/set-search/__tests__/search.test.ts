import path from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
import { DEFENSE_BAND } from '../logic/constants'
import type { SearchInput, SearchResult, SetSearchIndex } from '../types'

// The index is built from the same SQLite database the real app uses.
// DATABASE_PATH must be set before the db client module is loaded, so the
// search/build-index modules are imported dynamically inside beforeAll.
process.env.DATABASE_PATH ??= path.join(process.cwd(), 'db', 'data.db')

type SearchFn = (input: SearchInput, index: SetSearchIndex) => SearchResult[]

describe('set-search', () => {
  let index: SetSearchIndex
  let search: SearchFn

  beforeAll(async () => {
    const [{ buildIndexFromDb }, { search: searchFn }] = await Promise.all([import('../build-index'), import('../logic/search')])
    index = buildIndexFromDb()
    search = searchFn
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
      const slotRank = (r: SearchResult): [number, number, number] => [
        r.freeSlots.filter((s) => s === 3).length,
        r.freeSlots.filter((s) => s === 2).length,
        r.freeSlots.length,
      ]
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
        decos: [
          'Earplugs Jewel 2',
          'Gobbler Jewel 1',
          'Gobbler Jewel 1',
          'Mighty Jewel 2',
          'Mighty Jewel 2',
          'Mighty Jewel 2',
          'Sane Jewel 1',
          'Sane Jewel 1',
          'Tenderizer Jewel 3',
          'Tenderizer Jewel 3',
        ],
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
        decos: [
          'Challenger Jewel 3',
          'Earplugs Jewel 2',
          'Gobbler Jewel 1',
          'Gobbler Jewel 1',
          'Mighty Jewel 2',
          'Sane Jewel 1',
          'Sane Jewel 1',
          'Tenderizer Jewel 3',
          'Tenderizer Jewel 3',
        ],
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

    it.each(groundTruthSets.map((set, i) => [i + 1, set] as const))(
      'pinning ground-truth set #%i reproduces the reference solution exactly',
      (_n, groundTruth) => {
        const pinned = search({ ...input, mandatoryArmor: groundTruth.armor }, index)
        expect(pinned.length).toBeGreaterThan(0)

        const top = pinned[0]
        expect([...top.armorNames].sort()).toEqual([...groundTruth.armor].sort())
        expect([...top.decoNames].sort()).toEqual([...groundTruth.decos].sort())
        expect(top.skills).toEqual(groundTruth.skills)
        expect(top.setSkills["Gore Magala's Tyranny"]).toBeGreaterThanOrEqual(1)
        expect(top.groupSkills["Lord's Soul"]).toBeGreaterThanOrEqual(1)
      }
    )
  })
})
