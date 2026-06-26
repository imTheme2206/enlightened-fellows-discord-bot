import openapi from '@elysia/openapi'
import { Elysia } from 'elysia'
import { authGuard } from './middleware/auth-guard'
import { channelsRoutes } from './routes/channels'
import { fetchArmorsRoutes } from './routes/fetch-armors'
import { genshinCodesRoutes } from './routes/genshin-codes'
import { jobLogsRoutes } from './routes/job-logs'
import { skillsRoutes } from './routes/skills'

export function createApp() {
  return new Elysia()
    .use(
      openapi({
        documentation: {
          info: { title: 'Enlightened Fellows API', version: '1.0.0' },
          tags: [
            { name: 'mh-wilds', description: 'Monster Hunter Wilds' },
            { name: 'genshin', description: 'Genshin Impact' },
            { name: 'admin', description: 'Admin / internal' },
          ],
        },
      })
    )
    .get('/api/health', () => ({ ok: true }))
    .group('/api', (app) =>
      app.onBeforeHandle(authGuard).use(jobLogsRoutes).use(genshinCodesRoutes).use(channelsRoutes).use(fetchArmorsRoutes)
    )
    .group('/api/mh-wilds', (app) => app.use(skillsRoutes))
}
