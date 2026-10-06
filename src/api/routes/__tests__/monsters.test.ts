import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MonsterDetail, MonsterListItem } from '../../../domains/mh-wilds-catalog/schema'

const getMonsters = vi.fn<() => Promise<MonsterListItem[]>>()
const getMonster = vi.fn<(id: string) => Promise<MonsterDetail | null>>()

vi.mock('../../../domains/mh-wilds-catalog/service', () => ({
  CatalogService: { getMonsters: () => getMonsters(), getMonster: (id: string) => getMonster(id) },
}))

const { monstersRoutes } = await import('../monsters')

const listItem: MonsterListItem = { id: 'mon_1', name: 'Rathalos', species: 'flying-wyvern', baseHealth: 4500, iconUrl: '/api/mh-wilds/monster-icons/Rathalos_Icon.png' }
const detail: MonsterDetail = {
  ...listItem,
  description: 'King of the Skies',
  size: { base: 1704.22 },
  dataVersion: { hash: 'abc', fetchedAt: '2026-10-06T00:00:00.000Z' },
  parts: [
    {
      id: 'mon_1:2883',
      kind: 'head',
      name: 'head',
      health: 500,
      kinsectEssence: 'red',
      multipliers: { slash: 0.65, blunt: 0.7, pierce: 0.6, fire: 0, water: 0.15, thunder: 0.2, ice: 0.15, dragon: 0.3, stun: 1 },
    },
  ],
  weaknesses: [{ kind: 'element', name: 'dragon', level: 1, condition: null }],
}

const req = (url: string) => monstersRoutes.handle(new Request(`http://localhost${url}`))

describe('monsters routes', () => {
  beforeEach(() => {
    getMonsters.mockReset().mockResolvedValue([listItem])
    getMonster.mockReset().mockResolvedValue(detail)
  })

  it('lists monsters', async () => {
    const res = await req('/monsters')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([listItem])
  })

  it('returns a monster with parts and weaknesses', async () => {
    const res = await req('/monsters/mon_1')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(detail)
    expect(getMonster).toHaveBeenCalledWith('mon_1')
  })

  it('returns 404 for an unknown monster', async () => {
    getMonster.mockResolvedValue(null)
    const res = await req('/monsters/nope')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Monster not found.' } })
  })
})
