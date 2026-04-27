import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { config } from '../../config'
import logger from '../../config/logger'
import { runScraper } from '../../services/scraperService'
import type { Command } from './_types'

export const data = new SlashCommandBuilder()
  .setName('admin-scrape')
  .setDescription('Manually trigger the armor/skill data scraper (owner only)')

export const execute: Command['execute'] = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  if (!config.DISCORD_OWNER_ID || interaction.user.id !== config.DISCORD_OWNER_ID) {
    await interaction.reply({ content: 'Not authorized.', ephemeral: true })
    return
  }

  await interaction.deferReply({ ephemeral: true })

  try {
    const result = await runScraper({ source: 'manual' })
    await interaction.editReply(
      `Scraper complete: ${result.armorCount} armor, ${result.skillCount} skills, ${result.decoCount} decorations`
    )
  } catch (err) {
    logger.error('[admin-scrape] Scraper failed:', { err })
    const message = err instanceof Error ? err.message : String(err)
    await interaction.editReply(`Scraper failed: ${message}`)
  }
}
