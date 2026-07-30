import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"

// Ordinary armor/weapon skills only. Set/Group Bonuses are separate entities
// (`bonus` + `bonusThreshold` + `armorBonus`) — see ADR-0011. A skill is a
// level-capped effect; a bonus activates at explicit piece-count thresholds.
export const skill = pgTable("skill", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  cleanName: text("clean_name").notNull().unique(),
  type: text("type").notNull().default("armor"), // 'armor' | 'weapon'
  maxLevel: integer("max_level").notNull().default(1),
  // Raw MHDB icon category, e.g. 'affinity', 'offense', 'handicraft'. Consumers map to their own assets.
  icon: text("icon"),
})

/**
 * A Set or Group Bonus as a first-class catalog entity (ADR-0011). Its ordered
 * activation thresholds live in `bonusThreshold`; the armor pieces that belong
 * to it live in `armorBonus`. `kind` distinguishes 'set' from 'group' so a
 * single membership table serves both.
 */
export const bonus = pgTable("bonus", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  cleanName: text("clean_name").notNull().unique(),
  kind: text("kind").notNull(), // 'set' | 'group'
  icon: text("icon"),
})

/**
 * One activation threshold of a `bonus`: at `piecesRequired` equipped pieces the
 * bonus grants `effectName` at `level`. Set bonuses have multiple ordered
 * thresholds; group bonuses typically have one (3 pieces). Ordered by `level`.
 */
export const bonusThreshold = pgTable(
  "bonus_threshold",
  {
    bonusId: text("bonus_id")
      .notNull()
      .references(() => bonus.id, { onDelete: "cascade" }),
    piecesRequired: integer("pieces_required").notNull(),
    effectName: text("effect_name").notNull(),
    level: integer("level").notNull(),
  },
  (t) => [primaryKey({ columns: [t.bonusId, t.piecesRequired] })],
)

export const decoration = pgTable("decoration", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type").notNull(), // 'armor' | 'weapon'
  slotSize: integer("slot_size").notNull(),
})

/**
 * A skill granted by a decoration. Decorations are multi-grant (a decoration may
 * grant more than one skill), so grants are normalized here rather than as the
 * former singular `decoration.skillId`/`skillLevel` columns.
 */
