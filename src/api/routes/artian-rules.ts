import { Elysia } from 'elysia'
import { artianRulesResponseSchema } from '../../domains/mh-wilds-catalog/schema'
import { CatalogService } from '../../domains/mh-wilds-catalog/service'

/**
 * `GET /api/mh-wilds/artian-rules` — the version-tagged Artian / Gogma Artian
 * rules table (ADR-0014). Clients derive a configured weapon's stats from these
 * numbers instead of duplicating them. Public reference data.
 */
export const artianRulesRoutes = new Elysia({ tags: ['mh-wilds'] }).get(
  '/artian-rules',
  { response: artianRulesResponseSchema },
  () => CatalogService.getArtianRules()
)
