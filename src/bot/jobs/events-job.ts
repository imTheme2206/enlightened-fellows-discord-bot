import { Client, TextChannel } from 'discord.js'
import cron from 'node-cron'
import { CRON_JOB } from '../../infra/config'
import logger from '../../infra/logger'
import { mhEventsChannels } from '../../domains/channels/service'
import { buildPaginationComponents } from '../utils/embed-pagination'
import { EVENTS_PAGINATION_BUTTON_IDS, loadAndPrepareEvents } from '../utils/mhwilds-event-delivery'

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
          const channelIds = (await mhEventsChannels.getAll()).map((c) => c.channelId)

          if (channelIds.length === 0) {
            logger.warn('No registered MH events channels — skipping job')
            return
          }

          logger.info(`Sending to ${channelIds.length} channel(s): ${channelIds.join(', ')}`)

          // Retrieve/filter/prepare once and reuse it for every channel — the
          // events-job broadcasts the same limited-events snapshot everywhere
          // rather than re-fetching per channel.
          const { feedEmpty, paginated } = await loadAndPrepareEvents('limited')
          if (feedEmpty || paginated.pages.length === 0) {
            logger.info('No limited events to broadcast — skipping job')
            return
          }

          const totalPages = paginated.pages.length
          const components = buildPaginationComponents(0, totalPages, EVENTS_PAGINATION_BUTTON_IDS)

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
              await channel.send({
                content: 'Here are the ongoing events',
                embeds: paginated.pages[0].map((entry) => entry.embed),
                files: paginated.attachmentsByPage[0],
                components,
              })
              logger.info(`Successfully sent events to ${channel.name}`)
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
