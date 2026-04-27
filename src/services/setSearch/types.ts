export type ArmorType =
  | "head"
  | "chest"
  | "arms"
  | "waist"
  | "legs"
  | "talisman";

export interface ArmorPiece {
  name: string;
  type: ArmorType;
  skills: Record<string, number>; // {skillName: level}
  groupSkills: string[]; // group names this piece belongs to
  slots: number[]; // [3, 2, 1]
  defense: number;
  resists: [number, number, number, number, number]; // [fire,water,thunder,ice,dragon]
  rank: "low" | "high" | "master";
  setSkills: string[]; // set names this piece belongs to
}

export interface DecorationItem {
  name: string;
  skills: Record<string, number>;
  slotSize: number;
}

export interface SetSkillMeta {
  name: string;
  skillName: string;
  piecesRequired: number;
  bonusLevels: number[];
}

export interface GroupSkillMeta {
  name: string;
  skillName: string;
  levelGranted: number;
  piecesRequired: number;
}

export interface SkillMeta {
  name: string;
  maxLevel: number;
}

export interface SetSearchIndex {
  version: string;
  byType: Record<ArmorType, ArmorPiece[]>;
  allArmor: ArmorPiece[];
  decorations: DecorationItem[];
  setSkills: Map<string, SetSkillMeta>;
  groupSkills: Map<string, GroupSkillMeta>;
  skills: Map<string, SkillMeta>;
}

export interface SearchInput {
  skills: Record<string, number>;
  setSkills?: Record<string, number>;
  groupSkills?: Record<string, number>;
  initialSetCounts?: Record<string, number>;
  initialGroupCounts?: Record<string, number>;
  mandatoryArmor?: (string | null)[]; // [head, chest, arms, waist, legs, talisman]
  blacklistedArmor?: string[];
  slotFilters?: Record<string, number>; // {"3": 2} = need 2 free 3-slots
  rank?: "low" | "high" | "master";
}

export interface SearchResult {
  armorNames: string[];
  skills: Record<string, number>;
  setSkills: Record<string, number>;
  groupSkills: Record<string, number>;
  decoNames: string[];
  freeSlots: number[];
  slots: number[];
}
