import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'

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
  // The web app resolves Discord ID → Supabase user via auth.identities at query time.
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
