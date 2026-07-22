import type { CustomTalisman, Skill, TalismanSlot } from '../../infra/db/schema'
import { SkillRepository } from '../skills/repository'
import { MAX_TALISMANS_PER_USER, MAX_TALISMAN_NAME_LENGTH, type CreateTalismanInput } from './schema'
import { TalismanRepository } from './repository'

export class TalismanValidationError extends Error {}
export class TalismanConflictError extends Error {}

/** Postgres unique_violation, per https://www.postgresql.org/docs/current/errcodes-appendix.html */
const UNIQUE_VIOLATION = '23505'

const ELLIPSIS = '…'

/**
 * Builds a display name from a talisman's skills, e.g. "Attack Boost 3, Weakness
 * Exploit 2". Skills keep the request order. If the joined name exceeds
 * `MAX_TALISMAN_NAME_LENGTH` it is truncated on a whole-skill boundary where
 * possible (dropping trailing skills and appending "…"), falling back to a
 * hard character cut for a single over-long skill.
 */
function generateTalismanName(
  requestedSkills: CreateTalismanInput['skills'],
  skillsById: Map<string, Skill>
): string {
  const parts = requestedSkills.map((s) => `${skillsById.get(s.skillId)?.name ?? 'Unknown'} ${s.level}`)

  const full = parts.join(', ')
  if (full.length <= MAX_TALISMAN_NAME_LENGTH) return full

  // Keep as many leading skills as fit alongside a trailing ellipsis.
  const kept: string[] = []
  for (const part of parts) {
    const candidate = [...kept, part].join(', ') + ELLIPSIS
    if (candidate.length > MAX_TALISMAN_NAME_LENGTH) break
    kept.push(part)
  }

  if (kept.length > 0) return kept.join(', ') + ELLIPSIS
  // Even the first skill is too long: hard-cut it.
  return parts[0].slice(0, MAX_TALISMAN_NAME_LENGTH - ELLIPSIS.length) + ELLIPSIS
}

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
    const name = input.name ?? generateTalismanName(input.skills, skillsById)

    try {
      return await TalismanRepository.insert(userId, name, input.skills, slots)
    } catch (err) {
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new TalismanConflictError(`You already have a talisman named "${name}"`)
      }
      throw err
    }
  }

  static async remove(userId: string, id: string): Promise<boolean> {
    return TalismanRepository.deleteOwned(userId, id)
  }
}
