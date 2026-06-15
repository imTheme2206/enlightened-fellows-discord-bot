import { Elysia } from 'elysia'
import { node } from '@elysiajs/node'
import { staticPlugin } from '@elysiajs/static'
import path from 'path'
import fs from 'fs'
import { config } from '../infra/config'
import logger from '../infra/logger'
import { authGuard } from './middleware/auth-guard'
import { jobLogsRoutes } from './routes/job-logs'
import { genshinCodesRoutes } from './routes/genshin-codes'
import { channelsRoutes } from './routes/channels'
import { fetchArmorsRoutes } from './routes/fetch-armors'

export async function startServer(): Promise<void> {
  const dashboardDist = path.join(process.cwd(), 'dashboard', 'dist')
  const indexPath = path.join(dashboardDist, 'index.html')

  const app = new Elysia({ adapter: node() })
    .use(fs.existsSync(dashboardDist) ? staticPlugin({ assets: dashboardDist, prefix: '/' }) : new Elysia())
    .get('/api/health', () => ({ ok: true }))
    .group('/api', (app) =>
      app.onBeforeHandle(authGuard).use(jobLogsRoutes).use(genshinCodesRoutes).use(channelsRoutes).use(fetchArmorsRoutes)
    )
    .get('/*', ({ set }) => {
      if (fs.existsSync(indexPath)) {
        set.headers = { 'content-type': 'text/html; charset=utf-8' }
        return fs.readFileSync(indexPath, 'utf-8')
      }
      set.status = 404
      return { error: 'Dashboard not built' }
    })

  app.listen(config.WEB_PORT)
  logger.info(`Web server listening on port ${config.WEB_PORT}`)
}
