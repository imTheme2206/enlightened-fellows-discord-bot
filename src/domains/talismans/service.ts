import type { CustomTalisman, TalismanSlot } from '../../infra/db/schema'
import { SkillRepository } from '../skills/repository'
import { MAX_TALISMANS_PER_USER, type CreateTalismanInput } from './schema'
import { TalismanRepository } from './repository'

export class TalismanValidationError extends Error {}
export class TalismanConflictError extends Error {}

/** Postgres unique_violation, per https://www.postgresql.org/docs/current/errcodes-appendix.html */
const UNIQUE_VIOLATION = '23505'

export abstract class TalismanService {
  static list(userId: string): Promise<CustomTalisman[]> {
    return TalismanRepository.findByUser(userId)
  }

  static async create(userId: string, input: CreateTalismanInput): Promise<CustomTalisman> {
    const existingCount = await TalismanRepository.countByUser(userId)
    if (existingCount >= MAX_TALISMANS_PER_USER) {
      throw new TalismanValidationError(`You can only have up to ${MAX_TALISMANS_PER_USER} custom talismans`)
    }

    const skills = await SkillRepository.findByIds(input.skills.map((s) => s.skillId))
    const skillsById = new Map(skills.map((s) => [s.id, s]))

    for (const requested of input.skills) {
      const skill = skillsById.get(requested.skillId)
      if (!skill) throw new TalismanValidationError(`Unknown skill: ${requested.skillId}`)
      if (requested.level > skill.maxLevel) {
        throw new TalismanValidationError(`${skill.name} level ${requested.level} exceeds max level ${skill.maxLevel}`)
      }
    }

    const slots: TalismanSlot[] = input.slots

    try {
      return await TalismanRepository.insert(userId, input.name, input.skills, slots)
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new TalismanConflictError(`You already have a talisman named "${input.name}"`)
      }
      throw err
    }
  }

  static async remove(userId: string, id: string): Promise<boolean> {
    return TalismanRepository.deleteOwned(userId, id)
  }
}
