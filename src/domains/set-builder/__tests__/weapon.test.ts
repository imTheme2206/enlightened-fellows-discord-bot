import { describe, expect, it } from "vitest"
import { canonicalizeSaveComposition } from "../canonicalize"
import type { SetBuilderErrorCode } from "../errors"
import { SetBuilderError } from "../errors"
import { buildSnapshotSchema, saveBuildRequestSchema } from "../schema"
import type { BuildSnapshot, CompositionRequest } from "../schema"
import { deriveStaleness, type StalenessCatalog } from "../staleness"
import { ARMORS, DECORATIONS, SKILLS, WEAPONS, makeRequest, makeView } from "./fixtures"

type WeaponSel = NonNullable<CompositionRequest["weapon"]>

const weapon = (overrides: Partial<WeaponSel> = {}): WeaponSel => ({
  weaponId: "weapon-gs",
  decorations: [],
  setBonusId: null,
  groupBonusId: null,
  ...overrides,
})

const expectCode = (fn: () => void, code: SetBuilderErrorCode) => {
  try {
    fn()
  } catch (err) {
    expect(err).toBeInstanceOf(SetBuilderError)
    expect((err as SetBuilderError).code).toBe(code)
    return
  }
  throw new Error(`expected SetBuilderError(${code}) but nothing was thrown`)
}

const freshCatalog = (): StalenessCatalog => ({
  armorsById: new Map(ARMORS.map((a) => [a.id, a])),
  decorationsById: new Map(DECORATIONS.map((d) => [d.id, d])),
  weaponsById: new Map(WEAPONS.map((w) => [w.id, w])),
  skillMaxByName: new Map(SKILLS.skills.map((s) => [s.name, s.maxLevel])),
  bonusesByName: new Map(
    SKILLS.bonuses.map((b) => [b.name, { kind: b.kind, thresholds: b.thresholds }]),
  ),
  existingCustomTalismanIds: new Set(),
})

const weaponSnapshot = () =>
  canonicalizeSaveComposition(
    makeRequest({
      weapon: weapon({
        decorations: [{ slotIndex: 0, decorationId: "deco-weapon-1" }],
        setBonusId: "bn-set",
      }),
    }),
    makeView(),
  )

describe("weapon in a Saved Build", () => {
  it("snapshots the weapon item, its decorations, and skill definitions", () => {
    const snapshot = weaponSnapshot()
    expect(() => buildSnapshotSchema.parse(snapshot)).not.toThrow()

    const w = snapshot.positions.weapon!
    expect(w.weaponId).toBe("weapon-gs")
    expect(w.name).toBe("Test Greatsword")
    expect(w.kind).toBe("great-sword")
    expect(w.rarity).toBe(8)
    expect(w.damage).toEqual({ raw: 1000, display: 200 })
    expect(w.affinity).toBe(10)
    expect(w.slots).toEqual([3, 1])
    expect(w.sharpness?.blue).toBe(80)
    expect(w.skills).toEqual([{ skillId: "sk-attack", name: "Attack Boost", level: 1 }])
    expect(w.decorations).toEqual([
      {
        slotIndex: 0,
        decorationId: "deco-weapon-1",
        name: "Critical Jewel",
        slotSize: 1,
        skills: [{ skillId: "sk-crit", name: "Critical Eye", level: 1 }],
      },
    ])
    expect(w.setBonus?.name).toBe("Example Set")
    expect(snapshot.skillDefinitions["Attack Boost"]).toBe(5)
    expect(snapshot.skillDefinitions["Critical Eye"]).toBe(5)
    expect(snapshot.bonusDefinitions["Example Set"]).toBeDefined()
  })

  it("accepts a weapon decoration in a fitting weapon slot (smaller deco in larger slot)", () => {
    expect(() =>
      canonicalizeSaveComposition(
        makeRequest({
          weapon: weapon({ decorations: [{ slotIndex: 0, decorationId: "deco-weapon-1" }] }),
        }),
        makeView(),
      ),
    ).not.toThrow()
  })

  it("rejects an unknown weapon id", () => {
    expectCode(
      () =>
        canonicalizeSaveComposition(
          makeRequest({ weapon: weapon({ weaponId: "nope" }) }),
          makeView(),
        ),
      "WEAPON_NOT_FOUND",
    )
  })

  it("rejects an armor decoration in a weapon slot", () => {
    expectCode(
      () =>
        canonicalizeSaveComposition(
          makeRequest({
            weapon: weapon({ decorations: [{ slotIndex: 0, decorationId: "deco-armor-1" }] }),
          }),
          makeView(),
        ),
      "DECORATION_SLOT_TYPE_MISMATCH",
    )
  })

  it("rejects a decoration larger than the weapon slot", () => {
    const view = makeView()
    view.decorationsById.set("deco-weapon-big", {
      id: "deco-weapon-big",
      name: "Big Weapon Jewel",
      type: "weapon",
      slotSize: 3,
      skills: [],
    })
    expectCode(
      () =>
        canonicalizeSaveComposition(
          makeRequest({
            weapon: weapon({ decorations: [{ slotIndex: 1, decorationId: "deco-weapon-big" }] }),
          }),
          view,
        ),
      "DECORATION_SLOT_TOO_SMALL",
    )
  })

  it("rejects a decoration on a slotless weapon or a bonus-only weapon", () => {
    const decorations = [{ slotIndex: 0, decorationId: "deco-weapon-1" }]
    expectCode(
      () =>
        canonicalizeSaveComposition(
          makeRequest({ weapon: weapon({ weaponId: "weapon-bow", decorations }) }),
          makeView(),
        ),
      "DECORATION_SLOT_OUT_OF_RANGE",
    )
    expectCode(
      () =>
        canonicalizeSaveComposition(
          makeRequest({ weapon: weapon({ weaponId: null, decorations }) }),
          makeView(),
        ),
      "DECORATION_SLOT_OUT_OF_RANGE",
    )
  })

  it("request schema defaults weaponId/decorations for bonus-only clients", () => {
    const parsed = saveBuildRequestSchema.parse({
      name: "x",
      composition: {
        head: null, chest: null, arms: null, waist: null, legs: null, talisman: null,
        weapon: { setBonusId: "bn-set", groupBonusId: null },
      },
    })
    expect(parsed.composition.weapon).toEqual({
      weaponId: null,
      decorations: [],
      setBonusId: "bn-set",
      groupBonusId: null,
    })
  })
})

