import type { ArmorPiece, DecorationItem } from '../types'
import type { GearPool, SkillPotentialAlias } from './constants'
import { ARMOR_SLOT_TYPES } from './constants'
import {
  slottageSizeCompare,
  slottageLengthCompare,
  areLeftSlotsBigger,
  slotCompare,
  hasBiggerSlottage,
  hasLongerSlottage,
} from './slotMath'
import {
  isEmpty,
  hasNeededSkill,
  isInSets,
  isInGroups,
  emptyGearSet,
  emptyGearPiece,
  getBestDecos,
  getSkillPotential,
  groupArmorIntoSets,
} from './poolHelpers'

// ─── updateSkillPotential helpers (extracted from closures) ──────────────────

/** Adds `newApplicant` to alias.more if it has at least as many mod-points as
 *  every existing entry — prevents the "more" pool from growing unchecked. */
function addToMorePool(
  alias: SkillPotentialAlias,
  modPointMap: Record<string, number>,
  newApplicant: string,
): void {
  const morePool = alias.more ?? []
  if (morePool.every((p) => (modPointMap[newApplicant] ?? 0) >= (modPointMap[p] ?? 0))) {
    morePool.push(newApplicant)
    alias.more = morePool
  }
}

/** Promotes `armorName` to the best slot for this skill/category alias, demoting
 *  the previous best to the "more" pool if it still meets the mod-point bar. */
function promoteAlias(
  alias: SkillPotentialAlias,
  armorName: string,
  piece: ArmorPiece,
  points: number,
  extraPoints: number,
  leftoverSlots: number[],
  modPoints: number,
  modPointMap: Record<string, number>,
  totalSkillPotential: Record<string, number>,
  skillName: string,
  includeExtra = false,
  includeLeftover = false,
): void {
  const oldBest = alias.best
  alias.best = armorName
  alias.points = points
  alias.slots = piece.slots
  alias.extraPoints = includeExtra ? extraPoints : (alias.extraPoints ?? 0)
  alias.leftoverSlots = includeLeftover ? leftoverSlots : (alias.leftoverSlots ?? [])
  alias.defense = piece.defense

  if (oldBest && (modPointMap[oldBest] ?? 0) >= modPoints) {
    addToMorePool(alias, modPointMap, oldBest)
  }

  totalSkillPotential[skillName] = (totalSkillPotential[skillName] ?? 0) + points
}

/** Updates the skill potential tracking structures for one piece/skill combination. */
export function updateSkillPotential(
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
  pot: Record<string, Record<string, SkillPotentialAlias>>
  totalPot: Record<string, number>
  modMap: Record<string, number>
} {
  const { points, leftoverSlots, extraPoints, modPoints } = getSkillPotential(
    piece,
    skillName,
    decos,
    allSkills,
  )
  modPointMap[armorName] = modPoints

  skillPotential[category] ??= {}
  let alias: SkillPotentialAlias

  if (groupName) {
    const categoryKey = skillPotential[category] as Record<
      string,
      Record<string, SkillPotentialAlias>
    >
    categoryKey[groupName] ??= {}
    categoryKey[groupName][skillName] ??= {}
    alias = categoryKey[groupName][skillName]
  } else {
    skillPotential[category][skillName] ??= {}
    alias = skillPotential[category][skillName]
  }

  const currentPoints = alias.points ?? 0
  const compare = slotCompare(alias.leftoverSlots ?? [], leftoverSlots)

  if (points > currentPoints) {
    promoteAlias(alias, armorName, piece, points, extraPoints, leftoverSlots, modPoints, modPointMap, totalSkillPotential, skillName, true, true)
  } else if (points === currentPoints && compare) {
    if (compare === 'equal') {
      const bestExtraPoints = alias.extraPoints ?? 0
      if (areLeftSlotsBigger(piece.slots, alias.slots ?? [])) {
        promoteAlias(alias, armorName, piece, points, extraPoints, leftoverSlots, modPoints, modPointMap, totalSkillPotential, skillName)
      } else if (extraPoints > bestExtraPoints) {
        promoteAlias(alias, armorName, piece, points, extraPoints, leftoverSlots, modPoints, modPointMap, totalSkillPotential, skillName, true)
      } else if (extraPoints === bestExtraPoints) {
        if (piece.defense > (alias.defense ?? 0)) {
          promoteAlias(alias, armorName, piece, points, extraPoints, leftoverSlots, modPoints, modPointMap, totalSkillPotential, skillName)
        }
      }
    } else {
      promoteAlias(alias, armorName, piece, points, extraPoints, leftoverSlots, modPoints, modPointMap, totalSkillPotential, skillName, false, true)
    }
  } else if (points < currentPoints && modPoints > (modPointMap[armorName] ?? 0)) {
    addToMorePool(alias, modPointMap, armorName)
  }

  return {
    pot: skillPotential,
    totalPot: totalSkillPotential,
    modMap: modPointMap,
  }
}

