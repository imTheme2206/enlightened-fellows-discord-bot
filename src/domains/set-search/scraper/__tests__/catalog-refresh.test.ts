import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Conflict } from '../../../mh-wilds-catalog/ingestion/reconcile'

// Hermetic: no DB, no network. fetch is stubbed per endpoint; persistence services,
// the job log, the sync-state table and the search index are in-memory fakes.
const reconcileEquipment = vi.fn()
vi.mock('../../../mh-wilds-catalog/ingestion/service', () => ({
  CatalogIngestionService: { reconcileAndPersist: (...a: unknown[]) => reconcileEquipment(...a) },
}))

const reconcileMonsters = vi.fn()
vi.mock('../../../mh-wilds-catalog/ingestion/monster-service', () => ({
  MonsterIngestionService: { reconcileAndPersist: (...a: unknown[]) => reconcileMonsters(...a) },
}))

const syncState = new Map<string, string>()
vi.mock('../../../mh-wilds-catalog/ingestion/sync-state', () => ({
  CatalogSyncStateService: {
    getHashes: async (sources: string[]) =>
      new Map(sources.filter((s) => syncState.has(s)).map((s) => [s, syncState.get(s)!])),
    recordHashes: async (hashes: Record<string, string>) => {
      for (const [k, v] of Object.entries(hashes)) syncState.set(k, v)
    },
  },
}))

const jobLog = vi.fn()
vi.mock('../../../job-logs/service', () => ({
  JobLogService: { log: (...a: unknown[]) => jobLog(...a) },
}))

const refresh = vi.fn()
vi.mock('../../runtime', () => ({ refresh: () => refresh() }))

const monsterFeed = (headSlash = 0.65) => [
  {
    id: 29,
    gameId: 123,
    kind: 'large',
    name: 'Rathalos',
    species: 'flying-wyvern',
    description: 'King of the Skies',
    baseHealth: 4500,
    size: {},
    parts: [
      {
        id: 1,
        kind: 'head',
        name: 'head',
        health: 500,
        kinsectEssence: null,
        multipliers: { slash: headSlash, blunt: 0.7, pierce: 0.6, fire: 0, water: 0.1, thunder: 0.2, ice: 0.1, dragon: 0.3, stun: 1 },
      },
    ],
    weaknesses: [],
  },
]

let monsters = monsterFeed()
let gate: Promise<void> | null = null
const fetchMock = vi.fn(async (url: string) => {
  if (gate) await gate
  const body = url.endsWith('/monsters') ? monsters : []
  return new Response(JSON.stringify(body), { status: 200 })
})

const noInserts = { armorCount: 0, skillCount: 0, decoCount: 0, weaponCount: 0, bonusCount: 0 }

describe('scheduled catalog refresh (runScraper with skipUnchanged)', () => {
  let runScraper: typeof import('../index').runScraper

  beforeEach(async () => {
    vi.resetModules()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockClear()
    syncState.clear()
    monsters = monsterFeed()
    gate = null
    reconcileEquipment.mockReset().mockResolvedValue(noInserts)
    reconcileMonsters.mockReset().mockResolvedValue({ inserted: 0, updated: 0, unchanged: 1 })
    jobLog.mockReset().mockResolvedValue(undefined)
    refresh.mockReset().mockResolvedValue(undefined)
    ;({ runScraper } = await import('../index'))
  })

  it('short-circuits both domains when payloads are unchanged since the last successful run', async () => {
    const first = await runScraper({ source: 'cron', skipUnchanged: true })
    expect(first.equipmentUnchanged).toBeUndefined()
    expect(reconcileEquipment).toHaveBeenCalledTimes(1)
    expect(reconcileMonsters).toHaveBeenCalledTimes(1)

    const second = await runScraper({ source: 'cron', skipUnchanged: true })
    expect(second).toMatchObject({ equipmentUnchanged: true, monstersUnchanged: true, armorCount: 0 })
    expect(reconcileEquipment).toHaveBeenCalledTimes(1)
    expect(reconcileMonsters).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(jobLog).toHaveBeenCalledWith('scraper:cron', 'SUCCESS', JSON.stringify({ unchanged: true }))
    expect(jobLog).toHaveBeenCalledWith('scraper:cron:monsters', 'SUCCESS', JSON.stringify({ unchanged: true }))
  })

  it('reconciles only the domain whose payload changed', async () => {
    await runScraper({ source: 'cron', skipUnchanged: true })
    monsters = monsterFeed(0.5)
    reconcileMonsters.mockResolvedValue({ inserted: 0, updated: 1, unchanged: 0 })

    const result = await runScraper({ source: 'cron', skipUnchanged: true })
    expect(result).toMatchObject({ equipmentUnchanged: true, monsterUpdatedCount: 1 })
    expect(reconcileEquipment).toHaveBeenCalledTimes(1)
    expect(reconcileMonsters).toHaveBeenCalledTimes(2)
  })

  it('does not consult stored hashes unless skipUnchanged is set (manual/boot always reconcile)', async () => {
    await runScraper({ source: 'cron', skipUnchanged: true })
    await runScraper({ source: 'manual' })
    expect(reconcileEquipment).toHaveBeenCalledTimes(2)
    expect(reconcileMonsters).toHaveBeenCalledTimes(2)
  })

  it('applies a monster change while an equipment conflict is rejected and logged in the same run', async () => {
    const conflicts = [{ kind: 'armor', key: 'head:Foo', field: 'rarity' }] as unknown as Conflict[]
    const { ScrapeConflictError } = await import('../../../mh-wilds-catalog/ingestion/errors')
    reconcileEquipment.mockRejectedValue(new ScrapeConflictError(conflicts))
    reconcileMonsters.mockResolvedValue({ inserted: 0, updated: 1, unchanged: 0 })

    await expect(runScraper({ source: 'cron', skipUnchanged: true })).rejects.toBeInstanceOf(ScrapeConflictError)

    expect(reconcileMonsters).toHaveBeenCalledTimes(1)
    expect(jobLog).toHaveBeenCalledWith('scraper:cron:monsters', 'SUCCESS', JSON.stringify({ inserted: 0, updated: 1, unchanged: 0 }))
    const failed = jobLog.mock.calls.find(([name, status]) => name === 'scraper:cron' && status === 'FAILED')
    expect(JSON.parse(failed![2])).toMatchObject({ total: 1, conflicts })
    // Monsters are recorded as synced; the rejected equipment is not, so it is retried next run.
    expect(syncState.has('monsters')).toBe(true)
    expect([...syncState.keys()].some((k) => k.startsWith('equipment:'))).toBe(false)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('skips a concurrent trigger instead of running twice', async () => {
    let release!: () => void
    gate = new Promise<void>((r) => (release = r))

    const running = runScraper({ source: 'boot' })
    const concurrent = await runScraper({ source: 'cron', skipUnchanged: true })
    expect(concurrent).toMatchObject({ skipped: true, armorCount: 0, monsterInsertedCount: 0 })
    expect(reconcileEquipment).not.toHaveBeenCalled()

    release()
    await running
    expect(reconcileEquipment).toHaveBeenCalledTimes(1)
    expect(reconcileMonsters).toHaveBeenCalledTimes(1)

    // The lock is released afterwards.
    expect((await runScraper({ source: 'manual' })).skipped).toBeUndefined()
  })
})
