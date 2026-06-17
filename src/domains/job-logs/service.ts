import type { JobLog } from '../../infra/db/schema'
import { JobLogRepository } from './repository'

export abstract class JobLogService {
  static async log(jobName: string, status: string, message?: string): Promise<void> {
    await JobLogRepository.insert(jobName, status, message ?? null)
  }

  static async getRecent(limit = 20): Promise<JobLog[]> {
    return JobLogRepository.findRecent(limit)
  }
}
