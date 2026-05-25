import { isDbEmpty } from "../../services/db-service";
import { runScraper } from "../../services/scraper-service";
import { initSearchIndex } from "../../services/set-search";
import logger from "../../config/logger";

export async function seedOnBoot(): Promise<void> {
  if (isDbEmpty()) {
    logger.info("[dbInit] Database is empty — seeding...");
    await runScraper({ source: "boot" });
  } else {
    await initSearchIndex();
  }
}
