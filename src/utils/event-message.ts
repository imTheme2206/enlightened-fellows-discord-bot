import { EventQuestItem, MHWIldsEventResponse } from 'mh-wilds-event-scraper';

const generateEventMessage = (event: EventQuestItem) => {
  const header = Array(event.difficulty).fill('⭐').join('');

  const locales = `**${event.locales}**`;

  const questTypeSymbol = {
    slay: '⚔️',
    hunt: '🗡️',
    capture: '🪤',
  };

  const questType = questTypeSymbol[event.questType] || '❓';

  const variant = event.variant !== 'normal' ? event.variant : '';

  const combinedMessage = `- [${header}] ${locales}  ${questType} ${
    event.questType
  } : ${event.amount > 1 ? event.amount : ''} ${variant} ${
    event.targetMonster
  }\n`;

  return combinedMessage;
};

export const craftEventMessage = (event: MHWIldsEventResponse) => {
  const craftedMessagesArray: string[] = [];

  const startDate = new Date(event.startDate).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
  });

  const endDate = new Date(event.endDate).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
  });

  const craftedMessage = `${startDate} - ${endDate}\n`;
  craftedMessagesArray.push(craftedMessage);

  craftedMessagesArray.push('\n**Event Quests**\n');

  event.eventQuests.map((eventQuest) => {
    craftedMessagesArray.push(generateEventMessage(eventQuest));
  });

  if (event.freeChallengeQuests.length === 0) {
    return craftedMessagesArray.join('');
  }

  craftedMessagesArray.push('\n**Free Challenge Quests**\n');

  event.freeChallengeQuests.map((eventQuest) => {
    craftedMessagesArray.push(generateEventMessage(eventQuest));
  });

  const finalMessage = craftedMessagesArray.join('');
  return finalMessage;
};
