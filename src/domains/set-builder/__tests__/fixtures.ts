import type { CustomTalisman } from "../../../infra/db/schema"
import type {
  ArmorCatalogItem,
  DecorationCatalogItem,
  SkillCatalogResponse,
  WeaponCatalogItem,
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

export const WEAPONS: WeaponCatalogItem[] = [
  {
    id: "weapon-gs",
    name: "Test Greatsword",
    kind: "great-sword",
    rarity: 8,
    damage: { raw: 1000, display: 200 },
    affinity: 10,
    specials: [
      { kind: "element", name: "fire", damage: { raw: 150, display: 15 }, hidden: false },
    ],
    sharpness: { red: 40, orange: 50, yellow: 60, green: 70, blue: 80, white: 0, purple: 0 },
    handicraft: [10, 20, 30, 40],
    slots: [3, 1], // weapon slot 0 size 3, slot 1 size 1
    skills: [{ skillId: "sk-attack", name: "Attack Boost", level: 1 }],
    elderseal: null,
    defenseBonus: 0,
    series: null,
    artian: null,
    kindSpecific: {},
  },
  {
    id: "weapon-bow",
    name: "Test Bow",
    kind: "bow",
    rarity: 5,
    damage: { raw: 200, display: 80 },
    affinity: 0,
    specials: [],
    sharpness: null,
    handicraft: null,
    slots: [],
    skills: [],
    elderseal: null,
    defenseBonus: 0,
    series: null,
    artian: null,
    kindSpecific: {},
  },
  {
    id: "weapon-artian-gs",
    name: "Varianza",
    kind: "great-sword",
    rarity: 8,
    damage: { raw: 190, display: 912 },
    affinity: 5,
    specials: [],
    sharpness: { red: 80, orange: 40, yellow: 60, green: 80, blue: 70, white: 20, purple: 0 },
    handicraft: [5],
    slots: [3, 3, 3],
    skills: [],
    elderseal: null,
    defenseBonus: 0,
    series: null,
    artian: { family: "artian", tier: 8, focus: null },
    kindSpecific: {},
  },
  {
    id: "weapon-gogma-gs",
    name: "Ostrak Oblivion (+15% affinity)",
    kind: "great-sword",
    rarity: 8,
    damage: { raw: 180, display: 864 },
    affinity: 15,
    specials: [],
    sharpness: { red: 140, orange: 40, yellow: 40, green: 50, blue: 70, white: 10, purple: 0 },
    handicraft: [5],
    slots: [3, 3, 3],
    skills: [],
    elderseal: null,
    defenseBonus: 0,
    series: null,
    artian: { family: "gogma", tier: 8, focus: "affinity" },
    kindSpecific: {},
  },
  {
    id: "weapon-gogma-bow",
    name: "Calamitous Angel (0% affinity)",
    kind: "bow",
    rarity: 8,
    damage: { raw: 190, display: 228 },
    affinity: 0,
    specials: [],
    sharpness: null,
    handicraft: null,
    slots: [3, 3, 3],
    skills: [],
    elderseal: null,
    defenseBonus: 0,
    series: null,
    artian: { family: "gogma", tier: 8, focus: "element" },
    kindSpecific: {},
  },
]

export const SKILLS: SkillCatalogResponse = {
  skills: [
    { id: "sk-attack", name: "Attack Boost", kind: "armor", maxLevel: 5, icon: null },
    { id: "sk-guard", name: "Guard", kind: "armor", maxLevel: 5, icon: null },
    { id: "sk-crit", name: "Critical Eye", kind: "armor", maxLevel: 5, icon: null },
    { id: "sk-tali", name: "Handicraft", kind: "armor", maxLevel: 5, icon: null },
  ],
  bonuses: [
    {
      id: "bn-set",
      name: "Example Set",
      kind: "set",
      icon: null,
      thresholds: [
        { piecesRequired: 2, effectName: "Set Effect I", level: 1 },
        { piecesRequired: 4, effectName: "Set Effect II", level: 2 },
      ],
    },
    {
      id: "bn-group",
      name: "Example Group",
      kind: "group",
      icon: null,
      thresholds: [{ piecesRequired: 2, effectName: "Group Effect I", level: 1 }],
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
    weapons: WEAPONS,
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
  weapon: null,
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
