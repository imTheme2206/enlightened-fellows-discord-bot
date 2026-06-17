import type { SearchState } from '../state'
import type { SearchInput } from '../../../../../domains/set-search/types'

export function buildSearchInput(state: SearchState): SearchInput {
  const skills: Record<string, number> = {}
  for (const s of state.skills) skills[s.name] = s.level

  const setSkills: Record<string, number> = {}
  const initialSetCounts: Record<string, number> = {}
  for (const s of state.setSkills) {
    setSkills[s.name] = s.rank
    if (state.gogmaSkills.setSkill === s.name) initialSetCounts[s.name] = 1
  }

  const groupSkills: Record<string, number> = {}
  const initialGroupCounts: Record<string, number> = {}
  for (const g of state.groupSkills) {
    groupSkills[g] = 1
    if (state.gogmaSkills.groupSkill === g) initialGroupCounts[g] = 1
  }

  return {
    skills,
    ...(Object.keys(setSkills).length > 0 && { setSkills }),
    ...(Object.keys(groupSkills).length > 0 && { groupSkills }),
    ...(Object.keys(initialSetCounts).length > 0 && { initialSetCounts }),
    ...(Object.keys(initialGroupCounts).length > 0 && { initialGroupCounts }),
    rank: state.rank,
  }
}
