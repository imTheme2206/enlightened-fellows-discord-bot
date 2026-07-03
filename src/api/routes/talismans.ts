import { Elysia } from 'elysia'
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
export const talismansRoutes = new Elysia({ tags: ['mh-wilds'] })
  .resolve(async ({ request, status }) => {
    const discordId = await verifyDiscordId(request.headers.get('authorization'))
    if (!discordId) return status(401, { error: 'Unauthorized' })
    return { discordId }
  })
  .get('/talismans', ({ discordId }) => TalismanService.list(discordId), {
    response: { 200: talismansResponseSchema },
  })
  .post(
    '/talismans',
    async ({ discordId, body, status }) => {
      try {
        return await TalismanService.create(discordId, body)
      } catch (err) {
        if (err instanceof TalismanValidationError) return status(400, { error: err.message })
        if (err instanceof TalismanConflictError) return status(409, { error: err.message })
        throw err
      }
    },
    {
      body: createTalismanSchema,
      response: { 200: talismanSchema },
    }
  )
  .delete(
    '/talismans/:id',
    async ({ discordId, params, status }) => {
      const deleted = await TalismanService.remove(discordId, params.id)
      if (!deleted) return status(404, { error: 'Not found' })
      return { ok: true }
    },
    { params: talismanParamsSchema }
  )
