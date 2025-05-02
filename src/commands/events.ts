import { CommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
  EventQuestItem,
  parseMHWildsEvents,
  MHWIldsEventResponse,
} from 'mh-wilds-event-scraper';
import { craftEventMessage } from '../utils/event-message';

export const data = new SlashCommandBuilder()
  .setName('events')
  .setDescription('Return a list of event scheduled');

export async function execute(interaction: CommandInteraction) {
  const MHWildsEvents: MHWIldsEventResponse[] = await parseMHWildsEvents(
    'https://info.monsterhunter.com/wilds/event-quest/en-us/schedule?utc=7'
  );

  if (MHWildsEvents.length === 0) {
    return interaction.reply('No events found.');
  }

  const messages: string = MHWildsEvents.map(craftEventMessage).join('\n');

  return interaction.reply(messages);
}
