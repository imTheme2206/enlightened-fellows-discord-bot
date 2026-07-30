# Frontend plan — MH Wilds web dashboard

The backend is feature-complete for the web builder flow. This is the plan for the
frontend (the `dashboard/` SPA that Elysia serves from `dashboard/dist` with SPA
fallback — see `CLAUDE.md` → Web API). No frontend exists yet; this is greenfield.

> **Open decision — stack.** Nothing is built, so pick one. Recommendation:
> **React + Vite + TypeScript**, output to `dashboard/dist` (matches the static-serve
> path the API already expects), with `@supabase/supabase-js` for auth and TanStack
> Query for server-state. The API-integration sections below are stack-agnostic; swap
> React for Nuxt/Vue with no change to contracts.

---

## 1. What the backend already gives you

Base URL in prod is same-origin (`/api/...`); local dev is `http://localhost:3003`.

### Public (no auth)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness |
| GET | `/api/mh-wilds/armors` | full armor catalog (id, slots, skills, bonuses, resistances) |
| GET | `/api/mh-wilds/decorations` | decoration catalog (id, slotSize, type armor/weapon, skills) |
| GET | `/api/mh-wilds/skills` | `{ skills[], bonuses[] }` — skills (name→maxLevel) + set/group bonuses w/ ordered thresholds |
| POST | `/api/mh-wilds/search` | run the set-search DFS (rate-limited 10/min/IP); bearer optional (adds caller's custom talismans) |
| GET | `/api/mh-wilds/builds/shared?limit&cursor` | cursor-paginated shared builds (summaries) |
| GET | `/api/mh-wilds/builds/:id` | one build by UUID = the shareable read link (ADR-0006) |

### Owner-authenticated (Supabase JWT → `Authorization: Bearer <token>`)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/mh-wilds/builds` | list caller's own builds (summaries, incl. `isStale`) |
| POST | `/api/mh-wilds/builds` | create — **requires `Idempotency-Key: <uuid v4>` header** |
| PUT | `/api/mh-wilds/builds/:id?revision=N` | replace composition — optimistic concurrency |
| PATCH | `/api/mh-wilds/builds/:id?revision=N` | metadata/sharing only (name, description, isShared) |
| DELETE | `/api/mh-wilds/builds/:id` | delete own build |
| GET | `/api/talismans` | list caller's custom talismans |
| POST | `/api/talismans` | create custom talisman |
| DELETE | `/api/talismans/:id` | delete custom talisman |

Contracts are the Zod schemas in `src/domains/*/schema.ts` and
`src/domains/mh-wilds-catalog/schema.ts`. An OpenAPI doc is mounted at
**`/openapi`** — generate a typed client from it, or share the inferred TS types
if the frontend lives in the same repo.

---

## 2. Auth model (ADR-0003 / ADR-0004)

- Frontend signs in with **Supabase Auth → Discord OAuth provider**.
- A Supabase **Auth Hook** stamps `app_metadata.discord_id` into the minted JWT.
- The API verifies that JWT **locally against Supabase JWKS** (`user-auth-guard.ts`)
  and derives the caller's Discord ID. **There is no admin bypass** for these routes.
- Frontend responsibility: hold the Supabase session, attach
  `Authorization: Bearer <access_token>` to every owner/talisman call, refresh the
  token before expiry, and treat `401 { error: { code: 'UNAUTHORIZED' } }` as
  "sign in required".

Frontend needs `SUPABASE_URL` + the Supabase **anon key** (public) as build-time env.

---

## 3. The client-side calculator (the meatiest piece)

**The API intentionally never returns aggregate totals** (ADR-0010). The build
snapshot embeds everything the frontend needs to compute them itself:

- `composition.positions.*` — each piece's `skills`, `bonuses`, `slots`, `decorations`, `defense`, `resistances`.
- `composition.skillDefinitions` — `name → maxLevel` for effective-level capping.
- `composition.bonusDefinitions` — `name → { kind, thresholds[] }` for set/group activation.

Build one pure, well-tested module that computes, from a snapshot (or from an
in-progress builder state shaped the same way):

1. **Effective skill levels** — sum skill levels across all armor + decorations + talisman + granted bonus effects, then cap each at `skillDefinitions[name]`.
2. **Bonus activation** — count pieces per set/group bonus, compare against `bonusDefinitions[name].thresholds`, surface which tier is active and the granted effect.
3. **Defense + elemental resistance totals** — sum across equipped pieces.

This same calculator drives both the **builder live preview** and the read-only
**shared build view**, so isolate it from React and unit-test it against the
snapshot schema.

---

## 4. Screens / flows to build

1. **Catalog data layer** — fetch + cache `armors`, `decorations`, `skills` once (they change only on a scrape). Index by id for O(1) lookups.
2. **Set search** — form (regular skills + levels, set bonuses, group bonuses, rank) → `POST /search` → enriched result list. Mirrors the Discord `/search-set` command; reuse the calculator to render totals.
3. **Set builder** (core):
   - Per-position armor pickers (head/chest/arms/waist/legs) + talisman picker (source `scraped` from catalog, or `custom` from `/talismans`).
   - Decoration assignment per slot: validate slot **size** and **type** (armor/weapon) client-side for UX — the backend re-validates and is authoritative.
   - Live totals via the §3 calculator.
   - **Save** → `POST /builds` with a fresh `Idempotency-Key` (uuid v4) per save action; reuse the same key on network retry. Handle `IDEMPOTENCY_KEY_REQUIRED`, `SAVED_BUILD_LIMIT_REACHED` (cap 50), and validation errors.
   - **Edit composition** → `PUT /builds/:id?revision=<current>`; on `409 REVISION_CONFLICT` refetch, show a conflict prompt, rebase.
   - **Edit metadata / share toggle** → `PATCH` (share cap = 5, `SHARED_BUILD_LIMIT_REACHED`).
   - **Delete** → `DELETE /builds/:id`.
4. **My builds** — `GET /builds`; render `isStale` badge (catalog changed since last save) with a "re-open & re-save to refresh" affordance.
5. **Shared gallery** — `GET /builds/shared` with cursor pagination ("load more" via `nextCursor`, stop when `null`).
6. **Build permalink** `/b/:id` — `GET /builds/:id`, read-only render of the snapshot (works anonymously; the UUID *is* the capability), with "duplicate into my builds".
7. **Custom talismans manager** — list / create / delete via `/api/talismans`; feeds the builder's `source: 'custom'` talisman option.

---

## 5. Cross-cutting contracts the frontend must honor

- **Error envelope**: `{ error: { code, message } }` on domain failures; map `code` → UX (409 conflict, 401 sign-in, 400 malformed, limit codes → toast).
- **Idempotency**: only `POST /builds` requires the header; generate uuid v4, persist it across retries of the *same* logical save.
- **Optimistic concurrency**: always send the `revision` you last read on PUT/PATCH; never blind-write.
- **Staleness is advisory**: `isStale: true` means "catalog moved under this snapshot" — never blocks reads; prompt a re-save.
- **No trusted stats from client**: the Save request carries only references + decoration slot assignments (ADR-0005). Never send computed levels/defense — the backend rebuilds the trusted snapshot.

---

## 6. Suggested build order (tracer-bullet)

1. Vite app scaffold → builds to `dashboard/dist`; wire dev proxy to `:3003`.
2. Catalog data layer + typed API client (from `/openapi`).
3. §3 calculator module + unit tests (no UI).
4. Supabase Discord sign-in + authed fetch wrapper.
5. Builder read-only permalink `/b/:id` (proves the snapshot → calculator → render path end-to-end).
6. Builder editor + Save/PUT/PATCH/Delete with idempotency & revision handling.
7. My-builds list + staleness, shared gallery, custom-talisman manager.
8. Set-search screen.
