import { Elysia } from 'elysia'
import { config } from '../infra/config'
import logger from '../infra/logger'
import { createApp } from './app'

const corsOrigin = config.CORS_ORIGIN ?? '*'

export async function startServer(): Promise<void> {
  // Elysia 2.x defaults to the Bun adapter; the process now runs under Bun,
  // so no explicit adapter is needed (@elysiajs/node has no 2.x release).
  const app = new Elysia()
    .request(({ set, request }) => {
      const origin = request.headers.get('origin')
      set.headers['access-control-allow-origin'] =
        corsOrigin === '*' ? '*' : (origin ?? corsOrigin)
      set.headers['access-control-allow-methods'] =
        'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      set.headers['access-control-allow-headers'] =
        'Content-Type, Authorization, Idempotency-Key'
    })
    .options('/*', ({ set }) => {
      set.status = 204
      return ''
    })
    .use(createApp())

  app.listen(config.WEB_PORT)
  logger.info(`Web server listening on port ${config.WEB_PORT}`)
}
