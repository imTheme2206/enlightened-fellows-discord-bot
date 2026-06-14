import { randomUUID } from 'crypto'
import { Client, TextChannel } from 'discord.js'
import { asc, desc, inArray } from 'drizzle-orm'
import logger from '../../config/logger'
import { db } from '../../db/client'
import { genshinCode, type GenshinCode } from '../../db/schema'
import { isDefined } from '../../utils/is-defined'
import { genshinCodeChannels } from '../channels/service'

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

  static async saveAndNotify(codes: string[], client: Client): Promise<void> {
    for (const code of codes) {
      await this.save(code, true)
    }

    const content = codes.map((c) => this.buildRedeemUrl(c)).join('\n')
    const channels = await genshinCodeChannels.getAll()

    for (const { channelId } of channels) {
      const channel = client.guilds.cache.map((g) => g.channels.cache.get(channelId)).find(isDefined) as TextChannel | undefined

      if (!channel) {
        logger.warn(`GenshinCodeService: channel ${channelId} not in cache`)
        continue
      }

      try {
        await channel.send({ content })
      } catch (err) {
        logger.error(`GenshinCodeService: failed to send to ${channelId}`, { err })
      }
    }
  }
}
