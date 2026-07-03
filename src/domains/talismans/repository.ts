import { randomUUID } from 'crypto'
import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '../../infra/db/client'
import {
  customTalisman,
  type CustomTalisman,
  type TalismanSkill,
  type TalismanSlot,
} from '../../infra/db/schema'

export abstract class TalismanRepository {
  static async findByUser(userId: string): Promise<CustomTalisman[]> {
    return db.query.customTalisman.findMany({
      where: (t, { eq }) => eq(t.userId, userId),
      orderBy: (t) => [desc(t.createdAt)],
    })
  }

  static async countByUser(userId: string): Promise<number> {
    const [row] = await db.select({ value: count() }).from(customTalisman).where(eq(customTalisman.userId, userId))
    return row?.value ?? 0
  }

  static async insert(
    userId: string,
    name: string,
    skills: TalismanSkill[],
    slots: TalismanSlot[]
  ): Promise<CustomTalisman> {
    const [row] = await db
      .insert(customTalisman)
      .values({ id: randomUUID(), userId, name, skills, slots })
      .returning()
    return row
  }

  static async deleteOwned(userId: string, id: string): Promise<boolean> {
    const deleted = await db
      .delete(customTalisman)
      .where(and(eq(customTalisman.id, id), eq(customTalisman.userId, userId)))
      .returning({ id: customTalisman.id })
    return deleted.length > 0
  }
}
