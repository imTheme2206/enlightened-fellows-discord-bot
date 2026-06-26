import { Elysia } from 'elysia'
import { ChannelService } from '../../domains/channels/service'

export const channelsRoutes = new Elysia({ tags: ['admin'] }).get('/channels', () => ChannelService.getAll())
