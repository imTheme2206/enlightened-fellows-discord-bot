import dayjs from 'dayjs'
import { AttachmentBuilder } from 'discord.js'
import { EventQuestItem, MHWIldsEventResponse, parseMHWildsEvents } from '@imthmn/mh-wilds-event-scraper'
import fs from 'fs'
import path from 'path'
import logger from '../../infra/logger'
import type { AttachmentRef, EmbedPaginationEntry, PaginatedEmbeds } from './embed-pagination'
import { paginateEmbedEntries } from './embed-pagination'
import { resolveMonsterIcon } from './resolve-monster-icon'
import { craftEventEmbed } from './wilds-event-embed'

/**
 * Deep, Discord-adjacent module owning MH Wilds event delivery: retrieval,
 * filtering, deduplication, and presentation preparation. No SQL. Both the
 * `/events` slash command and the scheduled events-job are thin adapters over
 * this module — retrieval/filter/prepare are pure enough to unit test with
 * injected event data, no Discord objects and no live network.
 */

export type EventType = 'permanent' | 'limited' | 'all'

const SOURCE_URL = 'https://info.monsterhunter.com/wilds/event-quest/en-us/schedule?utc=7'
const PAGE_SIZE = 5
export const EVENTS_PAGINATION_BUTTON_IDS = { prev: 'events_prev', next: 'events_next' } as const

// ── retrieval ────────────────────────────────────────────────────────────

/** Fetches the raw upstream event feed. The only network/IO in this module. */
export async function fetchMHWildsEvents(): Promise<MHWIldsEventResponse> {
  return parseMHWildsEvents(SOURCE_URL)
}

// ── filtering (pure) ─────────────────────────────────────────────────────

/**
 * Filters events by type and, for `limited`, to the current-time activation
 * window plus deduplication by `questName`. Pure — takes `now` as an
 * injectable parameter so window-edge behavior is testable without faking
 * global time.
 */
export function filterEvents(events: EventQuestItem[], eventType: EventType, now: dayjs.Dayjs = dayjs()): EventQuestItem[] {
  if (eventType === 'all') return events

  if (eventType === 'permanent') {
    return events.filter((event) => event.isPermanent)
  }

  // 'limited': dedupe by questName first, then apply the current-time window.
  const uniqueEvents = new Map<string, EventQuestItem>()
  for (const event of events) {
    if (!uniqueEvents.has(event.questName)) uniqueEvents.set(event.questName, event)
  }

  return Array.from(uniqueEvents.values()).filter((event) => {
    if (event.isPermanent || !event.startAt || !event.endAt) return false

    const start = dayjs(event.startAt)
    const end = dayjs(event.endAt)

    // Guard against missing/malformed dates: dayjs(undefined) resolves to
    // "now", which would otherwise let endless events leak through as
    // currently ongoing.
    if (!start.isValid() || !end.isValid()) return false

    return start.isBefore(now) && end.isAfter(now)
  })
}

// ── presentation preparation ────────────────────────────────────────────

/** Preloaded on first use; both icon maps are keyed by filename. */
let monsterIcons: Record<string, AttachmentRef> | null = null
let questTypeIcons: Record<string, AttachmentRef> | null = null

function loadIconMap(dir: string): Record<string, AttachmentRef> {
  const map: Record<string, AttachmentRef> = {}
  for (const filename of fs.readdirSync(dir)) {
    const file = new AttachmentBuilder(path.join(dir, filename))
    map[filename] = { file, key: `attachment://${filename}` }
  }
  return map
}

function ensureIconsLoaded(): void {
  if (monsterIcons && questTypeIcons) return
  logger.info('[mhwildsEventDelivery] Preloading icons...')
  monsterIcons = loadIconMap('assets/icons/large')
  questTypeIcons = loadIconMap('assets/icons/quest')
}

/** Builds one paginable entry (embed + attachments) per event, in input order. */
export function buildEventEntries(events: EventQuestItem[]): EmbedPaginationEntry[] {
  ensureIconsLoaded()

  return events.map((event) => {
    const monsterFileName = resolveMonsterIcon(event.targetMonster)
    const questTypeFileName = `${event.questType}.png`

    const attachments: AttachmentRef[] = []
    const monsterIcon = monsterIcons![monsterFileName]
    const questIcon = questTypeIcons![questTypeFileName]
    if (monsterIcon) attachments.push(monsterIcon)
    if (questIcon) attachments.push(questIcon)

    const { embed } = craftEventEmbed(event)
    return { embed: embed[0], attachments }
  })
}

/** Chunks prepared entries into pages of `PAGE_SIZE` (5). */
export function paginateEvents(entries: EmbedPaginationEntry[]): PaginatedEmbeds {
  return paginateEmbedEntries(entries, PAGE_SIZE)
}

// ── combined pipeline ────────────────────────────────────────────────────

export interface PreparedEvents {
  /** True when the upstream feed itself returned zero events (not just after filtering). */
  feedEmpty: boolean
  paginated: PaginatedEmbeds
}

/** Retrieval → filter → prepare, the full pipeline both adapters call. */
export async function loadAndPrepareEvents(eventType: EventType, now: dayjs.Dayjs = dayjs()): Promise<PreparedEvents> {
  const feed = await fetchMHWildsEvents()
  if (feed.eventQuests.length === 0) {
    return { feedEmpty: true, paginated: { pages: [], attachmentsByPage: [] } }
  }

  const selected = filterEvents(feed.eventQuests, eventType, now)
  const entries = buildEventEntries(selected)
  return { feedEmpty: false, paginated: paginateEvents(entries) }
}
