import { count } from 'drizzle-orm'
import logger from '../../infra/logger'
import { db } from '../../infra/db/client'
import { armor } from '../../infra/db/schema'
import { runScraper, scrapeMonsters } from '../../domains/set-search/scraper'
import { MonsterIngestionService } from '../../domains/mh-wilds-catalog/ingestion/monster-service'
import { refresh } from '../../domains/set-search/runtime'

export async function seedOnBoot(): Promise<void> {
  const [{ value }] = await db.select({ value: count() }).from(armor)
  const isEmpty = value === 0

  if (isEmpty) {
    logger.info('[dbInit] Database is empty — seeding...')
    await runScraper({ source: 'boot' })
  } else {
    await refresh()
    // Existing catalogs predate the monster tables (ADR-0015); seed them once.
    try {
      if (await MonsterIngestionService.isEmpty()) await scrapeMonsters('boot')
    } catch (err) {
      logger.warn('[dbInit] Monster seed failed (non-fatal; already job-logged):', { err })
    }
  }
}
