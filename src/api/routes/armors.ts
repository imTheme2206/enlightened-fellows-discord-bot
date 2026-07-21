import { Elysia } from 'elysia'
import { armorCatalogResponseSchema } from '../../domains/mh-wilds-catalog/schema'
import { CatalogService } from '../../domains/mh-wilds-catalog/service'

/**
 * `GET /api/mh-wilds/armors` — the complete active armor + scraped-talisman
 * catalog, each piece enriched with its ordinary skill grants and set/group
 * bonus memberships (ADR-0009). Returned in full; not paginated.
 */
export const armorsRoutes = new Elysia({ tags: ['mh-wilds'] }).get('/armors', () => CatalogService.getArmors(), {
  response: armorCatalogResponseSchema,
})
