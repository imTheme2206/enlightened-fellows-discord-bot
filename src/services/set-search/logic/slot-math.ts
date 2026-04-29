import type { ArmorPiece } from "../types";
import { SLOT_COUNT } from "./constants";

/** Core slot comparison: iterates forward (reverse=false) or backward (reverse=true). */
function compareSlots(
  a: number[],
  b: number[],
  reverse = false,
  fallback = 0,
): number {
  for (
    let i = reverse ? SLOT_COUNT - 1 : 0;
    reverse ? i >= 0 : i < SLOT_COUNT;
    reverse ? i-- : i++
  ) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return bv - av;
  }
  return fallback;
}

/** Returns true if any slot in left is greater than the corresponding slot in right. */
function anySlotGreater(
  left: number[],
  right: number[],
  reverse = false,
): boolean {
  for (
    let i = reverse ? SLOT_COUNT - 1 : 0;
    reverse ? i >= 0 : i < SLOT_COUNT;
    reverse ? i-- : i++
  ) {
    if ((left[i] ?? 0) > (right[i] ?? 0)) return true;
  }
  return false;
}

/** Compares by highest slot first (index 0 → 2). Higher wins. */
export function slottageSizeCompare(
  a: number[],
  b: number[],
  fallback = 0,
): number {
  return compareSlots(a, b, false, fallback);
}

/** Compares by most slots first (index 2 → 0). More slots wins. */
export function slottageLengthCompare(
  a: number[],
  b: number[],
  fallback = 0,
): number {
  return compareSlots(a, b, true, fallback);
}

export function areLeftSlotsBigger(left: number[], right: number[]): boolean {
  return anySlotGreater(left, right, false);
}

export function areLeftSlotsLonger(left: number[], right: number[]): boolean {
  return anySlotGreater(left, right, true);
}

export function slotsEqual(a: number[], b: number[]): boolean {
  for (let i = 0; i < SLOT_COUNT; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return false;
  }
  return true;
}

export function slotCompare(
  topSlots: number[],
  trySlots: number[],
): "equal" | boolean {
  if (slotsEqual(trySlots, topSlots)) return "equal";
  return (
    areLeftSlotsLonger(trySlots, topSlots) ||
    areLeftSlotsBigger(trySlots, topSlots)
  );
}

export function hasBiggerSlottage(
  armors: Record<string, ArmorPiece>,
  challengerSlots: number[],
): boolean {
  if (!armors || Object.keys(armors).length === 0) return true;
  const sorted = Object.values(armors).sort((a, b) =>
    slottageSizeCompare(a.slots, b.slots),
  );
  return areLeftSlotsBigger(challengerSlots, sorted[0].slots);
}

export function hasLongerSlottage(
  armors: Record<string, ArmorPiece>,
  challengerSlots: number[],
): boolean {
  if (!armors || Object.keys(armors).length === 0) return true;
  const sorted = Object.values(armors).sort((a, b) =>
    slottageLengthCompare(a.slots, b.slots),
  );
  return areLeftSlotsLonger(challengerSlots, sorted[0].slots);
}
