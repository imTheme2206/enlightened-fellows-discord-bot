import dayjs from 'dayjs'
import { ColorResolvable, EmbedBuilder } from 'discord.js'
import { EventQuestItem } from '@imthmn/mh-wilds-event-scraper'
import { resolveMonsterIcon } from './resolve-monster-icon'

const toCapitalCase = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const generateEventMessage = (event: EventQuestItem) => {
  const header = `${event.difficulty}⭐`

  return `${event.questName} [${header}]`
}

export const craftEventEmbed = (event: EventQuestItem) => {
  const monsterFilename = resolveMonsterIcon(event.targetMonster)

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

  if (!event.isPermanent) {
    const end = dayjs(event.endAt)
    embed.addFields({
      name: 'Last Until',
      // dayjs(undefined) resolves to "now"; only format a genuinely valid date.
      value: event.endAt && end.isValid() ? end.format('YYYY-MM-DD') : 'Unknown',
      inline: true,
    })
  }

  return {
    embed: [embed],
  }
}
