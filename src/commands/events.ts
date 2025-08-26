import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  CommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import {
  EventQuestItem,
  parseMHWildsEvents,
  MHWIldsEventResponse,
} from 'mh-wilds-event-scraper';
import { craftEventEmbed } from '../utils/wilds-event-embed';
import fs from 'fs';
import path from 'path';

// Explicit icon reference type to ensure consistent typing across maps and arrays
type IconRef = { file: AttachmentBuilder; path: string };

const monsterIcons: Record<string, IconRef> = {};
const questTypeIcons: Record<string, IconRef> = {};

function preloadIcons() {
  console.log('Preloading icons...');
  const monsterDir = 'assets/icons/large';
  fs.readdirSync(monsterDir).forEach((filename) => {
    const file = new AttachmentBuilder(path.join(monsterDir, filename));
    monsterIcons[filename] = { file, path: `attachment://${filename}` };
  });

  const questDir = 'assets/icons/quest';
  fs.readdirSync(questDir).forEach((filename) => {
    const file = new AttachmentBuilder(path.join(questDir, filename));
    questTypeIcons[filename] = { file, path: `attachment://${filename}` };
  });
}

preloadIcons();

export const data = new SlashCommandBuilder()
  .setName('events')
  .setDescription('Return a list of event scheduled')
  .addStringOption((option) =>
    option
      .setName('type')
      .setDescription('Select mode')
      .addChoices(
        { name: 'Permanent', value: 'permanent' },
        { name: 'Limited', value: 'limited' }
      )
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const MHWildsEvents: MHWIldsEventResponse = await parseMHWildsEvents(
      'https://info.monsterhunter.com/wilds/event-quest/en-us/schedule?utc=7'
    );
    const eventType = interaction.options.getString('type', true);

    if (
      MHWildsEvents.limitedEventQuests.length === 0 &&
      MHWildsEvents.permanentQuests.length === 0
    ) {
      return interaction.editReply('No events found.');
    }

    const selectedEvents =
      eventType === 'permanent'
        ? MHWildsEvents.permanentQuests
        : MHWildsEvents.limitedEventQuests[0].eventQuests;

    const appearedMonsterFile: IconRef[] = [];
    const appearedQuestType: IconRef[] = [];

    const limitedEvents = selectedEvents.map((event) => {
      const monsterFileName =
        event.targetMonster.split(' ').join('_') + '_Icon.png';
      const questTypeFileName = event.questType + '.png';

      if (!appearedMonsterFile.includes(monsterIcons[monsterFileName])) {
        appearedMonsterFile.push(monsterIcons[monsterFileName]);
      }

      if (!appearedQuestType.includes(questTypeIcons[questTypeFileName])) {
        appearedQuestType.push(questTypeIcons[questTypeFileName]);
      }
      return craftEventEmbed(event);
    });

    const startDate = new Date(
      MHWildsEvents.limitedEventQuests[0].startDate
    ).toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
    });

    const endDate = new Date(
      MHWildsEvents.limitedEventQuests[0].endDate
    ).toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
    });

    const embeds = limitedEvents.flatMap((event) => event.embed);

    return interaction.reply({
      content:
        eventType === 'permanent'
          ? 'Permanent Events'
          : `Here are the events during : ${startDate} - ${endDate}`,
      embeds,
      files: [
        ...appearedMonsterFile.map((icon) => icon.file),
        ...appearedQuestType.map((icon) => icon.file),
      ],
    });
  } catch (error) {
    console.error(error);
    return interaction.editReply('Failed to fetch events.');
  }
}
