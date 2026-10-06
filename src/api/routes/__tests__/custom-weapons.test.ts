import { beforeEach, describe, expect, it, vi } from 'vitest'

const service = {
  list: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
}
const verifyDiscordId = vi.fn<(header: string | null) => Promise<string | null>>()

vi.mock('../../../domains/custom-weapons/service', () => ({
  CustomWeaponService: service,
  CustomWeaponValidationError: class CustomWeaponValidationError extends Error {},
  CustomWeaponConflictError: class CustomWeaponConflictError extends Error {},
}))
vi.mock('../../middleware/user-auth-guard', () => ({ verifyDiscordId: (header: string | null) => verifyDiscordId(header) }))

const { customWeaponsRoutes } = await import('../custom-weapons')

const AUTH = 'Bearer good'
const weapon = {
  id: 'weapon-1',
  userId: 'user-1',
  name: 'My Gogma Great Sword',
  weaponId: 'gogma-gs',
  customization: {
    element: 'fire',
    attackParts: 2,
    affinityParts: 1,
    elementInfusion: true,
    reinforcements: [{ type: 'attack', level: 'EX' }],
  },
  setBonusId: 'set-1',
  groupBonusId: 'group-1',
  createdAt: new Date('2026-10-06T00:00:00.000Z'),
}
const createBody = {
  name: 'My Gogma Great Sword',
  weaponId: 'gogma-gs',
  customization: weapon.customization,
  setBonusId: 'set-1',
  groupBonusId: 'group-1',
}
const request = (url: string, init?: RequestInit) => customWeaponsRoutes.handle(new Request(`http://localhost${url}`, init))
const jsonInit = (method: string, body: unknown, headers: Record<string, string> = {}) => ({
  method,
  headers: { authorization: AUTH, 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
})

beforeEach(() => {
  vi.clearAllMocks()
  verifyDiscordId.mockResolvedValue('user-1')
})

describe('custom weapon routes', () => {
  it('requires an authenticated owner for collection reads', async () => {
    verifyDiscordId.mockResolvedValueOnce(null)
    const response = await request('/custom-weapons')
    expect(response.status).toBe(401)
    expect(service.list).not.toHaveBeenCalled()
  })

  it('lists only the authenticated owner collection', async () => {
    service.list.mockResolvedValue([weapon])
    const response = await request('/custom-weapons', { headers: { authorization: AUTH } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([{ ...weapon, createdAt: '2026-10-06T00:00:00.000Z' }])
    expect(service.list).toHaveBeenCalledWith('user-1')
  })

  it('validates and creates the Artian weapon payload for its owner', async () => {
    service.create.mockResolvedValue(weapon)
    const response = await request('/custom-weapons', jsonInit('POST', createBody))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ...weapon, createdAt: '2026-10-06T00:00:00.000Z' })
    expect(service.create).toHaveBeenCalledWith('user-1', createBody)
  })

  it('rejects malformed customization before calling the service', async () => {
    const response = await request('/custom-weapons', jsonInit('POST', { ...createBody, customization: { element: null } }))
    expect(response.status).toBe(422)
    expect(service.create).not.toHaveBeenCalled()
  })

  it('deletes only through the owner scoped service and returns not found when absent', async () => {
    service.remove.mockResolvedValueOnce(true)
    const deleted = await request('/custom-weapons/weapon-1', { method: 'DELETE', headers: { authorization: AUTH } })
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toEqual({ ok: true })
    expect(service.remove).toHaveBeenCalledWith('user-1', 'weapon-1')

    service.remove.mockResolvedValueOnce(false)
    const missing = await request('/custom-weapons/missing', { method: 'DELETE', headers: { authorization: AUTH } })
    expect(missing.status).toBe(404)
  })
})
