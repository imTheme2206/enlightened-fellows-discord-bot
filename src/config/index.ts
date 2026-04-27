import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  EVENTS_CHANNEL_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  WEB_PORT: z.coerce.number().default(3000),
  WEB_ADMIN_TOKEN: z.string().optional(),
  SCRAPER_CRON: z.string().optional().default('0 */6 * * *'),
  DISCORD_OWNER_ID: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

/** Validated environment configuration */
export const config = parsed.data
