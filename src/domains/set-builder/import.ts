import type { CustomTalisman } from "../../infra/db/schema"
import type {
  ArmorCatalogItem,
  DecorationCatalogItem,
  SkillCatalogResponse,
} from "../mh-wilds-catalog/schema"
import { SetBuilderError } from "./errors"
import type { CompositionRequest, ImportBuildRequest } from "./schema"

/**
 * Pure port of the frontend's optimizer-result → Save-request transform
 * (design doc: import a Set Search result into a saved Build). It resolves the
 * name-based, aggregate `SearchResultDto` against a backend-owned, name-indexed
 * slice of the catalog and greedily packs its flat decoration list into the
 * open slots it just collected — producing the very `CompositionRequest` that
 * `canonicalizeSaveComposition` (canonicalize.ts) already knows how to validate
 * and snapshot. No DB/service calls happen here; the service layer resolves the
 * catalog + owner data and calls this function before delegating to `create()`.
 *
 * Differences from the client-side reference:
 *   - a talisman name that does not resolve to a scraped talisman falls back to
 *     the owner's custom talismans (the client only ever had scraped catalog
 *     data to search);
 *   - the weapon's Set/Group Bonus contribution is resolved here too, by name,
 *     against the shared bonus catalog.
 */

type BonusCatalogEntry = SkillCatalogResponse["bonuses"][number]

export type ImportCatalogInput = {
  armors: ArmorCatalogItem[]
  decorations: DecorationCatalogItem[]
  bonuses: BonusCatalogEntry[]
}

const BODY_POSITIONS = ["head", "chest", "arms", "waist", "legs"] as const
type BodyPosition = (typeof BODY_POSITIONS)[number]
/** Mirrors `SearchResultDto.armorNames`/`rarities`: 6 slots, talisman last. */
const RESULT_POSITIONS = [...BODY_POSITIONS, "talisman"] as const
type ResultPosition = (typeof RESULT_POSITIONS)[number]

type DecorationAssignment = { slotIndex: number; decorationId: string }

/** An armor/talisman piece's not-yet-filled slot, tracked across the whole build. */
type OpenSlot = {
  position: ResultPosition
  slotIndex: number
  size: number
  type: "armor" | "weapon"
}

type ArmorSelectionDraft = {
  armorId: string
  decorations: DecorationAssignment[]
}
type TalismanSelectionDraft = {
  source: "custom" | "scraped"
  talismanId: string
  decorations: DecorationAssignment[]
}

export function buildImportComposition(
  request: ImportBuildRequest,
  catalog: ImportCatalogInput,
  ownerCustomTalismans: CustomTalisman[],
): CompositionRequest {
  const { result } = request

  const armorSelections: Record<BodyPosition, ArmorSelectionDraft | null> = {
    head: null,
    chest: null,
    arms: null,
    waist: null,
    legs: null,
  }
  let talismanSelection: TalismanSelectionDraft | null = null
  const openSlots: OpenSlot[] = []

  RESULT_POSITIONS.forEach((position, i) => {
    const armorName = result.armorNames[i]
    if (!armorName) return // empty position

    if (position === "talisman") {
      talismanSelection = resolveTalisman(
        armorName,
        catalog.armors,
        ownerCustomTalismans,
        openSlots,
      )
      return
    }

    const rarity = result.rarities[i]
    const armor = catalog.armors.find(
      (a) => a.type === position && a.name === armorName && a.rarity === rarity,
    )
    if (!armor) throw missingFromCatalog(armorName, { position })

    armor.slots.forEach((size, slotIndex) =>
      openSlots.push({ position, slotIndex, size, type: "armor" }),
    )
    armorSelections[position] = { armorId: armor.id, decorations: [] }
  })

  packDecorations(result.decoNames, catalog.decorations, openSlots, {
    armorSelections,
    talismanSelection,
  })

  return {
    head: armorSelections.head,
    chest: armorSelections.chest,
    arms: armorSelections.arms,
    waist: armorSelections.waist,
    legs: armorSelections.legs,
    talisman: talismanSelection,
    weapon: resolveWeapon(request.weapon, catalog.bonuses),
  }
}

