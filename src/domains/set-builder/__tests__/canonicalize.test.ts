import { describe, expect, it } from "vitest"
import { buildSnapshotSchema } from "../schema"
import { canonicalizeSaveComposition } from "../canonicalize"
import type { SetBuilderErrorCode } from "../errors"
import { SetBuilderError } from "../errors"
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

describe("canonicalizeSaveComposition", () => {
  it("valid composition -> validates then returns a trusted, schema-conformant snapshot", () => {
    const view = makeView()
    const request = makeRequest({
      head: {
        armorId: "armor-head",
        decorations: [{ slotIndex: 0, decorationId: "deco-armor-1" }],
      },
      chest: { armorId: "armor-chest", decorations: [] },
      talisman: {
        source: "custom",
        talismanId: "ct-1",
        decorations: [{ slotIndex: 0, decorationId: "deco-weapon-1" }],
      },
    })

    const snapshot = canonicalizeSaveComposition(request, view)

    expect(snapshot.schemaVersion).toBe(1)
    expect(() => buildSnapshotSchema.parse(snapshot)).not.toThrow()
    expect(snapshot.positions.head?.armorId).toBe("armor-head")
    expect(snapshot.positions.talisman?.talismanId).toBe("ct-1")
  })

  it("an entirely empty composition canonicalizes to a snapshot with null positions", () => {
    const snapshot = canonicalizeSaveComposition(makeRequest(), makeView())
    expect(snapshot.positions).toEqual({
      head: null,
      chest: null,
      arms: null,
      waist: null,
      legs: null,
      talisman: null,
      weapon: null,
    })
  })

  // ── each validation failure class surfaces the same SetBuilderError code
  //    canonicalize must not swallow, wrap, or downgrade it ──────────────────

  it("unknown armor reference -> ARMOR_NOT_FOUND, no snapshot constructed", () => {
    const view = makeView()
    const request = makeRequest({ head: { armorId: "nope", decorations: [] } })
    expectCode(() => canonicalizeSaveComposition(request, view), "ARMOR_NOT_FOUND")
  })

  it("armor placed in the wrong body position -> INVALID_ARMOR_POSITION", () => {
    const view = makeView()
    // armor-chest is a chest piece, placed at head.
    const request = makeRequest({ head: { armorId: "armor-chest", decorations: [] } })
    expectCode(() => canonicalizeSaveComposition(request, view), "INVALID_ARMOR_POSITION")
  })

  it("decoration slot index out of range -> DECORATION_SLOT_OUT_OF_RANGE", () => {
    const view = makeView()
    const request = makeRequest({
      head: { armorId: "armor-head", decorations: [{ slotIndex: 5, decorationId: "deco-armor-1" }] },
    })
    expectCode(() => canonicalizeSaveComposition(request, view), "DECORATION_SLOT_OUT_OF_RANGE")
  })

  it("two decorations assigned to the same slot -> DECORATION_SLOT_DUPLICATE", () => {
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
    expectCode(() => canonicalizeSaveComposition(request, view), "DECORATION_SLOT_DUPLICATE")
  })

  it("unknown decoration reference -> DECORATION_NOT_FOUND", () => {
    const view = makeView()
    const request = makeRequest({
      head: { armorId: "armor-head", decorations: [{ slotIndex: 0, decorationId: "nope" }] },
    })
    expectCode(() => canonicalizeSaveComposition(request, view), "DECORATION_NOT_FOUND")
  })

  it("weapon decoration in an armor slot -> DECORATION_SLOT_TYPE_MISMATCH", () => {
    const view = makeView()
    const request = makeRequest({
      head: { armorId: "armor-head", decorations: [{ slotIndex: 0, decorationId: "deco-weapon-1" }] },
    })
    expectCode(() => canonicalizeSaveComposition(request, view), "DECORATION_SLOT_TYPE_MISMATCH")
  })

  it("decoration too large for the slot -> DECORATION_SLOT_TOO_SMALL", () => {
    const view = makeView()
    // deco-armor-big needs slotSize 3; armor-head slot 1 is size 1.
    const request = makeRequest({
      head: { armorId: "armor-head", decorations: [{ slotIndex: 1, decorationId: "deco-armor-big" }] },
    })
    expectCode(() => canonicalizeSaveComposition(request, view), "DECORATION_SLOT_TOO_SMALL")
  })

  it("unknown scraped talisman reference -> TALISMAN_NOT_FOUND", () => {
    const view = makeView()
    const request = makeRequest({ talisman: { source: "scraped", talismanId: "nope", decorations: [] } })
    expectCode(() => canonicalizeSaveComposition(request, view), "TALISMAN_NOT_FOUND")
  })

  it("custom talisman not owned by the caller -> TALISMAN_NOT_OWNED", () => {
    const view = makeView({ customTalisman: null })
    const request = makeRequest({ talisman: { source: "custom", talismanId: "ct-1", decorations: [] } })
    expectCode(() => canonicalizeSaveComposition(request, view), "TALISMAN_NOT_OWNED")
  })

  // ── snapshot values must come from the catalog view, never caller input ────

  it("snapshot values are sourced from the catalog view, ignoring any stat-like fields on the request", () => {
    const view = makeView()
    const request = makeRequest({
      head: { armorId: "armor-head", decorations: [{ slotIndex: 0, decorationId: "deco-armor-1" }] },
    })
    // The Save request shape only carries references (armorId/decorationId) —
    // simulate a caller that tried to smuggle trusted-looking fields in.
    const tampered = {
      ...request,
      composition: {
        ...request.composition,
        head: {
          ...request.composition.head!,
          // Deliberately not part of ArmorSelection; canonicalize must ignore
          // these if present. (Spreading widens the literal, so no
          // excess-property error fires here and no ts-expect-error is needed.)
          defense: 99999,
          name: "Attacker-Supplied Name",
        },
      },
    }

    const snapshot = canonicalizeSaveComposition(tampered, view)
    const head = snapshot.positions.head!

    // Values must match the catalog fixture (defense 40, name "Test Helm"),
    // never the tampered request fields.
    expect(head.defense).toBe(40)
    expect(head.name).toBe("Test Helm")
    expect(head.skills).toEqual([{ skillId: "sk-attack", name: "Attack Boost", level: 2 }])
  })

  // ── weapon bonus contribution ───────────────────────────────────────────────

  it("canonicalizes a weapon's Set + Group Bonus contribution into the snapshot and bonusDefinitions", () => {
    const view = makeView()
    const request = makeRequest({
      weapon: { setBonusId: "bn-set", groupBonusId: "bn-group" },
    })

    const snapshot = canonicalizeSaveComposition(request, view)

    expect(() => buildSnapshotSchema.parse(snapshot)).not.toThrow()
    expect(snapshot.positions.weapon).toEqual({
      setBonus: { bonusId: "bn-set", name: "Example Set", kind: "set" },
      groupBonus: { bonusId: "bn-group", name: "Example Group", kind: "group" },
    })
    expect(snapshot.bonusDefinitions["Example Set"].kind).toBe("set")
    expect(snapshot.bonusDefinitions["Example Group"].kind).toBe("group")
  })

  it("a weapon contributing a Group Bonus in the Set slot -> WEAPON_BONUS_KIND_MISMATCH, no snapshot constructed", () => {
    const view = makeView()
    const request = makeRequest({
      weapon: { setBonusId: "bn-group", groupBonusId: null },
    })
    expectCode(
      () => canonicalizeSaveComposition(request, view),
      "WEAPON_BONUS_KIND_MISMATCH",
    )
  })

  it("an unknown weapon bonus reference -> WEAPON_BONUS_NOT_FOUND", () => {
    const view = makeView()
    const request = makeRequest({
      weapon: { setBonusId: "nope", groupBonusId: null },
    })
    expectCode(
      () => canonicalizeSaveComposition(request, view),
      "WEAPON_BONUS_NOT_FOUND",
    )
  })

  it("a null weapon canonicalizes with a null weapon position and contributes nothing", () => {
    const view = makeView()
    const request = makeRequest({ weapon: null })
    const snapshot = canonicalizeSaveComposition(request, view)
    expect(snapshot.positions.weapon).toBeNull()
    expect(snapshot.bonusDefinitions).toEqual({})
  })

  it("validation runs before snapshot construction: an invalid composition never reaches buildSnapshot", () => {
    const view = makeView()
    // Reference both a bad armor id (fails validation) — if buildSnapshot ran
    // first it would throw its own ARMOR_NOT_FOUND too, but with a different
    // stack; the important invariant is validation's error code wins and no
    // partial snapshot is ever visible to the caller.
    const request = makeRequest({ head: { armorId: "nope", decorations: [] } })
    let thrown: unknown
    try {
      canonicalizeSaveComposition(request, view)
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(SetBuilderError)
    expect((thrown as SetBuilderError).code).toBe("ARMOR_NOT_FOUND")
  })
})
