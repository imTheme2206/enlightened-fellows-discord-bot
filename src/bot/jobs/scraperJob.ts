import cron from 'node-cron'
import { config } from '../../config'
import logger from '../../config/logger'
import { runScraper } from '../../services/scraperService'

/**
 * Starts the cron job that periodically re-seeds armor/skill data.
 * Schedule is controlled by the SCRAPER_CRON env var (default: every 6 hours).
 */
export function startScraperJob(): void {
  const schedule = config.SCRAPER_CRON

  logger.info(`[scraperJob] Scheduling scraper with cron: ${schedule}`)

  cron.schedule(schedule, async () => {
    logger.info('[scraperJob] Running scheduled scrape...')
    try {
      const result = await runScraper({ source: 'cron' })
      logger.info(
        `[scraperJob] Done: ${result.armorCount} armor, ${result.skillCount} skills, ${result.decoCount} decorations`
      )
    } catch (err) {
      logger.error('[scraperJob] Scheduled scrape failed:', { err })
    }
  })
}
