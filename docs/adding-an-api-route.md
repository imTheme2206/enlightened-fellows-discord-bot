# Adding an API route

How to add a new HTTP endpoint to the Elysia API, following the project's
layered (DDD-lite) structure. The running example is `GET /api/skills`, which
lists rows from the `skill` table.

## The layers a request flows through

```
HTTP request
  → api/routes/<name>.ts      validate input/output (Zod), no business logic, no SQL
  → domains/<name>/service.ts business rules / public API used by BOTH api and bot
  → domains/<name>/repository.ts   all Drizzle/DB access lives here
  → infra/db/client.ts        Postgres connection
```

Dependency direction is one-way: **`api/` → `domains/` → `infra/`**. A route must
never import `infra/db` or write SQL directly — it goes through a domain service.
The same domain service is reused by the bot, so anything you put in `service.ts`
is automatically available to slash commands and cron jobs too.

## Steps

### 1. Domain repository — `src/domains/<name>/repository.ts`

All DB access. Static methods on an `abstract class`, named for the data operation
(`findAll`, `findOne`, `insert`, `markAlerted`, …). Return Drizzle-inferred types
from `infra/db/schema` — never hand-rolled interfaces.

```ts
import { and, asc, eq, type SQL } from 'drizzle-orm'
import { db } from '../../infra/db/client'
import { skill, type Skill } from '../../infra/db/schema'

export abstract class SkillRepository {
  static async findAll(filter: { type?: string; setSkill?: boolean } = {}): Promise<Skill[]> {
    const conditions: SQL[] = []
    if (filter.type !== undefined) conditions.push(eq(skill.type, filter.type))
    if (filter.setSkill !== undefined) conditions.push(eq(skill.isSetSkill, filter.setSkill))

    return db
      .select()
      .from(skill)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(skill.name))
  }
}
```

### 2. Domain schema (the Zod contract) — `src/domains/<name>/schema.ts`

The single source of truth for what the endpoint accepts and returns. For a
read endpoint backed by a table, derive the response shape from Drizzle with
`drizzle-zod` so the contract can never drift from the table:

```ts
import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { skill } from '../../infra/db/schema'

export const skillSchema = createSelectSchema(skill)   // response shape, from the table
export type SkillDto = z.infer<typeof skillSchema>
export const skillsResponseSchema = z.array(skillSchema)

export const skillQuerySchema = z.object({
  type: z.enum(['armor', 'weapon']).optional(),
  setSkill: z.stringbool().optional(),                 // "true"/"false" → boolean
})
export type SkillQuery = z.infer<typeof skillQuerySchema>
```

Notes:
- Elysia (v1.4) consumes Zod directly via **Standard Schema** — no adapter needed
  since the project is on Zod 4. Use these schemas as-is in the route.
- `createSelectSchema` / `createInsertSchema` only fit when the wire shape **is**
  the table. For a write endpoint, `.omit({ id: true, … })` the columns clients
  must not set. For a payload that is *not* a table (e.g. the future set-search
  query), hand-write a plain `z.object({ … })` instead.
- Query string values arrive as strings — use `z.stringbool()` / `z.coerce.*` for
  non-string params rather than `z.boolean()`.
- The exported `SkillDto` type is what the **web app** reuses to type and validate
  its fetch (and feed `zodResolver` in react-hook-form).

### 3. Domain service — `src/domains/<name>/service.ts`

Business rules + the public API. For a thin endpoint it just delegates; it's also
where defaults, derived values, and orchestration live. Consumed by both the route
and the bot.

```ts
import type { Skill } from '../../infra/db/schema'
import { SkillRepository } from './repository'
import type { SkillQuery } from './schema'

export abstract class SkillService {
  static getAll(query: SkillQuery = {}): Promise<Skill[]> {
    return SkillRepository.findAll(query)
  }
}
```

### 4. Route — `src/api/routes/<name>.ts`

Wire the schemas to Elysia. No logic beyond calling the service.

```ts
import { Elysia } from 'elysia'
import { SkillService } from '../../domains/skills/service'
import { skillQuerySchema, skillsResponseSchema } from '../../domains/skills/schema'

export const skillsRoutes = new Elysia().get('/skills', ({ query }) => SkillService.getAll(query), {
  query: skillQuerySchema,
  response: skillsResponseSchema,
})
```

Elysia validates `query` before the handler runs (invalid input → `422`, handler
never called) and validates `response` on the way out.

For interactive components with a `customId`, that's a **bot** concern, not a
route — see `bot/events/interaction-create.ts`.

### 5. Mount it — `src/api/index.ts`

Add the import and `.use()` it inside the `/api` group so it inherits the auth
guard:

```ts
import { skillsRoutes } from './routes/skills'
// ...
.group('/api', (app) =>
  app
    .onBeforeHandle(authGuard)
    // ...existing routes
    .use(skillsRoutes)
)
```

### 6. Test the contract — `src/api/routes/__tests__/<name>.test.ts`

Mock the service so no DB is needed, then drive the route with `handle()` to prove
the validation wiring works. Cover: happy path, query coercion, and a rejected
input (`422`).

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getAll = vi.fn()
vi.mock('../../../domains/skills/service', () => ({
  SkillService: { getAll: (q?: unknown) => getAll(q) },
}))
const { skillsRoutes } = await import('../skills')
const req = (url: string) => skillsRoutes.handle(new Request(`http://localhost${url}`))

describe('GET /skills', () => {
  beforeEach(() => getAll.mockResolvedValue([/* a row matching skillSchema */]))

  it('coerces query params', async () => {
    await req('/skills?type=armor&setSkill=true')
    expect(getAll).toHaveBeenCalledWith({ type: 'armor', setSkill: true })
  })

  it('rejects invalid input', async () => {
    const res = await req('/skills?type=bogus')
    expect(res.status).toBe(422)
  })
})
```

Run: `bunx vitest run src/api/routes/__tests__/skills.test.ts`

## Before you finish

- `bun run build` — esbuild resolves every import; catches broken paths.
- `bun run lint` — must be clean.
- `bunx vitest run` — your new test green (note: the existing set-search test has
  a pre-existing, unrelated failure).

## Gotchas

- **Auth:** everything under `.group('/api')` sits behind `authGuard`
  (`WEB_ADMIN_TOKEN`; unset = open). Don't ship that token to a browser SPA — for
  public reference data, expose the route outside the guard like `/api/health`.
- **CORS:** a separately-hosted web app needs `@elysiajs/cors`. The bundled
  `dashboard/dist` is same-origin and doesn't.
- **No SQL above the domain layer.** If you're tempted to query the DB from a
  route or a bot command, add a repository method instead.
- **Sharing types with the web app:** copy the Zod schema for now; the clean
  long-term path is a `packages/` monorepo split so bot/api/web import one schema.
```