export const decorationSkill = pgTable(
  "decoration_skill",
  {
    decorationId: text("decoration_id")
      .notNull()
      .references(() => decoration.id, { onDelete: "cascade" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skill.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
  },
  (t) => [primaryKey({ columns: [t.decorationId, t.skillId] })],
)

export const armor = pgTable("armor", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type").notNull(),
  rank: text("rank").notNull().default("HIGH"),
  rarity: integer("rarity").notNull().default(0),
  defense: integer("defense").notNull().default(0),
  fireRes: integer("fire_res").notNull().default(0),
  waterRes: integer("water_res").notNull().default(0),
  thunderRes: integer("thunder_res").notNull().default(0),
  iceRes: integer("ice_res").notNull().default(0),
  dragonRes: integer("dragon_res").notNull().default(0),
  slots: jsonb("slots").$type<number[]>().notNull().default([]),
})

export const armorSkill = pgTable(
  "armor_skill",
  {
    armorId: text("armor_id")
      .notNull()
      .references(() => armor.id, { onDelete: "cascade" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skill.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
  },
  (t) => [primaryKey({ columns: [t.armorId, t.skillId] })],
)

/**
 * Membership of an armor piece in a Set or Group `bonus` (ADR-0011). Replaces
 * the former `armorSetSkill` + `armorGroupSkill` tables; the set/group
 * distinction lives on `bonus.kind`, so one membership table serves both.
 */
export const armorBonus = pgTable(
  "armor_bonus",
  {
    armorId: text("armor_id")
      .notNull()
      .references(() => armor.id, { onDelete: "cascade" }),
    bonusId: text("bonus_id")
      .notNull()
      .references(() => bonus.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.armorId, t.bonusId] })],
)

export const jobLog = pgTable("job_log", {
  id: text("id").primaryKey(),
  jobName: text("job_name").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const searchHistory = pgTable("search_history", {
  id: text("id").primaryKey(),
  // Discord snowflake — intentionally text, not a FK to auth.users.
  // The API obtains it from a Supabase JWT's app_metadata.discord_id claim (see ADR-0003), not by querying auth.identities.
  userId: text("user_id").notNull(),
  label: text("label").notNull(),
  data: jsonb("data").notNull(),
  searchedAt: timestamp("searched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const genshinCode = pgTable("genshin_code", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  rewards: text("rewards"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  isExpired: boolean("is_expired").notNull().default(false),
  isAlerted: boolean("is_alerted").notNull().default(false),
})

export const registeredChannel = pgTable(
  "registered_channel",
  {
    channelId: text("channel_id").notNull(),
    type: text("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.type] })],
)

/** A skill applied to a custom talisman: `skillId` references `skill.id`, `level` <= that skill's `maxLevel`. */
export type TalismanSkill = { skillId: string; level: number }

/**
 * A slot on a custom talisman. Only the first slot (array index 0) may be
 * `'weapon'` — real talismans in this game can carry one weapon-type slot;
 * any additional slots are always `'armor'`. See docs/adr and CONTEXT.md.
 */
export type TalismanSlot = { type: "weapon" | "armor"; size: number }

export const customTalisman = pgTable(
  "custom_talisman",
  {
    id: text("id").primaryKey(),
    // Discord snowflake — intentionally text, not a FK to auth.users (see ADR-0003).
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    skills: jsonb("skills").$type<TalismanSkill[]>().notNull(),
    slots: jsonb("slots").$type<TalismanSlot[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.userId, t.name)],
)

/**
 * A Saved Build: one JSONB aggregate row (ADR-0008). The scalar lifecycle fields
 * are indexed; the domain-validated, schema-versioned `composition` snapshot is
 * self-contained (ADR-0005) and has no foreign keys to catalog rows. `composition`
 * is intentionally typed loosely here — infra must not import a domain type — and
 * is cast to the domain-owned `BuildSnapshot` in the set-builder repository.
 *
 * `(user_id, idempotency_key)` is unique; the create-payload hash is retained so a
 * true retry (same key + payload) can be distinguished from key reuse with
 * different content. Indexes cover owner ordering (`updated_at DESC, id`) and the
 * shared listing cursor (`is_shared, shared_at DESC, id`). See the design doc
 * §Persistence.
 *
 * `owner_display_name` / `owner_avatar_url` denormalize the owner's Discord
 * identity (username + CDN avatar URL) captured from the Supabase JWT on each
 * owner write, so the Shared Build gallery can attribute a build without a live
 * Discord lookup. They are nullable: legacy rows and any token missing the
 * claims leave them null (ADR-0003).
 */
export const savedBuild = pgTable(
  "saved_build",
  {
    id: text("id").primaryKey(),
    // Discord snowflake — intentionally text, not a FK to auth.users (see ADR-0003).
    userId: text("user_id").notNull(),
    ownerDisplayName: text("owner_display_name"),
    ownerAvatarUrl: text("owner_avatar_url"),
    name: text("name").notNull(),
    description: text("description"),
    isShared: boolean("is_shared").notNull().default(false),
    sharedAt: timestamp("shared_at", { withTimezone: true }),
    revision: integer("revision").notNull().default(1),
    idempotencyKey: text("idempotency_key").notNull(),
    idempotencyPayloadHash: text("idempotency_payload_hash").notNull(),
    composition: jsonb("composition").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("saved_build_user_idempotency_key").on(t.userId, t.idempotencyKey),
    index("saved_build_owner_idx").on(t.userId, t.updatedAt, t.id),
    index("saved_build_shared_idx").on(t.isShared, t.sharedAt, t.id),
  ],
)

// Inferred types (replace the hand-written *Row interfaces in service files)
export type Skill = typeof skill.$inferSelect
export type Decoration = typeof decoration.$inferSelect
export type DecorationSkill = typeof decorationSkill.$inferSelect
export type Bonus = typeof bonus.$inferSelect
export type NewBonus = typeof bonus.$inferInsert
export type BonusThreshold = typeof bonusThreshold.$inferSelect
export type ArmorBonus = typeof armorBonus.$inferSelect
export type Armor = typeof armor.$inferSelect
export type JobLog = typeof jobLog.$inferSelect
export type NewJobLog = typeof jobLog.$inferInsert
export type SearchHistory = typeof searchHistory.$inferSelect
export type NewSearchHistory = typeof searchHistory.$inferInsert
export type GenshinCode = typeof genshinCode.$inferSelect
export type NewGenshinCode = typeof genshinCode.$inferInsert
export type RegisteredChannel = typeof registeredChannel.$inferSelect
export type NewRegisteredChannel = typeof registeredChannel.$inferInsert
export type CustomTalisman = typeof customTalisman.$inferSelect
export type NewCustomTalisman = typeof customTalisman.$inferInsert
export type SavedBuild = typeof savedBuild.$inferSelect
export type NewSavedBuild = typeof savedBuild.$inferInsert
