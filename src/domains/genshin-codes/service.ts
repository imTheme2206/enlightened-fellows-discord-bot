import type { GenshinCode } from '../../infra/db/schema'
import { GenshinCodeRepository } from './repository'

export abstract class GenshinCodeService {
  static redeemUrl = 'https://genshin.hoyoverse.com/en/gift?code='

  static async save(code: string, isAlerted = false, isExpired = false, rewards?: string): Promise<void> {
    await GenshinCodeRepository.insert(code, rewards ?? null, isAlerted, isExpired)
  }

  static async getUnalerted(): Promise<GenshinCode[]> {
    return GenshinCodeRepository.findUnalerted()
  }

  static async markAlerted(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await GenshinCodeRepository.markAlerted(ids)
  }

  static async getAll(limit = 100): Promise<GenshinCode[]> {
    return GenshinCodeRepository.findAll(limit)
  }

  static buildRedeemUrl(code: string): string {
    return `${this.redeemUrl}${code}`
  }
}
