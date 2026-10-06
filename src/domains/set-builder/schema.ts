import { z } from "zod"
import {
  artianCustomizationRequestSchema,
  artianCustomizationSchema,
  bonusThresholdSchema,
  weaponArtianSchema,
  weaponKindSchema,
} from "../mh-wilds-catalog/schema"
import { searchResultSchema } from "../set-search/schema"

/**
 * Set Builder wire contracts (design doc §Save request / §Build representation).
 *
 * Two shapes matter here and must not be confused:
 *   - the **Save request** carries references + decoration assignments only; a
 *     caller never submits trusted component values (ADR-0005);
 *   - the **Build snapshot** (`composition`) is backend-constructed, self-contained,
 *     and schema-versioned. It embeds the selected component values plus the
 *     referenced Skill maxima and Set/Group Bonus thresholds a web/bot calculator
 *     needs, so it never has to consult the live catalog (ADR-0005, ADR-0010).
 *
 * Aggregate skill/defense/resistance totals are deliberately absent from every
 * contract here — consumers calculate those on demand (ADR-0010).
 */

// ── Save request ────────────────────────────────────────────────────────────

/** One decoration assigned to a specific slot index on a piece or talisman. */
const decorationAssignmentSchema = z.object({
  slotIndex: z.number().int().min(0),
  decorationId: z.string().min(1),
})

const armorSelectionSchema = z.object({
  armorId: z.string().min(1),
  decorations: z.array(decorationAssignmentSchema).default([]),
})

const talismanSelectionSchema = z.object({
  source: z.enum(["custom", "scraped"]),
  talismanId: z.string().min(1),
  decorations: z.array(decorationAssignmentSchema).default([]),
})

/**
 * A weapon selection (ADR-0013): an optional catalog weapon (`weaponId`, resolved
 * against the weapon catalog) with decorations assigned to its weapon-type slots,
 * plus the optional Set/Group Bonus pair that mirrors what the Set Search
 * optimizer's "gogma weapon" contributes (`search-set/state.ts` `gogmaSkills`).
 *
 * `weaponId` is nullable and defaults to `null` so bonus-only selections keep
 * working: the optimizer import carries only bonuses, and clients predating the
 * weapon catalog omit the field. A null `weaponId` has no slots, so it cannot
 * carry decorations. Each bonus reference is independently optional; the whole
 * weapon key is nullable to denote no weapon contribution. Bonuses on a
 * catalog weapon are only valid for a Gogma Artian (ADR-0014).
 */
const weaponSelectionSchema = z.object({
  weaponId: z.string().min(1).nullable().default(null),
  decorations: z.array(decorationAssignmentSchema).default([]),
  setBonusId: z.string().min(1).nullable(),
  groupBonusId: z.string().min(1).nullable(),
  /**
   * The Artian / Gogma Artian configuration (ADR-0014): element, production
   * bonuses and reinforcements, validated against the rules table. Only an
   * Artian-family `weaponId` may carry one; `null` means "no customization".
   * A Gogma Artian's rolled Set/Group Bonus stay in `setBonusId`/`groupBonusId`.
   */
  customization: artianCustomizationRequestSchema.nullish(),
})

/** All seven position keys are required; `null` denotes an empty position. */
const compositionRequestSchema = z.object({
  head: armorSelectionSchema.nullable(),
  chest: armorSelectionSchema.nullable(),
  arms: armorSelectionSchema.nullable(),
  waist: armorSelectionSchema.nullable(),
  legs: armorSelectionSchema.nullable(),
  talisman: talismanSelectionSchema.nullable(),
  weapon: weaponSelectionSchema.nullable(),
})
export type CompositionRequest = z.infer<typeof compositionRequestSchema>

/** Names are 1–100 chars; descriptions optional and ≤1000 chars, always plain text. */
export const MAX_BUILD_NAME_LENGTH = 100
export const MAX_BUILD_DESCRIPTION_LENGTH = 1000

/** Per-owner caps (design doc §Ownership, limits, and discovery). */
export const MAX_SAVED_BUILDS_PER_USER = 50
export const MAX_SHARED_BUILDS_PER_USER = 5

/** Shared-listing page sizes (design doc §Ownership, limits, and discovery). */
export const DEFAULT_SHARED_PAGE_SIZE = 20
export const MAX_SHARED_PAGE_SIZE = 50

export const saveBuildRequestSchema = z.object({
  name: z.string().trim().min(1).max(MAX_BUILD_NAME_LENGTH),
  description: z.string().max(MAX_BUILD_DESCRIPTION_LENGTH).nullish(),
  isShared: z.boolean().default(false),
  composition: compositionRequestSchema,
})
export type SaveBuildRequest = z.infer<typeof saveBuildRequestSchema>

/** `PATCH /builds/:id` changes only metadata/sharing; composition is untouched. */
export const patchBuildRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_BUILD_NAME_LENGTH),
    description: z.string().max(MAX_BUILD_DESCRIPTION_LENGTH).nullable(),
    isShared: z.boolean(),
  })
  .partial()
