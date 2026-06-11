import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { GenshinCodeService } from '../../../modules/genshin-codes/service'
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
  .addStringOption((option) => option.setName(CodeFields.CODE1).setDescription('Enter the code').setRequired(true))
  .addStringOption((option) => option.setName(CodeFields.CODE2).setDescription('Enter the code').setRequired(false))
  .addStringOption((option) => option.setName(CodeFields.CODE3).setDescription('Enter the code').setRequired(false))

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const code1 = interaction.options.getString(CodeFields.CODE1, true)
  const code2 = interaction.options.getString(CodeFields.CODE2, false)
  const code3 = interaction.options.getString(CodeFields.CODE3, false)

  const codes = [code1, code2, code3].filter((c): c is string => !!c)

  // All business logic is in the service — command is just parse + respond
  await GenshinCodeService.saveAndNotify(codes, interaction.client)

  const content = codes.map((c) => `${redeemUrl}${c}`).join('\n')
  await interaction.reply({ content })
}

export default { data, execute } satisfies Command
