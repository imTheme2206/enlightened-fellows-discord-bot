# Adding a database table

How to add a new table to the schema, migrate it, and wire it into the app. The
running example is a `favorite_set` table — a user bookmarking an armor build —
which mirrors the existing `search_history` pattern (Discord-user-scoped, JSON
payload, timestamp).

Stack: **Drizzle ORM + Postgres (Supabase)**. The schema is the single source of
truth; migrations are generated from it, never hand-written.

## 1. Define the table — `src/infra/db/schema.ts`

Add a `pgTable` export. Follow the conventions already in the file:

- **camelCase** export + column keys, **snake_case** DB column names.
- **`text('id').primaryKey()`** for the PK — there is no DB default, so the
  application generates the id (`randomUUID()` in the repository, see step 4).
- `.notNull()`, `.unique()`, `.default(...)` as needed.
- Timestamps: `timestamp('...', { withTimezone: true }).notNull().defaultNow()`.
- JSON payloads: `jsonb('...').$type<MyShape>()` to get a typed column.
- Foreign keys: `.references(() => other.id, { onDelete: 'cascade' })`.
- Composite primary key (join tables): pass a second arg
  `(t) => [primaryKey({ columns: [t.a, t.b] })]`.

```ts
// Shape of the typed jsonb column — declared alongside the table and exported
// so the repository/service can reuse it.
export type SavedBuild = { armorIds: string[]; decorationIds: string[] }

export const favoriteSet = pgTable('favorite_set', {
  id: text('id').primaryKey(),
  // Discord snowflake — intentionally text, not a FK to auth.users (see search_history).
  userId: text('user_id').notNull(),
  label: text('label').notNull(),
  build: jsonb('build').$type<SavedBuild>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

> If you import a column helper not yet used in the file (e.g. `jsonb`,
> `timestamp`), add it to the top-of-file import from `drizzle-orm/pg-core`.

## 2. Export inferred types

At the bottom of `schema.ts`, export the select/insert types. **Always use these
instead of hand-written interfaces** — repositories and services depend on them.

```ts
export type FavoriteSet = typeof favoriteSet.$inferSelect
export type NewFavoriteSet = typeof favoriteSet.$inferInsert
```

The new table is automatically available for relational queries as
`db.query.favoriteSet`, because `infra/db/client.ts` passes the whole schema
module to `drizzle(client, { schema })`.

## 3. Generate the migration

```bash
bun run db:generate
```

This diffs `schema.ts` against the current migrations and writes a new SQL file +
snapshot under `drizzle/`. **Open the generated `.sql` and read it** — confirm it
creates exactly the table/columns/constraints you expect (especially FK
`on delete cascade` and any `not null` on existing tables, which can fail against
rows already present).

Commit the generated files in `drizzle/` together with the `schema.ts` change.

## 4. Apply the migration

```bash
bun run db:migrate
```

- Locally/dev this runs against **`DIRECT_URL`** (direct Postgres, set in
  `drizzle.config.ts`) — not the runtime pooler.
- In **production it runs automatically** as the Fly `release_command` on deploy,
  so you don't migrate prod by hand.
- Runtime queries use **`DATABASE_URL`** (the Supabase transaction pooler,
  `prepare: false`). Migrations must not use the pooler — hence the URL split.

## 5. Wire it into a domain

Create (or extend) a domain so the table is reachable through the
`service → repository` boundary. Routes and bot code never touch `db` directly.

`src/domains/favorite-sets/repository.ts` — all DB access. Generate the `id` here
since the PK has no DB default:

```ts
import { randomUUID } from 'crypto'
import { desc } from 'drizzle-orm'
import { db } from '../../infra/db/client'
import { favoriteSet, type FavoriteSet, type SavedBuild } from '../../infra/db/schema'

export abstract class FavoriteSetRepository {
  static async insert(userId: string, label: string, build: SavedBuild): Promise<void> {
    await db.insert(favoriteSet).values({ id: randomUUID(), userId, label, build })
  }

  static async findByUser(userId: string, limit: number): Promise<FavoriteSet[]> {
    return db.query.favoriteSet.findMany({
      where: (t, { eq }) => eq(t.userId, userId),
      orderBy: (t) => [desc(t.createdAt)],
      limit,
    })
  }
}
```

`src/domains/favorite-sets/service.ts` — the public API (defaults, rules,
orchestration), reused by both the API and the bot:

```ts
import type { FavoriteSet } from '../../infra/db/schema'
import { FavoriteSetRepository } from './repository'

export abstract class FavoriteSetService {
  static save(userId: string, label: string, build: SavedBuild): Promise<void> {
    return FavoriteSetRepository.insert(userId, label, build)
  }

  static list(userId: string, limit = 20): Promise<FavoriteSet[]> {
    return FavoriteSetRepository.findByUser(userId, limit)
  }
}
```

## 6. Expose it (optional)

- **Over HTTP:** add a route + Zod contract — see
  [`adding-an-api-route.md`](adding-an-api-route.md). For a table-backed response,
  derive the contract with `createSelectSchema(favoriteSet)`.
- **From the bot:** import the service in a command/job. The DB is already
  reachable because the service goes through the repository.

## Gotchas

- **App-generated ids.** `text('id').primaryKey()` has no DB default. Every insert
  must pass `id: randomUUID()` — forgetting it is a runtime error, not a type
  error (insert types treat `id` as required, so TS will actually catch it if you
  use the generated `New*` type).
- **Don't put user data in the set-search tables.** `armor`, `skill`,
  `decoration`, `armor_*` are **fully wiped and replaced** on every scrape
  (`domains/set-search/scraper`). Anything user-owned (like `favorite_set`) must
  be its own table.
- **Boot seeding only checks `armor`.** `db-init` (`seedOnBoot`) reseeds when the
  `armor` table is empty; it does not touch other tables. New tables start empty
  and are populated by their own code paths.
- **`not null` on a column added to a populated table** needs a default or a
  backfill, or the migration fails on existing rows. Review the generated SQL.
- **Snake_case the DB name, camelCase the key** — mismatching these is the most
  common schema mistake.
```
