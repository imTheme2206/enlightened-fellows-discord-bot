import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SetBuilderError } from '../../../domains/set-builder/errors'
import type { BuildResponse, BuildSummary } from '../../../domains/set-builder/schema'

const service = {
  create: vi.fn(),
  get: vi.fn(),
  listOwned: vi.fn(),
  listShared: vi.fn(),
  replace: vi.fn(),
  updateMetadata: vi.fn(),
  remove: vi.fn(),
}
const verifyDiscordId = vi.fn<(h: string | null) => Promise<string | null>>()

vi.mock('../../../domains/set-builder/service', () => ({ SetBuilderService: service }))
vi.mock('../../middleware/user-auth-guard', () => ({ verifyDiscordId: (h: string | null) => verifyDiscordId(h) }))

// Imported after the mocks so the routes pick up the mocked service + guard.
const { buildsPublicRoutes, buildsOwnerRoutes } = await import('../builds')

const emptySnapshot = {
  schemaVersion: 1 as const,
  positions: { head: null, chest: null, arms: null, waist: null, legs: null, talisman: null },
  skillDefinitions: {},
  bonusDefinitions: {},
}
const build: BuildResponse = {
  id: 'b1',
  name: 'My Build',
  description: null,
  isShared: false,
  sharedAt: null,
  revision: 1,
  isStale: false,
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z',
  composition: emptySnapshot,
}
const summary: BuildSummary = (({ composition: _c, ...rest }) => rest)(build)

const AUTH = 'Bearer good'
const UUID = '11111111-1111-4111-8111-111111111111'

const publicReq = (url: string, init?: RequestInit) => buildsPublicRoutes.handle(new Request(`http://localhost${url}`, init))
const ownerReq = (url: string, init?: RequestInit) => buildsOwnerRoutes.handle(new Request(`http://localhost${url}`, init))
const jsonInit = (method: string, body: unknown, headers: Record<string, string> = {}) => ({
  method,
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
})
const validSave = { name: 'X', isShared: false, composition: emptySnapshot.positions }

beforeEach(() => {
  vi.clearAllMocks()
  verifyDiscordId.mockResolvedValue(null)
})

describe('public build reads', () => {
  it('GET /builds/:id returns the build without requiring auth', async () => {
    service.get.mockResolvedValue(build)
    const res = await publicReq('/builds/b1')
    expect(res.status).toBe(200)
    expect((await res.json()).id).toBe('b1')
  })

  it('maps BUILD_NOT_FOUND to 404 with the error envelope', async () => {
    service.get.mockRejectedValue(new SetBuilderError('BUILD_NOT_FOUND', { id: 'nope' }))
    const res = await publicReq('/builds/nope')
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('BUILD_NOT_FOUND')
  })

  it('GET /builds/shared returns items with a null cursor on a short page', async () => {
    service.listShared.mockResolvedValue([summary])
    const res = await publicReq('/builds/shared')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(1)
    expect(body.nextCursor).toBeNull()
  })

  it('emits a nextCursor when the page is full and decodes it back on the next call', async () => {
    const shared: BuildSummary = { ...summary, id: 'b9', isShared: true, sharedAt: '2026-07-01T00:00:00.000Z' }
    service.listShared.mockResolvedValue([shared])
    const first = await publicReq('/builds/shared?limit=1')
    const { nextCursor } = await first.json()
    expect(nextCursor).toBeTruthy()

    await publicReq(`/builds/shared?limit=1&cursor=${encodeURIComponent(nextCursor)}`)
    const passedCursor = service.listShared.mock.calls[1][1]
    expect(passedCursor).toEqual({ sharedAt: new Date('2026-07-01T00:00:00.000Z'), id: 'b9' })
  })
})

describe('owner routes require a JWT', () => {
  it('GET /builds is 401 without a valid token', async () => {
    const res = await ownerReq('/builds')
    expect(res.status).toBe(401)
  })

  it('GET /builds returns owner summaries with a valid token', async () => {
    verifyDiscordId.mockResolvedValue('user-1')
    service.listOwned.mockResolvedValue([summary])
    const res = await ownerReq('/builds', { headers: { authorization: AUTH } })
    expect(res.status).toBe(200)
    expect(service.listOwned).toHaveBeenCalledWith('user-1')
  })
})

describe('POST /builds', () => {
  beforeEach(() => verifyDiscordId.mockResolvedValue('user-1'))

  it('rejects a missing Idempotency-Key with 400', async () => {
    const res = await ownerReq('/builds', jsonInit('POST', validSave, { authorization: AUTH }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('IDEMPOTENCY_KEY_REQUIRED')
  })

  it('rejects a non-UUID Idempotency-Key with 400', async () => {
    const res = await ownerReq('/builds', jsonInit('POST', validSave, { authorization: AUTH, 'idempotency-key': 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })

  it('creates with a valid key, forwarding the key to the service', async () => {
    service.create.mockResolvedValue(build)
    const res = await ownerReq('/builds', jsonInit('POST', validSave, { authorization: AUTH, 'idempotency-key': UUID }))
    expect(res.status).toBe(200)
    expect(service.create).toHaveBeenCalledWith('user-1', expect.objectContaining({ name: 'X' }), UUID)
  })

  it('maps a malformed body to 400', async () => {
    const res = await ownerReq('/builds', jsonInit('POST', { name: 'X' }, { authorization: AUTH, 'idempotency-key': UUID }))
    expect(res.status).toBe(400)
  })

  it('maps IDEMPOTENCY_KEY_REUSED to 409', async () => {
    service.create.mockRejectedValue(new SetBuilderError('IDEMPOTENCY_KEY_REUSED'))
    const res = await ownerReq('/builds', jsonInit('POST', validSave, { authorization: AUTH, 'idempotency-key': UUID }))
    expect(res.status).toBe(409)
  })
})

describe('owner mutations', () => {
  beforeEach(() => verifyDiscordId.mockResolvedValue('user-1'))

  it('PUT forwards the ?revision to the service', async () => {
    service.replace.mockResolvedValue({ ...build, revision: 3 })
    const res = await ownerReq('/builds/b1?revision=2', jsonInit('PUT', validSave, { authorization: AUTH }))
    expect(res.status).toBe(200)
    expect(service.replace).toHaveBeenCalledWith('user-1', 'b1', expect.any(Object), 2)
  })

  it('PATCH forwards metadata + revision and maps REVISION_CONFLICT to 409', async () => {
    service.updateMetadata.mockRejectedValue(new SetBuilderError('REVISION_CONFLICT', { expected: 1, actual: 2 }))
    const res = await ownerReq('/builds/b1?revision=1', jsonInit('PATCH', { name: 'New' }, { authorization: AUTH }))
    expect(res.status).toBe(409)
  })

  it('DELETE returns { ok: true }', async () => {
    service.remove.mockResolvedValue(undefined)
    const res = await ownerReq('/builds/b1', { method: 'DELETE', headers: { authorization: AUTH } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(service.remove).toHaveBeenCalledWith('user-1', 'b1')
  })

  it('maps NOT_OWNER to 403', async () => {
    service.remove.mockRejectedValue(new SetBuilderError('NOT_OWNER'))
    const res = await ownerReq('/builds/b1', { method: 'DELETE', headers: { authorization: AUTH } })
    expect(res.status).toBe(403)
  })
})
