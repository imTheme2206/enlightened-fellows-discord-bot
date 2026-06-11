import { randomUUID } from 'crypto'
import { db } from '../../db/client'

export interface SearchHistoryRow {
  id: string
  userId: string
  label: string
  data: string
  searchedAt: string
}

export abstract class SearchHistoryService {
  static save(userId: string, label: string, data: string): void {
    const old = db.prepare('SELECT id FROM SearchHistory WHERE userId = ? ORDER BY searchedAt DESC LIMIT -1 OFFSET 9').all(userId) as {
      id: string
    }[]

    if (old.length > 0) {
      const placeholders = old.map(() => '?').join(', ')
      db.prepare(`DELETE FROM SearchHistory WHERE id IN (${placeholders})`).run(...old.map((r) => r.id))
    }

    db.prepare('INSERT INTO SearchHistory (id, userId, label, data) VALUES (?, ?, ?, ?)').run(randomUUID(), userId, label, data)
  }

  static getRecent(userId: string, limit = 10): SearchHistoryRow[] {
    return db
      .prepare('SELECT * FROM SearchHistory WHERE userId = ? ORDER BY searchedAt DESC LIMIT ?')
      .all(userId, limit) as SearchHistoryRow[]
  }
}
