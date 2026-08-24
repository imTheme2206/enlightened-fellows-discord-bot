import logger from '../../infra/logger'
import { buildIndexFromDb } from './build-index'
import { loadCustomTalismans } from './custom-talismans'
import { runSearchInWorker } from './search-worker-client'
import type { SearchInput, SearchResult, SetSearchIndex } from './types'

/**
 * Owns the module-level in-memory search index and its readiness lifecycle.
 * `service.ts` re-exports this module's public surface so existing callers
 * (`handlers.ts`, API routes, `db-init`) are unaffected by this seam.
 *
 * Readiness model: lazy initialization on first search rather than a raw
 * "throw if null". `startServer()` (HTTP) can run before the Discord `ready`
 * event fires the (un-awaited) boot seed, so a cold-start search must not see
 * a spurious "not initialized" error — it instead triggers (or awaits an
 * already in-flight) build. Concurrent callers during a cold start share the
 * same in-flight build promise rather than each starting their own.
 */
let currentIndex: SetSearchIndex | null = null
let buildInFlight: Promise<SetSearchIndex> | null = null

async function buildAndSwap(): Promise<SetSearchIndex> {
  logger.info('[setSearchRuntime] Building search index from DB...')
  // Build into a local first — a failed build must leave the prior index (if
  // any) intact rather than clobbering it with a partial/null value.
  const next = await buildIndexFromDb()
  currentIndex = next
  logger.info(`[setSearchRuntime] Index ready: ${next.allArmor.length} armor pieces`)
  return next
}

/**
 * Resolves once an index is available, building one if none exists yet.
 * Safe to call concurrently — only one build runs at a time; other callers
 * await the same in-flight promise. Never resolves to a partial index.
 */
function whenReady(): Promise<SetSearchIndex> {
  if (currentIndex) return Promise.resolve(currentIndex)
  if (!buildInFlight) {
    buildInFlight = buildAndSwap().finally(() => {
      buildInFlight = null
    })
  }
  return buildInFlight
}

/**
 * Builds (or rebuilds) the in-memory index and atomically swaps it in. Used
 * both for the initial boot build and for post-scrape refreshes. If the build
 * throws, the previous index (if any) is left untouched and the error
 * propagates to the caller for logging.
 */
export async function refresh(): Promise<void> {
  if (buildInFlight) {
    // A build is already underway (e.g. a cold-start search raced this call)
    // — piggyback on it instead of starting a second concurrent build.
    await buildInFlight
    return
  }
  buildInFlight = buildAndSwap().finally(() => {
    buildInFlight = null
  })
  await buildInFlight
}

/**
 * Runs a set search against the current in-memory index, building it first if
 * this is the first call since boot (see `whenReady`). When `userId` is
 * given, that user's custom talismans are merged in as extra, non-mandatory
 * talisman candidates for this call only — the shared index is never mutated.
 */
export async function searchSets(input: SearchInput, userId?: string): Promise<SearchResult[]> {
  const index = await whenReady()
  if (!userId) return runSearchInWorker(input, index)

  const customTalismans = await loadCustomTalismans(userId, input.rank ?? 'high')
  return runSearchInWorker(input, index, customTalismans)
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

/** Test-only: resets module state between test cases. Not exported from service.ts. */
export function __resetForTests(): void {
  currentIndex = null
  buildInFlight = null
}
