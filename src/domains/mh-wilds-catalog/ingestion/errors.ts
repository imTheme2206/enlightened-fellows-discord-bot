import type { Conflict } from './reconcile'

/** Raised when a scrape's values conflict with an existing catalog identity. */
export class ScrapeConflictError extends Error {
  constructor(readonly conflicts: Conflict[]) {
    super(`Scrape rejected: ${conflicts.length} conflict(s) with existing catalog identities`)
    this.name = 'ScrapeConflictError'
  }
}

/** Raised when a custom talisman references a skill absent from the catalog. */
export class OrphanedTalismanSkillError extends Error {
  constructor(readonly skillIds: string[]) {
    super(`Custom talisman(s) reference ${skillIds.length} skill id(s) not in the catalog; manual repair required`)
    this.name = 'OrphanedTalismanSkillError'
  }
}
