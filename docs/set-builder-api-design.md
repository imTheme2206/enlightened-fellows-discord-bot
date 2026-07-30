# Set Builder API Design

Status: agreed v1 design. This document describes contracts and boundaries; it is not an implementation record.

## Scope

Set Builder is independent from Set Search. It lets a browser compose and locally retain a partial or complete Build, then explicitly save it. A Build supports up to five body armor pieces, an optional scraped or custom talisman, and type-compatible decorations. It has no weapon equipment or inventory model, but a Custom Talisman's weapon slot and weapon decorations are fully supported.

The browser owns Working Build state and calculation. The API owns catalog truth, Save validation, trusted self-contained snapshots, persistence, ownership, link reads, and shared-list discovery. Build responses contain no aggregate skill, bonus, defense, or resistance totals; web and bot calculate those from the snapshot.

## Internal boundaries

- `mh-wilds-catalog` owns armor, decorations, ordinary Skills, Set/Group Bonuses, stable identities, active status, and insert-only scraping.
- `set-builder` owns Build contracts, validation, snapshot construction, limits, optimistic concurrency, sharing, and persistence.
- `set-search` remains an independent optimizer that consumes catalog reads but does not share Set Builder request/result models.
- `talismans` continues to own Custom Talisman management. Set Builder may read and snapshot an authenticated owner's talisman during Save.
- API and future bot handlers call domain services; neither reaches into repositories directly, and the bot does not call this process's HTTP API.

## HTTP surface

