import { Elysia } from 'elysia'
import { z } from 'zod'
import {
  createTalismanSchema,
  talismanParamsSchema,
  talismanSchema,
  talismansResponseSchema,
} from '../../domains/talismans/schema'
import { TalismanConflictError, TalismanService, TalismanValidationError } from '../../domains/talismans/service'
import { verifyDiscordId } from '../middleware/user-auth-guard'

/**
 * `/api/talismans` — CRUD for a Discord user's custom talismans. Dashboard-only
 * for now (no Discord bot command yet); scoped entirely to the caller's own
 * Discord ID, resolved from a Supabase JWT (docs/adr/0003, 0004). Independent
 * of `authGuard` / `WEB_ADMIN_TOKEN` — no admin bypass.
 */
/** Shape every non-2xx branch in this module returns. */
const errorResponseSchema = z.object({ error: z.string() })

export const talismansRoutes = new Elysia({ tags: ['mh-wilds'] })
  // Elysia 2.0 removed `.resolve()`; `.derive()` is the surviving equivalent and
  // still short-circuits the request when it returns a `status(...)`.
  .derive(async ({ request, status }) => {
    const discordId = await verifyDiscordId(request.headers.get('authorization'))
    if (!discordId) return status(401, { error: 'Unauthorized' })
    return { discordId }
  })
  .get(
    '/talismans',
    { response: { 200: talismansResponseSchema } },
    ({ discordId }) => TalismanService.list(discordId)
  )
  .post(
    '/talismans',
    {
      body: createTalismanSchema,
      // Elysia 2.0 narrows `status(...)` to the declared response map, so the
      // handler's 400/409 branches have to be declared alongside the 200.
      response: {
        200: talismanSchema,
        400: errorResponseSchema,
        409: errorResponseSchema,
      },
    },
    async ({ discordId, body, status }) => {
      try {
        return await TalismanService.create(discordId, body)
      } catch (err) {
        if (err instanceof TalismanValidationError) return status(400, { error: err.message })
        if (err instanceof TalismanConflictError) return status(409, { error: err.message })
        throw err
      }
    }
  )
  .delete(
    '/talismans/:id',
    { params: talismanParamsSchema },
    async ({ discordId, params, status }) => {
      const deleted = await TalismanService.remove(discordId, params.id)
      if (!deleted) return status(404, { error: 'Not found' })
      return { ok: true }
    }
  )
