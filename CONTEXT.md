# Enlightened Fellows — Domain Context

Domain language for the MH Wilds set-search engine and the data it exposes. Captures terms whose meaning is project-specific and easy to misread.

## Language

**Set search**:
The armor-optimization query: given desired skills (regular / set / group), filters, and rank, find armor + decoration combinations that satisfy them. Entry point is the in-memory-indexed `searchSets()`.

**Set Builder**:
The user-directed feature for manually composing an equipment build from selected armor and decorations, independently of **Set search** optimization.
_Avoid_: Manual set search, custom search.

**Set Builder v1 Build**:
A manually composed selection of up to five body armor pieces, an optional scraped or custom talisman, and optional type-compatible decorations assigned to selected equipment slots.
_Avoid_: Weapon loadout, full equipment loadout.

**Working Build**:
The frontend-owned, locally persisted Set Builder composition before the user explicitly saves it through the API.
_Avoid_: Server draft, autosaved build.

**Saved Build**:
A user-owned persisted **Set Builder v1 Build** whose latest explicitly saved canonical composition remains viewable independently of later catalog changes.

**Stale Build**:
A **Saved Build** with at least one referenced component whose calculation-relevant values no longer match its current source or which is no longer available there.
_Avoid_: Invalid build (it may have been valid when saved).

**Shared Build**:
A **Saved Build** whose owner has opted it into the public shared-build listing.
_Avoid_: Broadcast Build, published build.

**Build Link**:
The unlisted URL containing a Saved Build's unguessable UUID, readable by anyone who possesses it.
_Avoid_: Public listing, private link.

**Active Catalog Item**:
An armor piece, decoration, or skill currently eligible for selection and therefore exposed in current resource lists.

**Inactive Catalog Item**:
A formerly known catalog item explicitly retired through an operator-controlled correction, retained for identity continuity but omitted from current resource lists.
_Avoid_: Deleted item.

**Search result**:
One satisfying build: 6 armor pieces (head, chest, arms, waist, legs, talisman), decorations, achieved skills, free slots, and aggregate stats.

**Defense**:
Sum of the **base** defense of the **5 body pieces** (talisman excluded). No augments and no per-rank defense floor — so it will not match the in-game or reference-site "total defense" exactly.
_Avoid_: "total defense" (implies augment/floor-accurate, which this is not).

**Raw Skill Level**:
The sum of all selected armor, talisman, decoration, set, and group contributions to a skill before applying its maximum level.

**Effective Skill Level**:
The usable level of a skill after capping its **Raw Skill Level** at that skill's maximum level.

**Set Bonus**:
An armor-set effect activated at one or more explicit selected-piece thresholds rather than by summing ordinary skill levels.
_Avoid_: Set skill when referring to the bonus definition.

**Group Bonus**:
An armor-group effect activated at an explicit selected-piece threshold rather than by summing ordinary skill levels.
_Avoid_: Group skill when referring to the bonus definition.

**Decoration**:
A slot-typed equipment enhancement that occupies one compatible slot and grants one or more Skill levels.

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

