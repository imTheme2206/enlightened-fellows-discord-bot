import { SkillRepository } from '../skills/repository'
import { TalismanRepository } from '../talismans/repository'
import type { ArmorPiece, ArmorType } from './types'

/**
 * Maps a user's custom talismans into the same `ArmorPiece` shape as scraped
 * armor so they can be merged into `byType.talisman` as extra, non-mandatory
 * candidates. Weapon-type slots are dropped — this engine only builds armor
 * sets (weapon-slot support is a future iteration).
 */
export async function loadCustomTalismans(userId: string, rank: ArmorPiece['rank']): Promise<ArmorPiece[]> {
  const talismans = await TalismanRepository.findByUser(userId)
  if (talismans.length === 0) return []

  const skillIds = [...new Set(talismans.flatMap((t) => t.skills.map((s) => s.skillId)))]
  const skills = await SkillRepository.findByIds(skillIds)
  const skillNameById = new Map(skills.map((s) => [s.id, s.name]))

  return talismans.map((talisman) => {
    const skillEntries = talisman.skills
      .map((s) => [skillNameById.get(s.skillId), s.level] as const)
      .filter((entry): entry is [string, number] => entry[0] !== undefined)

    return {
      name: talisman.name,
      type: 'talisman' as ArmorType,
      skills: Object.fromEntries(skillEntries),
      groupSkills: [],
      setSkills: [],
      slots: talisman.slots.filter((s) => s.type === 'armor').map((s) => s.size),
      defense: 0,
      resists: [0, 0, 0, 0, 0],
      rank,
      rarity: 0,
    }
  })
}
