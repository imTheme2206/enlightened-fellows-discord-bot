import { node } from '@elysiajs/node'
import { Elysia } from 'elysia'
import { config } from '../infra/config'
import logger from '../infra/logger'
import { createApp } from './app'

const corsOrigin = config.CORS_ORIGIN ?? '*'

export async function startServer(): Promise<void> {
  const app = new Elysia({ adapter: node() })
    .onRequest(({ set, request }) => {
      const origin = request.headers.get('origin')
      set.headers['access-control-allow-origin'] =
        corsOrigin === '*' ? '*' : (origin ?? corsOrigin)
      set.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
      set.headers['access-control-allow-headers'] = 'Content-Type, Authorization'
    })
    .options('/*', ({ set }) => {
      set.status = 204
      return ''
    })
    .use(createApp())

  app.listen(config.WEB_PORT)
  logger.info(`Web server listening on port ${config.WEB_PORT}`)
}
