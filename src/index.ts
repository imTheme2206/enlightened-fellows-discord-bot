import { Client, GatewayIntentBits } from "discord.js";
// import { client } from "./bot/client";
import { loadEvents } from "./bot/handlers/event-handler";
import { config } from "./config";
import logger from "./config/logger";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildMessages,
  ],
});

// Handle graceful shutdown
function handleShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  client.destroy();
  process.exit(0);
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

async function main(): Promise<void> {
  // config is validated on import; fatal exit if env vars missing
  logger.info("Starting bot...");
  logger.info(`Web server stub on port ${config.WEB_PORT}`);

  // await initSearchIndex()
  await loadEvents(client);

  await client.login(config.DISCORD_TOKEN);
}

main().catch((err) => {
  logger.error("Fatal error during startup:", { err });
  process.exit(1);
});
