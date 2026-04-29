import type { ArmorPiece, DecorationItem } from "../types";
import type { SlotType } from "./constants";

export function isEmpty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}

export function mergeSumMaps(
  maps: Array<Record<string, number>>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m)) {
      result[k] = (result[k] ?? 0) + v;
    }
  }
  return result;
}

export function hasNeededSkill(
  pieceSkills: Record<string, number>,
  neededSkills: Record<string, number>,
): boolean {
  return Object.keys(pieceSkills).some((sk) => sk in neededSkills);
}

export function isInSets(
  piece: ArmorPiece,
  setSkills: Record<string, number>,
): boolean {
  return piece.setSkills.some((sk) => sk in setSkills);
}

export function isInGroups(
  piece: ArmorPiece,
  groupSkills: Record<string, number>,
): boolean {
  return piece.groupSkills.some((sk) => sk in groupSkills);
}

export function emptyGearSet(): Record<SlotType, Record<string, ArmorPiece>> {
  return { head: {}, chest: {}, arms: {}, waist: {}, legs: {}, talisman: {} };
}

/** Returns a "None" placeholder piece so DFS always has at least one option per slot. */
export function emptyGearPiece(
  type: SlotType,
  rank: string,
): Record<string, ArmorPiece> {
  return {
    None: {
      name: "None",
      type: type as ArmorPiece["type"],
      skills: {},
      groupSkills: [],
      slots: [],
      defense: 0,
      resists: [0, 0, 0, 0, 0],
      rank: rank as "low" | "high" | "master",
      setSkills: [],
    },
  };
}

/** Returns decorations whose skills overlap with the requested skills. */
export function getBestDecos(
  skills: Record<string, number>,
  allDecos: DecorationItem[],
): Record<string, DecorationItem> {
  return Object.fromEntries(
    allDecos
      .filter((d) => hasNeededSkill(d.skills, skills))
      .sort((a, b) => {
        const totalA = Object.values(a.skills).reduce((s, v) => s + v, 0);
        const totalB = Object.values(b.skills).reduce((s, v) => s + v, 0);
        return totalB - totalA;
      })
      .map((d) => [d.name, d]),
  );
}

/** Computes the skill potential of a single armor piece given the desired decos. */
export function getSkillPotential(
  piece: ArmorPiece,
  skillName: string,
  decos: Record<string, DecorationItem>,
  allSkills: Record<string, number>,
): {
  points: number;
  leftoverSlots: number[];
  extraPoints: number;
  modPoints: number;
} {
  const filteredDecos = Object.values(decos)
    .filter((d) => skillName in d.skills)
    .map((d) => ({ level: d.skills[skillName] ?? 0, slotSize: d.slotSize }))
    .sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return b.slotSize - a.slotSize;
    });

  const otherDecoSlotSizes = Object.values(decos)
    .filter((d) => !(skillName in d.skills))
    .map((d) => d.slotSize);

  const extraPoints = Object.entries(piece.skills)
    .filter(([sk]) => sk !== skillName)
    .reduce((sum, [sk]) => sum + (allSkills[sk] !== undefined ? 5 : 1), 0);

  let maxPoints = 0;
  const leftoverSlots = [...piece.slots];

  for (const { level, slotSize } of filteredDecos) {
    let summation = 0;
    const workingSlots = [...piece.slots];

    for (const slot of workingSlots) {
      if (slotSize <= slot) {
        const popIdx = leftoverSlots.indexOf(slot);
        if (popIdx !== -1) leftoverSlots.splice(popIdx, 1);
        summation += level;
      }
    }

    maxPoints = Math.max(summation, maxPoints);
  }

  const points = maxPoints + (piece.skills[skillName] ?? 0);
  const modPoints =
    points + leftoverSlots.filter((s) => otherDecoSlotSizes.includes(s)).length;

  return { points, leftoverSlots, extraPoints, modPoints };
}

export function groupArmorIntoSets(
  armorPieces: Record<string, ArmorPiece>,
  setSkills: Record<string, number>,
  groupSkills: Record<string, number>,
): [
  Record<string, Record<string, ArmorPiece>>,
  Record<string, Record<string, ArmorPiece>>,
] {
  const groups: Record<string, Record<string, ArmorPiece>> = {};
  const groupsEmpty: Record<string, Record<string, ArmorPiece>> = {};

  for (const [armorName, piece] of Object.entries(armorPieces)) {
    for (const setName of piece.setSkills) {
      if (setName && setSkills[setName]) {
        groups[setName] ??= {};
        groupsEmpty[setName] ??= {};
        groups[setName][armorName] = piece;
      }
    }
    for (const groupName of piece.groupSkills) {
      if (groupName && groupSkills[groupName]) {
        groups[groupName] ??= {};
        groupsEmpty[groupName] ??= {};
        groups[groupName][armorName] = piece;
      }
    }
  }

  return [groups, groupsEmpty];
}

export const skillRelevanceScore = (
  piece: ArmorPiece,
  skills: Record<string, number>,
  decos: Record<string, DecorationItem>,
): number => {
  let score = 0;
  for (const skillName of Object.keys(skills)) {
    score += piece.skills[skillName] ?? 0;
    if (piece.type !== "talisman") {
      for (const deco of Object.values(decos)) {
        if (deco.skills[skillName]) {
          score +=
            deco.skills[skillName] *
            piece.slots.filter((s) => s >= deco.slotSize).length;
          break;
        }
      }
    }
  }
  return score;
};
