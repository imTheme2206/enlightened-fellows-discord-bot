import { count } from 'drizzle-orm'
import logger from '../../infra/logger'
import { db } from '../../infra/db/client'
import { armor } from '../../infra/db/schema'
import { runScraper } from '../../domains/set-search/scraper'
import { initSearchIndex } from '../../domains/set-search/service'

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
