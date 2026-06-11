import '../../db/schema'
import { db } from '../../db/client'
import { runScraper } from '../../services/scraper-service'
import { initSearchIndex } from '../../services/set-search'
import logger from '../../config/logger'

export async function seedOnBoot(): Promise<void> {
  const row = db.prepare('SELECT COUNT(*) as count FROM Armor').get() as {
    count: number
  }
  const isEmpty = row.count === 0

  if (isEmpty) {
    logger.info('[dbInit] Database is empty — seeding...')
    await runScraper({ source: 'boot' })
  } else {
    await initSearchIndex()
  }
}
