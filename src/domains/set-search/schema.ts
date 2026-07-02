import { z } from 'zod'

const skillMap = z.record(z.string(), z.number().int())

/**
 * Request contract for `POST /api/mh-wilds/search` — the canonical shape of a
 * set-search query. This is the single source of truth: {@link SearchInput} is
 * inferred from it, so the bot and the HTTP API share one validated shape.
 */
export const searchRequestSchema = z.object({
  skills: skillMap,
  setSkills: skillMap.optional(),
  groupSkills: skillMap.optional(),
  initialSetCounts: skillMap.optional(),
  initialGroupCounts: skillMap.optional(),
  mandatoryArmor: z.array(z.string().nullable()).optional(), // [head, chest, arms, waist, legs, talisman]
  blacklistedArmor: z.array(z.string()).optional(),
  slotFilters: skillMap.optional(), // {"3": 2} = need 2 free 3-slots
  rank: z.enum(['low', 'high', 'master']).optional(),
})

export type SearchInput = z.infer<typeof searchRequestSchema>

const elementalDefensesSchema = z.object({
  fire: z.number(),
  water: z.number(),
  thunder: z.number(),
  ice: z.number(),
  dragon: z.number(),
})

/** Response contract: the enriched set-search result (internal `_originalIndex` omitted). */
export const searchResultSchema = z.object({
  armorNames: z.array(z.string()),
  rarities: z.array(z.number()),
  skills: z.record(z.string(), z.number()),
  setSkills: z.record(z.string(), z.number()),
  groupSkills: z.record(z.string(), z.number()),
  decoNames: z.array(z.string()),
  freeSlots: z.array(z.number()),
  slots: z.array(z.number()),
  defense: z.number(),
  elementalDefenses: elementalDefensesSchema,
})

export const searchResponseSchema = z.array(searchResultSchema)
export type SearchResultDto = z.infer<typeof searchResultSchema>
