import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { Command } from './_types'

const apexMonsters = [
  'Arkveld',
  'Rey Dau',
  'Nu Udra',
  'Uth Duna',
  'Jin Dahaad',
  'Gore Magala',
  'Mizutsune',
  'Zho Shia',
]

export const data = new SlashCommandBuilder()
  .setName('hzv')
  .setDescription('Return Meta Build Guide Reddit Link')
  .addStringOption((option) =>
    option
      .setName('monster')
      .setDescription('Select monster')
      .addChoices(
        ...apexMonsters.map((monster) => ({
          name: monster,
          value: monster,
        }))
      )
      .setRequired(true)
  )

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const monster = interaction.options.getString('monster', true)

  const HZVImagePath = `./assets/hitzone-value/${monster.split(' ').join('_')}_HZV.png`

  await interaction.reply({
    files: [HZVImagePath],
  })
}

export default { data, execute } satisfies Command
