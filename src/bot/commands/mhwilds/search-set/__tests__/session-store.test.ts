import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchHistory } from '../../../../../infra/db/schema'
import { MAX_SKILLS, SESSION_TTL_MS } from '../state'
import type { SearchState } from '../state'
import { __resetForTests, buildPendingSkills, capToRemainingSkillSlots, getSession, hasSelections, restoreFromHistory, saveSession } from '../session-store'

function historyRow(data: unknown): SearchHistory {
  return { id: 'h1', userId: 'user-1', label: 'Test search', data, searchedAt: new Date('2026-01-01T00:00:00Z') }
}

describe('search-set session store', () => {
  beforeEach(() => {
    __resetForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    __resetForTests()
  })

  describe('getSession / saveSession', () => {
    it('returns a fresh default session for an unknown user', () => {
      const state = getSession('user-1')
      expect(state.step).toBe('main')
      expect(state.skills).toEqual([])
      expect(state.rank).toBe('high')
    })

    it('round-trips a saved session', () => {
      const state = getSession('user-1')
      const next: SearchState = { ...state, step: 'weapon-skill', rank: 'master' }
      saveSession('user-1', next)
      expect(getSession('user-1')).toEqual(next)
    })

    it('sessions are isolated per user', () => {
      saveSession('user-1', { ...getSession('user-1'), rank: 'low' })
      saveSession('user-2', { ...getSession('user-2'), rank: 'master' })
      expect(getSession('user-1').rank).toBe('low')
      expect(getSession('user-2').rank).toBe('master')
    })
  })

  describe('expiry', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('deletes the session after SESSION_TTL_MS of inactivity', () => {
      saveSession('user-1', { ...getSession('user-1'), rank: 'master' })
      vi.advanceTimersByTime(SESSION_TTL_MS - 1)
      expect(getSession('user-1').rank).toBe('master') // still alive

      vi.advanceTimersByTime(1)
      expect(getSession('user-1').rank).toBe('high') // expired -> fresh default
    })

    it('a newer save cancels the older expiry timer instead of being deleted by it', () => {
      // Regression test: saveSession used to schedule a new setTimeout on every
      // call without clearing the previous one, so an old timer could delete
      // state a later save had just written.
      saveSession('user-1', { ...getSession('user-1'), rank: 'low' })

      // Advance most of the way through the first TTL window, then save again.
      vi.advanceTimersByTime(SESSION_TTL_MS - 1)
      saveSession('user-1', { ...getSession('user-1'), rank: 'master' })

      // If the OLD timer had fired here, the session would be wiped even
      // though the second save is still well within its own fresh TTL.
      vi.advanceTimersByTime(2)
      expect(getSession('user-1').rank).toBe('master')

      // The new timer still expires it after its own full TTL window.
      vi.advanceTimersByTime(SESSION_TTL_MS)
      expect(getSession('user-1').rank).toBe('high')
    })

    it('expiry timers are independent per user', () => {
      saveSession('user-1', { ...getSession('user-1'), rank: 'low' })
      vi.advanceTimersByTime(SESSION_TTL_MS / 2)
      saveSession('user-2', { ...getSession('user-2'), rank: 'master' })

      vi.advanceTimersByTime(SESSION_TTL_MS / 2 + 1)
      expect(getSession('user-1').rank).toBe('high') // user-1 expired
      expect(getSession('user-2').rank).toBe('master') // user-2 still alive
    })
  })

  describe('hasSelections', () => {
    it('false for an empty session', () => {
      expect(hasSelections(getSession('user-1'))).toBe(false)
    })

    it('true when any of skills/setSkills/groupSkills is non-empty', () => {
      const base = getSession('user-1')
      expect(hasSelections({ ...base, skills: [{ name: 'Attack Boost', level: 3, slotSize: 1 }] })).toBe(true)
      expect(hasSelections({ ...base, setSkills: [{ name: "Gore's Tyranny", rank: 1 }] })).toBe(true)
      expect(hasSelections({ ...base, groupSkills: ["Lord's Soul"] })).toBe(true)
    })
  })

  describe('capToRemainingSkillSlots / buildPendingSkills (MAX_SKILLS enforcement)', () => {
    it('caps to remaining room under MAX_SKILLS', () => {
      const state = { ...getSession('user-1'), skills: Array.from({ length: MAX_SKILLS - 2 }, (_, i) => ({ name: `Skill ${i}`, level: 1, slotSize: 1 as const })) }
      const capped = capToRemainingSkillSlots(state, ['A', 'B', 'C', 'D'])
      expect(capped).toEqual(['A', 'B'])
    })

    it('returns empty when already at MAX_SKILLS', () => {
      const state = { ...getSession('user-1'), skills: Array.from({ length: MAX_SKILLS }, (_, i) => ({ name: `Skill ${i}`, level: 1, slotSize: 1 as const })) }
      expect(capToRemainingSkillSlots(state, ['A', 'B'])).toEqual([])
    })

    it('buildPendingSkills attaches slotSize and respects the cap', () => {
      const state = { ...getSession('user-1'), skills: Array.from({ length: MAX_SKILLS - 1 }, (_, i) => ({ name: `Skill ${i}`, level: 1, slotSize: 1 as const })) }
      const pending = buildPendingSkills(state, ['A', 'B'], 2)
      expect(pending).toEqual([{ name: 'A', slotSize: 2 }])
    })
  })

  describe('restoreFromHistory', () => {
    it('restores skills/setSkills(current shape)/groupSkills/rank/gogma and resets to main step', () => {
      const state = getSession('user-1')
      const entry = historyRow({
        skills: [{ name: 'Attack Boost', level: 3, slotSize: 1 }],
        setSkills: [{ name: "Gore's Tyranny", rank: 2 }],
        groupSkills: ["Lord's Soul"],
        gogmaSetSkill: "Gore's Tyranny",
        gogmaGroupSkill: "Lord's Soul",
        rank: 'master',
      })

      const restored = restoreFromHistory({ ...state, step: 'history', historyEntries: [entry] }, entry)

      expect(restored.step).toBe('main')
      expect(restored.historyEntries).toBeUndefined()
      expect(restored.skills).toEqual([{ name: 'Attack Boost', level: 3, slotSize: 1 }])
      expect(restored.setSkills).toEqual([{ name: "Gore's Tyranny", rank: 2 }])
      expect(restored.groupSkills).toEqual(["Lord's Soul"])
      expect(restored.rank).toBe('master')
      expect(restored.gogmaSkills).toEqual({ setSkill: "Gore's Tyranny", groupSkill: "Lord's Soul" })
    })

    it('migrates legacy string[]-shaped setSkills into SetSkillEntry[] with rank 1', () => {
      const state = getSession('user-1')
      const entry = historyRow({
        skills: [],
        setSkills: ["Gore's Tyranny", 'Fanged Exploiter'], // legacy shape
        groupSkills: [],
        gogmaSetSkill: '',
        gogmaGroupSkill: '',
        rank: 'high',
      })

      const restored = restoreFromHistory(state, entry)
      expect(restored.setSkills).toEqual([
        { name: "Gore's Tyranny", rank: 1 },
        { name: 'Fanged Exploiter', rank: 1 },
      ])
    })

    it('non-array setSkills becomes an empty array rather than throwing', () => {
      const state = getSession('user-1')
      const entry = historyRow({
        skills: [],
        setSkills: null,
        groupSkills: [],
        gogmaSetSkill: '',
        gogmaGroupSkill: '',
        rank: 'high',
      })

      expect(() => restoreFromHistory(state, entry)).not.toThrow()
      expect(restoreFromHistory(state, entry).setSkills).toEqual([])
    })
  })
})
