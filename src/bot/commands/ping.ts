import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { Command } from './_types'

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with Pong!')

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply('Pong!')
}

export default { data, execute } satisfies Command
