import type { CatalogView } from "./catalog-view"
import type { BuildSnapshot, SaveBuildRequest } from "./schema"
import { buildSnapshot } from "./snapshot"
import { validateSaveComposition } from "./validation"

/**
 * The single save-time seam: validates a Save composition against the
 * backend-owned `CatalogView`, then constructs its trusted snapshot. `validation.ts`
 * and `snapshot.ts` remain internal implementation details — `buildSnapshot`
 * previously documented that callers MUST run `validateSaveComposition` first,
 * which put the correctness of that choreography on every caller. `create` and
 * `replace` now call this one function instead of repeating the two-step dance.
 *
 * No behavior change: the same errors are thrown (validation runs first, so an
 * invalid composition never reaches snapshot construction) and the same
 * snapshot is produced (`buildSnapshot` still sources every value from `view`,
 * never from `request`).
 */
export function canonicalizeSaveComposition(
  request: SaveBuildRequest,
  view: CatalogView,
): BuildSnapshot {
  validateSaveComposition(request, view)
  return buildSnapshot(request, view)
}
