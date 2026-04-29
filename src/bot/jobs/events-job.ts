import { Client, TextChannel } from 'discord.js'
import cron from 'node-cron'
import { config } from '../../config'
import logger from '../../config/logger'
import { commandRegistry } from '../registry'

const cronSchedule = '0 10 * * 3' // every Wednesday at 10:00 SGT

/**
 * Starts the weekly cron job that auto-posts limited MH Wilds events
 * to all channels listed in EVENTS_CHANNEL_ID.
 * @param client - The Discord client used to fetch channels
 */
export function startEventsJob(client: Client): void {
  try {
    logger.info(`Setting up cron job with schedule: ${cronSchedule}`)
    logger.info('Using timezone: Asia/Singapore (matching Fly.io region)')

    const task = cron.schedule(
      cronSchedule,
      async () => {
        const now = new Date().toLocaleString('en-US', {
          timeZone: 'Asia/Singapore',
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
          const channelIds = config.EVENTS_CHANNEL_ID.split(',')
          logger.info(
            `Sending to ${channelIds.length} channel(s): ${channelIds.join(', ')}`
          )

          for (const channelId of channelIds) {
            logger.info(`Fetching channel: ${channelId}`)
            const channel = (await client.channels.fetch(channelId)) as TextChannel

            if (!channel) {
              logger.error(`Channel not found: ${channelId}`)
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
            } as Parameters<NonNullable<ReturnType<typeof commandRegistry.get>>['execute']>[0]

            const eventsCommand = commandRegistry.get('events')
            if (!eventsCommand) {
              logger.error('events command not found in registry')
              continue
            }

            await eventsCommand.execute(fakeInteraction)
            logger.info(`Successfully executed events command in ${channel.name}`)
          }

          logger.info(`Scheduled job completed successfully at ${now}`)
        } catch (err) {
          logger.error('Failed scheduled job execution:', { err })
        }
      },
      {
        timezone: 'Asia/Singapore',
      }
    )

    if (task) {
      logger.info('Cron job scheduled successfully')
      logger.info(`Schedule: ${cronSchedule} (Asia/Singapore timezone)`)
      logger.info('Next execution: Every Wednesday at 10:00 AM Singapore time')
    } else {
      logger.error('Failed to schedule cron job')
    }
  } catch (cronError) {
    logger.error('Error setting up cron job:', { cronError })
  }
}
