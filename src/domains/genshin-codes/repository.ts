import { randomUUID } from 'crypto'
import { asc, desc, inArray } from 'drizzle-orm'
import { db } from '../../infra/db/client'
import { genshinCode, type GenshinCode } from '../../infra/db/schema'

export abstract class GenshinCodeRepository {
  static async insert(code: string, rewards: string | null, isAlerted: boolean, isExpired: boolean): Promise<void> {
    await db.insert(genshinCode).values({ id: randomUUID(), code, rewards, isAlerted, isExpired }).onConflictDoNothing()
  }

  static async findUnalerted(): Promise<GenshinCode[]> {
    return db.query.genshinCode.findMany({
      where: (t, { and, eq }) => and(eq(t.isAlerted, false), eq(t.isExpired, false)),
      orderBy: (t) => [asc(t.createdAt)],
    })
  }

  static async markAlerted(ids: string[]): Promise<void> {
    await db.update(genshinCode).set({ isAlerted: true }).where(inArray(genshinCode.id, ids))
  }

  static async findAll(limit: number): Promise<GenshinCode[]> {
    return db.query.genshinCode.findMany({ orderBy: (t) => [desc(t.createdAt)], limit })
  }
}
