/**
 * Mints a local Supabase access token carrying `app_metadata.discord_id` (docs/local-development.md).
 * Creates the test user on first run, then signs in with its password through GoTrue, so the
 * Custom Access Token hook (ADR-0003) runs exactly as it does for a Discord login.
 *
 *   bun scripts/local-token.ts [discordId]      # prints the access token only
 *
 * Env overrides: LOCAL_DISCORD_ID, LOCAL_TEST_EMAIL, LOCAL_TEST_PASSWORD. Keys and URL come from
 * `supabase status -o env` (local-only default keys; never run this against a hosted project).
 */
import { $ } from 'bun'

const status = Object.fromEntries(
  (await $`supabase status -o env`.quiet().text())
    .split('\n')
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => [m[1], m[2]]),
)

const apiUrl = status.API_URL
const publishableKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY
const adminKey = status.SERVICE_ROLE_KEY ?? status.SECRET_KEY
if (!apiUrl || !publishableKey || !adminKey) {
  throw new Error('Could not read keys from `supabase status -o env`. Is local Supabase running?')
}

const discordId = process.argv[2] ?? process.env.LOCAL_DISCORD_ID ?? '100000000000000001'
const email = process.env.LOCAL_TEST_EMAIL ?? `discord-${discordId}@local.test`
const password = process.env.LOCAL_TEST_PASSWORD ?? 'local-dev-password'

const createRes = await fetch(`${apiUrl}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: adminKey, Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    app_metadata: { discord_id: discordId },
    user_metadata: { name: `Local Hunter ${discordId.slice(-4)}`, avatar_url: null },
  }),
})
// 422 = user already exists from a previous run, which is fine.
if (!createRes.ok && createRes.status !== 422) {
  throw new Error(`Create user failed: ${createRes.status} ${await createRes.text()}`)
}

const tokenRes = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
if (!tokenRes.ok) throw new Error(`Sign-in failed: ${tokenRes.status} ${await tokenRes.text()}`)

const { access_token } = (await tokenRes.json()) as { access_token: string }
console.log(access_token)