/** Scraped talismans are tried first; a name that only matches a custom talisman falls back to it. */
function resolveTalisman(
  armorName: string,
  armors: ArmorCatalogItem[],
  ownerCustomTalismans: CustomTalisman[],
  openSlots: OpenSlot[],
): TalismanSelectionDraft {
  const scraped = armors.find(
    (a) => a.type === "talisman" && a.name === armorName,
  )
  if (scraped) {
    scraped.slots.forEach((size, slotIndex) =>
      openSlots.push({ position: "talisman", slotIndex, size, type: "armor" }),
    )
    return { source: "scraped", talismanId: scraped.id, decorations: [] }
  }

  const custom = ownerCustomTalismans.find((t) => t.name === armorName)
  if (custom) {
    custom.slots.forEach((slot, slotIndex) =>
      openSlots.push({
        position: "talisman",
        slotIndex,
        size: slot.size,
        type: slot.type,
      }),
    )
    return { source: "custom", talismanId: custom.id, decorations: [] }
  }

  throw new SetBuilderError(
    "TALISMAN_NOT_FOUND",
    { armorName },
    `${armorName} is missing from the current armor catalog.`,
  )
}

/**
 * Resolves every `decoNames` entry, then greedily packs them largest-first into
 * the smallest open slot that fits — matching the client reference exactly.
 * Only `type: 'armor'` decorations are ever produced by the optimizer, so a
 * weapon-typed slot (possible on a custom talisman) is never a valid target and
 * is simply skipped by the type match below.
 */
function packDecorations(
  decoNames: string[],
  decorations: DecorationCatalogItem[],
  openSlots: OpenSlot[],
  targets: {
    armorSelections: Record<BodyPosition, ArmorSelectionDraft | null>
    talismanSelection: TalismanSelectionDraft | null
  },
): void {
  const resolved = decoNames
    .map((name) => {
      const deco = decorations.find((d) => d.name === name && d.type === "armor")
      if (!deco) {
        throw new SetBuilderError("DECORATION_NOT_FOUND", { decorationName: name })
      }
      return deco
    })
    .sort((a, b) => b.slotSize - a.slotSize)

  for (const deco of resolved) {
    let bestIndex = -1
    for (let i = 0; i < openSlots.length; i++) {
      const slot = openSlots[i]
      if (slot.type !== "armor" || slot.size < deco.slotSize) continue
      if (bestIndex === -1 || slot.size < openSlots[bestIndex].size) bestIndex = i
    }
    if (bestIndex === -1) {
      throw new SetBuilderError(
        "DECORATION_SLOT_TOO_SMALL",
        { decorationName: deco.name },
        `No slot can hold ${deco.name}.`,
      )
    }

    const slot = openSlots[bestIndex]
    const assignment: DecorationAssignment = {
      slotIndex: slot.slotIndex,
      decorationId: deco.id,
    }
    if (slot.position === "talisman") {
      targets.talismanSelection!.decorations.push(assignment)
    } else {
      targets.armorSelections[slot.position]!.decorations.push(assignment)
    }
    openSlots.splice(bestIndex, 1)
  }
}

/** Resolves the weapon's Set/Group Bonus contribution by name; either may be absent. */
function resolveWeapon(
  weapon: ImportBuildRequest["weapon"],
  bonuses: BonusCatalogEntry[],
): CompositionRequest["weapon"] {
  return {
    setBonusId: weapon.setBonus
      ? resolveBonus(weapon.setBonus, "set", bonuses).id
      : null,
    groupBonusId: weapon.groupBonus
      ? resolveBonus(weapon.groupBonus, "group", bonuses).id
      : null,
  }
}

function resolveBonus(
  name: string,
  kind: "set" | "group",
  bonuses: BonusCatalogEntry[],
): BonusCatalogEntry {
  const bonus = bonuses.find((b) => b.name === name)
  if (!bonus) {
    throw new SetBuilderError("WEAPON_BONUS_NOT_FOUND", { slot: kind, name })
  }
  if (bonus.kind !== kind) {
    throw new SetBuilderError("WEAPON_BONUS_KIND_MISMATCH", {
      slot: kind,
      name,
      actualKind: bonus.kind,
    })
  }
  return bonus
}

function missingFromCatalog(
  armorName: string,
  details: Record<string, unknown>,
): SetBuilderError {
  return new SetBuilderError(
    "ARMOR_NOT_FOUND",
    { armorName, ...details },
    `${armorName} is missing from the current armor catalog.`,
  )
}
