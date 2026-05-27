import { Client, MessageFlags, TextChannel } from 'discord.js'
import cron from 'node-cron'
import logger from '../../config/logger'
import { genshinCodeChannels } from '../../services/channel-registry'
import {
  GenshinCodeRow,
  getUnalertedGenshinCodes,
  markGenshinCodesAlerted,
} from '../../services/db-service'

const redeemUrl = 'https://genshin.hoyoverse.com/en/gift?code='
const cronSchedule = '0 * * * *' // every hour

export async function sendCodesToChannel(
  channel: TextChannel,
  codes: GenshinCodeRow[],
): Promise<void> {
  const content = codes.map((c) => `${redeemUrl}${c.code}`).join('\n')
  await channel.send({ content, flags: MessageFlags.SuppressEmbeds })
  logger.info(`Genshin code job: alerted ${codes.length} code(s) to ${channel.id}`)
}

export async function alertCodesToChannel(
  client: Client,
  channelId: string,
): Promise<void> {
  const codes = getUnalertedGenshinCodes()
  if (codes.length === 0) return

  const channel = client.guilds.cache
    .map((g) => g.channels.cache.get(channelId))
    .find((c) => c != null) as TextChannel | undefined

  if (!channel) {
    logger.warn(`Genshin code job: channel not found in cache: ${channelId}`)
    return
  }

  await sendCodesToChannel(channel, codes)
}

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

      const channels = genshinCodeChannels.getAll()
      if (channels.length === 0) {
        logger.debug('No registered Genshin code channels — skipping alert')
        return
      }

      for (const { channelId } of channels) {
        try {
          await alertCodesToChannel(client, channelId)
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
