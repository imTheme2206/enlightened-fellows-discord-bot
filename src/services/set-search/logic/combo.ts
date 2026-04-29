import type { DecorationItem, SearchResult } from "../types";
import type { ArmorComboResult, DecoResult, PieceEntry } from "./constants";
import { ARMOR_SLOT_TYPES } from "./constants";
import { mergeSumMaps } from "./pool-helpers";

export function armorCombo(pieces: PieceEntry[]): ArmorComboResult {
  const [head, chest, arms, waist, legs, talisman] = pieces;
  const allPieces = [head, chest, arms, waist, legs, talisman];
  const armorBodyPieces = [head, chest, arms, waist, legs];

  const skillTotals: Record<string, number> = {};
  for (const [, piece] of allPieces) {
    for (const [sk, lv] of Object.entries(piece.skills)) {
      skillTotals[sk] = (skillTotals[sk] ?? 0) + lv;
    }
  }

  const slots: number[] = [];
  for (const [, piece] of armorBodyPieces) {
    slots.push(...piece.slots);
  }

  const setSkillCounts: Record<string, number> = {};
  const groupSkillCounts: Record<string, number> = {};
  let defense = 0;
  for (const [, piece] of armorBodyPieces) {
    defense += piece.defense;
    for (const sk of piece.setSkills) {
      setSkillCounts[sk] = (setSkillCounts[sk] ?? 0) + 1;
    }
    for (const gk of piece.groupSkills) {
      groupSkillCounts[gk] = (groupSkillCounts[gk] ?? 0) + 1;
    }
  }

  return {
    names: allPieces.map(([n]) => n),
    skills: Object.fromEntries(
      Object.entries(skillTotals).sort((a, b) => b[1] - a[1]),
    ),
    slots,
    setSkills: setSkillCounts,
    groupSkills: groupSkillCounts,
    defense,
  };
}

export function getDecosToFulfillSkills(
  decos: Record<string, DecorationItem>,
  desiredSkills: Record<string, number>,
  slotsAvailable: number[],
  startingSkills: Record<string, number>,
): DecoResult | null {
  if (!decos || Object.keys(decos).length === 0) return null;

  const skillsNeeded = { ...desiredSkills };
  for (const [sk, lv] of Object.entries(startingSkills)) {
    if (skillsNeeded[sk] !== undefined) {
      skillsNeeded[sk] -= lv;
      if (skillsNeeded[sk] <= 0) delete skillsNeeded[sk];
    }
  }

  if (Object.keys(skillsNeeded).length === 0) {
    return { decoNames: [], freeSlots: slotsAvailable };
  }

  const slotPool = [...slotsAvailable].sort((a, b) => a - b);

  const sortedDecos = Object.entries(decos).sort((a, b) => {
    const totalA = Object.values(a[1].skills).reduce((s, v) => s + v, 0);
    const totalB = Object.values(b[1].skills).reduce((s, v) => s + v, 0);
    if (totalB !== totalA) return totalB - totalA;
    return a[1].slotSize - b[1].slotSize;
  });

  const usedDecos: string[] = [];

  for (const [sk, neededPoints] of Object.entries(skillsNeeded)) {
    let remaining = neededPoints;
    while (remaining > 0) {
      let foundMatch = false;

      for (const [decoName, deco] of sortedDecos) {
        if (!(sk in deco.skills)) continue;
        // No inventory limits in this bot context — use decos freely
        const decoSlot = deco.slotSize;

        for (let i = 0; i < slotPool.length; i++) {
          if (slotPool[i] >= decoSlot) {
            usedDecos.push(decoName);
            slotPool.splice(i, 1);
            remaining -= deco.skills[sk];
            foundMatch = true;
            break;
          }
        }

        if (foundMatch) break;
      }

      if (!foundMatch) return null;
    }
  }

  return { decoNames: usedDecos, freeSlots: slotPool };
}

/**
 * Tests whether an armor combo satisfies the desired skills (with decos).
 * Returns a SearchResult if successful, null otherwise.
 */
export function testCombo(
  armorSet: ArmorComboResult,
  decos: Record<string, DecorationItem>,
  desiredSkills: Record<string, number>,
): SearchResult | null {
  const have: Record<string, number> = {};
  const need: Record<string, number> = {};
  let done = true;

  for (const [sk, lv] of Object.entries(desiredSkills)) {
    have[sk] = armorSet.skills[sk] ?? 0;
    need[sk] = lv - have[sk];
    if (need[sk] > 0) done = false;
  }

  if (done) {
    return {
      armorNames: armorSet.names,
      slots: armorSet.slots,
      decoNames: [],
      skills: armorSet.skills,
      setSkills: armorSet.setSkills,
      groupSkills: armorSet.groupSkills,
      freeSlots: armorSet.slots,
      defense: armorSet.defense,
    };
  }

  const decosUsed = getDecosToFulfillSkills(
    decos,
    desiredSkills,
    armorSet.slots,
    armorSet.skills,
  );
  if (!decosUsed) return null;

  const decoSkillsMap = mergeSumMaps(
    decosUsed.decoNames.map((name) => decos[name]?.skills ?? {}),
  );
  const combinedSkills = mergeSumMaps([armorSet.skills, decoSkillsMap]);

  return {
    armorNames: armorSet.names,
    slots: armorSet.slots,
    decoNames: decosUsed.decoNames,
    skills: combinedSkills,
    setSkills: armorSet.setSkills,
    groupSkills: armorSet.groupSkills,
    freeSlots: decosUsed.freeSlots,
    defense: armorSet.defense,
  };
}

/**
 * DFS pruning check: can the current partial armor set + remaining pool
 * possibly reach the required skill level?
 */
export function canArmorFulfillSkill(
  currentArmor: Record<string, PieceEntry>,
  decos: Record<string, DecorationItem>,
  skillName: string,
  skillLevel: number,
  maxPotential: Record<string, Record<string, number>>,
): boolean {
  const poolTypeList = ARMOR_SLOT_TYPES.filter((t) => !currentArmor[t]);

  let totalPoints = 0;

  // Precomputed max per remaining slot — O(1) per slot instead of O(pool × decos)
  for (const tipo of poolTypeList) {
    totalPoints += maxPotential[tipo]?.[skillName] ?? 0;
    if (totalPoints >= skillLevel) return true;
  }

  // Points from already-assigned slots (at most 6 pieces, cost is negligible)
  for (const [armorType, pieceEntry] of Object.entries(currentArmor)) {
    const piece = pieceEntry[1];
    totalPoints += piece.skills[skillName] ?? 0;
    if (armorType === "talisman") continue;
    for (const deco of Object.values(decos)) {
      const decoSkillLevel = deco.skills[skillName];
      if (decoSkillLevel) {
        totalPoints +=
          decoSkillLevel * piece.slots.filter((s) => s >= deco.slotSize).length;
        break;
      }
    }
  }

  return totalPoints >= skillLevel;
}
