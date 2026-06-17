import { randomUUID } from 'crypto'
import { desc, notInArray } from 'drizzle-orm'
import { db } from '../../infra/db/client'
import { searchHistory, type SearchHistory } from '../../infra/db/schema'

export abstract class SearchHistoryRepository {
  /**
   * Inserts a new history row, trimming the user's history so that at most
   * `keepExisting` prior rows survive (i.e. `keepExisting + 1` total after insert).
   */
  static async saveTrimmed(userId: string, label: string, data: unknown, keepExisting: number): Promise<void> {
    await db.transaction(async (tx) => {
      const keep = await tx.query.searchHistory.findMany({
        columns: { id: true },
        where: (t, { eq }) => eq(t.userId, userId),
        orderBy: (t) => [desc(t.searchedAt)],
        limit: keepExisting,
      })

      if (keep.length === keepExisting) {
        const keepIds = keep.map((r) => r.id)
        await tx.delete(searchHistory).where(notInArray(searchHistory.id, keepIds))
      }

      await tx.insert(searchHistory).values({ id: randomUUID(), userId, label, data })
    })
  }

  static async findRecent(userId: string, limit: number): Promise<SearchHistory[]> {
    return db.query.searchHistory.findMany({
      where: (t, { eq }) => eq(t.userId, userId),
      orderBy: (t) => [desc(t.searchedAt)],
      limit,
    })
  }
}
