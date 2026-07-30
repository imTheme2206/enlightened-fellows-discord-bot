import { describe, expect, it } from "vitest"
import type { SetBuilderErrorCode } from "../errors"
import { SetBuilderError } from "../errors"
import { validateSaveComposition } from "../validation"
import { makeRequest, makeView } from "./fixtures"

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

describe("validateSaveComposition", () => {
  it("accepts a full, well-formed composition", () => {
    const view = makeView()
    const request = makeRequest({
      head: {
        armorId: "armor-head",
        decorations: [{ slotIndex: 0, decorationId: "deco-armor-1" }],
      },
      chest: { armorId: "armor-chest", decorations: [] },
      arms: null,
      waist: null,
      legs: null,
      talisman: {
        source: "custom",
        talismanId: "ct-1",
        decorations: [{ slotIndex: 0, decorationId: "deco-weapon-1" }],
      },
    })
    expect(() => validateSaveComposition(request, view)).not.toThrow()
  })

  it("accepts an entirely empty composition", () => {
    const view = makeView()
    const request = makeRequest({
      head: null,
      chest: null,
      arms: null,
      waist: null,
      legs: null,
      talisman: null,
    })
    expect(() => validateSaveComposition(request, view)).not.toThrow()
  })

  it("rejects an unknown armor reference", () => {
    const view = makeView()
    const request = makeRequest({ head: { armorId: "nope", decorations: [] } })
    expectCode(() => validateSaveComposition(request, view), "ARMOR_NOT_FOUND")
  })

  it("rejects an armor placed in the wrong body position", () => {
    const view = makeView()
    const request = makeRequest({
      head: { armorId: "armor-chest", decorations: [] },
    })
    expectCode(
      () => validateSaveComposition(request, view),
      "INVALID_ARMOR_POSITION",
    )
  })

  it("rejects an unknown decoration reference", () => {
    const view = makeView()
    const request = makeRequest({
      head: {
        armorId: "armor-head",
        decorations: [{ slotIndex: 0, decorationId: "nope" }],
      },
    })
    expectCode(
      () => validateSaveComposition(request, view),
      "DECORATION_NOT_FOUND",
    )
  })

  it("rejects a decoration assigned to a nonexistent slot", () => {
    const view = makeView()
    // armor-head has two slots (indexes 0,1); index 2 is out of range.
    const request = makeRequest({
      head: {
        armorId: "armor-head",
        decorations: [{ slotIndex: 2, decorationId: "deco-armor-1" }],
      },
    })
    expectCode(
      () => validateSaveComposition(request, view),
      "DECORATION_SLOT_OUT_OF_RANGE",
    )
  })

  it("rejects two decorations in the same slot", () => {
    const view = makeView()
    const request = makeRequest({
      head: {
        armorId: "armor-head",
        decorations: [
          { slotIndex: 0, decorationId: "deco-armor-1" },
          { slotIndex: 0, decorationId: "deco-armor-1" },
        ],
      },
    })
    expectCode(
      () => validateSaveComposition(request, view),
      "DECORATION_SLOT_DUPLICATE",
    )
  })

  it("rejects a weapon decoration in an armor slot", () => {
    const view = makeView()
    const request = makeRequest({
      head: {
        armorId: "armor-head",
        decorations: [{ slotIndex: 0, decorationId: "deco-weapon-1" }],
      },
    })
    expectCode(
      () => validateSaveComposition(request, view),
      "DECORATION_SLOT_TYPE_MISMATCH",
    )
  })

  it("rejects a decoration larger than its slot", () => {
    const view = makeView()
    // deco-armor-big requires size 3; armor-head slot 1 is size 1.
    const request = makeRequest({
      head: {
        armorId: "armor-head",
        decorations: [{ slotIndex: 1, decorationId: "deco-armor-big" }],
      },
    })
    expectCode(
      () => validateSaveComposition(request, view),
      "DECORATION_SLOT_TOO_SMALL",
    )
  })

  it("rejects a scraped talisman that is not in the catalog", () => {
    const view = makeView()
    const request = makeRequest({
      talisman: { source: "scraped", talismanId: "nope", decorations: [] },
    })
    expectCode(
      () => validateSaveComposition(request, view),
      "TALISMAN_NOT_FOUND",
    )
  })

  it("rejects an armor id used as a scraped talisman", () => {
    const view = makeView()
    const request = makeRequest({
      talisman: {
        source: "scraped",
        talismanId: "armor-head",
        decorations: [],
      },
    })
    expectCode(
      () => validateSaveComposition(request, view),
      "TALISMAN_NOT_FOUND",
    )
  })

  it("rejects decorations on a slotless scraped talisman", () => {
    const view = makeView()
    const request = makeRequest({
      talisman: {
        source: "scraped",
        talismanId: "tali-scraped",
        decorations: [{ slotIndex: 0, decorationId: "deco-armor-1" }],
      },
    })
    expectCode(
      () => validateSaveComposition(request, view),
      "DECORATION_SLOT_OUT_OF_RANGE",
    )
  })

  it("rejects a custom talisman that was not resolved for the caller", () => {
    const view = makeView({ customTalisman: null })
    const request = makeRequest({
      talisman: { source: "custom", talismanId: "ct-1", decorations: [] },
    })
    expectCode(
      () => validateSaveComposition(request, view),
      "TALISMAN_NOT_OWNED",
    )
  })

  it("rejects a custom talisman id that does not match the resolved one", () => {
    const view = makeView()
    const request = makeRequest({
      talisman: { source: "custom", talismanId: "other-ct", decorations: [] },
    })
    expectCode(
      () => validateSaveComposition(request, view),
      "TALISMAN_NOT_OWNED",
    )
  })

  it("accepts a weapon decoration in a custom talisman weapon slot", () => {
    const view = makeView()
    const request = makeRequest({
      talisman: {
        source: "custom",
        talismanId: "ct-1",
        decorations: [{ slotIndex: 0, decorationId: "deco-weapon-1" }],
      },
    })
    expect(() => validateSaveComposition(request, view)).not.toThrow()
  })

  it("rejects an armor decoration in a custom talisman weapon slot", () => {
    const view = makeView()
    // ct-1 slot 0 is a weapon slot; an armor decoration mismatches.
    const request = makeRequest({
      talisman: {
        source: "custom",
        talismanId: "ct-1",
        decorations: [{ slotIndex: 0, decorationId: "deco-armor-1" }],
      },
    })
    expectCode(
      () => validateSaveComposition(request, view),
      "DECORATION_SLOT_TYPE_MISMATCH",
    )
  })

  // ── weapon bonus contribution ───────────────────────────────────────────────

  it("accepts a weapon contributing both a Set and a Group Bonus", () => {
    const view = makeView()
    const request = makeRequest({
      weapon: { setBonusId: "bn-set", groupBonusId: "bn-group" },
    })
    expect(() => validateSaveComposition(request, view)).not.toThrow()
  })

  it("accepts a weapon contributing only a Set Bonus", () => {
    const view = makeView()
    const request = makeRequest({
      weapon: { setBonusId: "bn-set", groupBonusId: null },
    })
    expect(() => validateSaveComposition(request, view)).not.toThrow()
  })

  it("accepts a weapon contributing only a Group Bonus", () => {
    const view = makeView()
    const request = makeRequest({
      weapon: { setBonusId: null, groupBonusId: "bn-group" },
    })
    expect(() => validateSaveComposition(request, view)).not.toThrow()
  })

  it("accepts a null weapon (no contribution)", () => {
    const view = makeView()
    const request = makeRequest({ weapon: null })
    expect(() => validateSaveComposition(request, view)).not.toThrow()
  })

  it("rejects an unknown weapon set-bonus reference", () => {
    const view = makeView()
    const request = makeRequest({
      weapon: { setBonusId: "nope", groupBonusId: null },
    })
    expectCode(
      () => validateSaveComposition(request, view),
      "WEAPON_BONUS_NOT_FOUND",
    )
  })

  it("rejects an unknown weapon group-bonus reference", () => {
    const view = makeView()
    const request = makeRequest({
      weapon: { setBonusId: null, groupBonusId: "nope" },
    })
    expectCode(
      () => validateSaveComposition(request, view),
      "WEAPON_BONUS_NOT_FOUND",
    )
  })

  it("rejects a Group Bonus id supplied as the weapon's set-bonus slot", () => {
    const view = makeView()
    const request = makeRequest({
      weapon: { setBonusId: "bn-group", groupBonusId: null },
    })
    expectCode(
      () => validateSaveComposition(request, view),
      "WEAPON_BONUS_KIND_MISMATCH",
    )
  })

  it("rejects a Set Bonus id supplied as the weapon's group-bonus slot", () => {
    const view = makeView()
    const request = makeRequest({
      weapon: { setBonusId: null, groupBonusId: "bn-set" },
    })
    expectCode(
      () => validateSaveComposition(request, view),
      "WEAPON_BONUS_KIND_MISMATCH",
    )
  })
})
