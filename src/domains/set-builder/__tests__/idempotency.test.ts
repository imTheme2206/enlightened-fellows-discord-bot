import { describe, expect, it } from "vitest"
import { hashPayload } from "../service"
import { makeRequest } from "./fixtures"

describe("hashPayload", () => {
  it("is stable across independent-but-equal requests", () => {
    const a = makeRequest({
      head: {
        armorId: "armor-head",
        decorations: [{ slotIndex: 0, decorationId: "deco-armor-1" }],
      },
    })
    const b = makeRequest({
      head: {
        armorId: "armor-head",
        decorations: [{ slotIndex: 0, decorationId: "deco-armor-1" }],
      },
    })
    expect(hashPayload(a)).toBe(hashPayload(b))
  })

  it("ignores metadata key ordering but is content-sensitive", () => {
    const base = makeRequest({
      chest: { armorId: "armor-chest", decorations: [] },
    })
    expect(hashPayload({ ...base })).toBe(hashPayload(base))
    expect(hashPayload({ ...base, name: "Different" })).not.toBe(
      hashPayload(base),
    )
  })

  it("treats a missing description the same as an explicit null", () => {
    const withNull = makeRequest({}, { description: null })
    const withUndefined = makeRequest({}, { description: undefined })
    expect(hashPayload(withNull)).toBe(hashPayload(withUndefined))
  })

  it("changes when composition or sharing changes", () => {
    const base = makeRequest({
      head: { armorId: "armor-head", decorations: [] },
    })
    const shared = makeRequest(
      { head: { armorId: "armor-head", decorations: [] } },
      { isShared: true },
    )
    const reordered = makeRequest({
      head: {
        armorId: "armor-head",
        decorations: [
          { slotIndex: 1, decorationId: "deco-armor-1" },
          { slotIndex: 0, decorationId: "deco-armor-1" },
        ],
      },
    })
    expect(hashPayload(base)).not.toBe(hashPayload(shared))
    // Decoration order is caller-defined and part of the payload identity.
    expect(hashPayload(base)).not.toBe(hashPayload(reordered))
  })
})
