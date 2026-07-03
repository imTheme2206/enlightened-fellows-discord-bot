import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { customTalisman } from '../../infra/db/schema'

/** A talisman may have at most this many skills. Bump if a future rank adds a slot. */
export const MAX_SKILLS_PER_TALISMAN = 3
/** A talisman may have at most this many slots (only index 0 may be `'weapon'`). */
export const MAX_SLOTS_PER_TALISMAN = 3
/** Per-user cap on stored custom talismans. */
export const MAX_TALISMANS_PER_USER = 50

const talismanSkillSchema = z.object({
  skillId: z.string().min(1),
  level: z.number().int().positive(),
})

const talismanSlotSchema = z.object({
  type: z.enum(['weapon', 'armor']),
  size: z.number().int().min(1).max(4),
})

/**
 * Canonical wire shape of a custom talisman, derived from the Drizzle table.
 * Reused by the web app to type/validate what it fetches.
 */
export const talismanSchema = createSelectSchema(customTalisman)
export type TalismanDto = z.infer<typeof talismanSchema>

export const talismansResponseSchema = z.array(talismanSchema)

/** Body contract for `POST /api/talismans`. */
export const createTalismanSchema = z.object({
  name: z.string().min(1).max(100),
  skills: z.array(talismanSkillSchema).min(1).max(MAX_SKILLS_PER_TALISMAN),
  slots: z
    .array(talismanSlotSchema)
    .max(MAX_SLOTS_PER_TALISMAN)
    .refine((slots) => slots.slice(1).every((s) => s.type === 'armor'), {
      message: 'Only the first slot may be a weapon slot',
    })
    .default([]),
})
export type CreateTalismanInput = z.infer<typeof createTalismanSchema>

export const talismanParamsSchema = z.object({ id: z.string().min(1) })
