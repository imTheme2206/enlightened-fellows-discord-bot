import { Elysia } from 'elysia'
import { z } from 'zod'
import {
  createCustomWeaponSchema,
  customWeaponParamsSchema,
  customWeaponSchema,
  customWeaponsResponseSchema,
} from '../../domains/custom-weapons/schema'
import { CustomWeaponConflictError, CustomWeaponService, CustomWeaponValidationError } from '../../domains/custom-weapons/service'
import { verifyDiscordId } from '../middleware/user-auth-guard'

const errorResponseSchema = z.object({ error: z.string() })

/** Owner-scoped Artian/Gogma custom weapon collection. */
export const customWeaponsRoutes = new Elysia({ tags: ['mh-wilds'] })
  .derive(async ({ request, status }) => {
    const discordId = await verifyDiscordId(request.headers.get('authorization'))
    if (!discordId) return status(401, { error: 'Unauthorized' })
    return { discordId }
  })
  .get(
    '/custom-weapons',
    { response: { 200: customWeaponsResponseSchema } },
    ({ discordId }) => CustomWeaponService.list(discordId),
  )
  .post(
    '/custom-weapons',
    {
      body: createCustomWeaponSchema,
      response: {
        200: customWeaponSchema,
        400: errorResponseSchema,
        409: errorResponseSchema,
      },
    },
    async ({ discordId, body, status }) => {
      try {
        return await CustomWeaponService.create(discordId, body)
      } catch (error) {
        if (error instanceof CustomWeaponValidationError) return status(400, { error: error.message })
        if (error instanceof CustomWeaponConflictError) return status(409, { error: error.message })
        throw error
      }
    },
  )
  .delete(
    '/custom-weapons/:id',
    { params: customWeaponParamsSchema },
    async ({ discordId, params, status }) => {
      const deleted = await CustomWeaponService.remove(discordId, params.id)
      if (!deleted) return status(404, { error: 'Not found' })
      return { ok: true }
    },
  )
