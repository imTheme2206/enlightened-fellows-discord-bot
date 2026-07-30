import './infra/db/schema'
import { Client, GatewayIntentBits } from 'discord.js'
// import { client } from "./bot/client";
import { loadEvents } from './bot/handlers/event-handler'
import { config } from './infra/config'
import logger from './infra/logger'
import { startServer } from './api'

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildMessages,
  ],
})

// Handle graceful shutdown
function handleShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`)
  client.destroy()
  process.exit(0)
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'))
process.on('SIGINT', () => handleShutdown('SIGINT'))

async function main(): Promise<void> {
  // config is validated on import; fatal exit if env vars missing
  logger.info('Starting bot...')

  await startServer()

  // Set-search index readiness is lazy (domains/set-search/runtime.ts):
  // startServer() (HTTP) can accept a search before the Discord `ready`
  // event's un-awaited seedOnBoot() finishes, and the first search call
  // simply builds the index on demand rather than throwing.
  await loadEvents(client)

  await client.login(config.DISCORD_TOKEN)
}

main().catch((err) => {
  logger.error('Fatal error during startup:', { err })
  process.exit(1)
})
