import type { RegisteredChannel } from '../../infra/db/schema'
import { ChannelRepository } from './repository'

/** A type-scoped view over registered channels (e.g. genshin codes, MH events). */
export class ChannelRegistry {
  constructor(private readonly type: string) {}

  register(channelId: string): Promise<void> {
    return ChannelRepository.register(channelId, this.type)
  }

  unregister(channelId: string): Promise<void> {
    return ChannelRepository.unregister(channelId, this.type)
  }

  get(channelId: string): Promise<{ channelId: string } | null> {
    return ChannelRepository.findOne(channelId, this.type)
  }

  getAll(): Promise<{ channelId: string }[]> {
    return ChannelRepository.findAllByType(this.type)
  }
}

export abstract class ChannelService {
  static getAll(): Promise<RegisteredChannel[]> {
    return ChannelRepository.findAll()
  }
}

export const genshinCodeChannels = new ChannelRegistry('genshin_code')
export const mhEventsChannels = new ChannelRegistry('mh_events')
