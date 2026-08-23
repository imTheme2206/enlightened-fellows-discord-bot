import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import logger from '../../../infra/logger'
import { GenshinCodeService } from '../../../domains/genshin-codes/service'
import { alertUnalertedCodes } from '../../jobs/genshin-code-job'
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

  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  try {
    await GenshinCodeService.save(code, false)
    await alertUnalertedCodes(interaction.client)

    await interaction.editReply({ content: `Code \`${code}\` queued for broadcast.` })
  } catch (err) {
    logger.error(`gi-code: failed to queue code ${code}`, { err })
    await interaction.editReply({ content: `Failed to queue code \`${code}\` for broadcast.` })
  }
}

export default { data, execute } satisfies Command
