import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder, TextChannel } from 'discord.js'
import logger from '../../../infra/logger'
import { genshinCodeChannels } from '../../../domains/channels/service'
import { GenshinCodeService } from '../../../domains/genshin-codes/service'
import { isDefined } from '../../../shared/utils/is-defined'
import { Command } from '../_types'

enum CodeFields {
  CODE = 'code',
}

export const data = new SlashCommandBuilder()
  .setName('gi-code')
  .setDescription('Return a redeem link for Genshin Impact')
  .addStringOption((option) => option.setName(CodeFields.CODE).setDescription('Enter the code').setRequired(true))

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const code = interaction.options.getString(CodeFields.CODE, true)

  await GenshinCodeService.save(code, true)

  const content = GenshinCodeService.buildRedeemUrl(code)

  const channels = await genshinCodeChannels.getAll()
  for (const { channelId } of channels) {
    const channel = interaction.client.guilds.cache.map((g) => g.channels.cache.get(channelId)).find(isDefined) as TextChannel | undefined
    if (!channel) {
      logger.warn(`gi-code: channel ${channelId} not in cache`)
      continue
    }
    try {
      await channel.send({ content, flags: MessageFlags.SuppressEmbeds })
    } catch (err) {
      logger.error(`gi-code: failed to send to ${channelId}`, { err })
    }
  }

  await interaction.reply({ content })
}

export default { data, execute } satisfies Command