describe("weapon staleness", () => {
  it("is fresh when the weapon is unchanged", () => {
    expect(deriveStaleness(weaponSnapshot(), freshCatalog())).toBe(false)
  })

  it("is stale when the weapon disappeared", () => {
    const catalog = freshCatalog()
    catalog.weaponsById.delete("weapon-gs")
    expect(deriveStaleness(weaponSnapshot(), catalog)).toBe(true)
  })

  it("is stale when weapon damage, affinity, slots, or skills change", () => {
    const base = WEAPONS[0]
    const changes = [
      { damage: { raw: 1100, display: 220 } },
      { affinity: 15 },
      { slots: [3] },
      { skills: [{ skillId: "sk-attack", name: "Attack Boost", level: 2 }] },
    ]
    for (const change of changes) {
      const catalog = freshCatalog()
      catalog.weaponsById.set("weapon-gs", { ...base, ...change })
      expect(deriveStaleness(weaponSnapshot(), catalog)).toBe(true)
    }
  })

  it("is stale when an element/status special changes, order-insensitively otherwise", () => {
    const base = WEAPONS[0]
    const el = base.specials[0]
    const cases = [
      [{ ...el, damage: { raw: 160, display: 16 } }],
      [{ ...el, name: "water" }],
      [{ ...el, hidden: true }],
      [],
      [el, { ...el, kind: "status" as const, name: "poison" }],
    ]
    for (const specials of cases) {
      const catalog = freshCatalog()
      catalog.weaponsById.set("weapon-gs", { ...base, specials })
      expect(deriveStaleness(weaponSnapshot(), catalog)).toBe(true)
    }
    // Same specials in a different order are not stale.
    const two = [el, { ...el, kind: "status" as const, name: "poison" }]
    const snap = canonicalizeSaveComposition(makeRequest({ weapon: weapon() }), makeView())
    snap.positions.weapon!.specials = two
    const catalog = freshCatalog()
    catalog.weaponsById.set("weapon-gs", { ...base, specials: [...two].reverse() })
    expect(deriveStaleness(snap, catalog)).toBe(false)
  })

  it("is stale when sharpness changes or appears/disappears", () => {
    const base = WEAPONS[0]
    for (const sharpness of [
      { ...base.sharpness!, blue: 90 },
      { ...base.sharpness!, white: 10 },
      null,
    ]) {
      const catalog = freshCatalog()
      catalog.weaponsById.set("weapon-gs", { ...base, sharpness })
      expect(deriveStaleness(weaponSnapshot(), catalog)).toBe(true)
    }
  })

  it("is stale when a weapon decoration is retired or changes", () => {
    const retired = freshCatalog()
    retired.decorationsById.delete("deco-weapon-1")
    expect(deriveStaleness(weaponSnapshot(), retired)).toBe(true)

    const changed = freshCatalog()
    changed.decorationsById.set("deco-weapon-1", { ...DECORATIONS[2], slotSize: 2 })
    expect(deriveStaleness(weaponSnapshot(), changed)).toBe(true)
  })
})

describe("legacy bonus-only weapon snapshot (pre ADR-0013)", () => {
  // Exactly what the backend stored before weapons became catalog items.
  const legacy = {
    schemaVersion: 1,
    positions: {
      head: null,
      chest: null,
      arms: null,
      waist: null,
      legs: null,
      talisman: null,
      weapon: {
        setBonus: { bonusId: "bn-set", name: "Example Set", kind: "set" },
        groupBonus: null,
      },
    },
    skillDefinitions: {},
    bonusDefinitions: {
      "Example Set": { kind: "set", thresholds: SKILLS.bonuses[0].thresholds },
    },
  }

  it("still parses and is not stale", () => {
    const snapshot = buildSnapshotSchema.parse(legacy) as BuildSnapshot
    expect(snapshot.positions.weapon?.weaponId).toBeUndefined()
    expect(snapshot.positions.weapon?.setBonus?.name).toBe("Example Set")
    expect(deriveStaleness(snapshot, freshCatalog())).toBe(false)
  })
})
