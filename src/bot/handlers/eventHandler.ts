import { Client } from 'discord.js'
import logger from '../../config/logger'
import * as ready from '../events/ready'
import * as interactionCreate from '../events/interactionCreate'

interface EventModule {
  name: string
  once?: boolean
  execute: (...args: unknown[]) => Promise<void> | void
}

export async function loadEvents(client: Client): Promise<void> {
  const events: EventModule[] = [ready, interactionCreate]

  for (const mod of events) {
    if (mod.once) {
      client.once(mod.name, (...args) => mod.execute(...args))
    } else {
      client.on(mod.name, (...args) => mod.execute(...args))
    }
    logger.debug(`Registered event: ${mod.name}`)
  }
}
