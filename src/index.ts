import {
  ChatInputCommandInteraction,
  Client,
  CommandInteraction,
} from 'discord.js';
import { config } from './config';
import { commands } from './commands';
import { deployCommands } from './deploy-commands';

const client = new Client({
  intents: ['Guilds', 'GuildMessages', 'DirectMessages'],
});

client.once('ready', async () => {
  console.log('Discord bot is ready! 🤖');
  await deployCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) {
    return;
  }
  const { commandName } = interaction;
  console.log(commands);
  if (commands[commandName as keyof typeof commands]) {
    commands[commandName as keyof typeof commands].execute(interaction as any);
  }
});

client.login(config.DISCORD_TOKEN);