// ─── getBestArmor ─────────────────────────────────────────────────────────────

/**
 * Filters and scores the armor pool to find the best candidates per slot type.
 * Ported faithfully from logic.js getBestArmor().
 */
export function getBestArmor(
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
  const armorTypes = ['head', 'chest', 'arms', 'waist', 'legs'] as const
  const allArmorFlat: Record<string, ArmorPiece> = {}
  for (const t of armorTypes) {
    for (const piece of allArmorByType[t] ?? []) {
      allArmorFlat[piece.name] = piece
    }
  }

  // Build mandatory map: type → name
  const mandatory: Record<string, string> = {}
  for (const name of mandatoryPieceNames) {
    if (!name) continue
    const found =
      allArmorFlat[name] ??
      allArmorByType['talisman']?.find((p) => p.name === name)
    if (found) {
      mandatory[found.type] = name
    }
  }

  // Filter armor by rank and mandatory/blacklist constraints
  const filteredArmor: Record<string, ArmorPiece> = {}
  for (const [name, piece] of Object.entries(allArmorFlat)) {
    if (piece.rank !== rank) continue
    if (mandatory[piece.type] && name !== mandatory[piece.type]) continue
    if (blacklistedArmor.includes(name)) continue
    filteredArmor[name] = piece
  }

  // Filter and score talismans
  const allTalismans = allArmorByType['talisman'] ?? []
  const candidateTalismans: Record<string, ArmorPiece> = {}
  if (!mandatory['talisman']) {
    for (const piece of allTalismans) {
      if (blacklistedArmor.includes(piece.name)) continue
      if (!hasNeededSkill(piece.skills, skills)) continue
      candidateTalismans[piece.name] = piece
    }
  } else {
    const mandatoryTalisman = allTalismans.find((p) => p.name === mandatory['talisman'])
    if (mandatoryTalisman) {
      candidateTalismans[mandatoryTalisman.name] = mandatoryTalisman
    }
  }

  // Keep top talismans by highest skill value per skill
  const topTalis: Record<string, ArmorPiece> = {}
  const topTalisLevels: Record<string, number> = {}
  for (const [talisName, piece] of Object.entries(candidateTalismans)) {
    for (const [skName, skLevel] of Object.entries(piece.skills)) {
      if (skLevel > (topTalisLevels[skName] ?? 0)) {
        topTalis[talisName] = piece
        topTalisLevels[skName] = skLevel
      }
    }
  }

  const bestDecos = getBestDecos(skills, allDecos)

  // Group firsts (best slottage representatives) and best (has needed skill)
  const firsts: Record<string, Record<string, ArmorPiece>> = emptyGearSet()
  const best: Record<string, Record<string, ArmorPiece>> = emptyGearSet()

  for (const sortType of ['length', 'size'] as const) {
    const checker: Record<string, { checked?: boolean }> =
      emptyGearSet() as unknown as Record<string, { checked?: boolean }>

    const allSort = Object.entries(filteredArmor).sort((a, b) => {
      if (sortType === 'size') {
        return slottageSizeCompare(a[1].slots, b[1].slots, b[1].defense - a[1].defense)
      }
      return slottageLengthCompare(a[1].slots, b[1].slots, b[1].defense - a[1].defense)
    })

    for (const [armorName, piece] of allSort) {
      const category = piece.type
      const catChecker = checker[category] as Record<string, unknown>
      if (isEmpty(catChecker as Record<string, unknown>)) {
        const catFirsts = firsts[category]
        const qualifies =
          sortType === 'size'
            ? hasBiggerSlottage(catFirsts, piece.slots)
            : hasLongerSlottage(catFirsts, piece.slots)
        if (qualifies) {
          catChecker['checked'] = true
          firsts[category][armorName] = piece
        }
      }
      if (hasNeededSkill(piece.skills, skills)) {
        best[category][armorName] = piece
      }
    }
  }

  // Compute skill potential for each type/skill/armor combination
  let totalMaxSkillPotential: Record<string, number> = {}
  let maxPossibleSkillPotential: Record<string, Record<string, SkillPotentialAlias>> = {}
  let modPointMap: Record<string, number> = {}

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
        )
        maxPossibleSkillPotential = pot
        totalMaxSkillPotential = totalPot
        modPointMap = modMap
      }
    }
  }

  // Build bareMinimum from firsts + skill potential entries
  const bareMinimum: Record<string, Record<string, ArmorPiece>> = { ...firsts }
  bareMinimum['talisman'] = {}

  for (const [category, data] of Object.entries(maxPossibleSkillPotential)) {
    for (const [_skillName, statData] of Object.entries(data)) {
      for (const key of ['best', 'more'] as const) {
        const entry = statData[key]
        if (!entry) continue
        if (key === 'more' && Array.isArray(entry) && entry.length) {
          for (const ex of entry) {
            if (filteredArmor[ex]) bareMinimum[category][ex] = filteredArmor[ex]
          }
        } else if (typeof entry === 'string' && filteredArmor[entry]) {
          bareMinimum[category][entry] = filteredArmor[entry]
        }
      }
    }
  }

  // Handle set/group skills
  const setGroupArmor: Record<string, ArmorPiece> = {}
  for (const [name, piece] of Object.entries(filteredArmor)) {
    if (isInSets(piece, setSkills) || isInGroups(piece, groupSkills)) {
      setGroupArmor[name] = piece
    }
  }
  const sortedSetGroupArmor = Object.fromEntries(
    Object.entries(setGroupArmor).sort((a, b) =>
      slottageSizeCompare(a[1].slots, b[1].slots, b[1].defense - a[1].defense),
    ),
  )

  totalMaxSkillPotential = {}
  const maxPossibleSkillPotentialSet: Record<
    string,
    Record<string, Record<string, SkillPotentialAlias>>
  > = {}

  const bestSetGroupByType: Record<string, Record<string, ArmorPiece>> = {}
  for (const [name, piece] of Object.entries(sortedSetGroupArmor)) {
    bestSetGroupByType[piece.type] ??= {}
    bestSetGroupByType[piece.type][name] = piece
  }

  if (!isEmpty(skills)) {
    modPointMap = {}
    for (const skillName of Object.keys(skills)) {
      for (const [category, data] of Object.entries(bestSetGroupByType)) {
        const [groupiesGrouped] = groupArmorIntoSets(data, setSkills, groupSkills)

        for (const [groupName, groupArmors] of Object.entries(groupiesGrouped)) {
          for (const [armorName, piece] of Object.entries(groupArmors)) {
            const potCat = maxPossibleSkillPotentialSet as unknown as Record<
              string,
              Record<string, SkillPotentialAlias>
            >
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
            )
            maxPossibleSkillPotential = pot
            totalMaxSkillPotential = totalPot
            modPointMap = modMap
          }
        }
      }
    }

    for (const [category, groupData] of Object.entries(maxPossibleSkillPotentialSet)) {
      for (const [_groupName, skillMap] of Object.entries(groupData)) {
        for (const [_skillName, statData] of Object.entries(skillMap)) {
          for (const key of ['best', 'more'] as const) {
            const entry = (statData as SkillPotentialAlias)[key]
            if (!entry) continue
            if (key === 'more' && Array.isArray(entry) && entry.length) {
              for (const ex of entry) {
                if (filteredArmor[ex]) bareMinimum[category][ex] = filteredArmor[ex]
              }
            } else if (typeof entry === 'string' && filteredArmor[entry]) {
              bareMinimum[category][entry] = filteredArmor[entry]
            }
          }
        }
      }
    }
  } else {
    // No regular skills — just copy all set/group pieces into bareMinimum
    for (const [category, data] of Object.entries(bestSetGroupByType)) {
      bareMinimum[category] = { ...(bareMinimum[category] ?? {}), ...data }
    }
  }

  bareMinimum['decos'] = bestDecos as unknown as Record<string, ArmorPiece>
  bareMinimum['talisman'] = topTalis

  // Ensure every slot type has at least the "None" placeholder
  for (const tipo of ARMOR_SLOT_TYPES) {
    if (!bareMinimum[tipo] || isEmpty(bareMinimum[tipo])) {
      bareMinimum[tipo] = emptyGearPiece(tipo, rank)
    }
  }

  // Sort final pool by slottage
  for (const cat of Object.keys(bareMinimum)) {
    if (cat === 'decos' || cat === 'talisman') continue
    bareMinimum[cat] = Object.fromEntries(
      Object.entries(bareMinimum[cat]).sort((a, b) =>
        slottageLengthCompare(a[1].slots, b[1].slots),
      ),
    )
  }

  return bareMinimum as unknown as GearPool
}