All routes retain the existing unversioned `/api/mh-wilds` convention.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/armors` | Public | Complete active armor/scraped-talisman catalog |
| `GET` | `/decorations` | Public | Complete active decoration catalog |
| `GET` | `/skills` | Public | Complete ordinary Skill and Set/Group Bonus catalog |
| `GET` | `/builds` | JWT | All summaries owned by the caller |
| `POST` | `/builds` | JWT | Explicitly save a Working Build |
| `GET` | `/builds/shared` | Public | Cursor-paginated Shared Build summaries |
| `GET` | `/builds/:id` | Public by UUID | One identity-free full Saved Build snapshot |
| `PUT` | `/builds/:id` | Owner JWT | Replace the full composition and metadata |
| `PATCH` | `/builds/:id` | Owner JWT | Change name, description, or sharing state only |
| `DELETE` | `/builds/:id` | Owner JWT | Permanently delete the Build |

There is no standalone validation route. The frontend validates its Working Build locally; create and composition update repeat authoritative structural/reference validation before writing.

## Catalog contracts

Catalog collections are returned in full and are not paginated. Ordinary HTTP caching and ETags may be used, but there is no domain-level Catalog Version.

`GET /armors` returns active items enriched with everything the builder needs: stable ID, name, position type, rank, rarity, base defense, elemental resistances, typed slots, ordinary Skill grants, and Set/Group Bonus memberships.

`GET /decorations` returns stable ID, name, armor/weapon type, required slot size, and every Skill grant. Decorations are multi-grant: persistence uses `decoration_skill`, not the current singular `decoration.skillId/skillLevel` fields.

`GET /skills` intentionally breaks the current flat response and returns distinct collections:

```json
{
  "skills": [
    { "id": "uuid", "name": "Attack Boost", "kind": "armor", "maxLevel": 5 }
  ],
  "bonuses": [
    {
      "id": "uuid",
      "name": "Example Set Bonus",
      "kind": "set",
      "thresholds": [
        { "piecesRequired": 2, "effectName": "Example Effect", "level": 1 }
      ]
    }
  ]
}
```

Set/Group Bonuses are separate catalog entities rather than special Skill rows. Their ordered thresholds are preserved from the source.

## Save request

All six position keys are required and use `null` for an empty position. The request contains references and assignments only; callers cannot submit trusted component values.

```json
{
  "name": "My Build",
  "description": "Plain text only",
  "isShared": false,
  "composition": {
    "head": null,
    "chest": {
      "armorId": "uuid",
      "decorations": [
        { "slotIndex": 0, "decorationId": "uuid" }
      ]
    },
    "arms": null,
    "waist": null,
    "legs": null,
    "talisman": {
      "source": "custom",
      "talismanId": "uuid",
      "decorations": []
    }
  }
}
```

`POST /builds` requires an `Idempotency-Key` UUID scoped to the authenticated Discord ID. Retrying the same key and payload returns the original Build; reusing it with different content returns `409 IDEMPOTENCY_KEY_REUSED`. The server generates the unguessable Build UUID.

Create accepts partial compositions and may create a Shared Build immediately if the owner remains within the shared limit.

## Save validation and snapshot construction

Create and `PUT` validate atomically that:

- every referenced catalog item exists and is active;
- each armor ID matches its fixed body position;
- a Custom Talisman belongs to the authenticated caller;
- each decoration targets one existing slot index at most once;
- decoration armor/weapon type matches the target slot type;
- the target slot size is at least the decoration's required size;
- metadata satisfies its plain-text and length constraints;
- owner and sharing limits are not exceeded.

Missing equipment and empty decoration slots are valid. Duplicate decoration types are valid because inventory quantities are not modeled.

After validation, the backend constructs `schemaVersion: 1` JSONB from backend-owned data. The snapshot is self-contained and contains selected component values, assignments, Skill names/maxima, and referenced Bonus thresholds. It never trusts caller-supplied stats or grants.

## Build representation

A full Build response is identical for owners and anonymous UUID readers. It includes:

- UUID, name, optional description, `isShared`, `sharedAt`, timestamps, and integer `revision`;
- computed stale status;
- the self-contained, schema-versioned composition snapshot;
- no Discord ID, owner profile, idempotency key, internal fields, or aggregate totals.

Names are 1–100 Unicode characters. Descriptions are optional and at most 1,000 characters. Both are always plain text, are escaped on the web, and are rendered by the bot with mentions disabled. Names need not be unique.

The public UUID is a read capability. Every Saved Build is link-readable without a separate visibility state. `isShared` controls listing discovery only.

## Lifecycle and concurrency

- Builds do not expire.
- Build Links follow the owner's latest explicitly saved edit; there is no revision history.
- `PUT` replaces the entire composition; `PATCH` changes metadata/sharing without rebasing a stale composition.
- Every mutation supplies the loaded integer revision. A mismatch returns `409 REVISION_CONFLICT`; successful mutation increments it. The service does not merge.
- Owner deletion is permanent and makes web/bot UUID lookups return `404`.
- A deleted Custom Talisman remains embedded in existing Build snapshots and makes those Builds stale.
- A stale or partial Build remains link-readable, bot-renderable, and eligible for sharing.
- Composition updates to stale Builds must replace/revalidate inactive references against the current catalog.

## Ownership, limits, and discovery

User ownership uses the Discord ID from the verified Supabase JWT, following ADR-0003 and ADR-0004. Only the owner may create, mutate, share/unshare, or delete a Build. There is no admin moderation endpoint in v1.

- Maximum 50 Saved Builds per Discord ID.
- Maximum 5 Shared Builds per Discord ID.
- Owner list returns all summaries, ordered by `updatedAt DESC`, then UUID.
- Shared list returns 20 summaries by default, accepts at most 50, and uses a stable cursor ordered by `sharedAt DESC`, then UUID.
- Editing does not move a Shared Build. Unsharing and resharing assigns a new `sharedAt`.
- List endpoints return summaries; only UUID detail returns the full composition.
- Public responses never expose owner identity.

## Bot boundary

There is no broadcast workflow in v1. A future `/mh-build <build_id>` command may render any Build whose UUID is supplied, whether shared or unshared. Autocomplete must not enumerate another owner's unshared Builds. The bot loads the Saved Build through the Set Builder domain service and calculates its display from the stored snapshot on demand.

## Errors

Set Builder uses stable machine-readable errors:

```json
{
  "error": {
    "code": "DECORATION_SLOT_TOO_SMALL",
    "message": "The selected decoration does not fit this slot.",
    "details": { "position": "chest", "slotIndex": 0 }
  }
}
```

- `400`: malformed request schema
- `401`: missing/invalid authentication
- `403`: authenticated caller does not own the Build or Custom Talisman
- `404`: Build or component does not exist
- `409`: revision conflict, idempotency-key conflict, or per-user limit
- `422`: well-formed composition rejected by domain validation
- `429`: rate limit, with `Retry-After`

## Persistence

`saved_build` is one aggregate row:

- `id` (server-generated UUID)
- `user_id`
- `name`
- nullable `description`
- `is_shared`
- nullable `shared_at`
- `revision`
- `idempotency_key`
- `idempotency_payload_hash`
- `composition` JSONB
- `created_at`, `updated_at`

Use unique `(user_id, idempotency_key)` and retain the create-payload hash so key reuse can be distinguished from a retry even after the Build is edited. Add indexes for owner ordering and `(is_shared, shared_at, id)` listing. The JSONB snapshot has no foreign keys to catalog rows. Staleness is derived by comparing its stable references with active catalog/custom-talisman sources; it is not an aggregate calculation result stored in the API contract. Deleting a Build also removes its idempotency record, so intentionally saving the same local composition later may create a new Build and UUID.

## Catalog ingestion and migration

The current destructive scraper must be replaced before Saved Builds rely on catalog IDs:

1. Preflight every Custom Talisman Skill ID; any orphan blocks migration for manual repair.
2. Preserve all valid existing armor, decoration, Skill, and relationship UUIDs.
3. Match future scraped items by durable upstream identity when available, otherwise a canonical type/name identity.
4. Insert new identities; leave identical existing data unchanged; retain items missing from later scrapes.
5. Treat any difference for an existing identity as a conflict that rejects the entire scrape transaction and is logged for operator review.
6. Apply corrections or retirement only through an explicit operator-controlled change.
7. Migrate singular decoration grants into `decoration_skill` and re-import all source grants.
8. Migrate Set/Group Skill rows into separate bonus, threshold, and armor-membership records, re-importing threshold data currently discarded by the scraper.

## Operational defaults

- Catalog/public reads: 120 requests/minute/IP.
- Authenticated Build mutations: 30 requests/minute/Discord ID.
- Catalog collections use HTTP caching and ETags as ordinary transport optimizations.
- Scrape conflicts and migration-integrity failures are structured job-log failures.
- The existing expensive Set Search limiter remains independent.
