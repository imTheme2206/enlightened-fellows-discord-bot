import { Elysia } from 'elysia'
import { rateLimit } from 'elysia-rate-limit'
import { z } from 'zod'
import { searchRequestSchema, searchResponseSchema } from '../../domains/set-search/schema'
import { searchSets } from '../../domains/set-search/service'
import { SetSearchTimeoutError } from '../../domains/set-search/search-worker-client'
import { verifyDiscordId } from '../middleware/user-auth-guard'

/**
 * `POST /api/mh-wilds/search` — runs the set-search engine with the same payload
 * as the Discord command and returns enriched results (per-piece rarity,
 * aggregated elemental defenses, base defense).
 *
 * Public, but rate-limited: each search is CPU-heavy even though the DFS runs in
 * an isolated worker (see docs/adr/0002). The limiter is `scoped` so it only
 * throttles this route, and is keyed off the Fly-forwarded client IP (the socket
 * address is the proxy behind Fly).
 *
 * A bearer token is optional here (unlike `/talismans`): if a valid Supabase
 * JWT is present, that user's custom talismans are folded into the candidate
 * pool; otherwise the search runs anonymously with no custom talismans.
 */
export const searchRoutes = new Elysia({ tags: ['mh-wilds'] })
  .use(
    rateLimit({
      scoping: 'plugin',
      duration: 60_000,
      max: 10,
      generator: (request, server) => request.headers.get('fly-client-ip') ?? request.headers.get('x-forwarded-for') ?? server?.requestIP(request)?.address ?? 'unknown',
    }),
  )
  .post(
    '/search',
    {
      body: searchRequestSchema,
      response: {
        200: searchResponseSchema,
        503: z.object({ error: z.string() }),
      },
    },
    async ({ body, request, status }) => {
      try {
        const discordId = await verifyDiscordId(request.headers.get('authorization'))
        return await searchSets(body, discordId ?? undefined)
      } catch (error) {
        if (error instanceof SetSearchTimeoutError) {
          return status(503, {
            error: 'Search is too broad to finish within the compute budget. Add another skill or filter and retry.',
          })
        }
        throw error
      }
    },
  )
