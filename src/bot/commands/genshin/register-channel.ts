import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel } from 'discord.js'
import logger from '../../../infra/logger'
import { genshinCodeChannels } from '../../../domains/channels/service'
import { GenshinCodeService } from '../../../domains/genshin-codes/service'
import { sendCodesToChannel } from '../../jobs/genshin-code-job'
import { Command } from '../_types'

export const data = new SlashCommandBuilder()
  .setName('register-genshin-code-channel')
  .setDescription('Register or unregister this channel for Genshin Impact code alerts')
  .addStringOption((option) =>
    option
      .setName('action')
      .setDescription('Register or unregister this channel')
      .setRequired(true)
      .addChoices({ name: 'register', value: 'register' }, { name: 'unregister', value: 'unregister' })
  )

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  logger.debug('register-genshin-code-channel invoked')

  const action = interaction.options.getString('action', true)
  const channelId = interaction.channelId

  if (action === 'register') {
    if (await genshinCodeChannels.get(channelId)) {
      await interaction.reply({
        content: 'This channel is already registered for Genshin Impact code alerts.',
        flags: ['Ephemeral'],
      })
      return
    }

    await genshinCodeChannels.register(channelId)
    logger.info(`Registered Genshin code channel: ${channelId}`)

    await interaction.reply({
      content: 'This channel will now receive Genshin Impact code alerts.',
      flags: ['Ephemeral'],
    })

    const codes = await GenshinCodeService.getUnalerted()
    if (codes.length > 0) {
      const channel = interaction.guild?.channels.cache.get(channelId) as TextChannel | undefined
      if (channel) {
        try {
          await sendCodesToChannel(channel, codes)
          await GenshinCodeService.markAlerted(codes.map((c) => c.id))
        } catch (err) {
          logger.error(`register-genshin-code-channel: immediate alert failed for ${channelId}`, { err })
        }
      } else {
        logger.warn(`register-genshin-code-channel: channel not found in cache: ${channelId}`)
      }
    }
  } else {
    if (!(await genshinCodeChannels.get(channelId))) {
      await interaction.reply({
        content: 'This channel is not registered for Genshin Impact code alerts.',
        flags: ['Ephemeral'],
      })
      return
    }

    await genshinCodeChannels.unregister(channelId)
    logger.info(`Unregistered Genshin code channel: ${channelId}`)

    await interaction.reply({
      content: 'This channel will no longer receive Genshin Impact code alerts.',
      flags: ['Ephemeral'],
    })
  }
}

export default { data, execute } satisfies Command
