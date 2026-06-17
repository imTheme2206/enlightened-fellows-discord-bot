import type { Skill } from '../../infra/db/schema'
import { SkillRepository } from './repository'
import type { SkillQuery } from './schema'

export abstract class SkillService {
  static getAll(query: SkillQuery = {}): Promise<Skill[]> {
    return SkillRepository.findAll(query)
  }
}
