import type { ArmorPiece, DecorationItem } from "../types";

export const LIMIT = 500_000;
export const MAX_RESULTS = 200;
export const SLOT_COUNT = 3;
export const ARMOR_SLOT_TYPES = [
  "head",
  "chest",
  "arms",
  "waist",
  "legs",
  "talisman",
] as const;
export type SlotType = (typeof ARMOR_SLOT_TYPES)[number];

/** A piece entry as used inside the DFS: [name, ArmorPiece] */
export type PieceEntry = [string, ArmorPiece];

export interface GearPool {
  head: Record<string, ArmorPiece>;
  chest: Record<string, ArmorPiece>;
  arms: Record<string, ArmorPiece>;
  waist: Record<string, ArmorPiece>;
  legs: Record<string, ArmorPiece>;
  talisman: Record<string, ArmorPiece>;
  decos: Record<string, DecorationItem>;
}

export interface ArmorComboResult {
  names: string[];
  skills: Record<string, number>;
  slots: number[];
  setSkills: Record<string, number>;
  groupSkills: Record<string, number>;
  defense: number;
}

export interface DecoResult {
  decoNames: string[];
  freeSlots: number[];
}

export interface SkillPotentialAlias {
  best?: string;
  more?: string[];
  points?: number;
  slots?: number[];
  extraPoints?: number;
  leftoverSlots?: number[];
  defense?: number;
}
