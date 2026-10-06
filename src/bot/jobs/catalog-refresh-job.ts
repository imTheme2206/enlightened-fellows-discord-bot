import cron from "node-cron"
import { config } from "../../infra/config"
import logger from "../../infra/logger"
import { runScraper, type ScraperResult } from "../../domains/set-search/scraper"

/**
 * One scheduled catalog refresh (ADR-0016): equipment (ADR-0007) and monsters
 * (ADR-0015) are reconciled independently, each skipped when its upstream
 * payloads are unchanged. Per-domain outcomes are written to `job_log`
 * (`scraper:cron` and `scraper:cron:monsters`) by the scraper itself.
 */
export async function runCatalogRefresh(): Promise<ScraperResult | undefined> {
  try {
    const result = await runScraper({ source: "cron", skipUnchanged: true })
    logger.info("Catalog refresh finished", { result })
    return result
  } catch (err) {
    // The failing domain already wrote a FAILED job_log entry; the other domain still ran.
    logger.error("Catalog refresh: a domain failed (see job_log)", { err })
    return undefined
  }
}

export function startCatalogRefreshJob(): void {
  cron.schedule(config.CATALOG_REFRESH_CRON, () => void runCatalogRefresh(), { timezone: "UTC" })
  logger.info(`Catalog refresh job scheduled (${config.CATALOG_REFRESH_CRON} UTC)`)
}
