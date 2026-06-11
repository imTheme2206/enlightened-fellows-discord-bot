import { Client, TextChannel } from 'discord.js'
import cron from 'node-cron'
import { CRON_JOB } from '../../config'
import logger from '../../config/logger'
import { mhEventsChannels } from '../../modules/channels/service'
import { execute as eventsExecute } from '../commands/mhwilds/events'

export function startEventsJob(client: Client): void {
  try {
    logger.info('Using timezone: Asia/Bangkok')

    const task = cron.schedule(
      CRON_JOB.WEDNESDAY_10AM,
      async () => {
        const now = new Date().toLocaleString('en-US', {
          timeZone: 'Asia/Bangkok',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        logger.info(`[${now}] Running scheduled /events limited job...`)

        try {
          const channelIds = mhEventsChannels.getAll().map((c) => c.channelId)

          if (channelIds.length === 0) {
            logger.warn('No registered MH events channels — skipping job')
            return
          }

          logger.info(`Sending to ${channelIds.length} channel(s): ${channelIds.join(', ')}`)

          for (const channelId of channelIds) {
            try {
              const channel = client.guilds.cache.map((g) => g.channels.cache.get(channelId)).find((c) => c != null) as
                | TextChannel
                | undefined

              if (!channel) {
                logger.error(`Channel not found in cache: ${channelId}`)
                continue
              }

              logger.info(`Channel found: ${channel.name} (${channel.id})`)

              const fakeInteraction = {
                options: {
                  getString: (name: string) => {
                    if (name === 'type') return 'limited'
                    return null
                  },
                },
                reply: (opts: unknown) => {
                  logger.info(`Sending message to ${channel.name}`)
                  return channel.send(opts as Parameters<typeof channel.send>[0])
                },
                editReply: (opts: unknown) => {
                  logger.info(`Editing message in ${channel.name}`)
                  return channel.send(opts as Parameters<typeof channel.send>[0])
                },
              } as Parameters<typeof eventsExecute>[0]

              await eventsExecute(fakeInteraction)
              logger.info(`Successfully executed events command in ${channel.name}`)
            } catch (err) {
              logger.error(`Failed to send events to channel ${channelId}:`, { err })
            }
          }

          logger.info(`Scheduled job completed successfully at ${now}`)
        } catch (err) {
          logger.error('Failed scheduled job execution:', { err })
        }
      },
      {
        timezone: 'Asia/Bangkok',
      }
    )

    if (task) {
      logger.info('Cron job scheduled successfully')
      logger.info('Next execution: Every Wednesday at 10:00 AM Thailand time')
    } else {
      logger.error('Failed to schedule cron job')
    }
  } catch (cronError) {
    logger.error('Error setting up cron job:', { cronError })
  }
}
