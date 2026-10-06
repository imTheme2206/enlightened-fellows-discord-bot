import { describe, expect, it } from "vitest"
import type { SearchResultDto } from "../../set-search/schema"
import type { SetBuilderErrorCode } from "../errors"
import { SetBuilderError } from "../errors"
import { buildImportComposition, type ImportCatalogInput } from "../import"
import type { ImportBuildRequest } from "../schema"
import { ARMORS, CUSTOM_TALISMAN, DECORATIONS, SKILLS } from "./fixtures"

/** Asserts `fn` throws a `SetBuilderError` with the expected machine code. */
function expectCode(fn: () => void, code: SetBuilderErrorCode) {
  try {
    fn()
  } catch (err) {
    expect(err).toBeInstanceOf(SetBuilderError)
    expect((err as SetBuilderError).code).toBe(code)
    return
  }
  throw new Error(`expected SetBuilderError(${code}) but nothing was thrown`)
}

const CATALOG: ImportCatalogInput = {
  armors: ARMORS,
  decorations: DECORATIONS,
  bonuses: SKILLS.bonuses,
}

const ZERO_ELEMENTAL = { fire: 0, water: 0, thunder: 0, ice: 0, dragon: 0 }

/** [head, chest, arms, waist, legs, talisman] — empty string denotes an empty position. */
function makeResult(overrides?: Partial<SearchResultDto>): SearchResultDto {
  return {
    armorNames: ["", "", "", "", "", ""],
    rarities: [0, 0, 0, 0, 0, 0],
    skills: {},
    setSkills: {},
    groupSkills: {},
    decoNames: [],
    freeSlots: [],
    slots: [],
    defense: 0,
    elementalDefenses: ZERO_ELEMENTAL,
    ...overrides,
  }
}

function makeRequest(overrides?: {
  result?: Partial<SearchResultDto>
  weapon?: ImportBuildRequest["weapon"]
}): ImportBuildRequest {
  return {
    result: makeResult(overrides?.result),
    weapon: overrides?.weapon ?? { setBonus: null, groupBonus: null },
    name: "Imported Build",
    description: null,
    isShared: false,
  }
}

