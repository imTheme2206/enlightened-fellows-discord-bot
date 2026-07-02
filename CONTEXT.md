# Enlightened Fellows — Domain Context

Domain language for the MH Wilds set-search engine and the data it exposes. Captures terms whose meaning is project-specific and easy to misread.

## Language

**Set search**:
The armor-optimization query: given desired skills (regular / set / group), filters, and rank, find armor + decoration combinations that satisfy them. Entry point is the in-memory-indexed `searchSets()`.

**Search result**:
One satisfying build: 6 armor pieces (head, chest, arms, waist, legs, talisman), decorations, achieved skills, free slots, and aggregate stats.

**Defense**:
Sum of the **base** defense of the **5 body pieces** (talisman excluded). No augments and no per-rank defense floor — so it will not match the in-game or reference-site "total defense" exactly.
_Avoid_: "total defense" (implies augment/floor-accurate, which this is not).

**Elemental defenses**:
Per-result object `{ fire, water, thunder, ice, dragon }`, summed over the **same 5 body pieces** as **Defense** (talisman excluded). Distinct from a single piece's `resists` 5-tuple, which is the internal per-piece source.

**Rarity**:
A per-piece integer (DB `armor.rarity`), surfaced on a result as `rarities[]` aligned 1:1 with the armor pieces. The talisman slot has no rarity → `0`.
_Avoid_: "rank" — **Rank** is a separate concept.

**Rank**:
The hunt tier of a piece / query: `low | high | master`. Orthogonal to **Rarity**.
_Avoid_: using "rarity" and "rank" interchangeably.

## Relationships

- A **Search result** contains 6 pieces but **Defense** and **Elemental defenses** aggregate only the 5 body pieces.
- **Rarity** is per-piece; **Rank** is per-piece and also a query-level filter.

## Flagged ambiguities

- "total defense" was used to mean the existing `defense` value — resolved: that value is base-only over 5 body pieces; we keep it and do **not** rename it "total" to avoid implying augment/floor accuracy.
- "armor's rarity" was ambiguous (per-piece vs aggregate) — resolved: per-piece `rarities[]` parallel to `armorNames`, not a single aggregate.
