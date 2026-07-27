import { ChatInputCommandInteraction, InteractionEditReplyOptions, InteractionReplyOptions, Message, SlashCommandBuilder } from 'discord.js'
import logger from '../../../infra/logger'
import { DEFAULT_PAGINATION_TIMEOUT_MS, buildPaginationComponents, registerEmbedPaginationCollector } from '../../utils/embed-pagination'
import { EVENTS_PAGINATION_BUTTON_IDS, EventType, loadAndPrepareEvents } from '../../utils/mhwilds-event-delivery'
import { Command } from '../_types'

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

/**
 * Thin adapter: defer → retrieve/filter/prepare via `mhwilds-event-delivery`
 * → reply/paginate. Fetching, filtering, timing, dedup, and rendering all
 * live in that deep module; this command only handles interaction transport.
 */
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

    const { feedEmpty, paginated } = await loadAndPrepareEvents(eventType)

    if (feedEmpty) {
      await respond('No events found.')
      return
    }
    if (paginated.pages.length === 0) {
      await respond('No events found for the selected type.')
      return
    }

    const totalPages = paginated.pages.length
    const currentPage = 0
    const initialFiles = paginated.attachmentsByPage[currentPage]

    const replyPayload: InteractionReplyOptions = {
      content: eventType === 'permanent' ? 'Permanent Events' : `Here are the ongoing events`,
      embeds: paginated.pages[currentPage].map((entry) => entry.embed),
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

    registerEmbedPaginationCollector(message, paginated, {
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
