import { Elysia } from 'elysia'
import { armorCatalogResponseSchema } from '../../domains/mh-wilds-catalog/schema'
import { CatalogService } from '../../domains/mh-wilds-catalog/service'

/**
 * `GET /api/mh-wilds/armors` — the complete active armor + scraped-talisman
 * catalog, each piece enriched with its ordinary skill grants and set/group
 * bonus memberships (ADR-0009). Returned in full; not paginated.
 *
 * `slots` are reported **transcended** (Armor Transcendence, HR100+) since this
 * catalog feeds endgame build tooling; base slots remain canonical in the DB.
 */
export const armorsRoutes = new Elysia({ tags: ['mh-wilds'] }).get(
  '/armors',
  { response: armorCatalogResponseSchema },
  () => CatalogService.getArmors()
)
