/**
 * Set-search logic ported from mhwilds-set-search/src/util/logic.js + tools.js.
 * Uses proper ArmorPiece objects instead of compact arrays, so no _x accessor needed.
 */

import type {
  ArmorPiece,
  DecorationItem,
  SearchInput,
  SearchResult,
  SetSearchIndex,
} from "./types";

// ─── Constants ───────────────────────────────────────────────────────────────

const LIMIT = 500_000;
const MAX_RESULTS = 20;
const ARMOR_SLOT_TYPES = [
  "head",
  "chest",
  "arms",
  "waist",
  "legs",
  "talisman",
] as const;
type SlotType = (typeof ARMOR_SLOT_TYPES)[number];

// ─── Internal compact-style representation used inside DFS ───────────────────

/** A piece entry as used inside the DFS: [name, ArmorPiece] */
type PieceEntry = [string, ArmorPiece];

/** Gear pool: one record per slot type containing candidate pieces */
interface GearPool {
  head: Record<string, ArmorPiece>;
  chest: Record<string, ArmorPiece>;
  arms: Record<string, ArmorPiece>;
  waist: Record<string, ArmorPiece>;
  legs: Record<string, ArmorPiece>;
  talisman: Record<string, ArmorPiece>;
  decos: Record<string, DecorationItem>;
}

// ─── Utility helpers (ported from tools.js) ──────────────────────────────────

function isEmpty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}

function mergeSumMaps(
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

function slottageSizeCompare(a: number[], b: number[], fallback = 0): number {
  for (let i = 0; i < 3; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return bv - av;
  }
  return fallback;
}

function slottageLengthCompare(a: number[], b: number[], fallback = 0): number {
  for (let i = 2; i >= 0; i--) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return bv - av;
  }
  return fallback;
}

function areLeftSlotsBigger(left: number[], right: number[]): boolean {
  for (let i = 0; i < 3; i++) {
    if ((left[i] ?? 0) > (right[i] ?? 0)) return true;
  }
  return false;
}

function areLeftSlotsLonger(left: number[], right: number[]): boolean {
  for (let i = 2; i >= 0; i--) {
    if ((left[i] ?? 0) > (right[i] ?? 0)) return true;
  }
  return false;
}

function areSlotsEqual(a: number[], b: number[]): boolean {
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return false;
  }
  return true;
}

function slotCompare(
  topSlots: number[],
  trySlots: number[],
): "equal" | boolean {
  const equal = areSlotsEqual(trySlots, topSlots);
  if (equal) return "equal";
  return (
    areLeftSlotsLonger(trySlots, topSlots) ||
    areLeftSlotsBigger(trySlots, topSlots)
  );
}

function hasBiggerSlottage(
  armors: Record<string, ArmorPiece>,
  challengerSlots: number[],
): boolean {
  if (!armors || isEmpty(armors as Record<string, unknown>)) return true;
  const sorted = Object.values(armors).sort((a, b) =>
    slottageSizeCompare(a.slots, b.slots),
  );
  return areLeftSlotsBigger(challengerSlots, sorted[0].slots);
}

function hasLongerSlottage(
  armors: Record<string, ArmorPiece>,
  challengerSlots: number[],
): boolean {
  if (!armors || isEmpty(armors as Record<string, unknown>)) return true;
  const sorted = Object.values(armors).sort((a, b) =>
    slottageLengthCompare(a.slots, b.slots),
  );
  return areLeftSlotsLonger(challengerSlots, sorted[0].slots);
}

function hasNeededSkill(
  pieceSkills: Record<string, number>,
  neededSkills: Record<string, number>,
): boolean {
  return Object.keys(pieceSkills).some((sk) => sk in neededSkills);
}

function isInSets(
  piece: ArmorPiece,
  setSkills: Record<string, number>,
): boolean {
  return piece.setSkills.some((sk) => sk in setSkills);
}

function isInGroups(
  piece: ArmorPiece,
  groupSkills: Record<string, number>,
): boolean {
  return piece.groupSkills.some((sk) => sk in groupSkills);
}

function emptyGearSet(): Record<SlotType, Record<string, ArmorPiece>> {
  return { head: {}, chest: {}, arms: {}, waist: {}, legs: {}, talisman: {} };
}

