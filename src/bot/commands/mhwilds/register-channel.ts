import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import logger from '../../../infra/logger'
import { mhEventsChannels } from '../../../domains/channels/service'
import { Command } from '../_types'

export const data = new SlashCommandBuilder()
  .setName('register-mh-events-channel')
  .setDescription('Register or unregister this channel for Monster Hunter Wilds event alerts')
  .addStringOption((option) =>
    option
      .setName('action')
      .setDescription('Register or unregister this channel')
      .setRequired(true)
      .addChoices({ name: 'register', value: 'register' }, { name: 'unregister', value: 'unregister' })
  )

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  logger.debug('register-mh-events-channel invoked')

  const action = interaction.options.getString('action', true)
  const channelId = interaction.channelId

  if (action === 'register') {
    if (await mhEventsChannels.get(channelId)) {
      await interaction.reply({
        content: 'This channel is already registered for Monster Hunter Wilds event alerts.',
        flags: ['Ephemeral'],
      })
      return
    }

    await mhEventsChannels.register(channelId)
    logger.info(`Registered MH events channel: ${channelId}`)

    await interaction.reply({
      content: 'This channel will now receive Monster Hunter Wilds event alerts.',
      flags: ['Ephemeral'],
    })
  } else {
    if (!(await mhEventsChannels.get(channelId))) {
      await interaction.reply({
        content: 'This channel is not registered for Monster Hunter Wilds event alerts.',
        flags: ['Ephemeral'],
      })
      return
    }

    await mhEventsChannels.unregister(channelId)
    logger.info(`Unregistered MH events channel: ${channelId}`)

    await interaction.reply({
      content: 'This channel will no longer receive Monster Hunter Wilds event alerts.',
      flags: ['Ephemeral'],
    })
  }
}

export default { data, execute } satisfies Command
