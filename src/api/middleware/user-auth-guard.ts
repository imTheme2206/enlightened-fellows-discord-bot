import { createRemoteJWKSet, jwtVerify } from 'jose'
import { config } from '../../infra/config'

const jwks = createRemoteJWKSet(new URL(`${config.SUPABASE_URL}/auth/v1/.well-known/jwks.json`))

/**
 * Verifies a Supabase-issued JWT locally against the project's JWKS (no
 * network call to Supabase's auth server) and returns the Discord ID that a
 * Supabase Auth Hook stamps into `app_metadata.discord_id` at token-mint time
 * (see docs/adr/0003). Returns `null` if the token is missing, invalid, or
 * lacks the claim.
 */
export async function verifyDiscordId(authHeader: string | null): Promise<string | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, jwks)
    const appMetadata = payload.app_metadata as Record<string, unknown> | undefined
    const discordId = appMetadata?.discord_id
    return typeof discordId === 'string' && discordId.length > 0 ? discordId : null
  } catch {
    return null
  }
}
