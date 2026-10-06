import { describe, expect, it, vi } from 'vitest'
import { ARTIAN_RULES } from '../../../domains/mh-wilds-catalog/artian-rules'

vi.mock('../../../domains/mh-wilds-catalog/service', () => ({
  CatalogService: { getArtianRules: () => ARTIAN_RULES },
}))

// Imported after the mock so the route picks up the mocked service.
const { artianRulesRoutes } = await import('../artian-rules')

describe('GET /artian-rules', () => {
  it('serves the version-tagged rules table', async () => {
    const res = await artianRulesRoutes.handle(new Request('http://localhost/artian-rules'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.gameVersion).toBe(ARTIAN_RULES.gameVersion)
    expect(body.reinforcement.attack).toEqual({ I: 5, II: 6, III: 9, EX: 12 })
    expect(body.kinds['hunting-horn'].gogmaName).toBe('Onyx Choros')
    expect(Object.keys(body.kinds)).toHaveLength(14)
  })
})
