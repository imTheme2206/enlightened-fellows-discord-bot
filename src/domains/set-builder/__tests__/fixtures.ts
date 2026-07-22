import type { CustomTalisman } from "../../../infra/db/schema"
import type {
  ArmorCatalogItem,
  DecorationCatalogItem,
  SkillCatalogResponse,
} from "../../mh-wilds-catalog/schema"
import { buildCatalogView, type CatalogView } from "../catalog-view"
import type { CompositionRequest, SaveBuildRequest } from "../schema"

const ZERO_RES = { fire: 0, water: 0, thunder: 0, ice: 0, dragon: 0 }

export const ARMORS: ArmorCatalogItem[] = [
  {
    id: "armor-head",
    name: "Test Helm",
    type: "head",
    rank: "high",
    rarity: 5,
    defense: 40,
    resistances: { fire: 2, water: 0, thunder: -1, ice: 0, dragon: 0 },
    slots: [3, 1], // slot 0 size 3, slot 1 size 1
    skills: [{ skillId: "sk-attack", name: "Attack Boost", level: 2 }],
    bonuses: [{ bonusId: "bn-set", name: "Example Set", kind: "set" }],
  },
  {
    id: "armor-chest",
    name: "Test Mail",
    type: "chest",
    rank: "high",
    rarity: 5,
    defense: 44,
    resistances: ZERO_RES,
    slots: [],
    skills: [{ skillId: "sk-guard", name: "Guard", level: 1 }],
    bonuses: [],
  },
  {
    id: "tali-scraped",
    name: "Scraped Charm",
    type: "talisman",
    rank: "high",
    rarity: 5,
    defense: 0,
    resistances: ZERO_RES,
    slots: [],
    skills: [{ skillId: "sk-crit", name: "Critical Eye", level: 1 }],
    bonuses: [],
  },
]

export const DECORATIONS: DecorationCatalogItem[] = [
  {
    id: "deco-armor-1",
    name: "Attack Jewel",
    type: "armor",
    slotSize: 1,
    skills: [{ skillId: "sk-attack", name: "Attack Boost", level: 1 }],
  },
  {
    id: "deco-armor-big",
    name: "Guard Jewel+",
    type: "armor",
    slotSize: 3,
    skills: [{ skillId: "sk-guard", name: "Guard", level: 2 }],
  },
  {
    id: "deco-weapon-1",
    name: "Critical Jewel",
    type: "weapon",
    slotSize: 1,
    skills: [{ skillId: "sk-crit", name: "Critical Eye", level: 1 }],
  },
]

export const SKILLS: SkillCatalogResponse = {
  skills: [
    { id: "sk-attack", name: "Attack Boost", kind: "armor", maxLevel: 5 },
    { id: "sk-guard", name: "Guard", kind: "armor", maxLevel: 5 },
    { id: "sk-crit", name: "Critical Eye", kind: "armor", maxLevel: 5 },
    { id: "sk-tali", name: "Handicraft", kind: "armor", maxLevel: 5 },
  ],
  bonuses: [
    {
      id: "bn-set",
      name: "Example Set",
      kind: "set",
      thresholds: [
        { piecesRequired: 2, effectName: "Set Effect I", level: 1 },
        { piecesRequired: 4, effectName: "Set Effect II", level: 2 },
      ],
    },
  ],
}

export const CUSTOM_TALISMAN: CustomTalisman = {
  id: "ct-1",
  userId: "user-1",
  name: "My Talisman",
  skills: [{ skillId: "sk-tali", level: 1 }],
  // slot 0 is a weapon slot; the rest are armor slots.
  slots: [
    { type: "weapon", size: 1 },
    { type: "armor", size: 2 },
  ],
  createdAt: new Date("2026-01-01T00:00:00Z"),
}

export function makeView(overrides?: {
  customTalisman?: CustomTalisman | null
}): CatalogView {
  return buildCatalogView({
    armors: ARMORS,
    decorations: DECORATIONS,
    skills: SKILLS,
    customTalisman:
      overrides && "customTalisman" in overrides
        ? overrides.customTalisman!
        : CUSTOM_TALISMAN,
  })
}

const EMPTY_COMPOSITION: CompositionRequest = {
  head: null,
  chest: null,
  arms: null,
  waist: null,
  legs: null,
  talisman: null,
}

export function makeRequest(
  composition?: Partial<CompositionRequest>,
  meta?: Partial<SaveBuildRequest>,
): SaveBuildRequest {
  return {
    name: "Test Build",
    description: null,
    isShared: false,
    composition: { ...EMPTY_COMPOSITION, ...composition },
    ...meta,
  }
}
