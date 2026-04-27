import { REST, Routes } from 'discord.js'
import fs from 'fs'
import path from 'path'
import { config } from '../../config'
import logger from '../../config/logger'
import { Command } from '../commands/_types'

/** Dynamically loads all command files and builds a registry map. */
export async function loadCommands(): Promise<Map<string, Command>> {
  const registry = new Map<string, Command>()

  // Resolve commands directory relative to this file
  const commandsDir = path.join(__dirname, '..', 'commands')

  const loadDir = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        loadDir(fullPath)
        continue
      }
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.js')) continue
      if (entry.name.startsWith('_')) continue

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(fullPath) as Partial<Command>
      if (!mod.data || typeof mod.execute !== 'function') {
        logger.warn(`Skipping ${fullPath}: missing data or execute export`)
        continue
      }

      const cmd = mod as Command
      const name = (cmd.data as { name: string }).name
      registry.set(name, cmd)
      logger.debug(`Loaded command: ${name}`)
    }
  }

  loadDir(commandsDir)
  logger.info(`Loaded ${registry.size} commands`)
  return registry
}

/**
 * Registers all slash commands with the Discord guild via REST.
 * @param commands - The command registry built by loadCommands
 */
export async function deployCommands(commands: Map<string, Command>): Promise<void> {
  const commandsData = Array.from(commands.values()).map((cmd) => cmd.data)
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN)

  try {
    logger.info('Refreshing application (/) commands...')
    await rest.put(
      Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
      { body: commandsData }
    )
    logger.info('Successfully reloaded application (/) commands.')
  } catch (error) {
    logger.error('Failed to deploy commands:', { error })
  }
}
