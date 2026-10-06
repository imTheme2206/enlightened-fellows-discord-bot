import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MhdbMonster } from '../mhdb-types'
import { mapMhdbMonsters, reconcileMonsters } from '../monsters'

const multipliers = { slash: 0.65, blunt: 0.7, pierce: 0.6, fire: 0, water: 0.15, thunder: 0.2, ice: 0.15, dragon: 0.3, stun: 1 }

const rathalos = (headSlash = 0.65): MhdbMonster => ({
  id: 29,
  gameId: 123,
  kind: 'large',
  name: 'Rathalos',
  species: 'flying-wyvern',
  description: 'King of the Skies',
  baseHealth: 4500,
  size: { base: 1704.22, mini: 1533.798 },
  parts: [
    { id: 2883, kind: 'head', name: 'head', health: 500, kinsectEssence: 'red', multipliers: { ...multipliers, slash: headSlash } },
    { id: 2884, kind: 'hide', name: 'hide', health: null, kinsectEssence: null, multipliers },
    { id: 2885, kind: 'hide', name: 'hide', health: null, kinsectEssence: null, multipliers },
  ],
  weaknesses: [
    { kind: 'element', element: 'dragon', level: 1, condition: null },
    { kind: 'status', status: 'paralysis', level: 2, condition: null },
    { kind: 'effect', effect: 'flash', level: 1, condition: 'only while airborne' },
  ],
})

describe('mapMhdbMonsters', () => {
  it('keeps large monsters only and flattens weaknesses', () => {
    const small = { ...rathalos(), id: 1, name: 'Vespoid', kind: 'small' as const }
    const [m, ...rest] = mapMhdbMonsters([rathalos(), small])
    expect(rest).toEqual([])
    expect(m.parts[0]).toMatchObject({ upstreamId: 2883, kind: 'head', health: 500 })
    expect(m.parts[0].multipliers.slash).toBe(0.65)
    expect(m.weaknesses.map((w) => w.name)).toEqual(['dragon', 'paralysis', 'flash'])
  })

  it('keeps repeated part kinds distinct by upstream id', () => {
    const [m] = mapMhdbMonsters([rathalos()])
    expect(m.parts.filter((p) => p.kind === 'hide').map((p) => p.upstreamId)).toEqual([2884, 2885])
  })

  it('hashes content deterministically and detects a multiplier change', () => {
    const [a] = mapMhdbMonsters([rathalos()])
    const [b] = mapMhdbMonsters([rathalos()])
    const [c] = mapMhdbMonsters([rathalos(0.7)])
    expect(a.contentHash).toBe(b.contentHash)
    expect(a.contentHash).not.toBe(c.contentHash)
  })

})

describe('reconcileMonsters', () => {
  const [stored] = mapMhdbMonsters([rathalos()])
  const existing = [{ id: 'mon_1', name: stored.name, contentHash: stored.contentHash }]

  it('inserts unknown monsters', () => {
    expect(reconcileMonsters([], [stored])).toEqual({ inserts: [stored], updates: [], unchanged: 0 })
  })

  it('is a no-op for identical content', () => {
    expect(reconcileMonsters(existing, [stored])).toEqual({ inserts: [], updates: [], unchanged: 1 })
  })

  it('replaces changed content under the same id', () => {
    const [changed] = mapMhdbMonsters([rathalos(0.7)])
    const plan = reconcileMonsters(existing, [changed])
    expect(plan.inserts).toEqual([])
    expect(plan.updates).toEqual([{ id: 'mon_1', record: changed }])
  })

  it('retains monsters missing from the scrape', () => {
    expect(reconcileMonsters(existing, [])).toEqual({ inserts: [], updates: [], unchanged: 0 })
  })
})

// --- persistence (ADR-0015): in-memory fake of the Drizzle calls the service makes ---------------------

type Row = Record<string, unknown>
const store = vi.hoisted(() => ({ monster: [] as Row[], monsterPart: [] as Row[], monsterWeakness: [] as Row[], writes: 0 }))

vi.mock('../../../../infra/db/schema', () => ({
  monster: { _t: 'monster', id: 'id', name: 'name', contentHash: 'contentHash' },
  monsterPart: { _t: 'monsterPart', monsterId: 'monsterId' },
  monsterWeakness: { _t: 'monsterWeakness', monsterId: 'monsterId' },
}))
vi.mock('drizzle-orm', () => ({ count: () => 'count', eq: (col: string, value: unknown) => ({ col, value }) }))
vi.mock('../../../../infra/db/client', () => {
  const tx = {
    insert: (t: { _t: keyof typeof store }) => ({
      values: async (v: Row | Row[]) => {
        store.writes++
        ;(store[t._t] as Row[]).push(...(Array.isArray(v) ? v : [v]))
      },
    }),
    update: (t: { _t: keyof typeof store }) => ({
      set: (patch: Row) => ({
        where: async ({ value }: { value: unknown }) => {
          store.writes++
          for (const r of store[t._t] as Row[]) if (r.id === value) Object.assign(r, patch)
        },
      }),
    }),
    delete: (t: { _t: keyof typeof store }) => ({
      where: async ({ col, value }: { col: string; value: unknown }) => {
        store.writes++
        ;(store as unknown as Record<string, Row[]>)[t._t] = (store[t._t] as Row[]).filter((r) => r[col] !== value)
      },
    }),
  }
  return {
    db: {
      select: () => ({ from: async () => store.monster.map(({ id, name, contentHash }) => ({ id, name, contentHash })) }),
      transaction: async (cb: (t: typeof tx) => Promise<void>) => cb(tx),
    },
  }
})

const { MonsterIngestionService } = await import('../monster-service')

describe('MonsterIngestionService.reconcileAndPersist', () => {
  beforeEach(() => {
    store.monster.length = 0
    store.monsterPart.length = 0
    store.monsterWeakness.length = 0
    store.writes = 0
  })

  it('writes nothing when re-run with unchanged data', async () => {
    await MonsterIngestionService.reconcileAndPersist(mapMhdbMonsters([rathalos()]), new Date('2026-01-01'))
    store.writes = 0
    const r = await MonsterIngestionService.reconcileAndPersist(mapMhdbMonsters([rathalos()]), new Date('2026-02-01'))
    expect(r).toEqual({ inserted: 0, updated: 0, unchanged: 1 })
    expect(store.writes).toBe(0)
    expect(store.monster[0].fetchedAt).toEqual(new Date('2026-01-01'))
  })

  it('updates changed multipliers in place and bumps the data version', async () => {
    await MonsterIngestionService.reconcileAndPersist(mapMhdbMonsters([rathalos()]), new Date('2026-01-01'))
    const before = { ...store.monster[0] }
    expect(store.monsterPart).toHaveLength(3)

    const r = await MonsterIngestionService.reconcileAndPersist(mapMhdbMonsters([rathalos(0.7)]), new Date('2026-02-01'))

    expect(r).toEqual({ inserted: 0, updated: 1, unchanged: 0 })
    expect(store.monster).toHaveLength(1)
    expect(store.monster[0].id).toBe(before.id)
    expect(store.monster[0].contentHash).not.toBe(before.contentHash)
    expect(store.monster[0].fetchedAt).toEqual(new Date('2026-02-01'))
    expect(store.monsterPart).toHaveLength(3)
    const head = store.monsterPart.find((p) => p.upstreamId === 2883)!
    expect((head.multipliers as { slash: number }).slash).toBe(0.7)
    expect(head.id).toBe(`${before.id}:2883`)
    expect(store.monsterWeakness).toHaveLength(3)
  })
})
