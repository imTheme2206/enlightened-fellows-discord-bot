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
  customization: null,
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
    expect(w.customization).toBeNull()
    expect(w.setBonus).toBeNull()
    expect(snapshot.skillDefinitions["Attack Boost"]).toBe(5)
    expect(snapshot.skillDefinitions["Critical Eye"]).toBe(5)
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

describe("Artian / Gogma Artian customization (ADR-0014)", () => {
  const GOGMA = "weapon-gogma-gs"
  const ARTIAN = "weapon-artian-gs"
  const gogmaConfig = {
    element: "water" as const,
    attackParts: 1,
    affinityParts: 2,
    elementInfusion: false,
    reinforcements: [
      { type: "attack" as const, level: "EX" as const },
      { type: "attack" as const, level: "EX" as const },
      { type: "affinity" as const, level: "III" as const },
      { type: "element" as const, level: "EX" as const },
      { type: "sharpness" as const, level: "EX" as const },
    ],
  }
  const gogmaWeapon = (overrides: Partial<WeaponSel> = {}) =>
    weapon({
      weaponId: GOGMA,
      setBonusId: "bn-set",
      groupBonusId: "bn-group",
      customization: gogmaConfig,
      ...overrides,
    })
  const gogmaSnapshot = () =>
    canonicalizeSaveComposition(makeRequest({ weapon: gogmaWeapon() }), makeView())

  it("snapshots effective stats, the config and both bonuses for a Gogma Artian", () => {
    const snapshot = gogmaSnapshot()
    expect(() => buildSnapshotSchema.parse(snapshot)).not.toThrow()
    const w = snapshot.positions.weapon!

    // Catalog row 180 raw / +15%: +5 attack part, +24 from two EX, +10% from two affinity parts, +8% III.
    expect(w.damage).toEqual({ raw: 209, display: 1003 })
    expect(w.affinity).toBe(15 + 10 + 8)
    // Water r8 450, Affinity Focus -10 (Great Sword), Element EX +110.
    expect(w.specials).toEqual([
      { kind: "element", name: "water", damage: { raw: 55, display: 550 }, hidden: false },
    ])
    expect(w.customization).toEqual({
      family: "gogma",
      tier: 8,
      focus: "affinity",
      config: gogmaConfig,
      base: { damage: { raw: 180, display: 864 }, affinity: 15 },
      sharpnessBonus: 50,
      ammoBonus: 0,
      gameVersion: "1.041",
    })
    expect(w.setBonus?.name).toBe("Example Set")
    expect(w.groupBonus?.name).toBe("Example Group")
    expect(snapshot.bonusDefinitions["Example Set"]).toBeDefined()
    expect(snapshot.bonusDefinitions["Example Group"]).toBeDefined()
  })

  it("records an empty configuration for an unconfigured Artian weapon", () => {
    const snapshot = canonicalizeSaveComposition(
      makeRequest({ weapon: weapon({ weaponId: ARTIAN }) }),
      makeView(),
    )
    const w = snapshot.positions.weapon!
    expect(w.damage).toEqual({ raw: 190, display: 912 })
    expect(w.customization?.family).toBe("artian")
    expect(w.customization?.config.reinforcements).toEqual([])
  })

  it("rejects a customization on a plain catalog weapon or a bonus-only weapon", () => {
    const config = { ...gogmaConfig, reinforcements: [] }
    expectCode(
      () =>
        canonicalizeSaveComposition(
          makeRequest({ weapon: weapon({ customization: config }) }),
          makeView(),
        ),
      "WEAPON_CUSTOMIZATION_NOT_ALLOWED",
    )
    expectCode(
      () =>
        canonicalizeSaveComposition(
          makeRequest({
            weapon: weapon({ weaponId: null, setBonusId: "bn-set", customization: config }),
          }),
          makeView(),
        ),
      "WEAPON_CUSTOMIZATION_NOT_ALLOWED",
    )
  })

  const invalid = (customization: WeaponSel["customization"], weaponId = GOGMA) => {
    try {
      canonicalizeSaveComposition(
        makeRequest({ weapon: gogmaWeapon({ weaponId, customization }) }),
        makeView(),
      )
    } catch (err) {
      expect(err).toBeInstanceOf(SetBuilderError)
      expect((err as SetBuilderError).code).toBe("WEAPON_CUSTOMIZATION_INVALID")
      expect((err as SetBuilderError).status).toBe(422)
      return (err as SetBuilderError).details?.reason
    }
    throw new Error("expected WEAPON_CUSTOMIZATION_INVALID")
  }

  it("rejects an element the weapon kind cannot take", () => {
    // Poison / paralysis / sleep Bows only change the coating, so they are not choosable.
    expect(
      invalid({ ...gogmaConfig, element: "poison", reinforcements: [] }, "weapon-gogma-bow"),
    ).toBe("element_not_available")
    expect(
      invalid({ ...gogmaConfig, element: "fire", reinforcements: [{ type: "sharpness", level: "I" }] }, "weapon-gogma-bow"),
    ).toBe("reinforcement_not_available")
  })

  it("rejects too many reinforcements, bad levels and too many EX of a type", () => {
    const five = gogmaConfig.reinforcements
    expect(invalid({ ...gogmaConfig, reinforcements: [...five, { type: "attack", level: "I" }] })).toBe(
      "too_many_reinforcements",
    )
    expect(
      invalid({ ...gogmaConfig, reinforcements: [{ type: "element", level: "III" }] }),
    ).toBe("reinforcement_level_not_available")
    expect(
      invalid({
        ...gogmaConfig,
        reinforcements: [
          { type: "attack", level: "EX" },
          { type: "attack", level: "EX" },
          { type: "attack", level: "EX" },
        ],
      }),
    ).toBe("too_many_ex_of_type")
    expect(
      invalid({ ...gogmaConfig, reinforcements: [{ type: "attack", level: "EX" }] }, ARTIAN),
    ).toBe("reinforcement_level_not_available")
  })

  it("requires both bonuses on a Gogma Artian and forbids them elsewhere", () => {
    expectCode(
      () =>
        canonicalizeSaveComposition(
          makeRequest({ weapon: gogmaWeapon({ groupBonusId: null }) }),
          makeView(),
        ),
      "WEAPON_BONUS_REQUIRED",
    )
    expectCode(
      () =>
        canonicalizeSaveComposition(
          makeRequest({ weapon: weapon({ weaponId: ARTIAN, setBonusId: "bn-set" }) }),
          makeView(),
        ),
      "WEAPON_BONUS_NOT_ALLOWED",
    )
    expectCode(
      () =>
        canonicalizeSaveComposition(
          makeRequest({ weapon: weapon({ setBonusId: "bn-set" }) }),
          makeView(),
        ),
      "WEAPON_BONUS_NOT_ALLOWED",
    )
  })

  it("rejects wrong-kind and unknown bonus ids on a Gogma Artian", () => {
    expectCode(
      () =>
        canonicalizeSaveComposition(
          makeRequest({ weapon: gogmaWeapon({ setBonusId: "bn-group" }) }),
          makeView(),
        ),
      "WEAPON_BONUS_KIND_MISMATCH",
    )
    expectCode(
      () =>
        canonicalizeSaveComposition(
          makeRequest({ weapon: gogmaWeapon({ groupBonusId: "bn-set" }) }),
          makeView(),
        ),
      "WEAPON_BONUS_KIND_MISMATCH",
    )
    expectCode(
      () =>
        canonicalizeSaveComposition(
          makeRequest({ weapon: gogmaWeapon({ groupBonusId: "nope" }) }),
          makeView(),
        ),
      "WEAPON_BONUS_NOT_FOUND",
    )
  })

  it("request schema accepts and defaults the customization field", () => {
    const base = {
      head: null, chest: null, arms: null, waist: null, legs: null, talisman: null,
    }
    const parsed = saveBuildRequestSchema.parse({
      name: "x",
      composition: { ...base, weapon: { weaponId: GOGMA, setBonusId: "a", groupBonusId: "b", customization: gogmaConfig } },
    })
    expect(parsed.composition.weapon?.customization).toEqual(gogmaConfig)
  })

  it("answers an unknown element or out-of-range part count with a coded 422, not a schema error", () => {
    expect(invalid({ ...gogmaConfig, element: "plasma" as never, reinforcements: [] })).toBe("unknown_value")
    expect(invalid({ ...gogmaConfig, attackParts: 7, reinforcements: [] })).toBe("unknown_value")
    expect(invalid({ ...gogmaConfig, reinforcements: [{ type: "luck" as never, level: "I" }] })).toBe("unknown_value")
    expect(invalid({ ...gogmaConfig, reinforcements: [{ type: "attack", level: "MAX" as never }] })).toBe("unknown_value")
  })

  it("is fresh when unchanged and stale when the base row or the config's effect changes", () => {
    expect(deriveStaleness(gogmaSnapshot(), freshCatalog())).toBe(false)

    const rebalanced = freshCatalog()
    rebalanced.weaponsById.set(GOGMA, { ...WEAPONS[3], damage: { raw: 190, display: 912 } })
    expect(deriveStaleness(gogmaSnapshot(), rebalanced)).toBe(true)

    const reclassified = freshCatalog()
    reclassified.weaponsById.set(GOGMA, { ...WEAPONS[3], artian: null })
    expect(deriveStaleness(gogmaSnapshot(), reclassified)).toBe(true)

    const tampered = gogmaSnapshot()
    tampered.positions.weapon!.damage = { raw: 999, display: 999 }
    expect(deriveStaleness(tampered, freshCatalog())).toBe(true)
  })
})
