import { randomUUID } from 'crypto'
import { asc, desc, inArray } from 'drizzle-orm'
import { db } from '../../db/client'
import { genshinCode, type GenshinCode } from '../../db/schema'

export abstract class GenshinCodeService {
  static redeemUrl = 'https://genshin.hoyoverse.com/en/gift?code='

  static async save(code: string, isAlerted = false, isExpired = false, rewards?: string): Promise<void> {
    await db
      .insert(genshinCode)
      .values({ id: randomUUID(), code, rewards: rewards ?? null, isAlerted, isExpired })
      .onConflictDoNothing()
  }

  static async getUnalerted(): Promise<GenshinCode[]> {
    return db.query.genshinCode.findMany({
      where: (t, { and, eq }) => and(eq(t.isAlerted, false), eq(t.isExpired, false)),
      orderBy: (t) => [asc(t.createdAt)],
    })
  }

  static async markAlerted(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await db.update(genshinCode).set({ isAlerted: true }).where(inArray(genshinCode.id, ids))
  }

  static async getAll(limit = 100): Promise<GenshinCode[]> {
    return db.query.genshinCode.findMany({ orderBy: (t) => [desc(t.createdAt)], limit })
  }

  static buildRedeemUrl(code: string): string {
    return `${this.redeemUrl}${code}`
  }
}
