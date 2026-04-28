import type { SearchResult } from "../types";

export function reorder(
  dataList: SearchResult[],
  skillMaxMap: Record<string, number>,
): SearchResult[] {
  // Cap visual skill levels and normalize set/group counts
  for (const data of dataList) {
    for (const [sk, lv] of Object.entries(data.skills)) {
      const max = skillMaxMap[sk];
      if (max !== undefined && lv > max) data.skills[sk] = max;
    }

    data.skills = Object.fromEntries(
      Object.entries(data.skills).sort(
        ([k1, v1], [k2, v2]) => v2 - v1 || k1.localeCompare(k2),
      ),
    );

    data.setSkills = Object.fromEntries(
      Object.entries(data.setSkills)
        .filter(([k, v]) => k && Math.floor(v / 2) > 0)
        .map(([k, v]) => [k, Math.floor(v / 2)]),
    );

    data.groupSkills = Object.fromEntries(
      Object.entries(data.groupSkills)
        .filter(([k, v]) => k && Math.floor(v / 3) > 0)
        .map(([k, v]) => [k, Math.floor(v / 3)]),
    );

    data.slots.sort((a, b) => b - a);
  }

  // Primary sort: most 3-slots → most 2-slots → longest free slots → most skill keys → highest defense
  const primarySorted = [...dataList].sort((a, b) => {
    const aThrees = a.freeSlots.filter((s) => s === 3).length;
    const bThrees = b.freeSlots.filter((s) => s === 3).length;
    const aTwos = a.freeSlots.filter((s) => s === 2).length;
    const bTwos = b.freeSlots.filter((s) => s === 2).length;
    return (
      // bThrees - aThrees ||
      // bTwos - aTwos ||
      b.freeSlots.length - a.freeSlots.length ||
      Object.keys(b.skills).length - Object.keys(a.skills).length ||
      b.defense - a.defense
    );
  });

  // Tier 1 dedup: keep one entry per (numThrees, numTwos) signature
  const pre: SearchResult[] = [];
  const post: SearchResult[] = [];
  const bestPerSignature: Record<string, number> = {};

  for (const res of primarySorted) {
    const numThrees = res.freeSlots.filter((s) => s === 3).length;
    const numTwos = res.freeSlots.filter((s) => s === 2).length;
    const key = `${numThrees},${numTwos}`;

    if (!(key in bestPerSignature)) {
      pre.push(res);
      bestPerSignature[key] = res.freeSlots.length;
    } else {
      post.push(res);
    }
  }

  // Tier 2 fallback: sort remaining by total free slots, prioritizing those with 2- or 3-slots, then original index
  const preIds = new Set(pre.map((r) => r._originalIndex));
  const longestSlots = [...dataList]
    .filter((r) => !preIds.has(r._originalIndex))
    .sort((a, b) => {
      const aHasPriority = a.freeSlots.some((v) => v >= 2)
        ? a.freeSlots.length
        : 0;
      const bHasPriority = b.freeSlots.some((v) => v >= 2)
        ? b.freeSlots.length
        : 0;
      return (
        b.freeSlots.length - a.freeSlots.length ||
        bHasPriority - aHasPriority ||
        b.defense - a.defense ||
        (a._originalIndex ?? 0) - (b._originalIndex ?? 0)
      );
    });

  return [...pre, ...longestSlots];
}
