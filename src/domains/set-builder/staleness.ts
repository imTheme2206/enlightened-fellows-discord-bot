import type {
  ArmorCatalogItem,
  DecorationCatalogItem,
  WeaponCatalogItem,
} from "../mh-wilds-catalog/schema"
import type {
  BuildSnapshot,
  SnapshotArmorPiece,
  SnapshotBonus,
  SnapshotDecoration,
  SnapshotTalisman,
  SnapshotWeapon,
} from "./schema"

/**
 * Pure staleness derivation (CONTEXT.md "Stale Build", ADR-0005). A Saved Build is
 * stale when any referenced component is no longer available in its current source,
 * or its calculation-relevant values no longer match the snapshot taken at save
 * time. Insert-only scraping (ADR-0007) means a present catalog id keeps its
 * values, but operator corrections can still change them, so this compares values
 * as well as existence rather than trusting presence alone.
 *
 * Staleness is computed identically for owners and anonymous UUID readers, so it
 * must not depend on private data: custom talismans are immutable once created and
 * are checked by existence only (their id set is resolved without exposing owner
 * identity — see the service).
 */
export type StalenessCatalog = {
  armorsById: Map<string, ArmorCatalogItem>
  decorationsById: Map<string, DecorationCatalogItem>
  weaponsById: Map<string, WeaponCatalogItem>
  /** Skill name → current maximum level. */
  skillMaxByName: Map<string, number>
  /** Bonus name → current kind + ordered thresholds. */
  bonusesByName: Map<string, BuildSnapshot["bonusDefinitions"][string]>
  /** Ids of custom talismans that still exist (existence only — values are immutable). */
  existingCustomTalismanIds: Set<string>
}

// ── order-independent structural keys ────────────────────────────────────────

function grantsKey(
  grants: { skillId: string; name: string; level: number }[],
): string {
  return JSON.stringify(
    [...grants]
      .sort((a, b) => a.skillId.localeCompare(b.skillId))
      .map((g) => [g.skillId, g.name, g.level]),
  )
}

function membershipsKey(
  bonuses: { bonusId: string; name: string; kind: string }[],
): string {
  return JSON.stringify(
    [...bonuses]
      .sort((a, b) => a.bonusId.localeCompare(b.bonusId))
      .map((b) => [b.bonusId, b.name, b.kind]),
  )
}

function thresholdsKey(
  thresholds: { piecesRequired: number; effectName: string; level: number }[],
): string {
  return JSON.stringify(
    [...thresholds]
      .sort((a, b) => a.piecesRequired - b.piecesRequired)
      .map((t) => [t.piecesRequired, t.effectName, t.level]),
  )
}

function specialsKey(
  specials: {
    kind: string
    name: string
    damage: { raw: number; display: number }
    hidden: boolean
  }[],
): string {
  return JSON.stringify(
    specials
      .map((s) => [s.kind, s.name, s.damage.raw, s.damage.display, s.hidden])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  )
}

function sharpnessTuple(
  s: {
    red: number
    orange: number
    yellow: number
    green: number
    blue: number
    white: number
    purple: number
  } | null,
): number[] | null {
  return s
    ? [s.red, s.orange, s.yellow, s.green, s.blue, s.white, s.purple]
    : null
}

function resistancesEqual(
  a: SnapshotArmorPiece["resistances"],
  b: SnapshotArmorPiece["resistances"],
): boolean {
  return (
    a.fire === b.fire &&
    a.water === b.water &&
    a.thunder === b.thunder &&
    a.ice === b.ice &&
    a.dragon === b.dragon
  )
}

function numbersEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

// ── per-component checks ──────────────────────────────────────────────────────

function isDecorationStale(
  deco: SnapshotDecoration,
  catalog: StalenessCatalog,
): boolean {
  const current = catalog.decorationsById.get(deco.decorationId)
  if (!current) return true
  if (current.slotSize !== deco.slotSize) return true
  return grantsKey(current.skills) !== grantsKey(deco.skills)
}

