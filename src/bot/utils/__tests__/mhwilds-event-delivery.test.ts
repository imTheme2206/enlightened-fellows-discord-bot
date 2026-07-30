import dayjs from 'dayjs'
import { describe, expect, it, vi } from 'vitest'
import type { EventQuestItem } from '@imthmn/mh-wilds-event-scraper'
import type { EmbedPaginationEntry } from '../embed-pagination'
import { filterEvents, paginateEvents } from '../mhwilds-event-delivery'

// A fixed reference "now" so current-time-window filtering is deterministic.
const NOW = dayjs('2026-07-23T12:00:00.000Z')

function makeEvent(overrides: Partial<EventQuestItem> = {}): EventQuestItem {
  return {
    img: '',
    questName: 'Quest',
    difficulty: 1,
    requiredRank: 1,
    startAt: '2026-07-20T00:00:00.000Z',
    endAt: '2026-07-25T00:00:00.000Z',
    locales: '',
    isNewEvent: false,
    description: '',
    isPermanent: false,
    targetMonster: 'Rathalos',
    variant: 'normal',
    questType: 'hunt',
    amount: 1,
    ...overrides,
  }
}

describe('filterEvents', () => {
  it("returns every event unchanged for type 'all'", () => {
    const events = [makeEvent({ questName: 'A' }), makeEvent({ questName: 'B', isPermanent: true })]
    expect(filterEvents(events, 'all', NOW)).toEqual(events)
  })

  it("returns only permanent events for type 'permanent'", () => {
    const permanent = makeEvent({ questName: 'P', isPermanent: true })
    const limited = makeEvent({ questName: 'L', isPermanent: false })
    expect(filterEvents([permanent, limited], 'permanent', NOW)).toEqual([permanent])
  })

  it("keeps only events whose current-time window contains `now` for type 'limited'", () => {
    const active = makeEvent({ questName: 'active', startAt: '2026-07-20T00:00:00.000Z', endAt: '2026-07-25T00:00:00.000Z' })
    const future = makeEvent({ questName: 'future', startAt: '2026-07-24T00:00:00.000Z', endAt: '2026-07-30T00:00:00.000Z' })
    const past = makeEvent({ questName: 'past', startAt: '2026-07-10T00:00:00.000Z', endAt: '2026-07-22T00:00:00.000Z' })

    const result = filterEvents([active, future, past], 'limited', NOW)

    expect(result.map((e) => e.questName)).toEqual(['active'])
  })

  it("excludes events with missing or malformed dates for type 'limited'", () => {
    const missingStart = makeEvent({ questName: 'missing-start', startAt: '', endAt: '2026-07-25T00:00:00.000Z' })
    const missingEnd = makeEvent({ questName: 'missing-end', startAt: '2026-07-20T00:00:00.000Z', endAt: '' })
    const malformed = makeEvent({ questName: 'malformed', startAt: 'not-a-date', endAt: 'also-not-a-date' })

    expect(filterEvents([missingStart, missingEnd, malformed], 'limited', NOW)).toEqual([])
  })

  it("excludes permanent events even when their window contains `now` for type 'limited'", () => {
    const permanentInWindow = makeEvent({
      questName: 'permanent-in-window',
      isPermanent: true,
      startAt: '2026-07-20T00:00:00.000Z',
      endAt: '2026-07-25T00:00:00.000Z',
    })
    expect(filterEvents([permanentInWindow], 'limited', NOW)).toEqual([])
  })

  it("deduplicates by questName, keeping the first occurrence, for type 'limited'", () => {
    const first = makeEvent({ questName: 'dupe', targetMonster: 'Rathalos' })
    const second = makeEvent({ questName: 'dupe', targetMonster: 'Rathian' })

    const result = filterEvents([first, second], 'limited', NOW)

    expect(result).toHaveLength(1)
    expect(result[0].targetMonster).toBe('Rathalos')
  })

  it("returns an empty array when no limited event is currently active", () => {
    const past = makeEvent({ questName: 'past', startAt: '2026-07-01T00:00:00.000Z', endAt: '2026-07-05T00:00:00.000Z' })
    expect(filterEvents([past], 'limited', NOW)).toEqual([])
  })
})

describe('paginateEvents', () => {
  const entry = (): EmbedPaginationEntry => ({ embed: {} as EmbedPaginationEntry['embed'], attachments: [] })

  it('chunks entries into pages of 5', () => {
    const entries = Array.from({ length: 12 }, entry)
    const { pages } = paginateEvents(entries)

    expect(pages).toHaveLength(3)
    expect(pages.map((p) => p.length)).toEqual([5, 5, 2])
  })

  it('produces no pages for an empty entry list', () => {
    expect(paginateEvents([]).pages).toEqual([])
  })
})

describe('loadAndPrepareEvents', () => {
  it('reports an empty feed without preparing any pages', async () => {
    vi.resetModules()
    vi.doMock('@imthmn/mh-wilds-event-scraper', () => ({
      parseMHWildsEvents: vi.fn().mockResolvedValue({ eventQuests: [] }),
    }))

    const { loadAndPrepareEvents } = await import('../mhwilds-event-delivery')
    const prepared = await loadAndPrepareEvents('limited', NOW)

    expect(prepared.feedEmpty).toBe(true)
    expect(prepared.paginated.pages).toEqual([])

    vi.doUnmock('@imthmn/mh-wilds-event-scraper')
  })
})
