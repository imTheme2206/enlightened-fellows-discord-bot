import { Client } from 'discord.js'

/** Singleton Discord client shared across the application */
export const client = new Client({
  intents: ['Guilds', 'GuildMessages', 'DirectMessages'],
})
