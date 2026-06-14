import { randomUUID } from 'crypto'
import { desc, notInArray } from 'drizzle-orm'
import { db } from '../../db/client'
import { searchHistory, type SearchHistory } from '../../db/schema'

export abstract class SearchHistoryService {
  static async save(userId: string, label: string, data: unknown): Promise<void> {
    await db.transaction(async (tx) => {
      const keep = await tx.query.searchHistory.findMany({
        columns: { id: true },
        where: (t, { eq }) => eq(t.userId, userId),
        orderBy: (t) => [desc(t.searchedAt)],
        limit: 9,
      })

      if (keep.length === 9) {
        const keepIds = keep.map((r) => r.id)
        await tx.delete(searchHistory).where(notInArray(searchHistory.id, keepIds))
      }

      await tx.insert(searchHistory).values({ id: randomUUID(), userId, label, data })
    })
  }

  static async getRecent(userId: string, limit = 10): Promise<SearchHistory[]> {
    return db.query.searchHistory.findMany({
      where: (t, { eq }) => eq(t.userId, userId),
      orderBy: (t) => [desc(t.searchedAt)],
      limit,
    })
  }
}
