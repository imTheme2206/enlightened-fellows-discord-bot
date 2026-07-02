import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchResult } from '../../../domains/set-search/types'

const searchSets = vi.fn<(input: unknown) => SearchResult[]>()

vi.mock('../../../domains/set-search/service', () => ({
  searchSets: (input: unknown) => searchSets(input),
}))

// Imported after the mock so the route picks up the mocked service.
const { searchRoutes } = await import('../search')

const sampleResult: SearchResult = {
  armorNames: ['G Arkveld Helm', 'G Arkveld Mail', 'Arms', 'Waist', 'Legs', 'Talisman'],
  rarities: [8, 8, 7, 6, 5, 0],
  skills: { 'Weakness Exploit': 5 },
  setSkills: {},
  groupSkills: {},
  decoNames: ['Tenderizer Jewel'],
  freeSlots: [3, 1],
  slots: [3, 2, 1],
  defense: 240,
  elementalDefenses: { fire: 10, water: 5, thunder: -3, ice: 2, dragon: 0 },
}

const post = (body: unknown) =>
  searchRoutes.handle(
    new Request('http://localhost/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  )

describe('POST /search', () => {
  beforeEach(() => {
    searchSets.mockReset()
  })

  it('runs the search and returns the enriched result', async () => {
    searchSets.mockReturnValue([sampleResult])
    const res = await post({ skills: { 'Weakness Exploit': 5 }, rank: 'high' })
    expect(res.status).toBe(200)
    expect(searchSets).toHaveBeenCalledWith({ skills: { 'Weakness Exploit': 5 }, rank: 'high' })
    const body = (await res.json()) as SearchResult[]
    expect(body[0].rarities).toEqual([8, 8, 7, 6, 5, 0])
    expect(body[0].elementalDefenses).toEqual({ fire: 10, water: 5, thunder: -3, ice: 2, dragon: 0 })
  })

  it('rejects an invalid rank (422) without invoking the engine', async () => {
    searchSets.mockReturnValue([])
    const res = await post({ skills: {}, rank: 'bogus' })
    expect(res.status).toBe(422)
    expect(searchSets).not.toHaveBeenCalled()
  })
})
