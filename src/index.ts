import {
  ChatInputCommandInteraction,
  Client,
  CommandInteraction,
  TextChannel,
} from "discord.js";
import { config } from "./config";
import cron from "node-cron";
import { commands } from "./commands";
import { deployCommands } from "./deploy-commands";

// Handle graceful shutdown
function handleShutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  client.destroy();
  process.exit(0);
}

// Register shutdown handlers
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

const client = new Client({
  intents: ["Guilds", "GuildMessages", "DirectMessages"],
});

const cronSchedule = "0 10 * * 3"; // every Wednesday at 10:00 (in the timezone specified by TZ env var)

client.on("ready", async () => {
  console.log("Discord bot is ready! 🤖");
  await deployCommands();

  cron.schedule(
    cronSchedule,
    async () => {
      console.log("⏰ Running /events limited job...");
      try {
        const channelIds = config.EVENTS_CHANNEL_ID.split(",");

        for (const channelId of channelIds) {
          const channel = (await client.channels.fetch(
            channelId,
          )) as TextChannel;
          if (!channel) return;

          const fakeInteraction = {
            options: {
              getString: (name: string) => {
                if (name === "type") return "limited";
                return null;
              },
            },
            reply: (opts: any) => channel.send(opts),
            editReply: (opts: any) => channel.send(opts),
          } as any;

          await commands["events"].execute(fakeInteraction);
        }
      } catch (err) {
        console.error("Failed scheduled job:", err);
      }
    },
    { timezone: "Asia/Bangkok" },
  );
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) {
    return;
  }
  const { commandName } = interaction;

  if (commands[commandName as keyof typeof commands]) {
    commands[commandName as keyof typeof commands].execute(interaction as any);
  }
});

client.login(config.DISCORD_TOKEN);
