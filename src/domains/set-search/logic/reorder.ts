import type { SearchResult } from '../types'
import { DEFENSE_BAND } from './constants'

/** Total skill levels across a result (skills are already capped to their max). */
function totalSkillLevels(result: SearchResult): number {
  return Object.values(result.skills).reduce((sum, lv) => sum + lv, 0)
}

function countSlots(slots: number[], size: number): number {
  return slots.filter((s) => s === size).length
}

/**
 * Ranks results in two defense tiers:
 * - Tier 1 (within DEFENSE_BAND of the best defense found): free slots first
 *   (size-3, then size-2, then count), then total skill levels, then defense.
 * - Tier 2 (below the band): defense first, then total skill levels, then free slots.
 * Discovery order breaks any remaining ties.
 */
export function reorder(dataList: SearchResult[], skillMaxMap: Record<string, number>): SearchResult[] {
  // Cap visual skill levels and normalize set/group counts
  for (const data of dataList) {
    for (const [sk, lv] of Object.entries(data.skills)) {
      const max = skillMaxMap[sk]
      if (max !== undefined && lv > max) data.skills[sk] = max
    }

    data.skills = Object.fromEntries(Object.entries(data.skills).sort(([k1, v1], [k2, v2]) => v2 - v1 || k1.localeCompare(k2)))

    data.setSkills = Object.fromEntries(
      Object.entries(data.setSkills)
        .filter(([k, v]) => k && Math.floor(v / 2) > 0)
        .map(([k, v]) => [k, Math.floor(v / 2)])
    )

    data.groupSkills = Object.fromEntries(
      Object.entries(data.groupSkills)
        .filter(([k, v]) => k && Math.floor(v / 3) > 0)
        .map(([k, v]) => [k, Math.floor(v / 3)])
    )

    data.slots.sort((a, b) => b - a)
  }

  const maxDefense = dataList.reduce((max, r) => Math.max(max, r.defense), 0)
  const tierThreshold = maxDefense - DEFENSE_BAND

  return [...dataList].sort((a, b) => {
    const aTopTier = a.defense >= tierThreshold
    const bTopTier = b.defense >= tierThreshold
    if (aTopTier !== bTopTier) return aTopTier ? -1 : 1

    if (aTopTier) {
      return (
        countSlots(b.freeSlots, 3) - countSlots(a.freeSlots, 3) ||
        countSlots(b.freeSlots, 2) - countSlots(a.freeSlots, 2) ||
        b.freeSlots.length - a.freeSlots.length ||
        totalSkillLevels(b) - totalSkillLevels(a) ||
        b.defense - a.defense ||
        (a._originalIndex ?? 0) - (b._originalIndex ?? 0)
      )
    }

    return (
      b.defense - a.defense ||
      totalSkillLevels(b) - totalSkillLevels(a) ||
      countSlots(b.freeSlots, 3) - countSlots(a.freeSlots, 3) ||
      countSlots(b.freeSlots, 2) - countSlots(a.freeSlots, 2) ||
      b.freeSlots.length - a.freeSlots.length ||
      (a._originalIndex ?? 0) - (b._originalIndex ?? 0)
    )
  })
}
