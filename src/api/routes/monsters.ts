import { Elysia } from 'elysia'
import {
  monsterDetailSchema,
  monsterListResponseSchema,
  monsterNotFoundSchema,
  monsterParamsSchema,
} from '../../domains/mh-wilds-catalog/schema'
import { CatalogService } from '../../domains/mh-wilds-catalog/service'

/**
 * `GET /api/mh-wilds/monsters` lists large monsters; `GET /monsters/:id` returns
 * one with its hitzone parts and weaknesses (ADR-0015). Public reference data,
 * returned in full; the detail carries `dataVersion` so clients can tell when a
 * patch replaced the values.
 */
export const monstersRoutes = new Elysia({ tags: ['mh-wilds'] })
  .get('/monsters', { response: monsterListResponseSchema }, () => CatalogService.getMonsters())
  .get(
    '/monsters/:id',
    { params: monsterParamsSchema, response: { 200: monsterDetailSchema, 404: monsterNotFoundSchema } },
    async ({ params, set }) => {
      const found = await CatalogService.getMonster(params.id)
      if (found) return found
      set.status = 404
      return { error: { code: 'NOT_FOUND' as const, message: 'Monster not found.' } }
    }
  )
