import { db } from '../../db/client'

export interface RegisteredChannelRow {
  channelId: string
  type: string
  createdAt: string
}

export class ChannelRegistry {
  constructor(private readonly type: string) {}

  register(channelId: string): void {
    db.prepare('INSERT OR IGNORE INTO RegisteredChannel (channelId, type) VALUES (?, ?)').run(channelId, this.type)
  }

  unregister(channelId: string): void {
    db.prepare('DELETE FROM RegisteredChannel WHERE channelId = ? AND type = ?').run(channelId, this.type)
  }

  get(channelId: string): { channelId: string } | null {
    return (
      (db.prepare('SELECT channelId FROM RegisteredChannel WHERE channelId = ? AND type = ?').get(channelId, this.type) as
        | { channelId: string }
        | undefined) ?? null
    )
  }

  getAll(): { channelId: string }[] {
    return db.prepare('SELECT channelId FROM RegisteredChannel WHERE type = ?').all(this.type) as { channelId: string }[]
  }
}

export abstract class ChannelService {
  static getAll(): RegisteredChannelRow[] {
    return db.prepare('SELECT * FROM RegisteredChannel ORDER BY createdAt DESC').all() as RegisteredChannelRow[]
  }
}

export const genshinCodeChannels = new ChannelRegistry('genshin_code')
export const mhEventsChannels = new ChannelRegistry('mh_events')
