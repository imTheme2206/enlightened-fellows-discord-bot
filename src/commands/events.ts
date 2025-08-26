import {
  ChatInputCommandInteraction,
  CommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import {
  EventQuestItem,
  parseMHWildsEvents,
  MHWIldsEventResponse,
} from 'mh-wilds-event-scraper';
import { craftEventMessage } from '../utils/event-message';

export const data = new SlashCommandBuilder()
  .setName('events')
  .setDescription('Return a list of event scheduled')
  .addStringOption((option) =>
    option
      .setName('duration')
      .setDescription('Select the locale')
      .addChoices({ name: 'Now', value: 'now' }, { name: 'All', value: 'all' })
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const duration = interaction.options.getString('duration', true);

  try {
    const MHWildsEvents: MHWIldsEventResponse = await parseMHWildsEvents(
      'https://info.monsterhunter.com/wilds/event-quest/en-us/schedule?utc=7'
    );

    if (
      MHWildsEvents.limitedEventQuests.length === 0 &&
      MHWildsEvents.permanentQuests.length === 0
    ) {
      return interaction.editReply('No events found.');
    }

    const messages: string = MHWildsEvents.limitedEventQuests
      .filter((event) => {
        if (duration === 'now') {
          return (
            new Date(event.startDate) <= new Date() &&
            new Date(event.endDate) >= new Date()
          );
        }
        return true;
      })
      .map((event) => craftEventMessage(event, MHWildsEvents.permanentQuests))
      .join('\n');

    return interaction.editReply(messages);
  } catch (error) {
    console.error(error);
    return interaction.editReply('Failed to fetch events.');
  }
}
