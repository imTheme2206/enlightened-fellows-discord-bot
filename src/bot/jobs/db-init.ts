import { count } from 'drizzle-orm'
import logger from '../../config/logger'
import { db } from '../../db/client'
import { armor } from '../../db/schema'
import { runScraper } from '../../services/scraper-service'
import { initSearchIndex } from '../../services/set-search'

export async function seedOnBoot(): Promise<void> {
  const [{ value }] = await db.select({ value: count() }).from(armor)
  const isEmpty = value === 0

  if (isEmpty) {
    logger.info('[dbInit] Database is empty — seeding...')
    await runScraper({ source: 'boot' })
  } else {
    await initSearchIndex()
  }
}
