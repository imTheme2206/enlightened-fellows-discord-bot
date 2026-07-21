import { Elysia } from 'elysia'
import { decorationCatalogResponseSchema } from '../../domains/mh-wilds-catalog/schema'
import { CatalogService } from '../../domains/mh-wilds-catalog/service'

/**
 * `GET /api/mh-wilds/decorations` — the complete active decoration catalog. Each
 * decoration lists every skill it grants (decorations are multi-grant, ADR-0011).
 * Returned in full; not paginated.
 */
export const decorationsRoutes = new Elysia({ tags: ['mh-wilds'] }).get('/decorations', () => CatalogService.getDecorations(), {
  response: decorationCatalogResponseSchema,
})
