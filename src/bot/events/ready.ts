import { Client } from "discord.js";
import logger from "../../config/logger";
import { deployCommands, loadCommands } from "../handlers/command-handler";
import { startEventsJob } from "../jobs/events-job";
import { seedOnBoot } from "../jobs/db-init";
import { commandRegistry } from "../registry";

export const name = "ready";
export const once = true;

/**
 * Fired once when the Discord client is ready.
 * Deploys slash commands and starts scheduled jobs.
 */
export async function execute(client: Client): Promise<void> {
  logger.info(`Bot ready as ${client.user?.tag}`);

  const commands = await loadCommands();

  // Populate shared registry
  for (const [key, value] of commands) {
    commandRegistry.set(key, value);
  }

  await deployCommands(commands);
  startEventsJob(client);
  seedOnBoot().catch((err) => {
    logger.error("[dbInit] Boot seed failed:", { err });
  });
}
