import type { SearchHistory } from '../../../../infra/db/schema'
import { MAX_SKILLS, SESSION_TTL_MS } from './state'
import type { PendingSkill, SavedSearch, SearchState, SetSkillEntry } from './state'

/**
 * Owns per-user search-set session lifecycle: storage, TTL-based expiry, and
 * the workflow transitions (history restoration, skill-limit enforcement)
 * that touch session state. Pure in-memory — no Discord types, no DB — so it
 * is unit-testable without mocks. Discord rendering (`components/`) and
 * interaction transport (`handlers.ts`) stay outside this module; they call
 * `getSession`/`saveSession` and the transition helpers below.
 */

const sessions = new Map<string, SearchState>()
// Tracks the pending expiry timer per user so a newer save can cancel an
// older one — previously each `saveSession` call scheduled a fresh
// `setTimeout` without clearing the last, so an old timer could delete
// session state a later save had just written.
const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>()

function defaultSession(): SearchState {
  return {
    gogmaSkills: { groupSkill: '', setSkill: '' },
    skills: [],
    setSkills: [],
    groupSkills: [],
    rank: 'high',
    step: 'main',
    pendingSkills: null,
    pendingSetSkill: null,
    weaponSkillPage: 0,
    slotPages: {},
  }
}

export function getSession(userId: string): SearchState {
  return sessions.get(userId) ?? defaultSession()
}

/** Persists `state` for `userId` and (re)schedules its TTL expiry. */
export function saveSession(userId: string, state: SearchState): void {
  sessions.set(userId, state)

  const existingTimer = expiryTimers.get(userId)
  if (existingTimer) clearTimeout(existingTimer)

  const timer = setTimeout(() => {
    sessions.delete(userId)
    expiryTimers.delete(userId)
  }, SESSION_TTL_MS)
  expiryTimers.set(userId, timer)
}

/** True once a session has any skill/set-skill/group-skill selection. */
export function hasSelections(state: SearchState): boolean {
  return state.skills.length > 0 || state.setSkills.length > 0 || state.groupSkills.length > 0
}

/**
 * Caps a batch of newly-picked skills to the remaining room under
 * `MAX_SKILLS`, given the session's current skill count.
 */
export function capToRemainingSkillSlots(state: SearchState, names: string[]): string[] {
  const remaining = MAX_SKILLS - state.skills.length
  return names.slice(0, Math.max(0, remaining))
}

function normalizeSetSkills(raw: unknown): SetSkillEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (typeof item === 'string') return { name: item, rank: 1 }
    if (item && typeof item.name === 'string') return { name: item.name, rank: Number(item.rank) || 1 }
    return { name: String(item), rank: 1 }
  })
}

/**
 * Restores a `SearchHistory` row's saved payload into a fresh main-step
 * session, migrating the legacy string[]-shaped `setSkills` field (see
 * `normalizeSetSkills`) into the current `SetSkillEntry[]` shape.
 */
export function restoreFromHistory(state: SearchState, entry: SearchHistory): SearchState {
  const saved = entry.data as SavedSearch
  return {
    ...state,
    skills: saved.skills,
    setSkills: normalizeSetSkills(saved.setSkills),
    groupSkills: saved.groupSkills,
    gogmaSkills: {
      setSkill: saved.gogmaSetSkill,
      groupSkill: saved.gogmaGroupSkill,
    },
    rank: saved.rank,
    step: 'main',
    historyEntries: undefined,
  }
}

/** Builds the pending-skill batch for a slot pick, capped to MAX_SKILLS. */
export function buildPendingSkills(state: SearchState, names: string[], slotSize: 1 | 2 | 3): PendingSkill[] {
  return capToRemainingSkillSlots(state, names).map((name) => ({ name, slotSize }))
}

/** Test-only: clears all sessions and pending timers between test cases. */
export function __resetForTests(): void {
  for (const timer of expiryTimers.values()) clearTimeout(timer)
  sessions.clear()
  expiryTimers.clear()
}
