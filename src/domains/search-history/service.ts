import type { SearchHistory } from '../../infra/db/schema'
import { SearchHistoryRepository } from './repository'

/** Maximum number of saved searches retained per user. */
const MAX_HISTORY_PER_USER = 10

export abstract class SearchHistoryService {
  static async save(userId: string, label: string, data: unknown): Promise<void> {
    await SearchHistoryRepository.saveTrimmed(userId, label, data, MAX_HISTORY_PER_USER - 1)
  }

  static async getRecent(userId: string, limit = 10): Promise<SearchHistory[]> {
    return SearchHistoryRepository.findRecent(userId, limit)
  }
}
