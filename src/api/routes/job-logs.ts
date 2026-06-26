import { Elysia } from 'elysia'
import { JobLogService } from '../../domains/job-logs/service'

export const jobLogsRoutes = new Elysia({ tags: ['admin'] }).get('/job-logs', () => JobLogService.getRecent(50))
