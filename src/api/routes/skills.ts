import { Elysia } from 'elysia'
import { SkillService } from '../../domains/skills/service'
import { skillQuerySchema, skillsResponseSchema } from '../../domains/skills/schema'

export const skillsRoutes = new Elysia().get('/skills', ({ query }) => SkillService.getAll(query), {
  query: skillQuerySchema,
  response: skillsResponseSchema,
})
