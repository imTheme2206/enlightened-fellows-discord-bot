import { and, asc, eq, type SQL } from 'drizzle-orm'
import { db } from '../../infra/db/client'
import { skill, type Skill } from '../../infra/db/schema'

export abstract class SkillRepository {
  static async findAll(filter: { type?: string; setSkill?: boolean } = {}): Promise<Skill[]> {
    const conditions: SQL[] = []
    if (filter.type !== undefined) conditions.push(eq(skill.type, filter.type))
    if (filter.setSkill !== undefined) conditions.push(eq(skill.isSetSkill, filter.setSkill))

    return db
      .select()
      .from(skill)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(skill.name))
  }
}
