import { CommandInteraction, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('meta')
  .setDescription('Return Meta Build Guide Reddit Link');

export async function execute(interaction: CommandInteraction) {
  return interaction.reply(
    'Here is the link to the Meta Build Guide: https://www.reddit.com/r/MonsterHunterMeta/comments/1jkaxo7/mhwilds_endgame_meta_builds_compilation/'
  );
}
