import { ColorResolvable, EmbedBuilder } from 'discord.js'
import { EventQuestItem } from 'mh-wilds-event-scraper'

const toCapitalCase = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const generateEventMessage = (event: EventQuestItem) => {
  const header = `${event.difficulty}⭐`

  return `${event.questName} [${header}]`
}

export const craftEventEmbed = (event: EventQuestItem) => {
  const monsterFilename =
    event.targetMonster !== 'Unknown'
      ? event.targetMonster.split(' ').join('_') + '_Icon.png'
      : 'Unknown_Icon.png'

  const embedColor: Record<EventQuestItem['variant'], ColorResolvable> = {
    'arch-tempered': 'Orange',
    tempered: 'Purple',
    normal: 'Grey',
    frenzied: 'Grey',
  }

  const embed = new EmbedBuilder()
    .setColor(embedColor[event.variant])
    .setTitle(
      `${toCapitalCase(event.questType)} ${event.amount > 1 ? event.amount : 'The'} ${
        event.variant === 'normal' ? '' : `${toCapitalCase(event.variant)} `
      }${event.targetMonster}`
    )
    .setAuthor({
      name: generateEventMessage(event),
      iconURL: `attachment://${event.questType}.png`,
    })
    .setThumbnail(`attachment://${monsterFilename}`)
    .addFields(
      {
        name: '\u200B',
        value: event.description,
      },
      { name: '\u200B', value: '\u200B' },
      { name: 'Locales', value: event.locales, inline: true },
      {
        name: 'Required HR',
        value: `${event.requiredRank.toString()}+`,
        inline: true,
      }
    )

  return {
    embed: [embed],
  }
}
