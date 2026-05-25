import { Client, MessageFlags, TextChannel } from 'discord.js'
import cron from 'node-cron'
import logger from '../../config/logger'
import {
  getGenshinCodeChannels,
  getUnalertedGenshinCodes,
  markGenshinCodesAlerted,
} from '../../services/db-service'

const redeemUrl = 'https://genshin.hoyoverse.com/en/gift?code='
const cronSchedule = '0 * * * *' // every hour

export function startGenshinCodeJob(client: Client): void {
  logger.info(`Setting up Genshin code alert job with schedule: ${cronSchedule}`)

  cron.schedule(cronSchedule, async () => {
    logger.info('Running Genshin code alert job...')

    try {
      const codes = getUnalertedGenshinCodes()
      if (codes.length === 0) {
        logger.debug('No unalerted Genshin codes found')
        return
      }

      const channels = getGenshinCodeChannels()
      if (channels.length === 0) {
        logger.debug('No registered Genshin code channels — skipping alert')
        return
      }

      const content = codes.map((c) => `${redeemUrl}${c.code}`).join('\n')

      for (const { channelId } of channels) {
        try {
          const channel = (await client.channels.fetch(channelId)) as TextChannel
          if (!channel) {
            logger.warn(`Genshin code job: channel not found: ${channelId}`)
            continue
          }
          await channel.send({ content, flags: MessageFlags.SuppressEmbeds })
          logger.info(`Genshin code job: alerted ${codes.length} code(s) to ${channelId}`)
        } catch (err) {
          logger.error(`Genshin code job: failed to send to channel ${channelId}`, { err })
        }
      }

      markGenshinCodesAlerted(codes.map((c) => c.id))
      logger.info(`Genshin code job: marked ${codes.length} code(s) as alerted`)
    } catch (err) {
      logger.error('Genshin code job: unexpected error', { err })
    }
  })

  logger.info('Genshin code alert job scheduled (every hour)')
}
