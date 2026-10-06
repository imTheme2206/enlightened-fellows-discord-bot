import type { CatalogView } from "./catalog-view"
import { SetBuilderError } from "./errors"
import type { CompositionRequest, SaveBuildRequest } from "./schema"

/**
 * Pure structural/reference validation of a Save composition against a
 * backend-owned `CatalogView` (design doc §Save validation). Internal
 * implementation detail of `canonicalizeSaveComposition` (canonicalize.ts), the
 * single save-time seam; not called directly outside this domain. It enforces
 * every rule that does not need a DB round-trip:
 *
 *   - each referenced catalog item exists (catalog reads only return active items);
 *   - each armor id matches its fixed body position;
 *   - a custom talisman was resolved for the authenticated owner;
 *   - each decoration targets one existing slot index at most once;
 *   - decoration armor/weapon type matches the slot type;
 *   - the slot is at least the decoration's required size;
 *   - a weapon exists and its decorations fit its weapon-type slots;
 *   - a weapon's Set/Group Bonus references resolve and match their slot's kind.
 *
 * Per-user save/share limits and idempotency are enforced in the service layer,
 * which needs live counts. Missing pieces and empty slots are valid; duplicate
 * decoration *types* are valid because inventory is not modeled.
 */

const BODY_POSITIONS = ["head", "chest", "arms", "waist", "legs"] as const
type BodyPosition = (typeof BODY_POSITIONS)[number]

/** A slot expressed uniformly for validation: body slots are always armor-typed. */
type Slot = { type: "weapon" | "armor"; size: number }

function validateDecorations(
  position: BodyPosition | "talisman" | "weapon",
  decorations: { slotIndex: number; decorationId: string }[],
  slots: Slot[],
  view: CatalogView,
): void {
  const seen = new Set<number>()

  for (const assignment of decorations) {
    const { slotIndex, decorationId } = assignment

    if (slotIndex >= slots.length) {
      throw new SetBuilderError("DECORATION_SLOT_OUT_OF_RANGE", {
        position,
        slotIndex,
      })
    }
    if (seen.has(slotIndex)) {
      throw new SetBuilderError("DECORATION_SLOT_DUPLICATE", {
        position,
        slotIndex,
      })
    }
    seen.add(slotIndex)

    const decoration = view.decorationsById.get(decorationId)
    if (!decoration) {
      throw new SetBuilderError("DECORATION_NOT_FOUND", {
        position,
        slotIndex,
        decorationId,
      })
    }

    const slot = slots[slotIndex]
    if (decoration.type !== slot.type) {
      throw new SetBuilderError("DECORATION_SLOT_TYPE_MISMATCH", {
        position,
        slotIndex,
        slotType: slot.type,
        decorationType: decoration.type,
      })
    }
    if (decoration.slotSize > slot.size) {
      throw new SetBuilderError("DECORATION_SLOT_TOO_SMALL", {
        position,
        slotIndex,
        slotSize: slot.size,
        requiredSize: decoration.slotSize,
      })
    }
  }
}

/**
 * A weapon's `weaponId` (when set) must exist in the weapon catalog, and its
 * decorations must fit its weapon-type slots (ADR-0013). A null `weaponId` is a
 * bonus-only weapon with no slots, so any decoration on it is out of range. Its
 * bonus references are resolved against the shared bonus catalog, each
 * independently, and each must resolve to the kind matching its slot: `setBonusId`
 * to a Set Bonus, `groupBonusId` to a Group Bonus.
 */
function validateWeapon(
  weapon: CompositionRequest["weapon"],
  view: CatalogView,
): void {
  if (!weapon) return

  let slots: Slot[] = []
  if (weapon.weaponId !== null) {
    const item = view.weaponsById.get(weapon.weaponId)
    if (!item) {
      throw new SetBuilderError("WEAPON_NOT_FOUND", {
        weaponId: weapon.weaponId,
      })
    }
    slots = item.slots.map((size) => ({ type: "weapon", size }))
  }
  validateDecorations("weapon", weapon.decorations, slots, view)

  if (weapon.setBonusId !== null) {
    const bonus = view.bonusesById.get(weapon.setBonusId)
    if (!bonus) {
      throw new SetBuilderError("WEAPON_BONUS_NOT_FOUND", {
        slot: "set",
        bonusId: weapon.setBonusId,
      })
    }
    if (bonus.kind !== "set") {
      throw new SetBuilderError("WEAPON_BONUS_KIND_MISMATCH", {
        slot: "set",
        bonusId: weapon.setBonusId,
        actualKind: bonus.kind,
      })
    }
  }

  if (weapon.groupBonusId !== null) {
    const bonus = view.bonusesById.get(weapon.groupBonusId)
    if (!bonus) {
      throw new SetBuilderError("WEAPON_BONUS_NOT_FOUND", {
        slot: "group",
        bonusId: weapon.groupBonusId,
      })
    }
    if (bonus.kind !== "group") {
      throw new SetBuilderError("WEAPON_BONUS_KIND_MISMATCH", {
        slot: "group",
        bonusId: weapon.groupBonusId,
        actualKind: bonus.kind,
      })
    }
  }
}

export function validateSaveComposition(
  request: SaveBuildRequest,
  view: CatalogView,
): void {
  const composition: CompositionRequest = request.composition

  for (const position of BODY_POSITIONS) {
    const selection = composition[position]
    if (!selection) continue

    const armor = view.armorsById.get(selection.armorId)
    if (!armor) {
      throw new SetBuilderError("ARMOR_NOT_FOUND", {
        position,
        armorId: selection.armorId,
      })
    }
    if (armor.type !== position) {
      throw new SetBuilderError("INVALID_ARMOR_POSITION", {
        position,
        actualType: armor.type,
      })
    }

    const slots: Slot[] = armor.slots.map((size) => ({ type: "armor", size }))
    validateDecorations(position, selection.decorations, slots, view)
  }

  validateWeapon(composition.weapon, view)

  const talisman = composition.talisman
  if (!talisman) return

  if (talisman.source === "scraped") {
    const armor = view.armorsById.get(talisman.talismanId)
    if (!armor || armor.type !== "talisman") {
      throw new SetBuilderError("TALISMAN_NOT_FOUND", {
        talismanId: talisman.talismanId,
      })
    }
    const slots: Slot[] = armor.slots.map((size) => ({ type: "armor", size }))
    validateDecorations("talisman", talisman.decorations, slots, view)
    return
  }

  // source === 'custom' — resolved only when found AND owned by the caller.
  const custom = view.customTalisman
  if (!custom || custom.id !== talisman.talismanId) {
    throw new SetBuilderError("TALISMAN_NOT_OWNED", {
      talismanId: talisman.talismanId,
    })
  }
  validateDecorations("talisman", talisman.decorations, custom.slots, view)
}
