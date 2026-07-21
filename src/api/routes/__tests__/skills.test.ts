import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SkillCatalogResponse } from '../../../domains/mh-wilds-catalog/schema'

const getSkills = vi.fn<() => Promise<SkillCatalogResponse>>()

vi.mock('../../../domains/mh-wilds-catalog/service', () => ({
  CatalogService: { getSkills: () => getSkills() },
}))

// Imported after the mock so the route picks up the mocked service.
const { skillsRoutes } = await import('../skills')

const sample: SkillCatalogResponse = {
  skills: [{ id: 'skl_1', name: 'Attack Boost', kind: 'armor', maxLevel: 5 }],
  bonuses: [
    {
      id: 'bns_1',
      name: "Gore's Tyranny",
      kind: 'set',
      thresholds: [
        { piecesRequired: 2, effectName: 'Antivirus', level: 1 },
        { piecesRequired: 4, effectName: 'Antivirus', level: 2 },
      ],
    },
  ],
}

const req = (url: string) => skillsRoutes.handle(new Request(`http://localhost${url}`))

describe('GET /skills', () => {
  beforeEach(() => {
    getSkills.mockReset()
    getSkills.mockResolvedValue(sample)
  })

  it('returns the split skills + bonuses catalog (ADR-0011)', async () => {
    const res = await req('/skills')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(sample)
  })

  it('validates the response shape (rejects a malformed bonus)', async () => {
    // Missing `thresholds` violates the response contract → 422 from Elysia.
    getSkills.mockResolvedValue({ skills: [], bonuses: [{ id: 'x', name: 'Bad', kind: 'set' }] } as unknown as SkillCatalogResponse)
    const res = await req('/skills')
    expect(res.status).toBe(422)
  })
})
