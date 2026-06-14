import dotenv from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

dotenv.config()

const client = postgres(process.env.DATABASE_URL!, {
  prepare: false, // required for Supabase transaction pooler (pgBouncer)
  max: 5,
})

export const db = drizzle(client, { schema })
