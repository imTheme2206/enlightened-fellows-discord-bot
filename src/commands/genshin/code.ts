import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';

const redeemUrl = 'https://genshin.hoyoverse.com/en/gift?code=';

enum CodeFields {
  CODE1 = 'c1',
  CODE2 = 'c2',
  CODE3 = 'c3',
}

export const data = new SlashCommandBuilder()
  .setName('gi-code')
  .setDescription('Return a redeem link for Genshin Impact, up to 3 codes')
  .addStringOption((option) =>
    option
      .setName(CodeFields.CODE1)
      .setDescription('Enter the code')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName(CodeFields.CODE2)
      .setDescription('Enter the code')
      .setRequired(false)
  )
  .addStringOption((option) =>
    option
      .setName(CodeFields.CODE3)
      .setDescription('Enter the code')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  console.log('gi-code invoked');

  const code1 = interaction.options.getString(CodeFields.CODE1, true);
  const code2 = interaction.options.getString(CodeFields.CODE2, false);
  const code3 = interaction.options.getString(CodeFields.CODE3, false);

  console.log('parsing code with', code1, code2, code3);

  if (!code1) {
    return interaction.editReply('No code provided.');
  }

  const messages: string[] = [];

  if (code1) {
    messages.push(`${redeemUrl}${code1}`);
  }

  if (code2) {
    messages.push(`${redeemUrl}${code2}`);
  }

  if (code3) {
    messages.push(`${redeemUrl}${code3}`);
  }

  console.log('returning message', messages);

  return interaction.reply({
    content: messages.join('\n'),
    flags: MessageFlags.SuppressEmbeds,
  });
}
