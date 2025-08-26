import {
  ChatInputCommandInteraction,
  Client,
  CommandInteraction,
  TextChannel,
} from 'discord.js';
import { config } from './config';
import cron from 'node-cron';
import { commands } from './commands';
import { deployCommands } from './deploy-commands';

const client = new Client({
  intents: ['Guilds', 'GuildMessages', 'DirectMessages'],
});

const cronSchedule = '0 10 * * 3'; // every Wednesday at 10:00

client.once('ready', async () => {
  console.log('Discord bot is ready! 🤖');
  await deployCommands();

  cron.schedule(cronSchedule, async () => {
    console.log('⏰ Running /events limited job...');
    try {
      const channel = (await client.channels.fetch(
        config.EVENTS_CHANNEL_ID
      )) as TextChannel;
      if (!channel) return;

      const fakeInteraction = {
        options: {
          getString: (name: string) => {
            if (name === 'type') return 'limited';
            return null;
          },
        },
        reply: (opts: any) => channel.send(opts),
        editReply: (opts: any) => channel.send(opts),
      } as any;

      await commands['events'].execute(fakeInteraction);
    } catch (err) {
      console.error('Failed scheduled job:', err);
    }
  });
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) {
    return;
  }
  const { commandName } = interaction;

  if (commands[commandName as keyof typeof commands]) {
    commands[commandName as keyof typeof commands].execute(interaction as any);
  }
});

client.login(config.DISCORD_TOKEN);
