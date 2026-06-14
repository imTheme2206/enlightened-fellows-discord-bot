import { randomUUID } from 'crypto'
import { desc } from 'drizzle-orm'
import { db } from '../../db/client'
import { jobLog, type JobLog } from '../../db/schema'

export abstract class JobLogService {
  static async log(jobName: string, status: string, message?: string): Promise<void> {
    await db.insert(jobLog).values({ id: randomUUID(), jobName, status, message: message ?? null })
  }

  static async getRecent(limit = 20): Promise<JobLog[]> {
    return db.query.jobLog.findMany({ orderBy: (t) => [desc(t.createdAt)], limit })
  }
}
