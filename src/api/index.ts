import openapi from '@elysia/openapi'
import { node } from '@elysiajs/node'
import { Elysia } from 'elysia'
import { rateLimit } from 'elysia-rate-limit'
import { config } from '../infra/config'
import logger from '../infra/logger'
import { authGuard } from './middleware/auth-guard'
import { channelsRoutes } from './routes/channels'
import { fetchArmorsRoutes } from './routes/fetch-armors'
import { genshinCodesRoutes } from './routes/genshin-codes'
import { jobLogsRoutes } from './routes/job-logs'
import { skillsRoutes } from './routes/skills'

export async function startServer(): Promise<void> {
  const app = new Elysia({ adapter: node() })
    .use(openapi())
    .get('/api/health', () => ({ ok: true }))
    .group('/api', (app) =>
      app.onBeforeHandle(authGuard).use(jobLogsRoutes).use(genshinCodesRoutes).use(channelsRoutes).use(fetchArmorsRoutes)
    )
    .group('api/mh-wilds', (app) => app.use(rateLimit({ max: 30, duration: 60_000 })).use(skillsRoutes))

  app.listen(config.WEB_PORT)
  logger.info(`Web server listening on port ${config.WEB_PORT}`)
}
