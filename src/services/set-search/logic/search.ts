import type { SearchInput, SearchResult, SetSearchIndex } from '../types'
import { MAX_RESULTS } from './constants'
import { getBestArmor, computeMaxPotential } from './candidatePool'
import { rollCombosDfs } from './dfs'
import { reorder } from './reorder'

/**
 * Main entry point for set search.
 * @param input - User-specified skill requirements and filters.
 * @param index - The pre-built search index from buildSearchIndex().
 */
export function search(input: SearchInput, index: SetSearchIndex): SearchResult[] {
  const skills = input.skills ?? {}
  const setSkills = input.setSkills ?? {}
  const groupSkills = input.groupSkills ?? {}
  const mandatoryArmor = input.mandatoryArmor ?? []
  const blacklistedArmor = input.blacklistedArmor ?? []
  const slotFilters = input.slotFilters ?? {}
  const rank = input.rank ?? 'high'

  const allArmorByType: Record<string, import('../types').ArmorPiece[]> = {}
  for (const [tipo, pieces] of Object.entries(index.byType)) {
    allArmorByType[tipo] = pieces
  }

  const gear = getBestArmor(
    skills,
    setSkills,
    groupSkills,
    mandatoryArmor,
    blacklistedArmor,
    allArmorByType,
    index.decorations,
    rank,
  )

  const maxPotential = computeMaxPotential(gear, Object.keys(skills))
  let rolls = rollCombosDfs(gear, skills, setSkills, groupSkills, input.initialSetCounts ?? {}, input.initialGroupCounts ?? {}, maxPotential)

  // Apply slot filters post-search
  if (Object.keys(slotFilters).length > 0) {
    const desiredSlots = Object.entries(slotFilters)
      .flatMap(([num, count]) => Array<number>(count).fill(Number(num)))
      .sort((a, b) => b - a)

    rolls = rolls.filter((roll) => {
      const rollFree = [...roll.freeSlots].sort((a, b) => b - a)
      if (rollFree.length < desiredSlots.length) return false
      for (let i = 0; i < desiredSlots.length; i++) {
        if (desiredSlots[i] > rollFree[i]) return false
      }
      return true
    })
  }

  // Inject gogma weapon contributions into set/group counts so they display correctly
  const initSetCounts = input.initialSetCounts ?? {}
  const initGroupCounts = input.initialGroupCounts ?? {}
  if (Object.keys(initSetCounts).length > 0 || Object.keys(initGroupCounts).length > 0) {
    for (const roll of rolls) {
      for (const [sk, count] of Object.entries(initSetCounts)) {
        roll.setSkills[sk] = (roll.setSkills[sk] ?? 0) + count
      }
      for (const [gk, count] of Object.entries(initGroupCounts)) {
        roll.groupSkills[gk] = (roll.groupSkills[gk] ?? 0) + count
      }
    }
  }

  const skillMaxMap: Record<string, number> = {}
  for (const [name, meta] of index.skills.entries()) {
    skillMaxMap[name] = meta.maxLevel
  }

  rolls = reorder(rolls, skillMaxMap)

  return rolls.slice(0, MAX_RESULTS)
}
