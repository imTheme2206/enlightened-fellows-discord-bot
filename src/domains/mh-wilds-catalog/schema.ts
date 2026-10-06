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

export const weaponKindSchema = z.enum([
  'great-sword',
  'long-sword',
  'sword-shield',
  'dual-blades',
  'hammer',
  'hunting-horn',
  'lance',
  'gunlance',
  'switch-axe',
  'charge-blade',
  'insect-glaive',
  'bow',
  'light-bowgun',
  'heavy-bowgun',
])
export type WeaponKind = z.infer<typeof weaponKindSchema>

const weaponDamageSchema = z.object({ raw: z.number(), display: z.number() })

/** ADR-0013: weapons are first-class catalog items. */
export const weaponCatalogItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: weaponKindSchema,
  rarity: z.number(),
  damage: weaponDamageSchema,
  affinity: z.number(),
  /** Element/status specials; `name` is the element (e.g. 'fire') or status (e.g. 'paralysis'). */
  specials: z.array(
    z.object({
      kind: z.enum(['element', 'status']),
      name: z.string(),
      damage: weaponDamageSchema,
      hidden: z.boolean(),
    })
  ),
  /** Null for ranged weapons. */
  sharpness: z
    .object({
      red: z.number(),
      orange: z.number(),
      yellow: z.number(),
      green: z.number(),
      blue: z.number(),
      white: z.number(),
      purple: z.number(),
    })
    .nullable(),
  /** Handicraft sharpness-gain breakpoints; null for ranged weapons. */
  handicraft: z.array(z.number()).nullable(),
  /** Weapon-type decoration slot sizes. */
  slots: z.array(z.number()),
  skills: z.array(skillGrantSchema),
  elderseal: z.string().nullable(),
  defenseBonus: z.number(),
  series: z.string().nullable(),
  /** Fields only some kinds carry: phial, shell, coatings, ammo, kinsectLevel, melody, ... */
  kindSpecific: z.record(z.string(), z.unknown()),
})
export type WeaponCatalogItem = z.infer<typeof weaponCatalogItemSchema>
export const weaponCatalogResponseSchema = z.array(weaponCatalogItemSchema)

export const weaponCatalogQuerySchema = z.object({
  kind: weaponKindSchema.optional(),
})
export type WeaponCatalogQuery = z.infer<typeof weaponCatalogQuerySchema>

/** ADR-0015: monsters are replace-on-change catalog data. */
export const monsterMultipliersSchema = z.object({
  slash: z.number(),
  blunt: z.number(),
  pierce: z.number(),
  fire: z.number(),
  water: z.number(),
  thunder: z.number(),
  ice: z.number(),
  dragon: z.number(),
  stun: z.number(),
})

/** Content fingerprint + when that content was written; changes whenever upstream values change. */
export const monsterDataVersionSchema = z.object({
  hash: z.string(),
  fetchedAt: z.string(),
})

export const monsterListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  species: z.string(),
  baseHealth: z.number(),
  /** Path of the monster's icon, served by this API (falls back to the Unknown icon). */
  iconUrl: z.string(),
})
export type MonsterListItem = z.infer<typeof monsterListItemSchema>
export const monsterListResponseSchema = z.array(monsterListItemSchema)

export const monsterPartSchema = z.object({
  /** Stable across replacements of the monster (`<monsterId>:<upstream part id>`). */
  id: z.string(),
  kind: z.string(),
  name: z.string(),
  /** Null when upstream publishes no part HP. */
  health: z.number().nullable(),
  kinsectEssence: z.string().nullable(),
  multipliers: monsterMultipliersSchema,
})

export const monsterWeaknessSchema = z.object({
  kind: z.enum(['element', 'status', 'effect']),
  /** Element (e.g. 'dragon'), status (e.g. 'paralysis') or effect (e.g. 'flash') name. */
  name: z.string(),
  level: z.number(),
  condition: z.string().nullable(),
})

export const monsterDetailSchema = monsterListItemSchema.extend({
  description: z.string(),
  size: z.record(z.string(), z.number()),
  dataVersion: monsterDataVersionSchema,
  parts: z.array(monsterPartSchema),
  weaknesses: z.array(monsterWeaknessSchema),
})
export type MonsterDetail = z.infer<typeof monsterDetailSchema>

export const monsterParamsSchema = z.object({ id: z.string() })
export const monsterNotFoundSchema = z.object({ error: z.object({ code: z.literal('NOT_FOUND'), message: z.string() }) })
