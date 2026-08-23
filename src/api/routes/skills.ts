import { Elysia } from 'elysia'
import { skillCatalogResponseSchema } from '../../domains/mh-wilds-catalog/schema'
import { CatalogService } from '../../domains/mh-wilds-catalog/service'

/**
 * `GET /api/mh-wilds/skills` — the complete catalog of ordinary Skills and
 * Set/Group Bonuses as two distinct collections (ADR-0011). Bonuses carry their
 * ordered activation thresholds. Returned in full; not paginated.
 */
export const skillsRoutes = new Elysia({ tags: ['mh-wilds'] }).get(
  '/skills',
  { response: skillCatalogResponseSchema },
  () => CatalogService.getSkills()
)
