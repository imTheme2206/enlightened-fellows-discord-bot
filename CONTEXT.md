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

**Discord ID**:
The raw Discord snowflake (string) identifying a user. Used as the bare `userId` column value across user-scoped tables (`search_history`, `custom_talisman`) — never a foreign key to Supabase's `auth` schema. See ADR-0003 for how the API obtains it from a Supabase JWT.
_Avoid_: User ID, Supabase user ID (that's a different identifier — the Supabase Auth UUID, not stored in this codebase's tables).

**Talisman (scraped)**:
A fixed, community-sourced talisman from wilds.mhdb.io, shared globally across all users, with skills only — no slots. Lives in the `armor` table with `type = 'talisman'`.
_Avoid_: Custom talisman, user talisman.

**Custom Talisman**:
A user-authored talisman, privately scoped to one Discord user, with 1-3 skills and up to 3 slots. Distinct from a scraped **Talisman**: it can have slots (a scraped Talisman cannot), and only the first slot may be a weapon slot — the rest are always armor slots.
_Avoid_: Talisman alone (ambiguous — always qualify as "scraped" or "custom" when it matters).

## Relationships

- A **Search result** contains 6 pieces but **Defense** and **Elemental defenses** aggregate only the 5 body pieces.
- **Rarity** is per-piece; **Rank** is per-piece and also a query-level filter.
- A **Custom Talisman** belongs to exactly one **Discord ID** (its owner), enforced by a per-user cap of 50 and a unique `(userId, name)` constraint.
- A **Custom Talisman**'s skills reference real rows in the `skill` table; each skill's level is validated against that skill's `maxLevel` at write time (not enforceable at the DB level since skills are stored as jsonb, not join rows).
- **Custom Talisman** management (create/list/delete) is dashboard-only for the current iteration; Discord bot slash commands to add/remove them, and feeding them into the set-search DFS as candidate pieces, are both deferred.

## Example dialogue

> **Dev:** "Can a custom talisman have 2 weapon slots?"
> **Domain expert:** "No — only the first of its up to 3 slots may be a weapon slot; any additional slots are always armor slots."
>
> **Dev:** "If a user names their talisman the same as another user's, does that fail?"
> **Domain expert:** "No — the unique-name constraint is scoped per Discord ID, not global."

## Flagged ambiguities

- "total defense" was used to mean the existing `defense` value — resolved: that value is base-only over 5 body pieces; we keep it and do **not** rename it "total" to avoid implying augment/floor accuracy.
- "armor's rarity" was ambiguous (per-piece vs aggregate) — resolved: per-piece `rarities[]` parallel to `armorNames`, not a single aggregate.
- "Talisman" alone is ambiguous between the scraped, globally-shared game-data talisman (`armor` table) and the new per-user **Custom Talisman** — resolved: always qualify which one is meant.
