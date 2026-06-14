import { Client, MessageFlags, TextChannel } from 'discord.js'
import cron from 'node-cron'
import { CRON_JOB } from '../../config'
import logger from '../../config/logger'
import { genshinCodeChannels } from '../../modules/channels/service'
import { GenshinCodeService } from '../../modules/genshin-codes/service'
import type { GenshinCode } from '../../db/schema'

const redeemUrl = 'https://genshin.hoyoverse.com/en/gift?code='

export async function sendCodesToChannel(channel: TextChannel, codes: GenshinCode[]): Promise<void> {
  const content = codes.map((c) => `${redeemUrl}${c.code}`).join('\n')
  await channel.send({ content, flags: MessageFlags.SuppressEmbeds })
  logger.info(`Genshin code job: alerted ${codes.length} code(s) to ${channel.id}`)
}

export async function alertCodesToChannel(client: Client, channelId: string): Promise<void> {
  const codes = await GenshinCodeService.getUnalerted()
  if (codes.length === 0) return

  const channel = client.guilds.cache.map((g) => g.channels.cache.get(channelId)).find((c) => c != null) as TextChannel | undefined

  if (!channel) {
    logger.warn(`Genshin code job: channel not found in cache: ${channelId}`)
    return
  }

  await sendCodesToChannel(channel, codes)
}

export function startGenshinCodeJob(client: Client): void {
  cron.schedule(CRON_JOB.EVERY_HOUR, async () => {
    logger.info('Running Genshin code alert job...')

    try {
      const codes = await GenshinCodeService.getUnalerted()
      if (codes.length === 0) {
        logger.debug('No unalerted Genshin codes found')
        return
      }

      const channels = await genshinCodeChannels.getAll()
      if (channels.length === 0) {
        logger.debug('No registered Genshin code channels — skipping alert')
        return
      }

      for (const { channelId } of channels) {
        const channel = client.guilds.cache.map((g) => g.channels.cache.get(channelId)).find((c) => c != null) as TextChannel | undefined
        if (!channel) {
          logger.warn(`Genshin code job: channel not found in cache: ${channelId}`)
          continue
        }
        await sendCodesToChannel(channel, codes)
      }

      await GenshinCodeService.markAlerted(codes.map((c) => c.id))
      logger.info(`Genshin code job: marked ${codes.length} code(s) as alerted`)
    } catch (err) {
      logger.error('Genshin code job: unexpected error', { err })
    }
  })

  logger.info('Genshin code alert job scheduled (every hour)')
}
