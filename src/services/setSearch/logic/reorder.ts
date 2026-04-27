import type { SearchResult } from '../types'

export function reorder(
  dataList: SearchResult[],
  skillMaxMap: Record<string, number>,
): SearchResult[] {
  for (const data of dataList) {
    for (const [sk, lv] of Object.entries(data.skills)) {
      const max = skillMaxMap[sk]
      if (max !== undefined && lv > max) data.skills[sk] = max
    }

    data.skills = Object.fromEntries(
      Object.entries(data.skills).sort(([k1, v1], [k2, v2]) => v2 - v1 || k1.localeCompare(k2)),
    )

    data.setSkills = Object.fromEntries(
      Object.entries(data.setSkills)
        .filter(([k, v]) => k && Math.floor(v / 2) > 0)
        .map(([k, v]) => [k, Math.floor(v / 2)]),
    )

    data.groupSkills = Object.fromEntries(
      Object.entries(data.groupSkills)
        .filter(([k, v]) => k && Math.floor(v / 3) > 0)
        .map(([k, v]) => [k, Math.floor(v / 3)]),
    )

    data.slots.sort((a, b) => b - a)
  }

  return dataList.sort((a, b) => {
    const aThrees = a.freeSlots.filter((s) => s === 3).length
    const bThrees = b.freeSlots.filter((s) => s === 3).length
    const aTwos = a.freeSlots.filter((s) => s === 2).length
    const bTwos = b.freeSlots.filter((s) => s === 2).length
    return (
      b.defense - a.defense ||
      bThrees - aThrees ||
      bTwos - aTwos ||
      b.freeSlots.length - a.freeSlots.length
    )
  })
}
