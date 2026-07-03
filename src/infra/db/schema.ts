import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, unique } from 'drizzle-orm/pg-core'

export const skill = pgTable('skill', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  cleanName: text('clean_name').notNull().unique(),
  type: text('type').notNull().default('armor'),
  maxLevel: integer('max_level').notNull().default(1),
  isSetSkill: boolean('is_set_skill').notNull().default(false),
  isGroupSkill: boolean('is_group_skill').notNull().default(false),
  requiredPieces: integer('required_pieces'),
  effectName: text('effect_name'),
  // Raw MHDB icon category, e.g. 'affinity', 'offense', 'handicraft'. Consumers map to their own assets.
  icon: text('icon'),
})

export const decoration = pgTable('decoration', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  type: text('type').notNull(),
  slotSize: integer('slot_size').notNull(),
  skillId: text('skill_id')
    .notNull()
    .references(() => skill.id, { onDelete: 'cascade' }),
  skillLevel: integer('skill_level').notNull(),
})

export const armor = pgTable('armor', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  type: text('type').notNull(),
  rank: text('rank').notNull().default('HIGH'),
  rarity: integer('rarity').notNull().default(0),
  defense: integer('defense').notNull().default(0),
  fireRes: integer('fire_res').notNull().default(0),
  waterRes: integer('water_res').notNull().default(0),
  thunderRes: integer('thunder_res').notNull().default(0),
  iceRes: integer('ice_res').notNull().default(0),
  dragonRes: integer('dragon_res').notNull().default(0),
  slots: jsonb('slots').$type<number[]>().notNull().default([]),
})

export const armorSkill = pgTable(
  'armor_skill',
  {
    armorId: text('armor_id')
      .notNull()
      .references(() => armor.id, { onDelete: 'cascade' }),
    skillId: text('skill_id')
      .notNull()
      .references(() => skill.id, { onDelete: 'cascade' }),
    level: integer('level').notNull(),
  },
  (t) => [primaryKey({ columns: [t.armorId, t.skillId] })]
)

export const armorSetSkill = pgTable(
  'armor_set_skill',
  {
    armorId: text('armor_id')
      .notNull()
      .references(() => armor.id, { onDelete: 'cascade' }),
    skillId: text('skill_id')
      .notNull()
      .references(() => skill.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.armorId, t.skillId] })]
)

export const armorGroupSkill = pgTable(
  'armor_group_skill',
  {
    armorId: text('armor_id')
      .notNull()
      .references(() => armor.id, { onDelete: 'cascade' }),
    skillId: text('skill_id')
      .notNull()
      .references(() => skill.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.armorId, t.skillId] })]
)

export const jobLog = pgTable('job_log', {
  id: text('id').primaryKey(),
  jobName: text('job_name').notNull(),
  status: text('status').notNull(),
  message: text('message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const searchHistory = pgTable('search_history', {
  id: text('id').primaryKey(),
  // Discord snowflake — intentionally text, not a FK to auth.users.
  // The API obtains it from a Supabase JWT's app_metadata.discord_id claim (see ADR-0003), not by querying auth.identities.
  userId: text('user_id').notNull(),
  label: text('label').notNull(),
  data: jsonb('data').notNull(),
  searchedAt: timestamp('searched_at', { withTimezone: true }).notNull().defaultNow(),
})

export const genshinCode = pgTable('genshin_code', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  rewards: text('rewards'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  isExpired: boolean('is_expired').notNull().default(false),
  isAlerted: boolean('is_alerted').notNull().default(false),
})

export const registeredChannel = pgTable(
  'registered_channel',
  {
    channelId: text('channel_id').notNull(),
    type: text('type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.type] })]
)

/** A skill applied to a custom talisman: `skillId` references `skill.id`, `level` <= that skill's `maxLevel`. */
export type TalismanSkill = { skillId: string; level: number }

/**
 * A slot on a custom talisman. Only the first slot (array index 0) may be
 * `'weapon'` — real talismans in this game can carry one weapon-type slot;
 * any additional slots are always `'armor'`. See docs/adr and CONTEXT.md.
 */
export type TalismanSlot = { type: 'weapon' | 'armor'; size: number }

export const customTalisman = pgTable(
  'custom_talisman',
  {
    id: text('id').primaryKey(),
    // Discord snowflake — intentionally text, not a FK to auth.users (see ADR-0003).
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    skills: jsonb('skills').$type<TalismanSkill[]>().notNull(),
    slots: jsonb('slots').$type<TalismanSlot[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.name)]
)

// Inferred types (replace the hand-written *Row interfaces in service files)
export type Skill = typeof skill.$inferSelect
export type Decoration = typeof decoration.$inferSelect
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