export type PatchBuildRequest = z.infer<typeof patchBuildRequestSchema>

/**
 * `POST /builds/import` — imports one Set Search optimizer result into a saved
 * Build. `result` reuses `searchResultSchema` (`set-search/schema.ts`) as-is: it
 * is already the shared, versionless API contract for a search result (ADR-0001),
 * so referencing it here is the same kind of cross-domain boundary as the
 * catalog's shared DTOs rather than a new coupling. `weapon` carries the
 * optimizer's "gogma weapon" Set/Group Bonus contribution by *name* (the result
 * has no ids); the service resolves each against the bonus catalog.
 */
export const importBuildRequestSchema = z.object({
  result: searchResultSchema,
  weapon: z.object({
    setBonus: z.string().nullable(),
    groupBonus: z.string().nullable(),
  }),
  name: z.string().trim().min(1).max(MAX_BUILD_NAME_LENGTH),
  description: z.string().max(MAX_BUILD_DESCRIPTION_LENGTH).nullish(),
  isShared: z.boolean().default(false),
})
export type ImportBuildRequest = z.infer<typeof importBuildRequestSchema>

// ── Snapshot (backend-constructed `composition`) ─────────────────────────────

const snapshotSkillSchema = z.object({
  skillId: z.string(),
  name: z.string(),
  level: z.number(),
})

const snapshotBonusSchema = z.object({
  bonusId: z.string(),
  name: z.string(),
  kind: z.enum(["set", "group"]),
})

const snapshotDecorationSchema = z.object({
  slotIndex: z.number(),
  decorationId: z.string(),
  name: z.string(),
  slotSize: z.number(),
  skills: z.array(snapshotSkillSchema),
})

const snapshotResistancesSchema = z.object({
  fire: z.number(),
  water: z.number(),
  thunder: z.number(),
  ice: z.number(),
  dragon: z.number(),
})

const snapshotArmorPieceSchema = z.object({
  armorId: z.string(),
  name: z.string(),
  type: z.enum(["head", "chest", "arms", "waist", "legs"]),
  rank: z.string(),
  rarity: z.number(),
  defense: z.number(),
  resistances: snapshotResistancesSchema,
  slots: z.array(z.number()),
  skills: z.array(snapshotSkillSchema),
  bonuses: z.array(snapshotBonusSchema),
  decorations: z.array(snapshotDecorationSchema),
})

/**
 * A talisman position mirrors an armor piece but carries its `source` and typed
 * slots. A scraped talisman has skills only (`slots: []`); a custom talisman may
 * carry 1–3 slots whose first may be a weapon slot (see CONTEXT.md).
 */
const snapshotTalismanSchema = z.object({
  source: z.enum(["custom", "scraped"]),
  talismanId: z.string(),
  name: z.string(),
  slots: z.array(
    z.object({ type: z.enum(["weapon", "armor"]), size: z.number() }),
  ),
  skills: z.array(snapshotSkillSchema),
  bonuses: z.array(snapshotBonusSchema),
  decorations: z.array(snapshotDecorationSchema),
})

const snapshotSpecialSchema = z.object({
  kind: z.enum(["element", "status"]),
  name: z.string(),
  damage: z.object({ raw: z.number(), display: z.number() }),
  hidden: z.boolean(),
})

const snapshotSharpnessSchema = z.object({
  red: z.number(),
  orange: z.number(),
  yellow: z.number(),
  green: z.number(),
  blue: z.number(),
  white: z.number(),
  purple: z.number(),
})

/**
 * The Artian / Gogma Artian configuration as saved (ADR-0014): the validated
 * `config`, what the weapon was classified as, the catalog base it was derived
 * from, the effective-only numbers that have no slot on the item itself, and the
 * rules `gameVersion` the derivation used.
 */
const snapshotCustomizationSchema = z.object({
  family: weaponArtianSchema.shape.family,
  tier: weaponArtianSchema.shape.tier,
  focus: weaponArtianSchema.shape.focus,
  config: artianCustomizationSchema,
  base: z.object({
    damage: z.object({ raw: z.number(), display: z.number() }),
    affinity: z.number(),
  }),
  sharpnessBonus: z.number(),
  ammoBonus: z.number(),
  gameVersion: z.string(),
})
export type SnapshotCustomization = z.infer<typeof snapshotCustomizationSchema>

/**
 * The weapon's trusted values, embedded like an armor piece (ADR-0013).
 * `slots` are weapon-type slot sizes; `decorations` index into them. For a
 * customized Artian weapon `damage`, `affinity` and `specials` are the *effective*
 * values derived from `customization`, so every consumer reads one set of numbers.
 */
