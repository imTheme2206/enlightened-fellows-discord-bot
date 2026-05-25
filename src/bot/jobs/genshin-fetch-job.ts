import cron from 'node-cron'
import logger from '../../config/logger'
import { saveGenshinCode } from '../../services/db-service'

const CODES_API = 'https://hoyo-codes.seria.moe/codes?game=genshin'
const cronSchedule = '0 */6 * * *' // every 6 hours

interface HoyoCode {
  id: number
  code: string
  status: string
  game: string
  rewards: string
}

interface HoyoCodesResponse {
  codes: HoyoCode[]
  game: string
}

export async function fetchAndSaveGenshinCodes(): Promise<void> {
  logger.info('Fetching Genshin codes from API...')

  const response = await fetch(CODES_API)

  if (!response.ok) {
    throw new Error(`API responded with status ${response.status}`)
  }

  const data = (await response.json()) as HoyoCodesResponse
  const codes = data.codes ?? []

  logger.info(`Fetched ${codes.length} Genshin code(s) from API`)

  for (const entry of codes) {
    const isExpired = entry.status !== 'OK'
    saveGenshinCode(entry.code, false, isExpired, entry.rewards)
  }

  logger.info('Genshin codes saved to DB')
}

export function startGenshinFetchJob(): void {
  logger.info(`Setting up Genshin code fetch job with schedule: ${cronSchedule}`)

  // Run immediately on boot
  fetchAndSaveGenshinCodes().catch((err) => {
    logger.error('Genshin fetch job: boot fetch failed', { err })
  })

  cron.schedule(cronSchedule, async () => {
    try {
      await fetchAndSaveGenshinCodes()
    } catch (err) {
      logger.error('Genshin fetch job: fetch failed', { err })
    }
  })

  logger.info('Genshin code fetch job scheduled (every 6 hours)')
}
