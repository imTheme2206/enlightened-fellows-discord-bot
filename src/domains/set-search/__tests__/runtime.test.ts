import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SetSearchIndex } from '../types'

// build-index and custom-talismans are the only DB-touching dependencies of
// runtime.ts; mocking them keeps this suite hermetic (no Discord, no DB).
const buildIndexFromDb = vi.fn()
vi.mock('../build-index', () => ({ buildIndexFromDb: () => buildIndexFromDb() }))

const loadCustomTalismans = vi.fn()
vi.mock('../custom-talismans', () => ({ loadCustomTalismans: (...args: unknown[]) => loadCustomTalismans(...args) }))

function emptyIndex(version: string): SetSearchIndex {
  return {
    version,
    byType: { head: [], chest: [], arms: [], waist: [], legs: [], talisman: [] },
    allArmor: [],
    decorations: [],
    setSkills: new Map(),
    groupSkills: new Map(),
    skills: new Map([['Attack Boost', { name: 'Attack Boost', maxLevel: 5 }]]),
  }
}

describe('set-search runtime', () => {
  let runtime: typeof import('../runtime')

  beforeEach(async () => {
    vi.resetModules()
    buildIndexFromDb.mockReset()
    loadCustomTalismans.mockReset()
    loadCustomTalismans.mockResolvedValue([])
    runtime = await import('../runtime')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('cold start: searchSets builds the index on first call rather than throwing', async () => {
    buildIndexFromDb.mockResolvedValue(emptyIndex('v1'))
    const results = await runtime.searchSets({ skills: {} })
    expect(Array.isArray(results)).toBe(true)
    expect(buildIndexFromDb).toHaveBeenCalledTimes(1)
    expect(runtime.getSkillNames()).toEqual(['Attack Boost'])
  })

  it('concurrent cold-start searches share one in-flight build', async () => {
    let resolveBuild!: (index: SetSearchIndex) => void
    buildIndexFromDb.mockReturnValue(
      new Promise<SetSearchIndex>((resolve) => {
        resolveBuild = resolve
      })
    )

    const first = runtime.searchSets({ skills: {} })
    const second = runtime.searchSets({ skills: {} })
    resolveBuild(emptyIndex('v1'))
    await Promise.all([first, second])

    expect(buildIndexFromDb).toHaveBeenCalledTimes(1)
  })

  it('a failed initial build leaves the index not-ready and surfaces the error', async () => {
    buildIndexFromDb.mockRejectedValueOnce(new Error('db unreachable'))
    await expect(runtime.searchSets({ skills: {} })).rejects.toThrow('db unreachable')
    expect(runtime.getSkillNames()).toEqual([]) // still not ready

    // A subsequent call retries the build rather than staying stuck.
    buildIndexFromDb.mockResolvedValueOnce(emptyIndex('v2'))
    await runtime.searchSets({ skills: {} })
    expect(runtime.getSkillNames()).toEqual(['Attack Boost'])
  })

  it('refresh() builds into a local and only swaps in on success', async () => {
    buildIndexFromDb.mockResolvedValueOnce(emptyIndex('v1'))
    await runtime.refresh()
    expect(runtime.getSkillNames()).toEqual(['Attack Boost'])

    buildIndexFromDb.mockRejectedValueOnce(new Error('scrape failed mid-refresh'))
    await expect(runtime.refresh()).rejects.toThrow('scrape failed mid-refresh')

    // Prior (v1) index is untouched by the failed refresh.
    expect(runtime.getSkillNames()).toEqual(['Attack Boost'])
  })

  it('a search that starts during a refresh sees a consistent index, never a partial one', async () => {
    buildIndexFromDb.mockResolvedValueOnce(emptyIndex('v1'))
    await runtime.refresh()

    let resolveRefresh!: (index: SetSearchIndex) => void
    buildIndexFromDb.mockReturnValueOnce(
      new Promise<SetSearchIndex>((resolve) => {
        resolveRefresh = resolve
      })
    )
    const refreshPromise = runtime.refresh()

    // Index is already ready (v1), so this search does NOT wait on the
    // in-flight refresh — it reads whatever is currently swapped in.
    const results = await runtime.searchSets({ skills: {} })
    expect(Array.isArray(results)).toBe(true)

    resolveRefresh(emptyIndex('v2'))
    await refreshPromise
    expect(buildIndexFromDb).toHaveBeenCalledTimes(2)
  })

  it('successful refresh atomically replaces the index', async () => {
    buildIndexFromDb.mockResolvedValueOnce(emptyIndex('v1'))
    await runtime.refresh()

    const v2 = emptyIndex('v2')
    v2.skills.set('Guard', { name: 'Guard', maxLevel: 5 })
    buildIndexFromDb.mockResolvedValueOnce(v2)
    await runtime.refresh()

    expect(runtime.getSkillNames().sort()).toEqual(['Attack Boost', 'Guard'])
  })

  it('getSkillMaxLevel / getSetSkillNames reflect the current index', async () => {
    const index = emptyIndex('v1')
    index.setSkills.set("Gore's Tyranny", { name: "Gore's Tyranny", skillName: 'Antivirus', piecesRequired: 2, bonusLevels: [2, 4] })
    buildIndexFromDb.mockResolvedValueOnce(index)
    await runtime.refresh()

    expect(runtime.getSkillMaxLevel('Attack Boost')).toBe(5)
    expect(runtime.getSkillMaxLevel('Unknown Skill')).toBeUndefined()
    expect(runtime.getSetSkillNames()).toEqual(["Gore's Tyranny"])
  })

  it('merges custom talismans into the talisman pool for a userId search without mutating the shared index', async () => {
    buildIndexFromDb.mockResolvedValueOnce(emptyIndex('v1'))
    await runtime.refresh()

    loadCustomTalismans.mockResolvedValueOnce([
      { name: 'My Talisman', type: 'talisman', skills: {}, groupSkills: [], setSkills: [], slots: [], defense: 0, resists: [0, 0, 0, 0, 0], rank: 'high', rarity: 0 },
    ])
    await runtime.searchSets({ skills: {} }, 'user-1')

    expect(loadCustomTalismans).toHaveBeenCalledWith('user-1', 'high')
  })
})
