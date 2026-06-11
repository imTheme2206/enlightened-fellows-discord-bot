import { randomUUID } from 'crypto'
import { Client, TextChannel } from 'discord.js'
import logger from '../../config/logger'
import { db } from '../../db/client'
import { isDefined } from '../../utils/is-defined'
import { genshinCodeChannels } from '../channels/service'

export interface GenshinCodeRow {
  id: string
  code: string
  rewards: string | null
  createdAt: string
  isExpired: number
  isAlerted: number
}

export abstract class GenshinCodeService {
  static redeemUrl = 'https://genshin.hoyoverse.com/en/gift?code='

  static save(code: string, isAlerted = false, isExpired = false, rewards?: string): void {
    db.prepare('INSERT OR IGNORE INTO GenshinCode (id, code, rewards, isAlerted, isExpired) VALUES (?, ?, ?, ?, ?)').run(
      randomUUID(),
      code,
      rewards ?? null,
      isAlerted ? 1 : 0,
      isExpired ? 1 : 0
    )
  }

  static getUnalerted(): GenshinCodeRow[] {
    return db.prepare('SELECT * FROM GenshinCode WHERE isAlerted = 0 AND isExpired = 0 ORDER BY createdAt ASC').all() as GenshinCodeRow[]
  }

  static markAlerted(ids: string[]): void {
    if (ids.length === 0) return
    const placeholders = ids.map(() => '?').join(', ')
    db.prepare(`UPDATE GenshinCode SET isAlerted = 1 WHERE id IN (${placeholders})`).run(...ids)
  }

  static getAll(limit = 100): GenshinCodeRow[] {
    return db.prepare('SELECT * FROM GenshinCode ORDER BY createdAt DESC LIMIT ?').all(limit) as GenshinCodeRow[]
  }

  static buildRedeemUrl(code: string): string {
    return `${this.redeemUrl}${code}`
  }

  static async saveAndNotify(codes: string[], client: Client): Promise<void> {
    for (const code of codes) {
      this.save(code, true)
    }

    const content = codes.map((c) => this.buildRedeemUrl(c)).join('\n')

    const channels = genshinCodeChannels.getAll()

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
