import { z } from 'zod'

/**
 * Wire contracts for the MH Wilds Catalog resource APIs (ADR-0009). These are
 * the single source of truth for `GET /armors`, `/decorations`, and `/skills`;
 * the web builder can reuse the inferred DTOs to type what it fetches.
 *
 * Set/Group Bonuses are first-class entities with ordered thresholds, distinct
 * from ordinary level-capped Skills (ADR-0011). Rank is left as a free string —
 * it is an in-game tier sourced from the scrape, not a value this API defines.
 */

const skillGrantSchema = z.object({
  skillId: z.string(),
  name: z.string(),
  level: z.number(),
})

const bonusMembershipSchema = z.object({
  bonusId: z.string(),
  name: z.string(),
  kind: z.enum(['set', 'group']),
})

export const armorCatalogItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['head', 'chest', 'arms', 'waist', 'legs', 'talisman']),
  rank: z.string(),
  rarity: z.number(),
  defense: z.number(),
  resistances: z.object({
    fire: z.number(),
    water: z.number(),
    thunder: z.number(),
    ice: z.number(),
    dragon: z.number(),
  }),
  slots: z.array(z.number()),
  skills: z.array(skillGrantSchema),
  bonuses: z.array(bonusMembershipSchema),
})
export type ArmorCatalogItem = z.infer<typeof armorCatalogItemSchema>
export const armorCatalogResponseSchema = z.array(armorCatalogItemSchema)

export const decorationCatalogItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['armor', 'weapon']),
  slotSize: z.number(),
  skills: z.array(skillGrantSchema),
})
export type DecorationCatalogItem = z.infer<typeof decorationCatalogItemSchema>
export const decorationCatalogResponseSchema = z.array(decorationCatalogItemSchema)

export const skillCatalogEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['armor', 'weapon']),
  maxLevel: z.number(),
  /** Raw MHDB icon category, e.g. 'offense'. Null when MHDB omitted it. */
  icon: z.string().nullable(),
})

export const bonusThresholdSchema = z.object({
  piecesRequired: z.number(),
  effectName: z.string(),
  level: z.number(),
})

export const bonusCatalogEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['set', 'group']),
  /** Raw MHDB icon category, e.g. 'offense'. Null when MHDB omitted it. */
  icon: z.string().nullable(),
  thresholds: z.array(bonusThresholdSchema),
})

/** `GET /skills` intentionally returns two distinct collections (ADR-0011). */
export const skillCatalogResponseSchema = z.object({
  skills: z.array(skillCatalogEntrySchema),
  bonuses: z.array(bonusCatalogEntrySchema),
})
export type SkillCatalogResponse = z.infer<typeof skillCatalogResponseSchema>