function isArmorPieceStale(
  piece: SnapshotArmorPiece,
  catalog: StalenessCatalog,
): boolean {
  const current = catalog.armorsById.get(piece.armorId)
  if (!current) return true
  if (current.defense !== piece.defense) return true
  if (!resistancesEqual(current.resistances, piece.resistances)) return true
  if (!numbersEqual(current.slots, piece.slots)) return true
  if (grantsKey(current.skills) !== grantsKey(piece.skills)) return true
  if (membershipsKey(current.bonuses) !== membershipsKey(piece.bonuses))
    return true
  return piece.decorations.some((d) => isDecorationStale(d, catalog))
}

function isTalismanStale(
  talisman: SnapshotTalisman,
  catalog: StalenessCatalog,
): boolean {
  if (talisman.source === "custom") {
    if (!catalog.existingCustomTalismanIds.has(talisman.talismanId)) return true
  } else {
    // A scraped talisman lives in the armor catalog; compare its calc-relevant values.
    const current = catalog.armorsById.get(talisman.talismanId)
    if (!current || current.type !== "talisman") return true
    if (grantsKey(current.skills) !== grantsKey(talisman.skills)) return true
    if (
      !numbersEqual(
        current.slots,
        talisman.slots.map((s) => s.size),
      )
    ) {
      return true
    }
  }
  return talisman.decorations.some((d) => isDecorationStale(d, catalog))
}

function isWeaponBonusStale(
  bonus: SnapshotBonus | null,
  catalog: StalenessCatalog,
): boolean {
  if (!bonus) return false
  const current = catalog.bonusesByName.get(bonus.name)
  // Deeper drift (kind/thresholds) is re-checked generically below via
  // `bonusDefinitions`; here we only need "does it still exist by name".
  return !current
}

function isWeaponStale(
  weapon: SnapshotWeapon,
  catalog: StalenessCatalog,
): boolean {
  if (
    isWeaponBonusStale(weapon.setBonus, catalog) ||
    isWeaponBonusStale(weapon.groupBonus, catalog)
  ) {
    return true
  }
  // Legacy bonus-only snapshots (pre ADR-0013) carry no weapon item to compare.
  if (!weapon.weaponId) return false

  const current = catalog.weaponsById.get(weapon.weaponId)
  if (!current) return true
  if (
    current.damage.raw !== weapon.damage?.raw ||
    current.damage.display !== weapon.damage?.display
  )
    return true
  if (current.affinity !== weapon.affinity) return true
  if (specialsKey(current.specials) !== specialsKey(weapon.specials ?? []))
    return true
  if (
    JSON.stringify(sharpnessTuple(current.sharpness)) !==
    JSON.stringify(sharpnessTuple(weapon.sharpness ?? null))
  )
    return true
  if (!numbersEqual(current.slots, weapon.slots ?? [])) return true
  if (grantsKey(current.skills) !== grantsKey(weapon.skills ?? [])) return true
  return (weapon.decorations ?? []).some((d) => isDecorationStale(d, catalog))
}

// ── entry point ────────────────────────────────────────────────────────────────

export function deriveStaleness(
  snapshot: BuildSnapshot,
  catalog: StalenessCatalog,
): boolean {
  const { positions, skillDefinitions, bonusDefinitions } = snapshot

  for (const key of ["head", "chest", "arms", "waist", "legs"] as const) {
    const piece = positions[key]
    if (piece && isArmorPieceStale(piece, catalog)) return true
  }
  if (positions.talisman && isTalismanStale(positions.talisman, catalog))
    return true
  if (positions.weapon && isWeaponStale(positions.weapon, catalog)) return true

  for (const [name, maxLevel] of Object.entries(skillDefinitions)) {
    if (catalog.skillMaxByName.get(name) !== maxLevel) return true
  }
  for (const [name, def] of Object.entries(bonusDefinitions)) {
    const current = catalog.bonusesByName.get(name)
    if (
      !current ||
      current.kind !== def.kind ||
      thresholdsKey(current.thresholds) !== thresholdsKey(def.thresholds)
    ) {
      return true
    }
  }

  return false
}
