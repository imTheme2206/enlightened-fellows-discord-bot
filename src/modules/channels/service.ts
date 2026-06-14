import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client'
import { registeredChannel, type RegisteredChannel } from '../../db/schema'

export class ChannelRegistry {
  constructor(private readonly type: string) {}

  async register(channelId: string): Promise<void> {
    await db.insert(registeredChannel).values({ channelId, type: this.type }).onConflictDoNothing()
  }

  async unregister(channelId: string): Promise<void> {
    await db.delete(registeredChannel).where(and(eq(registeredChannel.channelId, channelId), eq(registeredChannel.type, this.type)))
  }

  async get(channelId: string): Promise<{ channelId: string } | null> {
    const row = await db.query.registeredChannel.findFirst({
      columns: { channelId: true },
      where: (t, { and, eq }) => and(eq(t.channelId, channelId), eq(t.type, this.type)),
    })
    return row ?? null
  }

  async getAll(): Promise<{ channelId: string }[]> {
    return db.query.registeredChannel.findMany({
      columns: { channelId: true },
      where: (t, { eq }) => eq(t.type, this.type),
    })
  }
}

export abstract class ChannelService {
  static async getAll(): Promise<RegisteredChannel[]> {
    return db.query.registeredChannel.findMany({ orderBy: (t, { desc }) => [desc(t.createdAt)] })
  }
}

export const genshinCodeChannels = new ChannelRegistry('genshin_code')
export const mhEventsChannels = new ChannelRegistry('mh_events')