- **Set Builder** and **Set search** are separate features with different purposes; a **Set Builder** composition is chosen by the user rather than generated by the optimizer.
- **Set Builder** and **Set search** consume the same MH Wilds catalog but do not share their request, result, or lifecycle models.
- The MH Wilds catalog is the single owner of armor, decoration, skill, bonus, stable-identity, and scraping rules; **Set Builder** owns Build rules and **Set search** owns optimization rules.
- A **Set Builder v1 Build** excludes weapon equipment but supports weapon-type slots supplied by a Custom Talisman; weapon decorations assigned to those slots contribute their skills normally.
- A **Set Builder v1 Build** may mix armor Ranks; Rank remains a per-piece property and is not stored as a Build-level field.
- Missing armor pieces, talisman, and decorations do not make a **Set Builder v1 Build** invalid.
- A partial **Saved Build** remains eligible for its Build Link, bot showcase, and the shared-build listing; completeness is not a lifecycle state.
- A **Working Build** is stored in frontend localStorage and is not sent to the API until the user explicitly saves it.
- Every selected decoration is assigned to one specific slot index on one selected armor piece or talisman, and its armor/weapon type must match the slot type; decorations are not stored as an unordered Build-level list.
- Builds do not track armor or decoration inventory; repeated decoration selections are allowed when each copy occupies a valid slot.
- A Save request identifies selected components and assignments but does not supply trusted component values; the backend constructs canonical component snapshots from its catalog and user-owned resources.
- A Saved Build's composition snapshot is self-contained: it includes the referenced Skill definitions and Set/Group Bonus thresholds needed for web or bot calculation without consulting the current catalog.
- A **Saved Build** retains its explicitly saved canonical snapshot across catalog refreshes and becomes a **Stale Build** rather than being silently rewritten or made unviewable.
- A **Stale Build** must be checked against the current catalog before it can be edited and saved as a current build.
- A **Stale Build** remains eligible for its **Build Link**, bot showcase, and the shared-build listing, where its historical status must be visible.
- Metadata-only edits remain allowed for a **Stale Build**; editing its composition requires full validation against current catalog items.
- A **Saved Build** belongs to exactly one **Discord ID**; only that owner may mutate it or change its sharing state.
- A **Saved Build** has a required name and may have a description; the public shared-build listing does not expose its owner's **Discord ID** or profile identity in v1.
- Saved Build names are not identifiers and need not be unique within one owner's collection.
- Saved Build names and descriptions are always plain text, never HTML or Markdown, across web and bot rendering.
- One **Discord ID** may own at most 50 **Saved Builds**, of which at most 5 may be **Shared Builds**.
- Anonymous users may compose and calculate a **Working Build** locally, but saving requires an authenticated **Discord ID**; there is no standalone backend validation operation in v1.
- Only a **Shared Build** appears in the public shared-build listing; listing eligibility is independent of whether a build can be viewed through its link.
- The shared-build listing is ordered by the time a Build most recently became shared; editing it does not change that order, while unsharing and resharing assigns a new sharing time.
- Bot support is an on-demand showcase command that renders a selected Build UUID; there is no bot broadcast workflow planned for v1.
- Anyone possessing a Saved Build's UUID may render it through the bot showcase command, whether or not it is a **Shared Build**.
- Bot discovery must not enumerate another owner's unshared Builds; direct UUID lookup remains allowed.
- Every **Saved Build** has a **Build Link**; there is no separate private, published, or visibility state in v1.
- Possessing a **Build Link** grants read access only; mutating the **Saved Build** still requires its authenticated owning **Discord ID**.
- A **Build Link** identifies an evolving **Saved Build** and shows its owner's latest explicitly saved edit; there are no immutable revision links or public revision history in v1.
- Catalog refreshes never edit a **Saved Build**, even though its owner may update it in place.
- Deleting a **Saved Build** is permanent in v1: its UUID no longer resolves through its **Build Link** or bot lookup, and there is no recovery state.
- Saved Builds do not expire automatically; only explicit owner deletion removes them.
- The Set Builder loads active armor, decorations, and skills through separate resource APIs; stable identities and insert-only catalog values make those resources safe to combine without a shared generation token.
- Catalog scraping is insert-only by stable identity: new items are inserted, matching existing items are left unchanged, and missing items are neither deleted nor made inactive.
- Existing armor, decoration, skill, and relationship rows retain their UUIDs and identities across scrapes, preserving Custom Talisman and Saved Build references.
- If scraped values conflict with an existing identity, the scraper leaves stored values unchanged and records the conflict for operator review.
- Any existing-item conflict rejects the entire scrape transaction and no new items are inserted.
- Corrections and retirement of existing catalog items require an explicit operator-controlled change rather than an automatic scrape.
- Current armor, decoration, and skill APIs return only **Active Catalog Items**.
- A **Search result** contains 6 pieces but **Defense** and **Elemental defenses** aggregate only the 5 body pieces.
- A calculated Build exposes both **Raw Skill Level** and **Effective Skill Level**, including the overflow between them when positive.
- **Set Bonuses** and **Group Bonuses** retain ordered activation thresholds and granted effects in the catalog; they are not modeled as ordinary level-based skills for Build calculation.
- A **Decoration** may grant multiple Skills; all grants are preserved and calculated rather than selecting only the first source entry.
- Build **Defense** and **Elemental defenses** sum only selected body armor; missing positions and talismans contribute zero.
- Saved Build API responses expose trusted component snapshots but no aggregate skill, bonus, defense, or resistance totals; web and bot consumers calculate those independently on demand.
- Calculation parity between web and bot is not a v1 invariant; the persisted composition and assignments are the shared source of truth.
- **Rarity** is per-piece; **Rank** is per-piece and also a query-level filter.
- A **Custom Talisman** belongs to exactly one **Discord ID** (its owner), enforced by a per-user cap of 50 and a unique `(userId, name)` constraint.
- Migration to the stable catalog must verify every existing **Custom Talisman** Skill ID; any orphan blocks migration for explicit repair rather than being guessed or deleted.
- Including a **Custom Talisman** in a **Saved Build** exposes its snapshotted name, skills, and slots through that Build's link and bot showcase, but never exposes its owner or the rest of the owner's talisman collection.
- Deleting a **Custom Talisman** does not remove its snapshot from existing Saved Builds; those Builds become stale and remain viewable.
- A **Custom Talisman**'s skills reference real rows in the `skill` table; each skill's level is validated against that skill's `maxLevel` at write time (not enforceable at the DB level since skills are stored as jsonb, not join rows).
- **Custom Talisman** management (create/list/delete) is dashboard-only for the current iteration; Discord bot slash commands to add/remove them, and feeding them into the set-search DFS as candidate pieces, are both deferred.

## Example dialogue

> **Dev:** "Can a custom talisman have 2 weapon slots?"
> **Domain expert:** "No — only the first of its up to 3 slots may be a weapon slot; any additional slots are always armor slots."
>
> **Dev:** "If a user names their talisman the same as another user's, does that fail?"
> **Domain expert:** "No — the unique-name constraint is scoped per Discord ID, not global."
>
> **Dev:** "Does manually choosing armor use the Set search request with mandatory pieces?"
> **Domain expert:** "No — manual composition belongs to Set Builder; Set search remains the separate optimization feature."
>
> **Dev:** "The catalog changed after this build was saved. Should we recalculate it silently?"
> **Domain expert:** "No — preserve the saved result, mark it stale, and require current-catalog validation before saving an edit."

## Flagged ambiguities

- "total defense" was used to mean the existing `defense` value — resolved: that value is base-only over 5 body pieces; we keep it and do **not** rename it "total" to avoid implying augment/floor accuracy.
- "armor's rarity" was ambiguous (per-piece vs aggregate) — resolved: per-piece `rarities[]` parallel to `armorNames`, not a single aggregate.
- "Talisman" alone is ambiguous between the scraped, globally-shared game-data talisman (`armor` table) and the new per-user **Custom Talisman** — resolved: always qualify which one is meant.
- A **Custom Talisman** is private while managed in its owner's collection, but its configuration is intentionally link-visible when snapshotted into a **Saved Build**.
- "Broadcast" was used for a public page of user-shared Builds and for possible bot distribution — resolved: the web feature is the opt-in **Shared Build** listing; the v1 bot only renders a Build selected by UUID.