/** Returns a "None" placeholder piece for the given type so DFS always has at least one option. */
function emptyGearPiece(
  type: SlotType,
  rank: string,
): Record<string, ArmorPiece> {
  if (type === "talisman") {
    return {
      None: {
        name: "None",
        type: "talisman",
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
function getBestDecos(
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
function getSkillPotential(
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

interface SkillPotentialAlias {
  best?: string;
  more?: string[];
  points?: number;
  slots?: number[];
  extraPoints?: number;
  leftoverSlots?: number[];
  defense?: number;
}

/** Updates the skill potential tracking structures for one piece/skill combination. */
function updateSkillPotential(
  skillPotential: Record<string, Record<string, SkillPotentialAlias>>,
  totalSkillPotential: Record<string, number>,
  modPointMap: Record<string, number>,
  category: string,
  skillName: string,
  armorName: string,
  piece: ArmorPiece,
  decos: Record<string, DecorationItem>,
  allSkills: Record<string, number>,
  groupName: string | null = null,
): {
  pot: Record<string, Record<string, SkillPotentialAlias>>;
  totalPot: Record<string, number>;
  modMap: Record<string, number>;
} {
  const { points, leftoverSlots, extraPoints, modPoints } = getSkillPotential(
    piece,
    skillName,
    decos,
    allSkills,
  );
  modPointMap[armorName] = modPoints;

  skillPotential[category] ??= {};
  let alias: SkillPotentialAlias;

  if (groupName) {
    const catGroup = skillPotential[category] as Record<
      string,
      Record<string, SkillPotentialAlias>
    >;
    catGroup[groupName] ??= {};
    catGroup[groupName][skillName] ??= {};
    alias = catGroup[groupName][skillName];
  } else {
    skillPotential[category][skillName] ??= {};
    alias = skillPotential[category][skillName];
  }

  const applyForMore = (newApplicant: string) => {
    const morePool = alias.more ?? [];
    if (
      morePool.every(
        (p) => (modPointMap[newApplicant] ?? 0) >= (modPointMap[p] ?? 0),
      )
    ) {
      morePool.push(newApplicant);
      alias.more = morePool;
    }
  };

  const aliasUpdate = (keys: string[] = []) => {
    const oldBest = alias.best;
    alias.best = armorName;
    alias.points = points;
    alias.slots = piece.slots;
    if (keys.includes("extra_points")) alias.extraPoints = extraPoints;
    else alias.extraPoints ??= 0;
    if (keys.includes("leftover_slots")) alias.leftoverSlots = leftoverSlots;
    else alias.leftoverSlots ??= [];
    alias.defense = piece.defense;

    if (oldBest && (modPointMap[oldBest] ?? 0) >= modPoints) {
      applyForMore(oldBest);
    }

    totalSkillPotential[skillName] =
      (totalSkillPotential[skillName] ?? 0) + points;
  };

  const currentPoints = alias.points ?? 0;
  const compare = slotCompare(alias.leftoverSlots ?? [], leftoverSlots);

  if (points > currentPoints) {
    aliasUpdate(["leftover_slots", "extra_points"]);
  } else if (points === currentPoints && compare) {
    if (compare === "equal") {
      const bestExtraPoints = alias.extraPoints ?? 0;
      if (areLeftSlotsBigger(piece.slots, alias.slots ?? [])) {
        aliasUpdate();
      } else if (extraPoints > bestExtraPoints) {
        aliasUpdate(["extra_points"]);
      } else if (extraPoints === bestExtraPoints) {
        if (piece.defense > (alias.defense ?? 0)) {
          aliasUpdate();
        }
      }
    } else {
      aliasUpdate(["leftover_slots"]);
    }
  } else if (
    points < currentPoints &&
    modPoints > (modPointMap[armorName] ?? 0)
  ) {
    applyForMore(armorName);
  }

  return {
    pot: skillPotential,
    totalPot: totalSkillPotential,
    modMap: modPointMap,
  };
}

function groupArmorIntoSets(
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

// ─── getBestArmor ─────────────────────────────────────────────────────────────

/**
 * Filters and scores the armor pool to find the best candidates per slot type.
 * Ported faithfully from logic.js getBestArmor().
 */
function getBestArmor(
  skills: Record<string, number>,
  setSkills: Record<string, number>,
  groupSkills: Record<string, number>,
  mandatoryPieceNames: (string | null | undefined)[],
  blacklistedArmor: string[],
  allArmorByType: Record<string, ArmorPiece[]>,
  allDecos: DecorationItem[],
  rank: string,
): GearPool {
  // Build a flat armor map from the typed pool (excluding talismans)
  const armorTypes = ["head", "chest", "arms", "waist", "legs"] as const;
  const fullDataFile: Record<string, ArmorPiece> = {};
  for (const t of armorTypes) {
    for (const piece of allArmorByType[t] ?? []) {
      fullDataFile[piece.name] = piece;
    }
  }

  // Build mandatory map: type → name
  const mandatory: Record<string, string> = {};
  for (const name of mandatoryPieceNames) {
    if (!name) continue;
    const found =
      fullDataFile[name] ??
      allArmorByType["talisman"]?.find((p) => p.name === name);
    if (found) {
      mandatory[found.type] = name;
    }
  }

  // Filter armor by rank and mandatory/blacklist constraints
  const dataFile: Record<string, ArmorPiece> = {};
  for (const [name, piece] of Object.entries(fullDataFile)) {
    if (piece.rank !== rank) continue;
    if (mandatory[piece.type] && name !== mandatory[piece.type]) continue;
    if (blacklistedArmor.includes(name)) continue;
    dataFile[name] = piece;
  }

  // Filter and score talismans
  const allTalismans = allArmorByType["talisman"] ?? [];
  const bestTalismans: Record<string, ArmorPiece> = {};
  if (!mandatory["talisman"]) {
    for (const piece of allTalismans) {
      if (blacklistedArmor.includes(piece.name)) continue;
      if (!hasNeededSkill(piece.skills, skills)) continue;
      bestTalismans[piece.name] = piece;
    }
  } else {
    const mandatoryTalisman = allTalismans.find(
      (p) => p.name === mandatory["talisman"],
    );
    if (mandatoryTalisman) {
      bestTalismans[mandatoryTalisman.name] = mandatoryTalisman;
    }
  }

  // Keep top talismans by highest skill value per skill
  const topTalis: Record<string, ArmorPiece> = {};
  const topTalisLevels: Record<string, number> = {};
  for (const [talisName, piece] of Object.entries(bestTalismans)) {
    for (const [skName, skLevel] of Object.entries(piece.skills)) {
      if (skLevel > (topTalisLevels[skName] ?? 0)) {
        topTalis[talisName] = piece;
        topTalisLevels[skName] = skLevel;
      }
    }
  }

  const bestDecos = getBestDecos(skills, allDecos);

  // Group firsts (best slottage representatives) and best (has needed skill)
  const firsts: Record<string, Record<string, ArmorPiece>> = emptyGearSet();
  const best: Record<string, Record<string, ArmorPiece>> = emptyGearSet();

  for (const sortType of ["length", "size"] as const) {
    const checker: Record<string, { checked?: boolean }> =
      emptyGearSet() as unknown as Record<string, { checked?: boolean }>;

    const allSort = Object.entries(dataFile).sort((a, b) => {
      if (sortType === "size") {
        return slottageSizeCompare(
          a[1].slots,
          b[1].slots,
          b[1].defense - a[1].defense,
        );
      }
      return slottageLengthCompare(
        a[1].slots,
        b[1].slots,
        b[1].defense - a[1].defense,
      );
    });

    for (const [armorName, piece] of allSort) {
      const category = piece.type;
      const catChecker = checker[category] as Record<string, unknown>;
      if (isEmpty(catChecker as Record<string, unknown>)) {
        const catFirsts = firsts[category];
        const qualifies =
          sortType === "size"
            ? hasBiggerSlottage(catFirsts, piece.slots)
            : hasLongerSlottage(catFirsts, piece.slots);
        if (qualifies) {
          catChecker["checked"] = true;
          firsts[category][armorName] = piece;
        }
      }
      if (hasNeededSkill(piece.skills, skills)) {
        best[category][armorName] = piece;
      }
    }
  }

  // Compute skill potential for each type/skill/armor combination
  let totalMaxSkillPotential: Record<string, number> = {};
  let maxPossibleSkillPotential: Record<
    string,
    Record<string, SkillPotentialAlias>
  > = {};
  let modPointMap: Record<string, number> = {};

  for (const skillName of Object.keys(skills)) {
    for (const [category, data] of Object.entries(best)) {
      for (const [armorName, piece] of Object.entries(data)) {
        const { pot, totalPot, modMap } = updateSkillPotential(
          maxPossibleSkillPotential,
          totalMaxSkillPotential,
          modPointMap,
          category,
          skillName,
          armorName,
          piece,
          bestDecos,
          skills,
        );
        maxPossibleSkillPotential = pot;
        totalMaxSkillPotential = totalPot;
        modPointMap = modMap;
      }
    }
  }

  // Build bareMinimum from firsts + skill potential entries
  const bareMinimum: Record<string, Record<string, ArmorPiece>> = { ...firsts };
  bareMinimum["talisman"] = {};

  for (const [category, data] of Object.entries(maxPossibleSkillPotential)) {
    for (const [_skillName, statData] of Object.entries(data)) {
      for (const key of ["best", "more"] as const) {
        const entry = statData[key];
        if (!entry) continue;
        if (key === "more" && Array.isArray(entry) && entry.length) {
          for (const ex of entry) {
            if (dataFile[ex]) bareMinimum[category][ex] = dataFile[ex];
          }
        } else if (typeof entry === "string" && dataFile[entry]) {
          bareMinimum[category][entry] = dataFile[entry];
        }
      }
    }
  }

  // Handle set/group skills
  const groupiesAlt: Record<string, ArmorPiece> = {};
  for (const [name, piece] of Object.entries(dataFile)) {
    if (isInSets(piece, setSkills) || isInGroups(piece, groupSkills)) {
      groupiesAlt[name] = piece;
    }
  }
  const sortedGroupiesAlt = Object.fromEntries(
    Object.entries(groupiesAlt).sort((a, b) =>
      slottageSizeCompare(a[1].slots, b[1].slots, b[1].defense - a[1].defense),
    ),
  );

  totalMaxSkillPotential = {};
  const maxPossibleSkillPotentialSet: Record<
    string,
    Record<string, Record<string, SkillPotentialAlias>>
  > = {};

  const bestGroupiesAlt: Record<string, Record<string, ArmorPiece>> = {};
  for (const [name, piece] of Object.entries(sortedGroupiesAlt)) {
    bestGroupiesAlt[piece.type] ??= {};
    bestGroupiesAlt[piece.type][name] = piece;
  }

  if (!isEmpty(skills)) {
    modPointMap = {};
    for (const skillName of Object.keys(skills)) {
      for (const [category, data] of Object.entries(bestGroupiesAlt)) {
        const [groupiesGrouped] = groupArmorIntoSets(
          data,
          setSkills,
          groupSkills,
        );

        for (const [groupName, groupArmors] of Object.entries(
          groupiesGrouped,
        )) {
          for (const [armorName, piece] of Object.entries(groupArmors)) {
            const potCat = maxPossibleSkillPotentialSet as unknown as Record<
              string,
              Record<string, SkillPotentialAlias>
            >;
            const { pot, totalPot, modMap } = updateSkillPotential(
              potCat,
              totalMaxSkillPotential,
              modPointMap,
              category,
              skillName,
              armorName,
              piece,
              bestDecos,
              skills,
              groupName,
            );
            maxPossibleSkillPotential = pot;
            totalMaxSkillPotential = totalPot;
            modPointMap = modMap;
          }
        }
      }
    }

    for (const [category, groupData] of Object.entries(
      maxPossibleSkillPotentialSet,
    )) {
      for (const [_groupName, skillMap] of Object.entries(groupData)) {
        for (const [_skillName, statData] of Object.entries(skillMap)) {
          for (const key of ["best", "more"] as const) {
            const entry = (statData as SkillPotentialAlias)[key];
            if (!entry) continue;
            if (key === "more" && Array.isArray(entry) && entry.length) {
              for (const ex of entry) {
                if (dataFile[ex]) bareMinimum[category][ex] = dataFile[ex];
              }
            } else if (typeof entry === "string" && dataFile[entry]) {
              bareMinimum[category][entry] = dataFile[entry];
            }
          }
        }
      }
    }
  } else {
    // No regular skills — just copy all set/group pieces into bareMinimum
    for (const [category, data] of Object.entries(bestGroupiesAlt)) {
      bareMinimum[category] = { ...(bareMinimum[category] ?? {}), ...data };
    }
  }

  bareMinimum["decos"] = bestDecos as unknown as Record<string, ArmorPiece>;
  bareMinimum["talisman"] = topTalis;

  // Ensure every slot type has at least the "None" placeholder
  for (const tipo of ARMOR_SLOT_TYPES) {
    if (!bareMinimum[tipo] || isEmpty(bareMinimum[tipo])) {
      bareMinimum[tipo] = emptyGearPiece(tipo, rank);
    }
  }

  // Sort final pool by slottage
  for (const cat of Object.keys(bareMinimum)) {
    if (cat === "decos" || cat === "talisman") continue;
    bareMinimum[cat] = Object.fromEntries(
      Object.entries(bareMinimum[cat]).sort((a, b) =>
        slottageLengthCompare(a[1].slots, b[1].slots),
      ),
    );
  }

  return bareMinimum as unknown as GearPool;
}

// ─── armorCombo ───────────────────────────────────────────────────────────────

interface ArmorComboResult {
  names: string[];
  skills: Record<string, number>;
  slots: number[];
  setSkills: Record<string, number>;
  groupSkills: Record<string, number>;
}

function armorCombo(pieces: PieceEntry[]): ArmorComboResult {
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
  for (const [, piece] of armorBodyPieces) {
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
  };
}

// ─── getDecosToFulfillSkills ──────────────────────────────────────────────────

interface DecoResult {
  decoNames: string[];
  freeSlots: number[];
}

function getDecosToFulfillSkills(
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
  const usedDecosCount: Record<string, number> = {};

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
            usedDecosCount[decoName] = (usedDecosCount[decoName] ?? 0) + 1;
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

// ─── test ─────────────────────────────────────────────────────────────────────

/**
 * Tests whether an armor combo satisfies the desired skills (with decos).
 * Returns a SearchResult if successful, null otherwise.
 */
function testCombo(
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
  };
}

// ─── canArmorFulfillSkill ─────────────────────────────────────────────────────

/**
 * DFS pruning check: can the current partial armor set + remaining pool
 * possibly reach the required skill level?
 */
function canArmorFulfillSkill(
  currentArmor: Record<string, PieceEntry>,
  armorPool: GearPool,
  decos: Record<string, DecorationItem>,
  skillName: string,
  skillLevel: number,
): boolean {
  const poolTypeList = ARMOR_SLOT_TYPES.filter((t) => !currentArmor[t]);

  let totalPoints = 0;

  // Best possible from remaining (unassigned) slots
  for (const tipo of poolTypeList) {
    let bestPointsOfType = 0;
    const pool = armorPool[tipo] as Record<string, ArmorPiece>;
    for (const piece of Object.values(pool)) {
      let points = piece.skills[skillName] ?? 0;
      if (tipo !== "talisman") {
        for (const deco of Object.values(decos)) {
          const decoSkillLevel = deco.skills[skillName];
          if (decoSkillLevel) {
            points +=
              decoSkillLevel *
              piece.slots.filter((s) => s >= deco.slotSize).length;
            break;
          }
        }
      }
      bestPointsOfType = Math.max(points, bestPointsOfType);
    }
    totalPoints += bestPointsOfType;
    if (totalPoints >= skillLevel) return true;
  }

  // Points from already assigned slots
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

// ─── rollCombosDfs ────────────────────────────────────────────────────────────

function rollCombosDfs(
  gear: GearPool,
  desiredSkills: Record<string, number>,
  setSkills: Record<string, number>,
  groupSkills: Record<string, number>,
): SearchResult[] {
  const results: SearchResult[] = [];
  let inc = 0;

  const slotTypes = ARMOR_SLOT_TYPES;

  const dfs = (
    index: number,
    currentArmor: Record<string, PieceEntry>,
    usedNames: Set<string>,
    setCounts: Record<string, number>,
    groupCounts: Record<string, number>,
  ): void => {
    if (results.length >= MAX_RESULTS) return;

    if (index === slotTypes.length) {
      const pieces = slotTypes.map((t) => currentArmor[t] as PieceEntry);
      const fullSet = armorCombo(pieces);
      const result = testCombo(
        fullSet,
        gear.decos as unknown as Record<string, DecorationItem>,
        desiredSkills,
      );
      if (result) {
        result.armorNames = [...result.armorNames];
        inc++;
        results.push(result);
      }
      return;
    }

    const slot = slotTypes[index];
    const pieces = gear[slot] as Record<string, ArmorPiece>;

    for (const [name, piece] of Object.entries(pieces)) {
      if (usedNames.has(name) && name !== "None") continue;

      currentArmor[slot] = [name, piece];
      usedNames.add(name);

      const addedSetCounts: Record<string, number> = {};
      const addedGroupCounts: Record<string, number> = {};

      for (const sk of piece.setSkills) {
        if (sk && setSkills[sk]) {
          setCounts[sk] = (setCounts[sk] ?? 0) + 1;
          addedSetCounts[sk] = (addedSetCounts[sk] ?? 0) + 1;
        }
      }
      for (const gk of piece.groupSkills) {
        if (gk && groupSkills[gk]) {
          groupCounts[gk] = (groupCounts[gk] ?? 0) + 1;
          addedGroupCounts[gk] = (addedGroupCounts[gk] ?? 0) + 1;
        }
      }

      let shouldContinue = true;

      // Prune by set/group skill feasibility
      const remainingSlots = slotTypes.length - (index + 1);
      for (const sk of Object.keys(setSkills)) {
        const needed = setSkills[sk] * 2 - (setCounts[sk] ?? 0);
        if (needed > remainingSlots) {
          shouldContinue = false;
          break;
        }
      }
      if (shouldContinue) {
        for (const gk of Object.keys(groupSkills)) {
          const needed = 3 - (groupCounts[gk] ?? 0);
          if (needed > remainingSlots) {
            shouldContinue = false;
            break;
          }
        }
      }

      // Prune by skill feasibility
      if (shouldContinue) {
        for (const [skillName, level] of Object.entries(desiredSkills)) {
          if (
            !canArmorFulfillSkill(
              currentArmor,
              gear,
              gear.decos as unknown as Record<string, DecorationItem>,
              skillName,
              level,
            )
          ) {
            shouldContinue = false;
            break;
          }
        }
      }

      if (shouldContinue) {
        dfs(index + 1, currentArmor, usedNames, setCounts, groupCounts);
      }

      // Backtrack
      usedNames.delete(name);
      delete currentArmor[slot];
      for (const sk of Object.keys(addedSetCounts))
        setCounts[sk] -= addedSetCounts[sk];
      for (const gk of Object.keys(addedGroupCounts))
        groupCounts[gk] -= addedGroupCounts[gk];
    }
  };

  dfs(0, {}, new Set(), {}, {});
  void inc; // suppress unused warning
  return results;
}

// ─── reorder ──────────────────────────────────────────────────────────────────

/**
 * Re-orders results to surface the most slot-rich / skill-rich sets first.
 * Ported from logic.js reorder().
 */
function reorder(
  dataList: SearchResult[],
  skillMaxMap: Record<string, number>,
): SearchResult[] {
  const indexed = dataList.map((item, i) => ({ ...item, _originalIndex: i }));

  for (const data of indexed) {
    // Cap skills at max level
    for (const [sk, lv] of Object.entries(data.skills)) {
      const max = skillMaxMap[sk];
      if (max !== undefined && lv > max) data.skills[sk] = max;
    }

    // Sort skills descending by level
    data.skills = Object.fromEntries(
      Object.entries(data.skills).sort(
        ([k1, v1], [k2, v2]) => v2 - v1 || k1.localeCompare(k2),
      ),
    );

    // Correct set skill levels (each pair of pieces = 1 level)
    data.setSkills = Object.fromEntries(
      Object.entries(data.setSkills)
        .filter(([k, v]) => k && Math.floor(v / 2) > 0)
        .map(([k, v]) => [k, Math.floor(v / 2)]),
    );

    // Correct group skill levels (3 pieces = 1 level)
    data.groupSkills = Object.fromEntries(
      Object.entries(data.groupSkills)
        .filter(([k, v]) => k && Math.floor(v / 3) > 0)
        .map(([k, v]) => [k, Math.floor(v / 3)]),
    );
  }

  const sorted = [...indexed].sort((a, b) =>
    slottageSizeCompare(a.freeSlots, b.freeSlots),
  );
  sorted.forEach((d) => d.slots.sort((a, b) => b - a));

  let pre: typeof indexed = [];
  let post: typeof indexed = [];
  const bestPerThree: Record<string, number> = {};

  const sortedFinal = sorted.sort((a, b) => {
    const aThrees = a.freeSlots.filter((y) => y === 3).length;
    const bThrees = b.freeSlots.filter((y) => y === 3).length;
    const aTwos = a.freeSlots.filter((y) => y === 2).length;
    const bTwos = b.freeSlots.filter((y) => y === 2).length;
    return (
      bThrees - aThrees ||
      bTwos - aTwos ||
      b.freeSlots.length - a.freeSlots.length ||
      Object.keys(b.skills).length - Object.keys(a.skills).length
    );
  });

  for (const res of sortedFinal) {
    const numThrees = res.freeSlots.filter((y) => y === 3).length;
    const numTwos = res.freeSlots.filter((y) => y === 2).length;
    const key = `${numThrees},${numTwos}`;
    if (!(key in bestPerThree)) {
      pre.push(res);
      bestPerThree[key] = res.freeSlots.length;
    } else {
      post.push(res);
    }
  }

  pre = [...pre, ...post];
  const excludeIds = new Set(pre.map((o) => o._originalIndex));

  const longestSlots = [...indexed]
    .filter((v) => !excludeIds.has(v._originalIndex))
    .sort((a, b) => {
      const aHas = a.freeSlots.some((v) => v === 2 || v === 3)
        ? a.freeSlots.length
        : 0;
      const bHas = b.freeSlots.some((v) => v === 2 || v === 3)
        ? b.freeSlots.length
        : 0;
      return (
        b.freeSlots.length - a.freeSlots.length ||
        bHas - aHas ||
        a._originalIndex - b._originalIndex
      );
    });

  // Strip internal index before returning
  return [...pre, ...longestSlots].map(
    ({ _originalIndex: _o, ...rest }) => rest as SearchResult,
  );
}

// ─── search ───────────────────────────────────────────────────────────────────

/**
 * Main entry point for set search.
 * @param input - User-specified skill requirements and filters.
 * @param index - The pre-built search index from buildSearchIndex().
 */
export function search(
  input: SearchInput,
  index: SetSearchIndex,
): SearchResult[] {
  const skills = input.skills ?? {};
  const setSkills = input.setSkills ?? {};
  const groupSkills = input.groupSkills ?? {};
  const mandatoryArmor = input.mandatoryArmor ?? [];
  const blacklistedArmor = input.blacklistedArmor ?? [];
  const slotFilters = input.slotFilters ?? {};
  const rank = input.rank ?? "high";

  // Build armor map by type for getBestArmor
  const allArmorByType: Record<string, ArmorPiece[]> = {};
  for (const [tipo, pieces] of Object.entries(index.byType)) {
    allArmorByType[tipo] = pieces;
  }

  const gear = getBestArmor(
    skills,
    setSkills,
    groupSkills,
    mandatoryArmor,
    blacklistedArmor,
    allArmorByType,
    index.decorations,
    rank,
  );

  let rolls = rollCombosDfs(gear, skills, setSkills, groupSkills);

  // Apply slot filters post-search
  if (Object.keys(slotFilters).length > 0) {
    const desiredSlots = Object.entries(slotFilters)
      .flatMap(([num, count]) => Array<number>(count).fill(Number(num)))
      .sort((a, b) => b - a);

    rolls = rolls.filter((roll) => {
      const rollFree = [...roll.freeSlots].sort((a, b) => b - a);
      if (rollFree.length < desiredSlots.length) return false;
      for (let i = 0; i < desiredSlots.length; i++) {
        if (desiredSlots[i] > rollFree[i]) return false;
      }
      return true;
    });
  }

  // Build skill max map for reorder capping
  const skillMaxMap: Record<string, number> = {};
  for (const [name, meta] of index.skills.entries()) {
    skillMaxMap[name] = meta.maxLevel;
  }

  rolls = reorder(rolls, skillMaxMap);

  return rolls.slice(0, MAX_RESULTS);
}

void LIMIT; // used as a conceptual limit reference — actual limit is MAX_RESULTS in DFS