const snapshotWeaponItemSchema = z.object({
  weaponId: z.string(),
  name: z.string(),
  kind: weaponKindSchema,
  rarity: z.number(),
  damage: z.object({ raw: z.number(), display: z.number() }),
  affinity: z.number(),
  specials: z.array(snapshotSpecialSchema),
  sharpness: snapshotSharpnessSchema.nullable(),
  slots: z.array(z.number()),
  skills: z.array(snapshotSkillSchema),
  decorations: z.array(snapshotDecorationSchema),
  customization: snapshotCustomizationSchema.nullable(),
})

/**
 * A weapon position: the resolved Set/Group Bonus pair (each independently
 * nullable) plus, when a catalog weapon was selected, its item snapshot.
 *
 * Legacy snapshots (saved before ADR-0013) hold only the bonus pair — and
 * ADR-0005 forbids rewriting them — so every item field is optional here:
 * `weaponId` absent/null means a bonus-only weapon. Newly built snapshots always
 * write the full item when `weaponId` is set, and `weaponId: null` otherwise.
 */
const snapshotWeaponSchema = snapshotWeaponItemSchema
  .partial()
  .extend({
    weaponId: z.string().nullish(),
    setBonus: snapshotBonusSchema.nullable(),
    groupBonus: snapshotBonusSchema.nullable(),
  })

export const buildSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  positions: z.object({
    head: snapshotArmorPieceSchema.nullable(),
    chest: snapshotArmorPieceSchema.nullable(),
    arms: snapshotArmorPieceSchema.nullable(),
    waist: snapshotArmorPieceSchema.nullable(),
    legs: snapshotArmorPieceSchema.nullable(),
    talisman: snapshotTalismanSchema.nullable(),
    weapon: snapshotWeaponSchema.nullable(),
  }),
  /** Every referenced Skill: name → its maximum level, for effective-level capping. */
  skillDefinitions: z.record(z.string(), z.number()),
  /** Every referenced Set/Group Bonus: name → kind + ordered activation thresholds. */
  bonusDefinitions: z.record(
    z.string(),
    z.object({
      kind: z.enum(["set", "group"]),
      thresholds: z.array(bonusThresholdSchema),
    }),
  ),
})
export type BuildSnapshot = z.infer<typeof buildSnapshotSchema>
export type SnapshotArmorPiece = z.infer<typeof snapshotArmorPieceSchema>
export type SnapshotTalisman = z.infer<typeof snapshotTalismanSchema>
export type SnapshotWeapon = z.infer<typeof snapshotWeaponSchema>
export type SnapshotDecoration = z.infer<typeof snapshotDecorationSchema>
export type SnapshotBonus = z.infer<typeof snapshotBonusSchema>

// ── Build response ───────────────────────────────────────────────────────────

/**
 * The build owner's Discord identity, denormalized at save time. Attached to
 * listing summaries only (never the anonymous UUID read). Both fields are
 * best-effort: an older row or a token missing the OAuth claims yields nulls.
 */
export const buildOwnerSchema = z.object({
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
})
export type BuildOwner = z.infer<typeof buildOwnerSchema>

/**
 * The owner identity an owner-write carries, to denormalize onto the row. The
 * caller supplies the two display fields; `userId` remains a separate argument
 * since it also scopes ownership.
 */
export type BuildOwnerInput = BuildOwner

/** Full Build — identical for owners and anonymous UUID readers; no owner identity. */
export const buildResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isShared: z.boolean(),
  sharedAt: z.string().nullable(),
  revision: z.number(),
  isStale: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  composition: buildSnapshotSchema,
})
export type BuildResponse = z.infer<typeof buildResponseSchema>

/**
 * List summaries omit the composition; only UUID detail returns the full
 * snapshot. Unlike the detail read, a summary carries the `owner` so the Shared
 * Build gallery (and the owner's own list) can attribute each build.
 */
export const buildSummarySchema = buildResponseSchema
  .omit({ composition: true })
  .extend({ owner: buildOwnerSchema.nullable() })
export type BuildSummary = z.infer<typeof buildSummarySchema>

/** Cursor-paginated Shared Build listing; `nextCursor` is null on the last page. */
export const sharedBuildListResponseSchema = z.object({
  items: z.array(buildSummarySchema),
  nextCursor: z.string().nullable(),
})
export type SharedBuildListResponse = z.infer<
  typeof sharedBuildListResponseSchema
>

// ── HTTP transport contracts ─────────────────────────────────────────────────

/** Optimistic-concurrency revision, supplied as `?revision=` on PUT/PATCH. */
export const revisionQuerySchema = z.object({
  revision: z.coerce.number().int().nonnegative(),
})

/** Shared-list paging: `?limit=` (1..50, default 20) and an opaque `?cursor=`. */
export const sharedListQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_SHARED_PAGE_SIZE)
    .default(DEFAULT_SHARED_PAGE_SIZE),
  cursor: z.string().optional(),
})

/** `:id` path param — the Build's unguessable UUID read capability (ADR-0006). */
export const buildParamsSchema = z.object({ id: z.string().min(1) })
