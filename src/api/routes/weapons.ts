import { Elysia } from 'elysia'
import { weaponCatalogQuerySchema, weaponCatalogResponseSchema } from '../../domains/mh-wilds-catalog/schema'
import { CatalogService } from '../../domains/mh-wilds-catalog/service'

/**
 * `GET /api/mh-wilds/weapons` — the complete weapon catalog (ADR-0013), with
 * skills resolved to `{skillId, name, level}`. Optional `?kind=` narrows to one
 * weapon type. Returned in full; not paginated.
 */
export const weaponsRoutes = new Elysia({ tags: ['mh-wilds'] }).get(
  '/weapons',
  { query: weaponCatalogQuerySchema, response: weaponCatalogResponseSchema },
  ({ query }) => CatalogService.getWeapons(query)
)
