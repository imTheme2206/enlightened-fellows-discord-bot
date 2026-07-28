/**
 * Armor Transcendence (MH Wilds TU4, HR100+) decoration-slot upgrades.
 *
 * The upstream feed (wilds.mhdb.io) and every other catalog source publish only
 * an armor piece's *base* slots — no source carries the transcended values. But
 * the transcend outcome is a **deterministic function of `(rarity, base slots)`**,
 * so we compute it here rather than storing it or sourcing a per-piece table.
 *
 * Rule (validated against in-game behaviour + community guides):
 *   - Pad the base slots to three positions, treating a missing slot as level 0.
 *   - Rarity 5: +1 level to ALL three positions   (e.g. ①,-,-  → ②,①,①).
 *   - Rarity 6: +1 level to the FIRST two positions (e.g. ③,-,-  → ③,①,-).
 *   - Every slot is capped at level 3; trailing empty (level-0) slots are dropped.
 *   - Rarity 7 / 8: no slot change.
 *   - Rarity 1–4: treated as no change (unconfirmed; those pieces are early-game
 *     and effectively never transcended for endgame builds).
 *
 * This is why the DB stores base slots (canonical, matches the feed, keeps scrape
 * reconciliation clean) while the in-memory search index is built from the
 * transcended values — endgame builds always assume a transcended piece.
 */

const MAX_SLOT_LEVEL = 3

/** How many leading slot positions gain +1 level when transcended, by rarity. */
function upgradedPositions(rarity: number): number {
  if (rarity === 5) return 3
  if (rarity === 6) return 2
  return 0 // R1–4 (unconfirmed) and R7/8 (confirmed): no slot change
}

/**
 * Returns the decoration slots an armor piece has after Armor Transcendence.
 * Pure: never mutates `baseSlots`. Returns a fresh array (a copy even when the
 * piece is unaffected, so callers can freely retain it).
 */
export function transcendSlots(baseSlots: number[], rarity: number): number[] {
  const positions = upgradedPositions(rarity)
  if (positions === 0) return [...baseSlots]

  const padded = [baseSlots[0] ?? 0, baseSlots[1] ?? 0, baseSlots[2] ?? 0]
  for (let i = 0; i < positions; i++) {
    padded[i] = Math.min(padded[i] + 1, MAX_SLOT_LEVEL)
  }
  while (padded.length > 0 && padded[padded.length - 1] === 0) padded.pop()
  return padded
}
