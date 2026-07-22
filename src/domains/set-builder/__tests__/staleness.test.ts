import { describe, expect, it } from "vitest"
import { buildSnapshot } from "../snapshot"
import { deriveStaleness, type StalenessCatalog } from "../staleness"
import { ARMORS, DECORATIONS, SKILLS, makeRequest, makeView } from "./fixtures"

/** A fresh snapshot referencing armor, a decoration, a bonus, and a custom talisman. */
function sampleSnapshot() {
  return buildSnapshot(
    makeRequest({
      head: {
        armorId: "armor-head",
        decorations: [{ slotIndex: 0, decorationId: "deco-armor-1" }],
      },
      talisman: { source: "custom", talismanId: "ct-1", decorations: [] },
    }),
    makeView(),
  )
}

/** A staleness catalog that currently matches everything in `sampleSnapshot`. */
function freshCatalog(): StalenessCatalog {
  return {
    armorsById: new Map(ARMORS.map((a) => [a.id, a])),
    decorationsById: new Map(DECORATIONS.map((d) => [d.id, d])),
    skillMaxByName: new Map(SKILLS.skills.map((s) => [s.name, s.maxLevel])),
    bonusesByName: new Map(
      SKILLS.bonuses.map((b) => [
        b.name,
        { kind: b.kind, thresholds: b.thresholds },
      ]),
    ),
    existingCustomTalismanIds: new Set(["ct-1"]),
  }
}

describe("deriveStaleness", () => {
  it("is not stale when the catalog still matches the snapshot", () => {
    expect(deriveStaleness(sampleSnapshot(), freshCatalog())).toBe(false)
  })

  it("is not stale for an empty build", () => {
    const snapshot = buildSnapshot(makeRequest(), makeView())
    expect(deriveStaleness(snapshot, freshCatalog())).toBe(false)
  })

  it("is stale when a referenced armor piece is retired from the catalog", () => {
    const catalog = freshCatalog()
    catalog.armorsById.delete("armor-head")
    expect(deriveStaleness(sampleSnapshot(), catalog)).toBe(true)
  })

  it("is stale when a referenced armor value changes (operator correction)", () => {
    const catalog = freshCatalog()
    catalog.armorsById.set("armor-head", { ...ARMORS[0], defense: 999 })
    expect(deriveStaleness(sampleSnapshot(), catalog)).toBe(true)
  })

  it("is stale when a referenced decoration is retired", () => {
    const catalog = freshCatalog()
    catalog.decorationsById.delete("deco-armor-1")
    expect(deriveStaleness(sampleSnapshot(), catalog)).toBe(true)
  })

  it("is stale when a referenced skill maximum changes", () => {
    const catalog = freshCatalog()
    catalog.skillMaxByName.set("Attack Boost", 7)
    expect(deriveStaleness(sampleSnapshot(), catalog)).toBe(true)
  })

  it("is stale when a referenced bonus threshold changes", () => {
    const catalog = freshCatalog()
    catalog.bonusesByName.set("Example Set", {
      kind: "set",
      thresholds: [{ piecesRequired: 3, effectName: "Changed", level: 1 }],
    })
    expect(deriveStaleness(sampleSnapshot(), catalog)).toBe(true)
  })

  it("is stale when an embedded custom talisman no longer exists", () => {
    const catalog = freshCatalog()
    catalog.existingCustomTalismanIds = new Set()
    expect(deriveStaleness(sampleSnapshot(), catalog)).toBe(true)
  })

  it("is stale when a scraped talisman is retired", () => {
    const snapshot = buildSnapshot(
      makeRequest({
        talisman: {
          source: "scraped",
          talismanId: "tali-scraped",
          decorations: [],
        },
      }),
      makeView(),
    )
    const catalog = freshCatalog()
    catalog.armorsById.delete("tali-scraped")
    expect(deriveStaleness(snapshot, catalog)).toBe(true)
  })
})
