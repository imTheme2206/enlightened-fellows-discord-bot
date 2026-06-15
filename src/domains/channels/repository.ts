import { and, eq } from 'drizzle-orm'
import { db } from '../../infra/db/client'
import { registeredChannel, type RegisteredChannel } from '../../infra/db/schema'

export abstract class ChannelRepository {
  static async register(channelId: string, type: string): Promise<void> {
    await db.insert(registeredChannel).values({ channelId, type }).onConflictDoNothing()
  }

  static async unregister(channelId: string, type: string): Promise<void> {
    await db.delete(registeredChannel).where(and(eq(registeredChannel.channelId, channelId), eq(registeredChannel.type, type)))
  }

  static async findOne(channelId: string, type: string): Promise<{ channelId: string } | null> {
    const row = await db.query.registeredChannel.findFirst({
      columns: { channelId: true },
      where: (t, { and, eq }) => and(eq(t.channelId, channelId), eq(t.type, type)),
    })
    return row ?? null
  }

  static async findAllByType(type: string): Promise<{ channelId: string }[]> {
    return db.query.registeredChannel.findMany({
      columns: { channelId: true },
      where: (t, { eq }) => eq(t.type, type),
    })
  }

  static async findAll(): Promise<RegisteredChannel[]> {
    return db.query.registeredChannel.findMany({ orderBy: (t, { desc }) => [desc(t.createdAt)] })
  }
}
