import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Skill } from '../../../infra/db/schema'

const getAll = vi.fn<(query?: unknown) => Promise<Skill[]>>()

vi.mock('../../../domains/skills/service', () => ({
  SkillService: { getAll: (query?: unknown) => getAll(query) },
}))

// Imported after the mock so the route picks up the mocked service.
const { skillsRoutes } = await import('../skills')

const sampleSkill: Skill = {
  id: 'skl_1',
  name: 'Attack Boost',
  cleanName: 'Attack Boost',
  type: 'armor',
  maxLevel: 5,
  isSetSkill: false,
  isGroupSkill: false,
  requiredPieces: null,
  effectName: null,
}

const req = (url: string) => skillsRoutes.handle(new Request(`http://localhost${url}`))

describe('GET /skills', () => {
  beforeEach(() => {
    getAll.mockReset()
    getAll.mockResolvedValue([sampleSkill])
  })

  it('returns the validated skill list', async () => {
    const res = await req('/skills')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([sampleSkill])
  })

  it('coerces query params through the Zod contract', async () => {
    await req('/skills?type=armor&setSkill=true')
    expect(getAll).toHaveBeenCalledWith({ type: 'armor', setSkill: true })
  })

  it('rejects an invalid query value (422)', async () => {
    const res = await req('/skills?type=bogus')
    expect(res.status).toBe(422)
    expect(getAll).not.toHaveBeenCalled()
  })
})
