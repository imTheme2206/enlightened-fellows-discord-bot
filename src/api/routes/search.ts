import { Elysia } from 'elysia'
import { rateLimit } from 'elysia-rate-limit'
import { searchRequestSchema, searchResponseSchema } from '../../domains/set-search/schema'
import { searchSets } from '../../domains/set-search/service'
import { verifyDiscordId } from '../middleware/user-auth-guard'

/**
 * `POST /api/mh-wilds/search` — runs the set-search engine with the same payload
 * as the Discord command and returns enriched results (per-piece rarity,
 * aggregated elemental defenses, base defense).
 *
 * Public, but rate-limited: each search is a synchronous DFS that can block the
 * event loop for seconds (see docs/adr/0002). The limiter is `scoped` so it only
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
  .post(
    '/search',
    async ({ body, request }) => {
      const discordId = await verifyDiscordId(request.headers.get('authorization'))
      return searchSets(body, discordId ?? undefined)
    },
    {
      body: searchRequestSchema,
      response: searchResponseSchema,
    }
  )
