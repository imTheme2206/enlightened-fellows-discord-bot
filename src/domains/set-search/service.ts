/**
 * Thin public face of the set-search domain. Index lifecycle (readiness,
 * atomic build/swap, refresh) lives in `runtime.ts`; this module re-exports
 * its public surface so existing callers (`handlers.ts`, API routes,
 * `db-init.ts`) are unaffected by that internal split.
 */
export { getSetSkillNames, getSkillMaxLevel, getSkillNames, refresh, searchSets } from './runtime'
