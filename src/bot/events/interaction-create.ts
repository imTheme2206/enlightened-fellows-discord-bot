import { Interaction } from "discord.js";
import logger from "../../config/logger";
import { commandRegistry } from "../registry";

/**
 * Routes Discord interactions to the appropriate command handler.
 */
export const name = "interactionCreate";
export const once = false;

export async function execute(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    const command = commandRegistry.get(interaction.commandName);
    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }
    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}:`, {
        error,
      });
    }
    return;
  }

  if (interaction.isButton()) {
    const [commandName] = interaction.customId.split(":");
    const command = commandRegistry.get(commandName);
    const handler = command?.handleComponent ?? command?.handleButton;
    if (handler) {
      try {
        await handler.call(command, interaction);
      } catch (error) {
        logger.error(`Error handling button for command ${commandName}:`, {
          error,
        });
      }
    }
    return;
  }

  if (interaction.isStringSelectMenu()) {
    const [commandName] = interaction.customId.split(":");
    const command = commandRegistry.get(commandName);
    if (command?.handleComponent) {
      try {
        await command.handleComponent(interaction);
      } catch (error) {
        logger.error(`Error handling select menu for command ${commandName}:`, {
          error,
        });
      }
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    const [commandName] = interaction.customId.split(":");
    const command = commandRegistry.get(commandName);
    if (command?.handleModal) {
      try {
        await command.handleModal(interaction);
      } catch (error) {
        logger.error(`Error handling modal for command ${commandName}:`, {
          error,
        });
      }
    }
    return;
  }

  if (interaction.isAutocomplete()) {
    const command = commandRegistry.get(interaction.commandName);
    if (command?.handleAutocomplete) {
      try {
        await command.handleAutocomplete(interaction);
      } catch (error) {
        logger.error(
          `Error handling autocomplete for command ${interaction.commandName}:`,
          { error },
        );
      }
    }
    return;
  }
}
