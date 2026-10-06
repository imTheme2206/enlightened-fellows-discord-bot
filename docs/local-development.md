# Local development against a local Supabase

Run the whole stack (API + web app) against a local Supabase instead of the hosted project.
Requires the `supabase` CLI and Docker. Local Supabase uses ports 54321-54329, so it does not
clash with another Postgres on 5432.

Ownership: **drizzle owns the app tables** (`drizzle/`, `bun run db:migrate`). **Supabase
migrations (`supabase/migrations/`) own only the Auth hook** (ADR-0003).

## 1. Start Supabase

```bash
supabase start      # Postgres :54322, API/Auth :54321, Studio :54323, Mailpit :54324
supabase status     # prints the URLs and keys used below
```

`supabase start` applies `supabase/migrations/*`, which creates
`public.custom_access_token_hook`; `supabase/config.toml` enables it under
`[auth.hook.custom_access_token]`. It stamps `app_metadata.discord_id` into every access token
(from the user's Discord identity, falling back to an existing `app_metadata.discord_id`, which is
how password test users work).

## 2. Point the backend at it

The real `.env` may hold hosted values, so use `.env.local` (gitignored; Bun loads it over `.env`):

```bash
cat > .env.local <<'EOF'
DISCORD_TOKEN=local-dummy
DISCORD_CLIENT_ID=local-dummy
SUPABASE_URL=http://127.0.0.1:54321
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
CORS_ORIGIN=http://localhost:3002
EOF
```

Add `WEB_PORT=...` if 3003 is taken. Delete or rename `.env.local` to go back to the hosted project.

## 3. Migrate and boot

```bash
bun run db:migrate   # drizzle migrations -> local DB (run `supabase db reset` first if you want a clean slate)
bun run dev:api      # API only (src/api/dev.ts): no Discord login, so no real bot token needed
```

On first boot the `armor` table is empty, so the boot scrape fetches wilds.mhdb.io and seeds the
catalog (about 140 skills, 900 armor pieces, 360 decorations; takes a few seconds). Use
`bun run dev` instead to run the full Discord bot as well (needs a real `DISCORD_TOKEN`).

Note: `supabase db reset` recreates the database, **including the drizzle tables** - re-run
`bun run db:migrate` and restart the API afterwards.

```bash
curl localhost:3003/api/mh-wilds/skills    # 200, seeded data
curl localhost:3003/api/mh-wilds/armors    # 200, seeded data
```

### Scheduled catalog refresh

A daily job (`CATALOG_REFRESH_CRON`, default `0 4 * * *` UTC) re-fetches wilds.mhdb.io and
reconciles equipment (ADR-0007) and monsters (ADR-0015); unchanged payloads are skipped via
`catalog_sync_state` hashes (ADR-0016). In production it is started by the Discord `ready` handler
(the single bot+API process, `src/index.ts`); `bun run dev:api` starts it too, so it also runs
locally without Discord. To try it, set `CATALOG_REFRESH_CRON="* * * * *"` in `.env.local`, restart,
and look for `scraper:cron` / `scraper:cron:monsters` rows via `GET /api/job-logs` (admin token) or the
`job_log` table. The second run should log `{"unchanged":true}` for both.

## 4. Get a test JWT without Discord

```bash
TOKEN=$(bun scripts/local-token.ts)               # discord_id 100000000000000001
TOKEN=$(bun scripts/local-token.ts 123456789012345678)   # a different Discord id

curl -i localhost:3003/api/mh-wilds/builds                              # 401
curl -i -H "Authorization: Bearer $TOKEN" localhost:3003/api/mh-wilds/builds   # 200
```

The script creates (once) a confirmed user with `app_metadata.discord_id` via the local admin API,
then signs in with its password through GoTrue, so the token goes through the same hook as a real
login. It reads URL/keys from `supabase status -o env` and only makes sense locally.

## 5. Point the frontend at it

In the `mhwilds-loadout-optimizer` repo, create a gitignored `.env.local`:

```bash
BUN_PUBLIC_API_BASE_URL=http://localhost:3003
BUN_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<"Publishable" key from `supabase status`>
```

Then `bun run dev` (restart after changing env: values are inlined at build time). The Supabase
`site_url` / redirect allow-list in `config.toml` cover `localhost:3002` and `localhost:3102`.

## 6. Discord OAuth locally (optional)

Create a Discord application with redirect URI `http://127.0.0.1:54321/auth/v1/callback`, then put
its credentials in `supabase/.env` (see `supabase/.env.example`) and `supabase stop && supabase start`.
Never commit these.

## Troubleshooting

- `bun run db:migrate` uses `bun --bun drizzle-kit`: under plain Node, drizzle-kit exits 1 with no
  message against this setup.
- Tokens signed by local Supabase only verify against local `SUPABASE_URL` (JWKS), never the
  hosted API, and vice versa.