describe("buildImportComposition", () => {
  it("an entirely empty result imports to an all-null composition with no weapon bonuses", () => {
    const composition = buildImportComposition(makeRequest(), CATALOG, [])
    expect(composition).toEqual({
      head: null,
      chest: null,
      arms: null,
      waist: null,
      legs: null,
      talisman: null,
      weapon: { weaponId: null, decorations: [], setBonusId: null, groupBonusId: null },
    })
  })

  it("resolves armor by name + rarity, and packs a decoration into the smallest fitting slot", () => {
    const request = makeRequest({
      result: {
        armorNames: ["Test Helm", "Test Mail", "", "", "", "Scraped Charm"],
        rarities: [5, 5, 0, 0, 0, 5],
        decoNames: ["Attack Jewel"], // slotSize 1
      },
    })

    const composition = buildImportComposition(request, CATALOG, [])

    expect(composition.head).toEqual({
      armorId: "armor-head",
      // armor-head has slots [3, 1]; the size-1 slot (index 1) is the smallest fit.
      decorations: [{ slotIndex: 1, decorationId: "deco-armor-1" }],
    })
    expect(composition.chest).toEqual({ armorId: "armor-chest", decorations: [] })
    expect(composition.talisman).toEqual({
      source: "scraped",
      talismanId: "tali-scraped",
      decorations: [],
    })
  })

  it("wrong rarity for an otherwise-matching armor name -> ARMOR_NOT_FOUND", () => {
    const request = makeRequest({
      result: { armorNames: ["Test Helm", "", "", "", "", ""], rarities: [6, 0, 0, 0, 0, 0] },
    })
    expectCode(() => buildImportComposition(request, CATALOG, []), "ARMOR_NOT_FOUND")
  })

  it("an armor name absent from the catalog -> ARMOR_NOT_FOUND with a 'missing from catalog' message", () => {
    const request = makeRequest({
      result: { armorNames: ["Nonexistent Helm", "", "", "", "", ""], rarities: [5, 0, 0, 0, 0, 0] },
    })
    try {
      buildImportComposition(request, CATALOG, [])
      throw new Error("expected a throw")
    } catch (err) {
      expect(err).toBeInstanceOf(SetBuilderError)
      expect((err as SetBuilderError).message).toBe(
        "Nonexistent Helm is missing from the current armor catalog.",
      )
    }
  })

  it("an unrecognized decoration name -> DECORATION_NOT_FOUND", () => {
    const request = makeRequest({
      result: {
        armorNames: ["Test Helm", "", "", "", "", ""],
        rarities: [5, 0, 0, 0, 0, 0],
        decoNames: ["Nonexistent Jewel"],
      },
    })
    expectCode(() => buildImportComposition(request, CATALOG, []), "DECORATION_NOT_FOUND")
  })

  it("a decoration too big for every open slot -> DECORATION_SLOT_TOO_SMALL", () => {
    const request = makeRequest({
      result: {
        armorNames: ["", "Test Mail", "", "", "", ""], // Test Mail has no slots at all
        rarities: [0, 5, 0, 0, 0, 0],
        decoNames: ["Guard Jewel+"], // slotSize 3
      },
    })
    expectCode(
      () => buildImportComposition(request, CATALOG, []),
      "DECORATION_SLOT_TOO_SMALL",
    )
  })

  it("falls back to an owner-scoped custom talisman when the name is not a scraped talisman", () => {
    const request = makeRequest({
      result: { armorNames: ["", "", "", "", "", "My Talisman"], rarities: [0, 0, 0, 0, 0, 0] },
    })
    const composition = buildImportComposition(request, CATALOG, [CUSTOM_TALISMAN])
    expect(composition.talisman).toEqual({
      source: "custom",
      talismanId: "ct-1",
      decorations: [],
    })
  })

  it("a decoration only fits a custom talisman's armor-typed slot, not its weapon-typed slot", () => {
    // CUSTOM_TALISMAN slots: [{ type: 'weapon', size: 1 }, { type: 'armor', size: 2 }].
    const request = makeRequest({
      result: {
        armorNames: ["", "", "", "", "", "My Talisman"],
        rarities: [0, 0, 0, 0, 0, 0],
        decoNames: ["Attack Jewel"], // armor-typed, slotSize 1
      },
    })
    const composition = buildImportComposition(request, CATALOG, [CUSTOM_TALISMAN])
    expect(composition.talisman?.decorations).toEqual([
      { slotIndex: 1, decorationId: "deco-armor-1" },
    ])
  })

  it("a talisman name matching neither a scraped nor an owned custom talisman -> TALISMAN_NOT_FOUND", () => {
    const request = makeRequest({
      result: { armorNames: ["", "", "", "", "", "Nobody's Charm"], rarities: [0, 0, 0, 0, 0, 0] },
    })
    expectCode(
      () => buildImportComposition(request, CATALOG, []),
      "TALISMAN_NOT_FOUND",
    )
  })

  it("resolves the weapon's Set and Group Bonus by name", () => {
    const request = makeRequest({
      weapon: { setBonus: "Example Set", groupBonus: "Example Group" },
    })
    const composition = buildImportComposition(request, CATALOG, [])
    expect(composition.weapon).toEqual({
      weaponId: null,
      decorations: [],
      setBonusId: "bn-set",
      groupBonusId: "bn-group",
    })
  })

  it("an unknown weapon bonus name -> WEAPON_BONUS_NOT_FOUND", () => {
    const request = makeRequest({ weapon: { setBonus: "Nonexistent Bonus", groupBonus: null } })
    expectCode(
      () => buildImportComposition(request, CATALOG, []),
      "WEAPON_BONUS_NOT_FOUND",
    )
  })

  it("a weapon bonus name resolving to the wrong kind -> WEAPON_BONUS_KIND_MISMATCH", () => {
    // "Example Group" is a group bonus, referenced here as the set slot.
    const request = makeRequest({ weapon: { setBonus: "Example Group", groupBonus: null } })
    expectCode(
      () => buildImportComposition(request, CATALOG, []),
      "WEAPON_BONUS_KIND_MISMATCH",
    )
  })
})
