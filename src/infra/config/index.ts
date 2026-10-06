import dotenv from "dotenv"
import cron from "node-cron"
import { z } from "zod"

dotenv.config()

export enum CRON_JOB {
  EVERY_HOUR = "0 * * * *",
  WEDNESDAY_10AM = "0 10 * * 3",
}

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  SUPABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  WEB_PORT: z.coerce.number().default(3003),
  WEB_ADMIN_TOKEN: z.string().optional(),
  DISCORD_OWNER_ID: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  // Scheduled MH Wilds catalog refresh (UTC). Default: daily at 04:00.
  CATALOG_REFRESH_CRON: z
    .string()
    .refine((v) => cron.validate(v), "must be a valid cron expression")
    .default("0 4 * * *"),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  )
  process.exit(1)
}

/** Validated environment configuration */
export const config = {
  ...parsed.data,
}
