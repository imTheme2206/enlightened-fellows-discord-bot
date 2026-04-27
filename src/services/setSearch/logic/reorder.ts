import type { SearchResult } from '../types'
import { slottageSizeCompare } from './slotMath'

export function reorder(
  dataList: SearchResult[],
  skillMaxMap: Record<string, number>,
): SearchResult[] {
  const indexed = dataList.map((item, i) => ({ ...item, _originalIndex: i }))

  for (const data of indexed) {
    // Cap skills at max level
    for (const [sk, lv] of Object.entries(data.skills)) {
      const max = skillMaxMap[sk]
      if (max !== undefined && lv > max) data.skills[sk] = max
    }

    // Sort skills descending by level
    data.skills = Object.fromEntries(
      Object.entries(data.skills).sort(([k1, v1], [k2, v2]) => v2 - v1 || k1.localeCompare(k2)),
    )

    // Correct set skill levels (each pair of pieces = 1 level)
    data.setSkills = Object.fromEntries(
      Object.entries(data.setSkills)
        .filter(([k, v]) => k && Math.floor(v / 2) > 0)
        .map(([k, v]) => [k, Math.floor(v / 2)]),
    )

    // Correct group skill levels (3 pieces = 1 level)
    data.groupSkills = Object.fromEntries(
      Object.entries(data.groupSkills)
        .filter(([k, v]) => k && Math.floor(v / 3) > 0)
        .map(([k, v]) => [k, Math.floor(v / 3)]),
    )
  }

  const sorted = [...indexed].sort((a, b) => b.defense - a.defense || slottageSizeCompare(a.freeSlots, b.freeSlots))
  sorted.forEach((d) => d.slots.sort((a, b) => b - a))

  let pre: typeof indexed = []
  let post: typeof indexed = []
  const bestPerThree: Record<string, number> = {}

  const sortedFinal = sorted.sort((a, b) => {
    const aThrees = a.freeSlots.filter((y) => y === 3).length
    const bThrees = b.freeSlots.filter((y) => y === 3).length
    const aTwos = a.freeSlots.filter((y) => y === 2).length
    const bTwos = b.freeSlots.filter((y) => y === 2).length
    return (
      bThrees - aThrees ||
      bTwos - aTwos ||
      b.freeSlots.length - a.freeSlots.length ||
      Object.keys(b.skills).length - Object.keys(a.skills).length
    )
  })

  for (const res of sortedFinal) {
    const numThrees = res.freeSlots.filter((y) => y === 3).length
    const numTwos = res.freeSlots.filter((y) => y === 2).length
    const key = `${numThrees},${numTwos}`
    if (!(key in bestPerThree)) {
      pre.push(res)
      bestPerThree[key] = res.freeSlots.length
    } else {
      post.push(res)
    }
  }

  pre = [...pre, ...post]
  const excludeIds = new Set(pre.map((o) => o._originalIndex))

  const longestSlots = [...indexed]
    .filter((v) => !excludeIds.has(v._originalIndex))
    .sort((a, b) => {
      const aHas = a.freeSlots.some((v) => v === 2 || v === 3) ? a.freeSlots.length : 0
      const bHas = b.freeSlots.some((v) => v === 2 || v === 3) ? b.freeSlots.length : 0
      return (
        b.freeSlots.length - a.freeSlots.length ||
        bHas - aHas ||
        a._originalIndex - b._originalIndex
      )
    })

  // Strip internal index before returning
  return [...pre, ...longestSlots].map(({ _originalIndex: _o, ...rest }) => rest as SearchResult)
}
