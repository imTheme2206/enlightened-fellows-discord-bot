import { createRemoteJWKSet, jwtVerify } from 'jose'
import { config } from '../../infra/config'

const jwks = createRemoteJWKSet(new URL(`${config.SUPABASE_URL}/auth/v1/.well-known/jwks.json`))

/**
 * The authenticated caller's Discord identity, as carried by the Supabase JWT.
 * `discordId` is the snowflake stamped into `app_metadata.discord_id` by the
 * Auth Hook (ADR-0003); `displayName` / `avatarUrl` come from the OAuth
 * `user_metadata` Supabase populates from Discord and are best-effort — either
 * may be null if a token omits the claim.
 */
export type DiscordIdentity = {
  discordId: string
  displayName: string | null
  avatarUrl: string | null
}

/**
 * Verifies a Supabase-issued JWT locally against the project's JWKS (no
 * network call to Supabase's auth server) and returns the caller's Discord
 * identity. The `discord_id` claim is required — without it the caller is
 * unauthenticated and this returns `null`; the display name and avatar are
 * optional enrichment read from `user_metadata`. Returns `null` if the token is
 * missing, invalid, or lacks the Discord ID claim.
 */
export async function verifyIdentity(authHeader: string | null): Promise<DiscordIdentity | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, jwks)
    const appMetadata = payload.app_metadata as Record<string, unknown> | undefined
    const discordId = appMetadata?.discord_id
    if (typeof discordId !== 'string' || discordId.length === 0) return null

    const userMetadata = payload.user_metadata as Record<string, unknown> | undefined
    return {
      discordId,
      // Discord's global/display name first, then the legacy username field.
      displayName: firstString(userMetadata, ['name', 'full_name', 'user_name']),
      // `avatar_url` and `picture` both hold the Discord CDN URL depending on provider version.
      avatarUrl: firstString(userMetadata, ['avatar_url', 'picture']),
    }
  } catch {
    return null
  }
}

/**
 * Convenience wrapper for callers that only need the Discord snowflake (e.g. the
 * talisman routes). Returns the ID, or `null` when unauthenticated.
 */
export async function verifyDiscordId(authHeader: string | null): Promise<string | null> {
  return (await verifyIdentity(authHeader))?.discordId ?? null
}

/** First non-empty string among the given keys of a metadata object, else null. */
function firstString(source: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!source) return null
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return null
}
