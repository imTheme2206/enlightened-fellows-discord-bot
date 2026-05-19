import logger from "../../config/logger";
import { buildIndexFromDb } from "./build-index";
import { search } from "./logic";
import type { SearchInput, SearchResult, SetSearchIndex } from "./types";

let currentIndex: SetSearchIndex | null = null;

/**
 * Builds (or rebuilds) the in-memory search index from seed JSON files.
 */
export async function initSearchIndex(): Promise<void> {
  logger.info("[setSearch] Building search index from DB...");
  currentIndex = buildIndexFromDb();
  logger.info(
    `[setSearch] Index ready: ${currentIndex.allArmor.length} armor pieces`,
  );
}

/**
 * Runs a set search against the current in-memory index.
 * Throws if the index has not been initialized.
 */
export function searchSets(input: SearchInput): SearchResult[] {
  if (!currentIndex) throw new Error("Search index not initialized");
  return search(input, currentIndex);
}

/** Returns all known regular skill names, or empty array if index not ready. */
export function getSkillNames(): string[] {
  if (!currentIndex) return [];
  return Array.from(currentIndex.skills.keys());
}

/** Returns all known set skill names, or empty array if index not ready. */
export function getSetSkillNames(): string[] {
  if (!currentIndex) return [];
  return Array.from(currentIndex.setSkills.keys());
}

/** Returns the max level for a skill, or undefined if not found. */
export function getSkillMaxLevel(name: string): number | undefined {
  return currentIndex?.skills.get(name)?.maxLevel;
}
