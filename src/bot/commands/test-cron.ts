import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel } from 'discord.js'
import { config } from '../../config'
import logger from '../../config/logger'
import { execute as executeEvents } from './events'
import { Command } from './_types'

export const data = new SlashCommandBuilder()
  .setName('test-cron')
  .setDescription('Manually trigger the scheduled events job for testing')

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  try {
    logger.info('Manual cron test triggered by user')
    const channelIds = config.EVENTS_CHANNEL_ID.split(',')

    for (const channelId of channelIds) {
      const channel = (await interaction.client.channels.fetch(channelId)) as TextChannel
      if (!channel) {
        logger.error(`Channel not found: ${channelId}`)
        continue
      }

      const fakeInteraction = {
        options: {
          getString: (name: string) => {
            if (name === 'type') return 'limited'
            return null
          },
        },
        reply: (opts: unknown) =>
          channel.send(opts as Parameters<typeof channel.send>[0]),
        editReply: (opts: unknown) =>
          channel.send(opts as Parameters<typeof channel.send>[0]),
      } as Parameters<typeof executeEvents>[0]

      await executeEvents(fakeInteraction)
    }

    await interaction.editReply(
      'Test cron job executed successfully! Check the events channel.'
    )
  } catch (error) {
    logger.error('Test cron failed:', { error })
    await interaction.editReply('Test cron job failed. Check console logs for details.')
  }
}

export default { data, execute } satisfies Command
