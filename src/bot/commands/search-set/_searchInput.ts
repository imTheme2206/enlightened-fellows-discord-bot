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

  const slotFilters: Record<string, number> = {};
  for (const s of state.skills) {
    const key = String(s.slotSize);
    slotFilters[key] = (slotFilters[key] ?? 0) + 1;
  }

  const setSkills: Record<string, number> = {};
  for (const s of state.setSkills) {
    const remaining = 1 - (state.gogmaSkills.setSkill === s ? 1 : 0);
    if (remaining > 0) setSkills[s] = remaining;
  }

  const groupSkills: Record<string, number> = {};
  for (const g of state.groupSkills) {
    const remaining = 1 - (state.gogmaSkills.groupSkill === g ? 1 : 0);
    if (remaining > 0) groupSkills[g] = remaining;
  }

  return {
    skills,
    slotFilters,
    ...(Object.keys(setSkills).length > 0 && { setSkills }),
    ...(Object.keys(groupSkills).length > 0 && { groupSkills }),
    rank: state.rank,
  };
}
