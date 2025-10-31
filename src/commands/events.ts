import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  Message,
  SlashCommandBuilder,
} from 'discord.js'
import {
  EventQuestItem,
  MHWIldsEventResponse,
  parseMHWildsEvents,
} from 'mh-wilds-event-scraper'
import { craftEventEmbed } from '../utils/wilds-event-embed'
import {
  EmbedPaginationEntry,
  DEFAULT_PAGINATION_TIMEOUT_MS,
  DEFAULT_PAGINATION_BUTTON_IDS,
  buildPaginationComponents,
  paginateEmbedEntries,
  registerEmbedPaginationCollector,
  AttachmentRef,
} from '../utils/embed-pagination'
import fs from 'fs'
import path from 'path'
import dayjs from 'dayjs'

// Explicit icon reference type to ensure consistent typing across maps and arrays
type IconRef = AttachmentRef
type EventType = 'permanent' | 'limited' | 'all'
const monsterIcons: Record<string, IconRef> = {}
const questTypeIcons: Record<string, IconRef> = {}
const PAGE_SIZE = 5

const buildEventEntries = (events: EventQuestItem[]): EmbedPaginationEntry[] =>
  events.map((event) => {
    const monsterFileName =
      event.targetMonster !== 'Unknown'
        ? event.targetMonster.split(' ').join('_') + '_Icon.png'
        : 'Unknown_Icon.png'
    const questTypeFileName = `${event.questType}.png`

    const attachments: IconRef[] = []
    const monsterIcon = monsterIcons[monsterFileName]
    const questIcon = questTypeIcons[questTypeFileName]

    if (monsterIcon) {
      attachments.push(monsterIcon)
    }

    if (questIcon) {
      attachments.push(questIcon)
    }

    const { embed } = craftEventEmbed(event)

    return {
      embed: embed[0],
      attachments,
    }
  })

const preloadIcons = () => {
  console.log('Preloading icons...')
  const monsterDir = 'assets/icons/large'
  fs.readdirSync(monsterDir).forEach((filename) => {
    const file = new AttachmentBuilder(path.join(monsterDir, filename))
    monsterIcons[filename] = { file, key: `attachment://${filename}` }
  })

  const questDir = 'assets/icons/quest'
  fs.readdirSync(questDir).forEach((filename) => {
    const file = new AttachmentBuilder(path.join(questDir, filename))
    questTypeIcons[filename] = { file, key: `attachment://${filename}` }
  })
}

preloadIcons()

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
  )

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const MHWildsEvents: MHWIldsEventResponse = await parseMHWildsEvents(
      'https://info.monsterhunter.com/wilds/event-quest/en-us/schedule?utc=7'
    )

    const eventType: EventType =
      (interaction.options.getString('type', true) as EventType) || 'all'

    if (MHWildsEvents.eventQuests.length === 0) {
      return interaction.editReply('No events found.')
    }

    const selectedEvents = filterEvent(MHWildsEvents.eventQuests, eventType)
    const eventEntries = buildEventEntries(selectedEvents)
    const paginatedEvents = paginateEmbedEntries(eventEntries, PAGE_SIZE)

    if (paginatedEvents.pages.length === 0) {
      return interaction.reply('No events found for the selected type.')
    }

    const totalPages = paginatedEvents.pages.length
    let currentPage = 0

    const initialFiles = paginatedEvents.attachmentsByPage[currentPage]

    const replyPayload: InteractionReplyOptions = {
      content:
        eventType === 'permanent' ? 'Permanent Events' : `Here are the ongoing events`,
      embeds: paginatedEvents.pages[currentPage].map((entry) => entry.embed),
      files: initialFiles,
      components: buildPaginationComponents(
        currentPage,
        totalPages,
        DEFAULT_PAGINATION_BUTTON_IDS
      ),
    }

    await interaction.reply(replyPayload)

    const commandUserId = interaction.user?.id ?? null
    let message: Message | null = null

    try {
      message = (await interaction.fetchReply()) as Message
    } catch (err) {
      console.error('Failed to fetch reply for pagination:', err)
    }

    if (
      totalPages <= 1 ||
      !message ||
      typeof message.createMessageComponentCollector !== 'function'
    ) {
      return message
    }

    registerEmbedPaginationCollector(message, paginatedEvents, {
      commandUserId,
      timeoutMs: DEFAULT_PAGINATION_TIMEOUT_MS,
      buttonIds: DEFAULT_PAGINATION_BUTTON_IDS,
    })

    return message
  } catch (error) {
    console.error(error)
    return interaction.editReply('Failed to fetch events.')
  }
}

const filterEvent = (events: EventQuestItem[], eventType: EventType) => {
  if (eventType === 'all') {
    return events
  }
  const filterIsPermanent = eventType === 'permanent'
  if (filterIsPermanent) {
    return events.filter((event) => event.isPermanent === filterIsPermanent)
  }

  const currentDate = dayjs()
  return events.filter(
    (event) =>
      dayjs(event.startAt).isBefore(currentDate) &&
      dayjs(event.endAt).isAfter(currentDate)
  )
}
