import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { search } from '../logic/search'
import type {
  SetSearchIndex,
  ArmorPiece,
  DecorationItem,
  ArmorType,
  SearchInput,
  SearchResult,
  SetSkillMeta,
  GroupSkillMeta,
  SkillMeta,
} from '../types'

// ---------------------------------------------------------------------------
// Test index builder — reads from assets/seed/ without touching the DB
// ---------------------------------------------------------------------------

const SEED_DIR = path.join(process.cwd(), 'assets', 'seed')

function readSeed<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(SEED_DIR, file), 'utf8')) as T
}

function buildTestIndex(): SetSearchIndex {
  // compact armor: [type, skills, groupSkills, slots, defense, resists, rank, setSkills]
  const mapArmor = (name: string, d: unknown[]): ArmorPiece => ({
    name,
    type: d[0] as ArmorType,
    skills: d[1] as Record<string, number>,
    groupSkills: d[2] as string[],
    slots: d[3] as number[],
    defense: d[4] as number,
    resists: d[5] as [number, number, number, number, number],
    rank: d[6] as 'low' | 'high' | 'master',
    setSkills: d[7] as string[],
  })

  // d[0] is the compact type tag "talisman" — type is hardcoded below
  const mapTalisman = (name: string, d: unknown[]): ArmorPiece => ({
    name,
    type: 'talisman',
    skills: d[1] as Record<string, number>,
    groupSkills: [],
    slots: [],
    defense: 0,
    resists: [0, 0, 0, 0, 0],
    rank: 'high',
    setSkills: [],
  })

  const armorFiles = ['head', 'chest', 'arms', 'waist', 'legs'] as const

  const byType: Record<ArmorType, ArmorPiece[]> = {
    head: [],
    chest: [],
    arms: [],
    waist: [],
    legs: [],
    talisman: [],
  }

  for (const slot of armorFiles) {
    const raw = readSeed<Record<string, unknown[]>>(`${slot}.json`)
    byType[slot] = Object.entries(raw).map(([n, d]) => mapArmor(n, d))
  }

  const talisRaw = readSeed<Record<string, unknown[]>>('talisman.json')
  byType.talisman = Object.entries(talisRaw).map(([n, d]) => mapTalisman(n, d))

  // compact deco: [type, skills, slotSize]
  const decoRaw = readSeed<Record<string, unknown[]>>('decoration.json')
  const decorations: DecorationItem[] = Object.entries(decoRaw).map(([name, d]) => ({
    name,
    skills: d[1] as Record<string, number>,
    slotSize: d[2] as number,
  }))

  // compact set-skill: [skillName, piecesRequired, bonusLevels]
  const setSkillsRaw = readSeed<Record<string, unknown[]>>('set-skills.json')
  const setSkills = new Map<string, SetSkillMeta>()
  for (const [name, d] of Object.entries(setSkillsRaw)) {
    setSkills.set(name, {
      name,
      skillName: d[0] as string,
      piecesRequired: d[1] as number,
      bonusLevels: d[2] as number[],
    })
  }

  // compact group-skill: [skillName, levelGranted, piecesRequired]
  const groupSkillsRaw = readSeed<Record<string, unknown[]>>('group-skills.json')
  const groupSkills = new Map<string, GroupSkillMeta>()
  for (const [name, d] of Object.entries(groupSkillsRaw)) {
    groupSkills.set(name, {
      name,
      skillName: d[0] as string,
      levelGranted: d[1] as number,
      piecesRequired: d[2] as number,
    })
  }

  // skills seed: { skillName: maxLevel }
  const skillsRaw = readSeed<Record<string, number>>('skills.json')
  const skills = new Map<string, SkillMeta>()
  for (const [name, maxLevel] of Object.entries(skillsRaw)) {
    skills.set(name, { name, maxLevel })
  }

  return {
    version: '1.0.0',
    byType,
    allArmor: [...byType.head, ...byType.chest, ...byType.arms, ...byType.waist, ...byType.legs, ...byType.talisman],
    decorations,
    setSkills,
    groupSkills,
    skills,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('set-search', () => {
  let index: SetSearchIndex

  beforeAll(() => {
    index = buildTestIndex()
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
        'Free Meal': 2,
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

    // Lord's Soul is a 3-piece group skill; the DFS explores a larger combination space
    // and may take up to ~10 seconds on a cold run.
    beforeAll(() => {
      results = search(input, index)
    }, 20_000)

    it('finds at least one valid build', () => {
      expect(results.length).toBeGreaterThan(0)
    })

    it('every result has 6 armor pieces', () => {
      expect(results.length).toBeGreaterThan(0)
      for (const result of results) {
        expect(result.armorNames).toHaveLength(6)
      }
    })

    it('every result satisfies Antivirus 3', () => {
      expect(results.length).toBeGreaterThan(0)
      for (const result of results) {
        expect(result.skills['Antivirus'] ?? 0).toBeGreaterThanOrEqual(3)
      }
    })

    it('every result satisfies Free Meal 2', () => {
      expect(results.length).toBeGreaterThan(0)
      for (const result of results) {
        expect(result.skills['Free Meal'] ?? 0).toBeGreaterThanOrEqual(2)
      }
    })

    it('every result satisfies Maximum Might 3', () => {
      expect(results.length).toBeGreaterThan(0)
      for (const result of results) {
        expect(result.skills['Maximum Might'] ?? 0).toBeGreaterThanOrEqual(3)
      }
    })

    it('every result satisfies Earplugs 1', () => {
      expect(results.length).toBeGreaterThan(0)
      for (const result of results) {
        expect(result.skills['Earplugs'] ?? 0).toBeGreaterThanOrEqual(1)
      }
    })

    it('every result satisfies Agitator 4', () => {
      expect(results.length).toBeGreaterThan(0)
      for (const result of results) {
        expect(result.skills['Agitator'] ?? 0).toBeGreaterThanOrEqual(4)
      }
    })

    it('every result satisfies Weakness Exploit 5', () => {
      expect(results.length).toBeGreaterThan(0)
      for (const result of results) {
        expect(result.skills['Weakness Exploit'] ?? 0).toBeGreaterThanOrEqual(5)
      }
    })

    it('every result satisfies Burst 1', () => {
      expect(results.length).toBeGreaterThan(0)
      for (const result of results) {
        expect(result.skills['Burst'] ?? 0).toBeGreaterThanOrEqual(1)
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

    it('innate-skill-first: no skill in any result exceeds its maximum level', () => {
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

    it('innate-skill-first: top result has the most or equal size-3 free slots among all results', () => {
      expect(results.length).toBeGreaterThan(0)
      const maxThrees = Math.max(...results.map((r) => r.freeSlots.filter((s) => s === 3).length))
      const topThrees = results[0].freeSlots.filter((s) => s === 3).length
      expect(topThrees).toBe(maxThrees)
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
        for (const [sk, needed] of Object.entries(input.skills)) {
          const decoContrib = decoSkills[sk] ?? 0
          const innateContrib = (result.skills[sk] ?? 0) - decoContrib
          const gap = Math.max(0, needed - innateContrib)
          expect(decoContrib).toBeLessThanOrEqual(gap)
        }
      }
    })
  })
})
