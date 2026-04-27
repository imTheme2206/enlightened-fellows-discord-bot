import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import dotenv from 'dotenv'

dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

/** Singleton Prisma client for the entire application. */
export const prisma = new PrismaClient({ adapter })

/**
 * Writes a job execution log entry.
 */
export async function logJob(
  jobName: string,
  status: string,
  message?: string
): Promise<void> {
  await prisma.jobLog.create({
    data: { jobName, status, message },
  })
}

/**
 * Returns the most recent job log entries.
 * @param limit - Maximum number of entries to return (default 20)
 */
export async function getRecentJobLogs(limit = 20) {
  return prisma.jobLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/**
 * Returns true if no Armor rows exist in the database.
 */
export async function isDbEmpty(): Promise<boolean> {
  const count = await prisma.armor.count()
  return count === 0
}
