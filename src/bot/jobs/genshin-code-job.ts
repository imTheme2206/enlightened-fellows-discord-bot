import { Client, EmbedBuilder, TextChannel } from "discord.js"
import { genshinCodeChannels } from "../../domains/channels/service"
import { GenshinCodeService } from "../../domains/genshin-codes/service"
import type { GenshinCode } from "../../infra/db/schema"
import logger from "../../infra/logger"

const GENSHIN_EMBED_COLOR = 0x4e9de0

function buildCodesEmbed(codes: GenshinCode[]): EmbedBuilder {
  const description = codes
    .map((c) => {
      const link = GenshinCodeService.buildRedeemUrl(c.code)
      return c.rewards ? `**${c.code}** — [Redeem](${link})\n${c.rewards}` : `**${c.code}** — [Redeem](${link})`
    })
    .join("\n\n")

  return new EmbedBuilder()
    .setTitle("New Genshin Impact Codes")
    .setDescription(description)
    .setColor(GENSHIN_EMBED_COLOR)
    .setTimestamp()
}

export async function sendCodesToChannel(
  channel: TextChannel,
  codes: GenshinCode[],
): Promise<void> {
  const embed = buildCodesEmbed(codes)
  await channel.send({ embeds: [embed] })
  logger.info(
    `Genshin code job: alerted ${codes.length} code(s) to ${channel.id}`,
  )
}

function resolveChannel(
  client: Client,
  channelId: string,
): TextChannel | undefined {
  return client.guilds.cache
    .map((g) => g.channels.cache.get(channelId))
    .find((c) => c != null) as TextChannel | undefined
}

export async function alertUnalertedCodes(client: Client): Promise<void> {
  const codes = await GenshinCodeService.getUnalerted()
  if (codes.length === 0) {
    logger.debug("No unalerted Genshin codes found")
    return
  }

  const channels = await genshinCodeChannels.getAll()
  if (channels.length === 0) {
    logger.debug("No registered Genshin code channels — skipping alert")
    return
  }

  let delivered = false
  for (const { channelId } of channels) {
    const channel = resolveChannel(client, channelId)
    if (!channel) {
      logger.warn(`Genshin code job: channel not found in cache: ${channelId}`)
      continue
    }
    try {
      await sendCodesToChannel(channel, codes)
      delivered = true
    } catch (err) {
      logger.error(`Genshin code job: failed to send to channel ${channelId}`, {
        err,
      })
    }
  }

  // Only mark alerted if the message actually reached a channel — otherwise leave
  // the codes unalerted so the next run retries instead of silently dropping them.
  if (!delivered) {
    logger.warn(
      "Genshin code job: no channel received the alert — leaving codes unalerted for retry",
    )
    return
  }

  await GenshinCodeService.markAlerted(codes.map((c) => c.id))
  logger.info(`Genshin code job: marked ${codes.length} code(s) as alerted`)
}
