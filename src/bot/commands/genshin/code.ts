import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js'
import logger from '../../../config/logger'
import {
  getGenshinCodeChannels,
  saveGenshinCode,
} from '../../../services/db-service'
import { Command } from '../_types'

const redeemUrl = 'https://genshin.hoyoverse.com/en/gift?code='

enum CodeFields {
  CODE1 = 'c1',
  CODE2 = 'c2',
  CODE3 = 'c3',
}

export const data = new SlashCommandBuilder()
  .setName('gi-code')
  .setDescription('Return a redeem link for Genshin Impact, up to 3 codes')
  .addStringOption((option) =>
    option.setName(CodeFields.CODE1).setDescription('Enter the code').setRequired(true)
  )
  .addStringOption((option) =>
    option.setName(CodeFields.CODE2).setDescription('Enter the code').setRequired(false)
  )
  .addStringOption((option) =>
    option.setName(CodeFields.CODE3).setDescription('Enter the code').setRequired(false)
  )

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  logger.debug('gi-code invoked')

  const code1 = interaction.options.getString(CodeFields.CODE1, true)
  const code2 = interaction.options.getString(CodeFields.CODE2, false)
  const code3 = interaction.options.getString(CodeFields.CODE3, false)

  logger.debug('parsing code', { code1, code2, code3 })

  const codes = [code1, code2, code3].filter((c): c is string => !!c)
  const messages = codes.map((c) => `${redeemUrl}${c}`)
  const content = messages.join('\n')

  for (const code of codes) {
    saveGenshinCode(code, true)
  }

  logger.debug('returning message', { messages })

  await interaction.reply({
    content,
    flags: MessageFlags.SuppressEmbeds,
  })

  const channels = getGenshinCodeChannels()
  for (const { channelId } of channels) {
    try {
      const channel = interaction.guild?.channels.cache.get(channelId) as TextChannel | undefined
      if (!channel) {
        logger.warn(`gi-code: channel not found in cache: ${channelId}`)
        continue
      }
      await channel.send({ content, flags: MessageFlags.SuppressEmbeds })
    } catch (err) {
      logger.error(`gi-code: failed to send to channel ${channelId}`, { err })
    }
  }
}

export default { data, execute } satisfies Command
