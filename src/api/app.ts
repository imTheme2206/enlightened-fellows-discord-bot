import openapi from '@elysia/openapi'
import { Elysia } from 'elysia'
import { authGuard } from './middleware/auth-guard'
import { armorsRoutes } from './routes/armors'
import { channelsRoutes } from './routes/channels'
import { decorationsRoutes } from './routes/decorations'
import { fetchArmorsRoutes } from './routes/fetch-armors'
import { genshinCodesRoutes } from './routes/genshin-codes'
import { jobLogsRoutes } from './routes/job-logs'
import { searchRoutes } from './routes/search'
import { skillsRoutes } from './routes/skills'
import { talismansRoutes } from './routes/talismans'

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
    // Public MH Wilds catalog + search (no admin guard; talismans self-authenticate).
    .group('/api/mh-wilds', (app) => app.use(skillsRoutes).use(armorsRoutes).use(decorationsRoutes).use(searchRoutes))
    .group('/api', (app) => app.use(talismansRoutes))
}
