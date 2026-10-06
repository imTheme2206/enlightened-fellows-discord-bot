import '../infra/db/schema'
import logger from '../infra/logger'
import { seedOnBoot } from '../bot/jobs/db-init'
import { startServer } from './index'

/**
 * API-only entry for local development (`bun run dev:api`): starts the HTTP server and the
 * boot catalog seed without logging in to Discord, so no real bot token is needed.
 * See docs/local-development.md.
 */
async function main(): Promise<void> {
  await startServer()
  seedOnBoot().catch((err) => {
    logger.error('[dbInit] Boot seed failed:', { err })
  })
}

main().catch((err) => {
  logger.error('Fatal error during API startup:', { err })
  process.exit(1)
})
