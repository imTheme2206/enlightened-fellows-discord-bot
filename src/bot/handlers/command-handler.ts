import { Client, REST, Routes } from 'discord.js'
import { config } from '../../config'
import logger from '../../config/logger'
import { Command } from '../commands/_types'
import * as genshinCode from '../commands/genshin/code'
import * as genshinRegisterChannel from '../commands/genshin/register-channel'
import * as mhwildsEvents from '../commands/mhwilds/events'
import * as mhwildsHzv from '../commands/mhwilds/hzv'
import * as mhwildsMetaGuide from '../commands/mhwilds/meta-guide'
import * as mhwildsRegisterChannel from '../commands/mhwilds/register-channel'
import * as mhwildsSearchSet from '../commands/mhwilds/search-set'

export async function loadCommands(): Promise<Map<string, Command>> {
  const registry = new Map<string, Command>()

  const modules: Partial<Command>[] = [
    mhwildsEvents,
    mhwildsHzv,
    mhwildsMetaGuide,
    mhwildsRegisterChannel,
    mhwildsSearchSet,
    genshinCode,
    genshinRegisterChannel,
  ]

  for (const mod of modules) {
    if (!mod.data || typeof mod.execute !== 'function') {
      logger.warn(`Skipping command module: missing data or execute export`)
      continue
    }
    const cmd = mod as Command
    const name = (cmd.data as { name: string }).name
    registry.set(name, cmd)
    logger.debug(`Loaded command: ${name}`)
  }

  logger.info(`Loaded ${registry.size} commands`)
  return registry
}

/**
 * Registers all slash commands with the Discord guild via REST.
 * @param commands - The command registry built by loadCommands
 */
export async function deployCommands(commands: Map<string, Command>, client: Client): Promise<void> {
  const commandsData = Array.from(commands.values()).map((cmd) => cmd.data)
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN)
  const guildIds = [...client.guilds.cache.keys()]

  try {
    await Promise.all(
      guildIds.map(async (guildId) => {
        logger.info(`[${guildId}] Refreshing application (/) commands...`)
        await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, guildId), { body: commandsData })
        logger.info(`[${guildId}] Successfully reloaded application (/) commands.`)
      })
    )
  } catch (error) {
    logger.error('Failed to deploy commands:', { error })
  }
}
