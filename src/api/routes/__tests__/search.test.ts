import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SetSearchTimeoutError } from '../../../domains/set-search/search-worker-client'
import type { SearchResult } from '../../../domains/set-search/types'

const searchSets = vi.fn<(input: unknown, userId?: string) => Promise<SearchResult[]>>()
const verifyDiscordId = vi.fn<(authHeader: string | null) => Promise<string | null>>()

vi.mock('../../../domains/set-search/service', () => ({
  searchSets: (input: unknown, userId?: string) => searchSets(input, userId),
}))

vi.mock('../../middleware/user-auth-guard', () => ({
  verifyDiscordId: (authHeader: string | null) => verifyDiscordId(authHeader),
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
    }),
  )

describe('POST /search', () => {
  beforeEach(() => {
    searchSets.mockReset()
    verifyDiscordId.mockReset()
    verifyDiscordId.mockResolvedValue(null)
  })

  it('runs the search and returns the enriched result', async () => {
    searchSets.mockResolvedValue([sampleResult])
    const res = await post({ skills: { 'Weakness Exploit': 5 }, rank: 'high' })
    expect(res.status).toBe(200)
    expect(searchSets).toHaveBeenCalledWith({ skills: { 'Weakness Exploit': 5 }, rank: 'high' }, undefined)
    const body = (await res.json()) as SearchResult[]
    expect(body[0].rarities).toEqual([8, 8, 7, 6, 5, 0])
    expect(body[0].elementalDefenses).toEqual({
      fire: 10,
      water: 5,
      thunder: -3,
      ice: 2,
      dragon: 0,
    })
  })

  it('rejects an invalid rank (422) without invoking the engine', async () => {
    searchSets.mockResolvedValue([])
    const res = await post({ skills: {}, rank: 'bogus' })
    expect(res.status).toBe(422)
    expect(searchSets).not.toHaveBeenCalled()
  })

  it("merges in the requester's custom talismans when a valid bearer token is present", async () => {
    verifyDiscordId.mockResolvedValue('discord-user-123')
    searchSets.mockResolvedValue([sampleResult])
    const res = await searchRoutes.handle(
      new Request('http://localhost/search', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer token',
        },
        body: JSON.stringify({
          skills: { 'Weakness Exploit': 5 },
          rank: 'high',
        }),
      }),
    )
    expect(res.status).toBe(200)
    expect(searchSets).toHaveBeenCalledWith({ skills: { 'Weakness Exploit': 5 }, rank: 'high' }, 'discord-user-123')
  })

  it('returns a retryable response when the worker compute budget is exhausted', async () => {
    searchSets.mockRejectedValue(new SetSearchTimeoutError())

    const res = await post({ skills: { Agitator: 1 }, rank: 'high' })

    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({
      error: 'Search is too broad to finish within the compute budget. Add another skill or filter and retry.',
    })
  })
})
