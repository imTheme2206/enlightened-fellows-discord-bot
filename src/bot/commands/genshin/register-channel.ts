import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import logger from '../../../config/logger'
import {
  getGenshinCodeChannels,
  removeGenshinCodeChannel,
  saveGenshinCodeChannel,
} from '../../../services/db-service'
import { Command } from '../_types'

export const data = new SlashCommandBuilder()
  .setName('register-genshin-code-channel')
  .setDescription('Register or unregister this channel for Genshin Impact code alerts')
  .addStringOption((option) =>
    option
      .setName('action')
      .setDescription('Register or unregister this channel')
      .setRequired(true)
      .addChoices(
        { name: 'register', value: 'register' },
        { name: 'unregister', value: 'unregister' }
      )
  )

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  logger.debug('register-genshin-code-channel invoked')

  const action = interaction.options.getString('action', true)
  const channelId = interaction.channelId

  if (action === 'register') {
    saveGenshinCodeChannel(channelId)
    logger.info(`Registered Genshin code channel: ${channelId}`)
    await interaction.reply({
      content: 'This channel will now receive Genshin Impact code alerts.',
      ephemeral: true,
    })
  } else {
    removeGenshinCodeChannel(channelId)
    logger.info(`Unregistered Genshin code channel: ${channelId}`)
    await interaction.reply({
      content: 'This channel will no longer receive Genshin Impact code alerts.',
      ephemeral: true,
    })
  }

  const remaining = getGenshinCodeChannels()
  logger.debug(`Genshin code channels after update: ${remaining.length}`)
}

export default { data, execute } satisfies Command
