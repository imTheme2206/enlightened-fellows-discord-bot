import type { SearchInput } from "../../../services/setSearch/types";
import type { SearchState } from "./_state";

/**
 * Builds the SearchInput from the current session state.
 * Gogma weapon skills contribute 1 level toward their respective set/group skills,
 * so we subtract 1 from the remaining pieces required for each gogma-contributed bonus.
 */
export function buildSearchInput(state: SearchState): SearchInput {
  const skills: Record<string, number> = {};
  for (const s of state.skills) skills[s.name] = s.level;

  const setSkills: Record<string, number> = {};
  const initialSetCounts: Record<string, number> = {};
  for (const s of state.setSkills) {
    setSkills[s] = 1;
    if (state.gogmaSkills.setSkill === s) initialSetCounts[s] = 1;
  }

  const groupSkills: Record<string, number> = {};
  const initialGroupCounts: Record<string, number> = {};
  for (const g of state.groupSkills) {
    groupSkills[g] = 1;
    if (state.gogmaSkills.groupSkill === g) initialGroupCounts[g] = 1;
  }

  return {
    skills,
    ...(Object.keys(setSkills).length > 0 && { setSkills }),
    ...(Object.keys(groupSkills).length > 0 && { groupSkills }),
    ...(Object.keys(initialSetCounts).length > 0 && { initialSetCounts }),
    ...(Object.keys(initialGroupCounts).length > 0 && { initialGroupCounts }),
    rank: state.rank,
  };
}
