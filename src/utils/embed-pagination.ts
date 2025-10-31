import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  Message,
} from 'discord.js'

export type AttachmentRef = {
  key: string
  file: AttachmentBuilder
}

export type EmbedPaginationEntry = {
  embed: EmbedBuilder
  attachments: AttachmentRef[]
}

export type PaginatedEmbeds = {
  pages: EmbedPaginationEntry[][]
  attachmentsByPage: AttachmentBuilder[][]
}

export type PaginationButtonIds = {
  prev: string
  next: string
}

export type EmbedPaginationOptions = {
  buttonIds?: PaginationButtonIds
  timeoutMs?: number
  initialPage?: number
  commandUserId?: string | null
  buildComponents?: (
    page: number,
    totalPages: number,
    buttonIds: PaginationButtonIds
  ) => ActionRowBuilder<ButtonBuilder>[]
  onPageChange?: (page: number) => void | Promise<void>
  onCollectorEnd?: (page: number) => void | Promise<void>
}

export const DEFAULT_PAGINATION_BUTTON_IDS: PaginationButtonIds = {
  prev: 'pagination_prev',
  next: 'pagination_next',
}

export const DEFAULT_PAGINATION_TIMEOUT_MS = 5 * 60 * 1000

export const chunkEntries = <T>(entries: T[], pageSize: number): T[][] => {
  if (pageSize <= 0) {
    throw new Error('pageSize must be greater than 0')
  }

  const pages: T[][] = []
  for (let i = 0; i < entries.length; i += pageSize) {
    pages.push(entries.slice(i, i + pageSize))
  }
  return pages
}

const collectAttachmentsForPage = (
  entries: EmbedPaginationEntry[]
): AttachmentBuilder[] => {
  const unique = new Map<string, AttachmentRef>()
  entries.forEach((entry) => {
    entry.attachments.forEach((attachment) => {
      if (!unique.has(attachment.key)) {
        unique.set(attachment.key, attachment)
      }
    })
  })
  return Array.from(unique.values()).map((attachment) => attachment.file)
}

export const paginateEmbedEntries = (
  entries: EmbedPaginationEntry[],
  pageSize: number
): PaginatedEmbeds => {
  const pages = chunkEntries(entries, pageSize)
  const attachmentsByPage = pages.map((pageEntries) =>
    collectAttachmentsForPage(pageEntries)
  )

  return {
    pages,
    attachmentsByPage,
  }
}

export const buildPaginationComponents = (
  page: number,
  totalPages: number,
  buttonIds: PaginationButtonIds,
  buttonStyle: ButtonStyle = ButtonStyle.Primary
) => {
  if (totalPages <= 1) {
    return [] as ActionRowBuilder<ButtonBuilder>[]
  }

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(buttonIds.prev)
        .setLabel('Previous')
        .setStyle(buttonStyle)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(buttonIds.next)
        .setLabel('Next')
        .setStyle(buttonStyle)
        .setDisabled(page === totalPages - 1)
    ),
  ]
}

const isPaginationButton = (customId: string, buttonIds: PaginationButtonIds) =>
  customId === buttonIds.prev || customId === buttonIds.next

export const registerEmbedPaginationCollector = (
  message: Message,
  paginatedEmbeds: PaginatedEmbeds,
  options: EmbedPaginationOptions = {}
) => {
  const { pages, attachmentsByPage } = paginatedEmbeds

  if (
    pages.length <= 1 ||
    typeof message.createMessageComponentCollector !== 'function'
  ) {
    return
  }

  const buttonIds = options.buttonIds ?? DEFAULT_PAGINATION_BUTTON_IDS
  const timeoutMs = options.timeoutMs ?? DEFAULT_PAGINATION_TIMEOUT_MS
  let currentPage = options.initialPage ?? 0
  const totalPages = pages.length
  const commandUserId = options.commandUserId ?? null
  const buildComponents = options.buildComponents
    ? (page: number) => options.buildComponents!(page, totalPages, buttonIds)
    : (page: number) => buildPaginationComponents(page, totalPages, buttonIds)

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: timeoutMs,
  })

  collector.on('collect', async (interaction: ButtonInteraction) => {
    if (!isPaginationButton(interaction.customId, buttonIds)) {
      return
    }

    if (commandUserId && interaction.user?.id !== commandUserId) {
      await interaction.reply({
        content: 'Only the command invoker can use these buttons.',
        ephemeral: true,
      })
      return
    }

    if (interaction.customId === buttonIds.prev && currentPage > 0) {
      currentPage -= 1
    } else if (interaction.customId === buttonIds.next && currentPage < totalPages - 1) {
      currentPage += 1
    } else {
      await interaction.deferUpdate()
      return
    }

    await interaction.update({
      embeds: pages[currentPage].map((entry) => entry.embed),
      files: attachmentsByPage[currentPage],
      attachments: [],
      components: buildComponents(currentPage),
    })

    if (options.onPageChange) {
      await options.onPageChange(currentPage)
    }
  })

  collector.on('end', async () => {
    try {
      await message.edit({ components: [] })
    } catch (err) {
      console.error('Failed to clean up pagination components:', err)
    }

    if (options.onCollectorEnd) {
      await options.onCollectorEnd(currentPage)
    }
  })

  return collector
}
