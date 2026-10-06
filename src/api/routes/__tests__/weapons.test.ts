import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WeaponCatalogItem, WeaponCatalogQuery } from '../../../domains/mh-wilds-catalog/schema'

const getWeapons = vi.fn<(query?: WeaponCatalogQuery) => Promise<WeaponCatalogItem[]>>()

vi.mock('../../../domains/mh-wilds-catalog/service', () => ({
  CatalogService: { getWeapons: (q?: WeaponCatalogQuery) => getWeapons(q) },
}))

// Imported after the mock so the route picks up the mocked service.
const { weaponsRoutes } = await import('../weapons')

const sample: WeaponCatalogItem = {
  id: 'wpn_1',
  name: 'Rey Tonitrus I',
  kind: 'long-sword',
  rarity: 3,
  damage: { raw: 140, display: 462 },
  affinity: 0,
  specials: [{ kind: 'element', name: 'thunder', damage: { raw: 15, display: 150 }, hidden: false }],
  sharpness: { red: 10, orange: 10, yellow: 150, green: 80, blue: 0, white: 0, purple: 0 },
  handicraft: [5],
  slots: [],
  skills: [{ skillId: 'skl_1', name: 'Punishing Draw', level: 1 }],
  elderseal: null,
  defenseBonus: 0,
  series: 'Rey Dau Tree',
  kindSpecific: {},
}

const req = (url: string) => weaponsRoutes.handle(new Request(`http://localhost${url}`))

describe('GET /weapons', () => {
  beforeEach(() => {
    getWeapons.mockReset()
    getWeapons.mockResolvedValue([sample])
  })

  it('returns the weapon catalog', async () => {
    const res = await req('/weapons')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([sample])
  })

  it('passes the kind filter through', async () => {
    await req('/weapons?kind=long-sword')
    expect(getWeapons).toHaveBeenCalledWith({ kind: 'long-sword' })
  })

  it('rejects an unknown kind with 422', async () => {
    const res = await req('/weapons?kind=boomerang')
    expect(res.status).toBe(422)
    expect(getWeapons).not.toHaveBeenCalled()
  })
})
