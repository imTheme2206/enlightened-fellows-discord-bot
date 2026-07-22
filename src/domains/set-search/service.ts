import logger from '../../infra/logger'
import { buildIndexFromDb } from './build-index'
import { loadCustomTalismans } from './custom-talismans'
import { search } from './logic'
import type { SearchInput, SearchResult, SetSearchIndex } from './types'

let currentIndex: SetSearchIndex | null = null

/**
 * Builds (or rebuilds) the in-memory search index from the database.
 */
export async function initSearchIndex(): Promise<void> {
  logger.info('[setSearch] Building search index from DB...')
  currentIndex = await buildIndexFromDb()
  logger.info(`[setSearch] Index ready: ${currentIndex.allArmor.length} armor pieces`)
}

/**
 * Runs a set search against the current in-memory index. When `userId` is
 * given, that user's custom talismans are merged in as extra, non-mandatory
 * talisman candidates for this call only — the shared index is never mutated.
 * Throws if the index has not been initialized.
 */
export async function searchSets(input: SearchInput, userId?: string): Promise<SearchResult[]> {
  if (!currentIndex) throw new Error('Search index not initialized')
  if (!userId) return search(input, currentIndex)

  const customTalismans = await loadCustomTalismans(userId, input.rank ?? 'high')
  if (customTalismans.length === 0) return search(input, currentIndex)

  const index: SetSearchIndex = {
    ...currentIndex,
    byType: { ...currentIndex.byType, talisman: [...currentIndex.byType.talisman, ...customTalismans] },
  }
  return search(input, index)
}

/** Returns all known regular skill names, or empty array if index not ready. */
export function getSkillNames(): string[] {
  if (!currentIndex) return []
  return Array.from(currentIndex.skills.keys())
}

/** Returns all known set skill names, or empty array if index not ready. */
export function getSetSkillNames(): string[] {
  if (!currentIndex) return []
  return Array.from(currentIndex.setSkills.keys())
}

/** Returns the max level for a skill, or undefined if not found. */
export function getSkillMaxLevel(name: string): number | undefined {
  return currentIndex?.skills.get(name)?.maxLevel
}
