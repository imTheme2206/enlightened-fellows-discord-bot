import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { skill } from '../../infra/db/schema'

/**
 * Canonical wire shape of a skill, derived directly from the Drizzle table.
 * This is the single source of truth for the API response contract — the web
 * app can reuse `skillSchema` / `SkillDto` to type and validate what it fetches.
 */
export const skillSchema = createSelectSchema(skill)
export type SkillDto = z.infer<typeof skillSchema>

export const skillsResponseSchema = z.array(skillSchema)

/** Query contract for `GET /api/skills`. Returns ordinary skills only; Set/Group
 * Bonuses are separate entities (ADR-0011) exposed on their own route. */
export const skillQuerySchema = z.object({
  type: z.enum(['armor', 'weapon']).optional(),
})
export type SkillQuery = z.infer<typeof skillQuerySchema>
