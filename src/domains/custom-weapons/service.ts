import type { CustomWeapon } from '../../infra/db/schema'
import { ARTIAN_RULES } from '../mh-wilds-catalog/artian-rules'
import { findArtianConfigIssue, parseArtianCustomization } from '../mh-wilds-catalog/artian'
import { CatalogService } from '../mh-wilds-catalog/service'
import type { ArtianCustomization } from '../mh-wilds-catalog/schema'
import { CustomWeaponRepository } from './repository'
import { MAX_CUSTOM_WEAPONS_PER_USER, type CreateCustomWeaponInput } from './schema'

export class CustomWeaponValidationError extends Error {}
export class CustomWeaponConflictError extends Error {}

const UNIQUE_VIOLATION = '23505'

export abstract class CustomWeaponService {
  static list(userId: string): Promise<CustomWeapon[]> {
    return CustomWeaponRepository.findByUser(userId)
  }

  static async create(userId: string, input: CreateCustomWeaponInput): Promise<CustomWeapon> {
    const count = await CustomWeaponRepository.countByUser(userId)
    if (count >= MAX_CUSTOM_WEAPONS_PER_USER) {
      throw new CustomWeaponValidationError(`You can only have up to ${MAX_CUSTOM_WEAPONS_PER_USER} custom weapons`)
    }

    const [weapons, skills] = await Promise.all([
      CatalogService.getWeapons(),
      CatalogService.getSkills(),
    ])
    const selectedWeapon = weapons.find((weapon) => weapon.id === input.weaponId)
    if (!selectedWeapon || !selectedWeapon.artian) {
      throw new CustomWeaponValidationError('Custom weapons must use an Artian or Gogma Artian catalog weapon')
    }

    const parsed = parseArtianCustomization(input.customization)
    if ('issue' in parsed) {
      throw new CustomWeaponValidationError(`Invalid weapon customization: ${parsed.issue.reason}`)
    }
    const issue = findArtianConfigIssue(selectedWeapon, selectedWeapon.artian, parsed.config, ARTIAN_RULES)
    if (issue) {
      throw new CustomWeaponValidationError(`Invalid weapon customization: ${issue.reason}`)
    }

    const bonusById = new Map(skills.bonuses.map((bonus) => [bonus.id, bonus]))
    const bonusSelections = [
      ['Set', input.setBonusId, 'set'],
      ['Group', input.groupBonusId, 'group'],
    ] as const

    for (const [label, bonusId, kind] of bonusSelections) {
      if (selectedWeapon.artian.family === 'gogma' && bonusId === null) {
        throw new CustomWeaponValidationError(`Gogma Artian weapons require a ${label} Bonus`)
      }
      if (selectedWeapon.artian.family === 'artian' && bonusId !== null) {
        throw new CustomWeaponValidationError('Only Gogma Artian weapons can have Set or Group Bonuses')
      }
      if (bonusId !== null) {
        const bonus = bonusById.get(bonusId)
        if (!bonus) throw new CustomWeaponValidationError(`Unknown ${label} Bonus: ${bonusId}`)
        if (bonus.kind !== kind) throw new CustomWeaponValidationError(`${label} Bonus must be a ${kind} bonus`)
      }
    }

    try {
      return await CustomWeaponRepository.insert(userId, {
        name: input.name,
        weaponId: input.weaponId,
        customization: parsed.config as ArtianCustomization,
        setBonusId: input.setBonusId,
        groupBonusId: input.groupBonusId,
      })
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new CustomWeaponConflictError(`You already have a custom weapon named "${input.name}"`)
      }
      throw error
    }
  }

  static remove(userId: string, id: string): Promise<boolean> {
    return CustomWeaponRepository.deleteOwned(userId, id)
  }
}
