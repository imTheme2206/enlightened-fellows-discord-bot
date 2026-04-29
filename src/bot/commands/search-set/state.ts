import type { SearchHistoryRow } from "../../../services/db-service";

export const MAX_SKILLS = 10;
export const SESSION_TTL_MS = 10 * 60 * 1000;
export const RESULTS_PER_PAGE = 5;

export type Step =
  | "main"
  | "weapon-skill"
  | "set-skill"
  | "history"
  | "remove-skill";

export interface SkillEntry {
  name: string;
  level: number;
  slotSize: 1 | 2 | 3;
}

export interface SavedSearch {
  skills: SkillEntry[];
  setSkills: string[];
  groupSkills: string[];
  gogmaSetSkill: string;
  gogmaGroupSkill: string;
  rank: "low" | "high" | "master";
}

export interface PendingSkill {
  name: string;
  slotSize: 1 | 2 | 3;
}

export interface SearchState {
  gogmaSkills: {
    setSkill: string;
    groupSkill: string;
  };
  skills: SkillEntry[];
  setSkills: string[];
  groupSkills: string[];
  rank: "low" | "high" | "master";
  step: Step;
  pendingSkills: PendingSkill[] | null;
  weaponSkillPage: number;
  slotPages: Partial<Record<1 | 2 | 3, number>>;
  historyEntries?: SearchHistoryRow[];
}

const sessions = new Map<string, SearchState>();

export function getSession(userId: string): SearchState {
  return (
    sessions.get(userId) ?? {
      gogmaSkills: { groupSkill: "", setSkill: "" },
      skills: [],
      setSkills: [],
      groupSkills: [],
      rank: "high",
      step: "main",
      pendingSkills: null,
      weaponSkillPage: 0,
      slotPages: {},
    }
  );
}

export function saveSession(userId: string, state: SearchState): void {
  sessions.set(userId, state);
  setTimeout(() => sessions.delete(userId), SESSION_TTL_MS);
}
