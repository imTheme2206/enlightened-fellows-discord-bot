import { Client } from 'discord.js'
import fs from 'fs'
import path from 'path'
import logger from '../../config/logger'

interface EventModule {
  name: string
  once?: boolean
  execute: (...args: unknown[]) => Promise<void> | void
}

/**
 * Dynamically loads all event files and registers them on the Discord client.
 * @param client - The Discord client instance
 */
export async function loadEvents(client: Client): Promise<void> {
  const eventsDir = path.join(__dirname, '..', 'events')

  const files = fs
    .readdirSync(eventsDir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))

  for (const file of files) {
    const fullPath = path.join(eventsDir, file)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(fullPath) as EventModule

    if (!mod.name || typeof mod.execute !== 'function') {
      logger.warn(`Skipping event file ${file}: missing name or execute export`)
      continue
    }

    if (mod.once) {
      client.once(mod.name, (...args) => mod.execute(...args))
    } else {
      client.on(mod.name, (...args) => mod.execute(...args))
    }

    logger.debug(`Registered event: ${mod.name}`)
  }
}
