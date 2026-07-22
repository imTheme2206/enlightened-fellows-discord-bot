import type { SearchHistory } from '../../../../infra/db/schema'

/**
 * Pure types + constants for the search-set session shape. Storage, TTL
 * expiry, and workflow transitions (history restoration, skill-limit
 * enforcement) live in `session-store.ts`, kept separate so this module has
 * no timers or Map state to reason about.
 */

export const MAX_SKILLS = 10
export const SESSION_TTL_MS = 10 * 60 * 1000
export const RESULTS_PER_PAGE = 5

export type Step = 'main' | 'weapon-skill' | 'set-skill' | 'history' | 'remove-skill'

export interface SkillEntry {
  name: string
  level: number
  slotSize: 1 | 2 | 3
}

export interface SetSkillEntry {
  name: string
  rank: number
}

export interface SavedSearch {
  skills: SkillEntry[]
  setSkills: SetSkillEntry[]
  groupSkills: string[]
  gogmaSetSkill: string
  gogmaGroupSkill: string
  rank: 'low' | 'high' | 'master'
}

export interface PendingSkill {
  name: string
  slotSize: 1 | 2 | 3
}

export interface PendingSetSkill {
  name: string
  maxLevel: number
}

export interface SearchState {
  gogmaSkills: {
    setSkill: string
    groupSkill: string
  }
  skills: SkillEntry[]
  setSkills: SetSkillEntry[]
  groupSkills: string[]
  rank: 'low' | 'high' | 'master'
  step: Step
  pendingSkills: PendingSkill[] | null
  pendingSetSkill: PendingSetSkill | null
  weaponSkillPage: number
  slotPages: Partial<Record<1 | 2 | 3, number>>
  historyEntries?: SearchHistory[]
}

export { getSession, saveSession } from './session-store'
