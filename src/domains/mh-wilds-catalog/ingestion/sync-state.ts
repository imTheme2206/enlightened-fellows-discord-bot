import { inArray, sql } from "drizzle-orm"
import { db } from "../../../infra/db/client"
import { catalogSyncState } from "../../../infra/db/schema"

/**
 * Per-source hash of the last upstream payload that was successfully synced
 * (ADR-0016). A source is recorded only after the owning domain's transaction
 * has committed, so a failed or conflicting run is retried next time.
 */
export abstract class CatalogSyncStateService {
  static async getHashes(sources: string[]): Promise<Map<string, string>> {
    const rows = await db
      .select({ source: catalogSyncState.source, contentHash: catalogSyncState.contentHash })
      .from(catalogSyncState)
      .where(inArray(catalogSyncState.source, sources))
    return new Map(rows.map((r) => [r.source, r.contentHash]))
  }

  static async recordHashes(hashes: Record<string, string>): Promise<void> {
    const values = Object.entries(hashes).map(([source, contentHash]) => ({ source, contentHash }))
    if (values.length === 0) return
    await db
      .insert(catalogSyncState)
      .values(values)
      .onConflictDoUpdate({
        target: catalogSyncState.source,
        set: { contentHash: sql`excluded.content_hash`, syncedAt: sql`now()` },
      })
  }
}
