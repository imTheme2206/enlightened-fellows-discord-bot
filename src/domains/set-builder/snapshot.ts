import type { CatalogView } from "./catalog-view"
import { SetBuilderError } from "./errors"
import type {
  BuildSnapshot,
  CompositionRequest,
  SaveBuildRequest,
  SnapshotArmorPiece,
  SnapshotDecoration,
  SnapshotTalisman,
  SnapshotWeapon,
} from "./schema"

/**
 * Builds the trusted `schemaVersion: 1` composition snapshot from backend-owned
 * catalog + owner data (design doc §Save validation and snapshot construction).
 * It never trusts caller-supplied stats — every value is copied from the
 * `CatalogView`. Internal implementation detail of `canonicalizeSaveComposition`
 * (canonicalize.ts), the single save-time seam — callers there run
 * `validateSaveComposition` first, so this function assumes references resolve
 * and treats a miss as an internal invariant break. Not called directly outside
 * this domain.
 *
 * The result is self-contained: `skillDefinitions` (name → maxLevel) and
 * `bonusDefinitions` (name → kind + thresholds) collect every Skill/Bonus
 * referenced anywhere in the build — including the weapon's Set/Group Bonus
 * contribution — so a web/bot calculator never has to consult the live catalog
 * (ADR-0005, ADR-0010).
 */

const BODY_POSITIONS = ["head", "chest", "arms", "waist", "legs"] as const

export function buildSnapshot(
  request: SaveBuildRequest,
  view: CatalogView,
): BuildSnapshot {
  const composition: CompositionRequest = request.composition

  const skillDefinitions: Record<string, number> = {}
  const bonusDefinitions: BuildSnapshot["bonusDefinitions"] = {}

  const recordSkill = (skillId: string) => {
    const s = view.skillsById.get(skillId)
    if (s) skillDefinitions[s.name] = s.maxLevel
  }
  const recordBonus = (bonusId: string) => {
    const b = view.bonusesById.get(bonusId)
    if (b) bonusDefinitions[b.name] = { kind: b.kind, thresholds: b.thresholds }
  }

  const snapshotDecoration = (assignment: {
    slotIndex: number
    decorationId: string
  }): SnapshotDecoration => {
    const d = view.decorationsById.get(assignment.decorationId)
    if (!d)
      throw new SetBuilderError("DECORATION_NOT_FOUND", {
        decorationId: assignment.decorationId,
      })
    d.skills.forEach((s) => recordSkill(s.skillId))
    return {
      slotIndex: assignment.slotIndex,
      decorationId: d.id,
      name: d.name,
      slotSize: d.slotSize,
      skills: d.skills.map((s) => ({
        skillId: s.skillId,
        name: s.name,
        level: s.level,
      })),
    }
  }

  const positions = {
    head: null as SnapshotArmorPiece | null,
    chest: null as SnapshotArmorPiece | null,
    arms: null as SnapshotArmorPiece | null,
    waist: null as SnapshotArmorPiece | null,
    legs: null as SnapshotArmorPiece | null,
    talisman: null as SnapshotTalisman | null,
    weapon: null as SnapshotWeapon | null,
  }

  for (const position of BODY_POSITIONS) {
    const selection = composition[position]
    if (!selection) continue

    const a = view.armorsById.get(selection.armorId)
    if (!a)
      throw new SetBuilderError("ARMOR_NOT_FOUND", {
        position,
        armorId: selection.armorId,
      })
    a.skills.forEach((s) => recordSkill(s.skillId))
    a.bonuses.forEach((b) => recordBonus(b.bonusId))

    positions[position] = {
      armorId: a.id,
      name: a.name,
      type: position,
      rank: a.rank,
      rarity: a.rarity,
      defense: a.defense,
      resistances: a.resistances,
      slots: a.slots,
      skills: a.skills.map((s) => ({
        skillId: s.skillId,
        name: s.name,
        level: s.level,
      })),
      bonuses: a.bonuses.map((b) => ({
        bonusId: b.bonusId,
        name: b.name,
        kind: b.kind,
      })),
      decorations: selection.decorations.map(snapshotDecoration),
    }
  }

  const talisman = composition.talisman
  if (talisman) {
    if (talisman.source === "scraped") {
      const a = view.armorsById.get(talisman.talismanId)
      if (!a)
        throw new SetBuilderError("TALISMAN_NOT_FOUND", {
          talismanId: talisman.talismanId,
        })
      a.skills.forEach((s) => recordSkill(s.skillId))
      a.bonuses.forEach((b) => recordBonus(b.bonusId))
      positions.talisman = {
        source: "scraped",
        talismanId: a.id,
        name: a.name,
        slots: a.slots.map((size) => ({ type: "armor", size })),
        skills: a.skills.map((s) => ({
          skillId: s.skillId,
          name: s.name,
          level: s.level,
        })),
        bonuses: a.bonuses.map((b) => ({
          bonusId: b.bonusId,
          name: b.name,
          kind: b.kind,
        })),
        decorations: talisman.decorations.map(snapshotDecoration),
      }
    } else {
      const custom = view.customTalisman
      if (!custom || custom.id !== talisman.talismanId) {
        throw new SetBuilderError("TALISMAN_NOT_OWNED", {
          talismanId: talisman.talismanId,
        })
      }
      custom.skills.forEach((s) => recordSkill(s.skillId))
      positions.talisman = {
        source: "custom",
        talismanId: custom.id,
        name: custom.name,
        slots: custom.slots,
        skills: custom.skills.map((s) => ({
          skillId: s.skillId,
          name: view.skillsById.get(s.skillId)?.name ?? "Unknown",
          level: s.level,
        })),
        bonuses: [],
        decorations: talisman.decorations.map(snapshotDecoration),
      }
    }
  }

  const weapon = composition.weapon
  if (weapon) {
    let setBonus: SnapshotWeapon["setBonus"] = null
    if (weapon.setBonusId !== null) {
      const b = view.bonusesById.get(weapon.setBonusId)
      if (!b)
        throw new SetBuilderError("WEAPON_BONUS_NOT_FOUND", {
          slot: "set",
          bonusId: weapon.setBonusId,
        })
      recordBonus(b.id)
      setBonus = { bonusId: b.id, name: b.name, kind: b.kind }
    }

    let groupBonus: SnapshotWeapon["groupBonus"] = null
    if (weapon.groupBonusId !== null) {
      const b = view.bonusesById.get(weapon.groupBonusId)
      if (!b)
        throw new SetBuilderError("WEAPON_BONUS_NOT_FOUND", {
          slot: "group",
          bonusId: weapon.groupBonusId,
        })
      recordBonus(b.id)
      groupBonus = { bonusId: b.id, name: b.name, kind: b.kind }
    }

    positions.weapon = { setBonus, groupBonus }
  }

  return { schemaVersion: 1, positions, skillDefinitions, bonusDefinitions }
}
