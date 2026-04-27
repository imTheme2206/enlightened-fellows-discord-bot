import { Command } from './commands/_types'

/**
 * Module-level command registry, populated during the ready event.
 * Shared between eventHandler and interactionCreate event.
 */
export const commandRegistry = new Map<string, Command>()
