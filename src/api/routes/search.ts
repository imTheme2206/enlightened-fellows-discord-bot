import { Elysia } from 'elysia'
import { rateLimit } from 'elysia-rate-limit'
import { searchRequestSchema, searchResponseSchema } from '../../domains/set-search/schema'
import { searchSets } from '../../domains/set-search/service'

/**
 * `POST /api/mh-wilds/search` — runs the set-search engine with the same payload
 * as the Discord command and returns enriched results (per-piece rarity,
 * aggregated elemental defenses, base defense).
 *
 * Public, but rate-limited: each search is a synchronous DFS that can block the
 * event loop for seconds (see docs/adr/0002). The limiter is `scoped` so it only
 * throttles this route, and is keyed off the Fly-forwarded client IP (the socket
 * address is the proxy behind Fly).
 */
export const searchRoutes = new Elysia({ tags: ['mh-wilds'] })
  .use(
    rateLimit({
      scoping: 'scoped',
      duration: 60_000,
      max: 10,
      generator: (request, server) =>
        request.headers.get('fly-client-ip') ??
        request.headers.get('x-forwarded-for') ??
        server?.requestIP(request)?.address ??
        'unknown',
    })
  )
  .post('/search', ({ body }) => searchSets(body), {
    body: searchRequestSchema,
    response: searchResponseSchema,
  })
