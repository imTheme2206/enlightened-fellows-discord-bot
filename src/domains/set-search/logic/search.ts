import type { SearchInput, SearchResult, SetSearchIndex } from '../types'
import { computeMaxPotential, getBestArmor } from './candidate-pool'
import { MAX_RESULTS } from './constants'
import { rollTopCombosDfs } from './dfs'

/**
 * Main entry point for set search.
 * @param input - User-specified skill requirements and filters.
 * @param index - The pre-built search index from buildIndexFromDb().
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

  const gear = getBestArmor(skills, setSkills, groupSkills, mandatoryArmor, blacklistedArmor, allArmorByType, index.decorations, rank)

  const maxPotential = computeMaxPotential(gear, Object.keys(skills))
  const desiredSlots = Object.entries(slotFilters)
    .flatMap(([num, count]) => Array<number>(count).fill(Number(num)))
    .sort((a, b) => b - a)
  const acceptsSlotFilters =
    desiredSlots.length === 0
      ? undefined
      : (roll: SearchResult) => {
          const rollFree = [...roll.freeSlots].sort((a, b) => b - a)
          if (rollFree.length < desiredSlots.length) return false
          for (let i = 0; i < desiredSlots.length; i++) {
            if (desiredSlots[i] > rollFree[i]) return false
          }
          return true
        }

  const skillMaxMap: Record<string, number> = {}
  for (const [name, meta] of index.skills.entries()) {
    skillMaxMap[name] = meta.maxLevel
  }

  // Weapon contributions are raw piece counts and must be injected before
  // prepareResult() turns them into activated set/group levels.
  const initSetCounts = input.initialSetCounts ?? {}
  const initGroupCounts = input.initialGroupCounts ?? {}
  const injectInitialCounts = (roll: SearchResult): void => {
    for (const [sk, count] of Object.entries(initSetCounts)) {
      roll.setSkills[sk] = (roll.setSkills[sk] ?? 0) + count
    }
    for (const [gk, count] of Object.entries(initGroupCounts)) {
      roll.groupSkills[gk] = (roll.groupSkills[gk] ?? 0) + count
    }
  }

  const rolls = rollTopCombosDfs(
    gear,
    skills,
    setSkills,
    groupSkills,
    initSetCounts,
    initGroupCounts,
    maxPotential,
    skillMaxMap,
    MAX_RESULTS,
    acceptsSlotFilters,
    injectInitialCounts,
  )

  return rolls
}
