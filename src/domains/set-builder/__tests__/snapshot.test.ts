import { describe, expect, it } from "vitest"
import { buildSnapshotSchema } from "../schema"
import { buildSnapshot } from "../snapshot"
import { makeRequest, makeView } from "./fixtures"

describe("buildSnapshot", () => {
  it("produces a schemaVersion-1 snapshot that satisfies the wire contract", () => {
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

    const snapshot = buildSnapshot(request, view)

    expect(snapshot.schemaVersion).toBe(1)
    expect(() => buildSnapshotSchema.parse(snapshot)).not.toThrow()
  })

  it("leaves empty positions null and dictionaries empty", () => {
    const snapshot = buildSnapshot(makeRequest(), makeView())
    expect(snapshot.positions).toEqual({
      head: null,
      chest: null,
      arms: null,
      waist: null,
      legs: null,
      talisman: null,
    })
    expect(snapshot.skillDefinitions).toEqual({})
    expect(snapshot.bonusDefinitions).toEqual({})
  })

  it("copies trusted armor values and decoration grants from the catalog", () => {
    const view = makeView()
    const request = makeRequest({
      head: {
        armorId: "armor-head",
        decorations: [{ slotIndex: 0, decorationId: "deco-armor-1" }],
      },
    })

    const head = buildSnapshot(request, view).positions.head!

    expect(head.armorId).toBe("armor-head")
    expect(head.type).toBe("head")
    expect(head.defense).toBe(40)
    expect(head.slots).toEqual([3, 1])
    expect(head.skills).toEqual([
      { skillId: "sk-attack", name: "Attack Boost", level: 2 },
    ])
    expect(head.bonuses).toEqual([
      { bonusId: "bn-set", name: "Example Set", kind: "set" },
    ])
    expect(head.decorations).toEqual([
      {
        slotIndex: 0,
        decorationId: "deco-armor-1",
        name: "Attack Jewel",
        slotSize: 1,
        skills: [{ skillId: "sk-attack", name: "Attack Boost", level: 1 }],
      },
    ])
  })

  it("collects skill maxima and bonus thresholds referenced anywhere in the build", () => {
    const view = makeView()
    const request = makeRequest({
      head: {
        armorId: "armor-head",
        decorations: [{ slotIndex: 0, decorationId: "deco-armor-1" }],
      }, // sk-attack + bn-set
      chest: { armorId: "armor-chest", decorations: [] }, // sk-guard
      talisman: {
        source: "custom",
        talismanId: "ct-1",
        decorations: [{ slotIndex: 0, decorationId: "deco-weapon-1" }],
      }, // sk-tali + sk-crit
    })

    const { skillDefinitions, bonusDefinitions } = buildSnapshot(request, view)

    expect(skillDefinitions).toEqual({
      "Attack Boost": 5,
      Guard: 5,
      Handicraft: 5,
      "Critical Eye": 5,
    })
    expect(bonusDefinitions).toEqual({
      "Example Set": {
        kind: "set",
        thresholds: [
          { piecesRequired: 2, effectName: "Set Effect I", level: 1 },
          { piecesRequired: 4, effectName: "Set Effect II", level: 2 },
        ],
      },
    })
  })

  it("snapshots a custom talisman with resolved skill names, typed slots, and no bonuses", () => {
    const view = makeView()
    const request = makeRequest({
      talisman: { source: "custom", talismanId: "ct-1", decorations: [] },
    })

    const talisman = buildSnapshot(request, view).positions.talisman!

    expect(talisman).toMatchObject({
      source: "custom",
      talismanId: "ct-1",
      name: "My Talisman",
      slots: [
        { type: "weapon", size: 1 },
        { type: "armor", size: 2 },
      ],
      skills: [{ skillId: "sk-tali", name: "Handicraft", level: 1 }],
      bonuses: [],
      decorations: [],
    })
  })

  it("snapshots a scraped talisman as slotless with its skills", () => {
    const view = makeView()
    const request = makeRequest({
      talisman: {
        source: "scraped",
        talismanId: "tali-scraped",
        decorations: [],
      },
    })

    const talisman = buildSnapshot(request, view).positions.talisman!

    expect(talisman).toMatchObject({
      source: "scraped",
      talismanId: "tali-scraped",
      name: "Scraped Charm",
      slots: [],
      skills: [{ skillId: "sk-crit", name: "Critical Eye", level: 1 }],
    })
  })
})
