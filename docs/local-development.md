# Local development with Docker Postgres

The API uses the project's Docker Postgres database. Supabase remains the hosted
**Auth provider** for sign-in; the frontend and backend must use the same hosted
Supabase project. The local Supabase CLI stack is not needed.

## Database

Start the Postgres container you already use for this project and confirm its
port is available (the current setup publishes `127.0.0.1:5432`). Set both
`DATABASE_URL` and `DIRECT_URL` to that database in the backend `.env`. Keep
your existing credentials; do not replace them with values from an example.

Run `bun run db:migrate` after pulling schema changes. Drizzle owns the app
tables. Migration `0007_catalog_reset` deliberately refuses to reset a catalog
that has custom talismans, because their skill IDs would be orphaned. Preserve
and remap those talismans before applying it; do not reset the database to get
past the guard.

## API

The backend `.env` also needs the hosted `SUPABASE_URL` used by the frontend.
Use `WEB_PORT=...` when the default port `3003` is occupied.

```bash
bun run dev:api  # API, catalog seed, and scheduled refresh, without Discord login
bun run dev      # Full Discord bot and API
```

The daily catalog refresh uses `CATALOG_REFRESH_CRON` (default `0 4 * * *`
UTC). The bot starts it from the Discord ready handler; `dev:api` starts it
without Discord. The initial boot seeds an empty catalog from wilds.mhdb.io.

## Frontend

Set `BUN_PUBLIC_API_BASE_URL` to the API origin. Set
`BUN_PUBLIC_SUPABASE_URL` and `BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the
**same hosted Auth project** the backend verifies through `SUPABASE_URL`.
Restart the frontend after changing these values, since they are embedded in
the browser build.
