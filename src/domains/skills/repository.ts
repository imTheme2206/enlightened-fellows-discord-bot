import { and, asc, eq, inArray, type SQL } from 'drizzle-orm'
import { db } from '../../infra/db/client'
import { skill, type Skill } from '../../infra/db/schema'

export abstract class SkillRepository {
  static async findAll(filter: { type?: string } = {}): Promise<Skill[]> {
    const conditions: SQL[] = []
    if (filter.type !== undefined) conditions.push(eq(skill.type, filter.type))

    return db
      .select()
      .from(skill)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(skill.name))
  }

  static async findByIds(ids: string[]): Promise<Skill[]> {
    if (ids.length === 0) return []
    return db.select().from(skill).where(inArray(skill.id, ids))
  }
}
