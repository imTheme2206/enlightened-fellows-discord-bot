import { randomUUID } from 'crypto'
import { desc } from 'drizzle-orm'
import { db } from '../../infra/db/client'
import { jobLog, type JobLog } from '../../infra/db/schema'

export abstract class JobLogRepository {
  static async insert(jobName: string, status: string, message: string | null): Promise<void> {
    await db.insert(jobLog).values({ id: randomUUID(), jobName, status, message })
  }

  static async findRecent(limit: number): Promise<JobLog[]> {
    return db.query.jobLog.findMany({ orderBy: (t) => [desc(t.createdAt)], limit })
  }
}
