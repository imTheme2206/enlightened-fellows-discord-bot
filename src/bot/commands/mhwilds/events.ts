import dayjs from 'dayjs'
import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  Message,
  SlashCommandBuilder,
} from 'discord.js'
import fs from 'fs'
import { EventQuestItem, MHWIldsEventResponse, parseMHWildsEvents } from 'mh-wilds-event-scraper'
import path from 'path'
import logger from '../../../config/logger'
import {
  AttachmentRef,
  DEFAULT_PAGINATION_TIMEOUT_MS,
  EmbedPaginationEntry,
  buildPaginationComponents,
  paginateEmbedEntries,
  registerEmbedPaginationCollector,
} from '../../utils/embed-pagination'
import { resolveMonsterIcon } from '../../utils/resolve-monster-icon'
import { craftEventEmbed } from '../../utils/wilds-event-embed'
import { Command } from '../_types'

// Explicit icon reference type to ensure consistent typing across maps and arrays
type IconRef = AttachmentRef
type EventType = 'permanent' | 'limited' | 'all'
const monsterIcons: Record<string, IconRef> = {}
const questTypeIcons: Record<string, IconRef> = {}
const PAGE_SIZE = 5
const EVENTS_PAGINATION_BUTTON_IDS = {
  prev: 'events_prev',
  next: 'events_next',
} as const

const filterEvent = (events: EventQuestItem[], eventType: EventType) => {
  if (eventType === 'all') {
    return events
  }
  const filterIsPermanent = eventType === 'permanent'
  if (filterIsPermanent) {
    return events.filter((event) => event.isPermanent === filterIsPermanent)
  }

  const currentDate = dayjs()

  const uniqueEvents = new Map<string, EventQuestItem>()

  events.forEach((event) => {
    if (!uniqueEvents.has(event.questName)) {
      uniqueEvents.set(event.questName, event)
    }
  })

  const uniqueEventsArray = Array.from(uniqueEvents.values())

  return uniqueEventsArray.filter(
    (event) => !event.isPermanent && dayjs(event.startAt).isBefore(currentDate) && dayjs(event.endAt).isAfter(currentDate)
  )
}

const buildEventEntries = (events: EventQuestItem[]): EmbedPaginationEntry[] =>
  events.map((event) => {
    const monsterFileName = resolveMonsterIcon(event.targetMonster)
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
  logger.info('Preloading icons...')
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
      .addChoices({ name: 'Permanent', value: 'permanent' }, { name: 'Limited', value: 'limited' })
      .setRequired(true)
  )

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const eventType: EventType = (interaction.options.getString('type', true) as EventType) || 'all'

  let hasDeferred = false
  let hasSentInitialResponse = false
  const canDefer = typeof interaction.deferReply === 'function'

  const respond = async (payload: string | InteractionReplyOptions) => {
    const shouldEdit =
      hasDeferred ||
      hasSentInitialResponse ||
      (typeof interaction.deferred === 'boolean' && interaction.deferred) ||
      (typeof interaction.replied === 'boolean' && interaction.replied)

    if (shouldEdit && typeof interaction.editReply === 'function') {
      hasSentInitialResponse = true
      return interaction.editReply(payload as InteractionEditReplyOptions | string)
    }

    if (typeof interaction.reply === 'function') {
      hasSentInitialResponse = true
      return interaction.reply(payload as InteractionReplyOptions | string)
    }

    if (typeof interaction.editReply === 'function') {
      hasSentInitialResponse = true
      return interaction.editReply(payload as InteractionEditReplyOptions | string)
    }

    throw new Error('Interaction does not support reply or editReply')
  }

  try {
    if (canDefer && typeof interaction.deferReply === 'function' && !(interaction.deferred || interaction.replied)) {
      await interaction.deferReply()
      hasDeferred = true
    }

    const MHWildsEvents: MHWIldsEventResponse = await parseMHWildsEvents(
      'https://info.monsterhunter.com/wilds/event-quest/en-us/schedule?utc=7'
    )

    if (MHWildsEvents.eventQuests.length === 0) {
      await respond('No events found.')
      return
    }

    const selectedEvents = filterEvent(MHWildsEvents.eventQuests, eventType)
    const eventEntries = buildEventEntries(selectedEvents)
    const paginatedEvents = paginateEmbedEntries(eventEntries, PAGE_SIZE)

    if (paginatedEvents.pages.length === 0) {
      await respond('No events found for the selected type.')
      return
    }

    const totalPages = paginatedEvents.pages.length
    const currentPage = 0

    const initialFiles = paginatedEvents.attachmentsByPage[currentPage]

    const replyPayload: InteractionReplyOptions = {
      content: eventType === 'permanent' ? 'Permanent Events' : `Here are the ongoing events`,
      embeds: paginatedEvents.pages[currentPage].map((entry) => entry.embed),
      files: initialFiles,
      components: buildPaginationComponents(currentPage, totalPages, EVENTS_PAGINATION_BUTTON_IDS),
    }

    await respond(replyPayload)

    const commandUserId = interaction.user?.id ?? null
    let message: Message | null = null

    try {
      if (typeof interaction.fetchReply === 'function') {
        message = (await interaction.fetchReply()) as Message
      }
    } catch (err) {
      logger.error('Failed to fetch reply for pagination:', { err })
    }

    if (totalPages <= 1 || !message || typeof message.createMessageComponentCollector !== 'function') {
      return
    }

    registerEmbedPaginationCollector(message, paginatedEvents, {
      commandUserId,
      timeoutMs: DEFAULT_PAGINATION_TIMEOUT_MS,
      buttonIds: EVENTS_PAGINATION_BUTTON_IDS,
      initialPage: currentPage,
    })
  } catch (error) {
    logger.error('Failed to fetch events:', { error })
    try {
      await respond('Failed to fetch events.')
    } catch (replyError) {
      logger.error('Failed to send error message:', { replyError })
    }
  }
}

export default { data, execute } satisfies Command
