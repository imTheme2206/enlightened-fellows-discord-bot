import cron from 'node-cron'
import { CRON_JOB } from '../../config'
import logger from '../../config/logger'
import { GenshinCodeService } from '../../modules/genshin-codes/service'

const CODES_API = 'https://hoyo-codes.seria.moe/codes?game=genshin'

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
    await GenshinCodeService.save(entry.code, false, isExpired, entry.rewards)
  }

  logger.info('Genshin codes saved to DB')
}

export function startGenshinFetchJob(): void {
  logger.info(`Setting up Genshin code fetch job`)

  // Run immediately on boot
  fetchAndSaveGenshinCodes().catch((err) => {
    logger.error('Genshin fetch job: boot fetch failed', { err })
  })

  cron.schedule(CRON_JOB.EVERY_HOUR, async () => {
    try {
      await fetchAndSaveGenshinCodes()
    } catch (err) {
      logger.error('Genshin fetch job: fetch failed', { err })
    }
  })

  logger.info('Genshin code fetch job scheduled (every 6 hours)')
}
