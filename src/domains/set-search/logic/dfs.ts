import type { ArmorPiece } from '../types'
import type { SearchResult } from '../types'
import type { GearPool, PieceEntry } from './constants'
import { ARMOR_SLOT_TYPES, DEFENSE_BAND, LIMIT, SEARCH_TIME_BUDGET_MS } from './constants'
import { armorCombo, testCombo } from './combo'
import { comparePreparedResults, prepareResult } from './reorder'

function walkCombosDfs(
  gear: GearPool,
  desiredSkills: Record<string, number>,
  setSkills: Record<string, number>,
  groupSkills: Record<string, number>,
  initialSetCounts: Record<string, number> = {},
  initialGroupCounts: Record<string, number> = {},
  maxPotential: Record<string, Record<string, number>>,
  onResult: (result: SearchResult, originalIndex: number) => void,
  deadline = Infinity,
  defenseFloor: () => number = () => -Infinity,
): void {
  let visited = 0
  let matched = 0
  // LIMIT counts only nodes that survive pruning, so it does not bound wall
  // time — heavily-pruned searches burn most of their time on rejected
  // children. The deadline (checked every 1024 child iterations) does.
  let iterations = 0
  let outOfTime = false

  // Pre-compute entry arrays once — avoids Object.entries() allocation on every DFS node.
  // Highest-defense pieces first, so strong sets are found early and the
  // defense bound below (see defenseFloor) starts cutting branches sooner.
  const slotEntries: Record<string, [string, ArmorPiece][]> = {}
  for (const slot of ARMOR_SLOT_TYPES) {
    slotEntries[slot] = Object.entries(gear[slot]).sort(([, a], [, b]) => b.defense - a.defense)
  }
  // Defense counts the body pieces only (armorCombo excludes the talisman).
  // defenseSuffix[i]: best-case defense still obtainable from slot types [i..end).
  const bodyDefense = (slot: string, piece: ArmorPiece): number => (slot === 'talisman' ? 0 : piece.defense)
  const defenseSuffix = new Array<number>(ARMOR_SLOT_TYPES.length + 1).fill(0)
  for (let i = ARMOR_SLOT_TYPES.length - 1; i >= 0; i--) {
    const slot = ARMOR_SLOT_TYPES[i]
    defenseSuffix[i] = defenseSuffix[i + 1] + Math.max(0, ...slotEntries[slot].map(([, p]) => bodyDefense(slot, p)))
  }
  let assignedDefense = 0
  const decos = gear.decos
  const setSkillKeys = Object.keys(setSkills)
  const groupSkillKeys = Object.keys(groupSkills)
  const desiredSkillEntries = Object.entries(desiredSkills)

  // Pre-compute each piece's contribution to desired skills (innate + best deco fit),
  // indexed like desiredSkillEntries. Maintained incrementally during DFS so the
  // feasibility check is O(skills) rather than re-iterating currentArmor every time.
  const pieceContrib: Record<string, number[]> = {}
  for (const slot of ARMOR_SLOT_TYPES) {
    for (const [name, piece] of slotEntries[slot]) {
      pieceContrib[name] = desiredSkillEntries.map(([skillName]) => {
        let pts = piece.skills[skillName] ?? 0
        for (const deco of Object.values(decos)) {
          const decoLevel = deco.skills[skillName]
          if (decoLevel) {
            pts += decoLevel * piece.slots.filter((s) => s >= deco.slotSize).length
            break
          }
        }
        return pts
      })
    }
  }
  // potentialSuffix[i][s]: best-case contribution to skill s from slot types [i..end).
  const potentialSuffix: number[][] = Array.from({ length: ARMOR_SLOT_TYPES.length + 1 }, () => new Array<number>(desiredSkillEntries.length).fill(0))
  for (let i = ARMOR_SLOT_TYPES.length - 1; i >= 0; i--) {
    desiredSkillEntries.forEach(([skillName], s) => {
      potentialSuffix[i][s] = potentialSuffix[i + 1][s] + (maxPotential[ARMOR_SLOT_TYPES[i]]?.[skillName] ?? 0)
    })
  }

  // Precompute which slot indices carry at least one piece for each required set/group skill.
  // Lets us prune "not enough skill-bearing slots remain" before even trying combinations.
  const setSlotMask: Record<string, boolean[]> = {}
  for (const sk of setSkillKeys) {
    setSlotMask[sk] = ARMOR_SLOT_TYPES.map((slot) => slotEntries[slot].some(([, p]) => p.setSkills.includes(sk)))
  }
  const groupSlotMask: Record<string, boolean[]> = {}
  for (const gk of groupSkillKeys) {
    groupSlotMask[gk] = ARMOR_SLOT_TYPES.map((slot) => slotEntries[slot].some(([, p]) => p.groupSkills.includes(gk)))
  }

  // Tracks cumulative skill points (indexed like desiredSkillEntries) already
  // covered by placed armor pieces. Updated on enter/backtrack.
  const assignedPoints = new Array<number>(desiredSkillEntries.length).fill(0)

  // Joint deco-slot capacity bound. The per-skill prune above assumes every
  // slot can hold every skill's deco at once, so with many deco-dependent
  // skills it barely prunes. Here the decos each skill still needs (after the
  // best-case innate points) must jointly fit the slots: for every size k, the
  // decos requiring a slot >= k cannot outnumber the slots >= k (Hall's
  // condition for nested slot sizes). Remaining slots use a per-slot upper
  // bound (most innate points, most slots >= k — possibly from different
  // pieces), so the check is admissible and never drops a fulfillable combo.
  const skillCount = desiredSkillEntries.length
  const decoMinSize: number[] = []
  const decoMaxLevel: number[] = []
  for (const [skillName] of desiredSkillEntries) {
    let minSize = Infinity
    let maxLevel = 0
    for (const deco of Object.values(decos)) {
      const lv = deco.skills[skillName]
      if (!lv) continue
      minSize = Math.min(minSize, deco.slotSize)
      maxLevel = Math.max(maxLevel, lv)
    }
    decoMinSize.push(minSize)
    decoMaxLevel.push(maxLevel)
  }
  let maxSlotSize = 0
  for (const slot of ARMOR_SLOT_TYPES) {
    for (const [, piece] of slotEntries[slot]) {
      for (const s of piece.slots) maxSlotSize = Math.max(maxSlotSize, s)
    }
  }
  for (let i = 0; i < skillCount; i++) {
    if (decoMinSize[i] > maxSlotSize) decoMinSize[i] = Infinity
  }
  // Suffix sums over slot types [i..end): best-case innate points per skill and
  // best-case count of slots >= k (index k, 1..maxSlotSize).
  const innateSuffix: number[][] = Array.from({ length: ARMOR_SLOT_TYPES.length + 1 }, () => new Array<number>(skillCount).fill(0))
  const slotSuffix: number[][] = Array.from({ length: ARMOR_SLOT_TYPES.length + 1 }, () => new Array<number>(maxSlotSize + 1).fill(0))
  for (let i = ARMOR_SLOT_TYPES.length - 1; i >= 0; i--) {
    const entries = slotEntries[ARMOR_SLOT_TYPES[i]]
    for (let s = 0; s < skillCount; s++) {
      let best = 0
      for (const [, piece] of entries) best = Math.max(best, piece.skills[desiredSkillEntries[s][0]] ?? 0)
      innateSuffix[i][s] = innateSuffix[i + 1][s] + best
    }
    for (let k = 1; k <= maxSlotSize; k++) {
      let best = 0
      for (const [, piece] of entries) best = Math.max(best, piece.slots.filter((x) => x >= k).length)
      slotSuffix[i][k] = slotSuffix[i + 1][k] + best
    }
  }
  const pieceInnate: Record<string, number[]> = {}
  const pieceSlotsAtLeast: Record<string, number[]> = {}
  for (const slot of ARMOR_SLOT_TYPES) {
    for (const [name, piece] of slotEntries[slot]) {
      pieceInnate[name] = desiredSkillEntries.map(([skillName]) => piece.skills[skillName] ?? 0)
      const atLeast = new Array<number>(maxSlotSize + 1).fill(0)
      for (let k = 1; k <= maxSlotSize; k++) atLeast[k] = piece.slots.filter((x) => x >= k).length
      pieceSlotsAtLeast[name] = atLeast
    }
  }
  const innateAssigned = new Array<number>(skillCount).fill(0)
  const slotsAssigned = new Array<number>(maxSlotSize + 1).fill(0)
  const decoDemand = new Array<number>(maxSlotSize + 1).fill(0)

  function fitsDecoCapacity(nextIndex: number): boolean {
    decoDemand.fill(0)
    const innateLeft = innateSuffix[nextIndex]
    for (let s = 0; s < skillCount; s++) {
      const deficit = desiredSkillEntries[s][1] - innateAssigned[s] - innateLeft[s]
      if (deficit <= 0) continue
      if (decoMinSize[s] === Infinity) return false
      decoDemand[decoMinSize[s]] += Math.ceil(deficit / decoMaxLevel[s])
    }
    const slotsLeft = slotSuffix[nextIndex]
    let demand = 0
    for (let k = maxSlotSize; k >= 1; k--) {
      demand += decoDemand[k]
      if (demand > slotsAssigned[k] + slotsLeft[k]) return false
    }
    return true
  }

  function dfs(index: number, currentArmor: Record<string, PieceEntry>, usedNames: Set<string>, setCounts: Record<string, number>, groupCounts: Record<string, number>): void {
    if (outOfTime || ++visited > LIMIT) return

    if (index === ARMOR_SLOT_TYPES.length) {
      const pieces = ARMOR_SLOT_TYPES.map((t) => currentArmor[t] as PieceEntry)
      const fullSet = armorCombo(pieces)
      const result = testCombo(fullSet, decos, desiredSkills)
      if (result) {
        result._originalIndex = matched
        onResult(result, matched++)
      }
      return
    }

    const slot = ARMOR_SLOT_TYPES[index]
    const pieces = slotEntries[slot]
    const nextIndex = index + 1

    // Reused scratch objects cleared via delete during backtrack — avoids per-piece allocation
    const addedSetCounts: Record<string, number> = {}
    const addedGroupCounts: Record<string, number> = {}

    for (const [name, piece] of pieces) {
      if ((++iterations & 1023) === 0 && performance.now() > deadline) outOfTime = true
      if (outOfTime) return
      if (usedNames.has(name) && name !== 'None') continue

      currentArmor[slot] = [name, piece]
      usedNames.add(name)
      const pieceDefense = bodyDefense(slot, piece)
      assignedDefense += pieceDefense

      for (const sk of piece.setSkills) {
        if (sk && setSkills[sk]) {
          setCounts[sk] = (setCounts[sk] ?? 0) + 1
          addedSetCounts[sk] = (addedSetCounts[sk] ?? 0) + 1
        }
      }
      for (const gk of piece.groupSkills) {
        if (gk && groupSkills[gk]) {
          groupCounts[gk] = (groupCounts[gk] ?? 0) + 1
          addedGroupCounts[gk] = (addedGroupCounts[gk] ?? 0) + 1
        }
      }

      // Incrementally update assignedPoints
      const contrib = pieceContrib[name]
      const innate = pieceInnate[name]
      const slotsAtLeast = pieceSlotsAtLeast[name]
      for (let s = 0; s < skillCount; s++) {
        assignedPoints[s] += contrib[s]
        innateAssigned[s] += innate[s]
      }
      for (let k = 1; k <= maxSlotSize; k++) slotsAssigned[k] += slotsAtLeast[k]

      // Branch-and-bound: skip branches whose best-case defense cannot place
      // them in the caller's top results.
      let shouldContinue = assignedDefense + defenseSuffix[nextIndex] >= defenseFloor()

      // Prune by set/group skill feasibility.
      // Tighter check: count how many remaining slots actually carry the skill,
      // not just how many slots remain overall.
      for (const sk of setSkillKeys) {
        if (!shouldContinue) break
        const needed = setSkills[sk] * 2 - (setCounts[sk] ?? 0)
        if (needed <= 0) continue
        let available = 0
        const mask = setSlotMask[sk]
        for (let i = nextIndex; i < ARMOR_SLOT_TYPES.length; i++) {
          if (mask[i]) available++
        }
        if (available < needed) {
          shouldContinue = false
          break
        }
      }
      if (shouldContinue) {
        for (const gk of groupSkillKeys) {
          const needed = 3 - (groupCounts[gk] ?? 0)
          if (needed <= 0) continue
          let available = 0
          const mask = groupSlotMask[gk]
          for (let i = nextIndex; i < ARMOR_SLOT_TYPES.length; i++) {
            if (mask[i]) available++
          }
          if (available < needed) {
            shouldContinue = false
            break
          }
        }
      }

      // Prune by skill feasibility using incremental assignedPoints — no array allocation
      if (shouldContinue) {
        const potentialLeft = potentialSuffix[nextIndex]
        for (let s = 0; s < skillCount; s++) {
          if (assignedPoints[s] + potentialLeft[s] < desiredSkillEntries[s][1]) {
            shouldContinue = false
            break
          }
        }
      }

      if (shouldContinue && !fitsDecoCapacity(nextIndex)) shouldContinue = false

      if (shouldContinue) {
        dfs(nextIndex, currentArmor, usedNames, setCounts, groupCounts)
      }

      // Backtrack — also clears addedSetCounts/addedGroupCounts for the next iteration
      for (let s = 0; s < skillCount; s++) {
        assignedPoints[s] -= contrib[s]
        innateAssigned[s] -= innate[s]
      }
      for (let k = 1; k <= maxSlotSize; k++) slotsAssigned[k] -= slotsAtLeast[k]
      assignedDefense -= pieceDefense
      usedNames.delete(name)
      delete currentArmor[slot]
      for (const sk of Object.keys(addedSetCounts)) {
        setCounts[sk] -= addedSetCounts[sk]
        delete addedSetCounts[sk]
      }
      for (const gk of Object.keys(addedGroupCounts)) {
        groupCounts[gk] -= addedGroupCounts[gk]
        delete addedGroupCounts[gk]
      }
    }
  }

  dfs(0, {}, new Set(), { ...initialSetCounts }, { ...initialGroupCounts })
}

export function rollCombosDfs(
  gear: GearPool,
  desiredSkills: Record<string, number>,
  setSkills: Record<string, number>,
  groupSkills: Record<string, number>,
  initialSetCounts: Record<string, number> = {},
  initialGroupCounts: Record<string, number> = {},
  maxPotential: Record<string, Record<string, number>> = {},
): SearchResult[] {
  const results: SearchResult[] = []
  walkCombosDfs(gear, desiredSkills, setSkills, groupSkills, initialSetCounts, initialGroupCounts, maxPotential, (result) => results.push(result))
  return results
}

/**
 * Exact bounded alternative to exhaustive collection, in a single traversal.
 *
 * The ranking's defense band depends on the global max defense, which is only
 * known at the end. Results inside the band of the running max are all kept
 * (`band`); a result can only ever leave the band as the max rises, never
 * re-enter it. Everything below the band is ranked defense-first, which does
 * not depend on the max, so only the best `limit` of those are kept
 * (`belowBand`). The final order is the sorted band followed by `belowBand`.
 *
 * Broad searches are cut short by branch-and-bound on defense: once `limit`
 * results are in hand, any result whose defense is below both the running
 * band (so it ends up below the band) and the `limit`-th best defense found
 * (so `limit` results already outrank it) can never be returned. Branches
 * whose best-case defense falls below that floor are skipped. Exact — the
 * result is the same as the full walk's.
 *
 * The walk stops after `budgetMs` and ranks whatever it found so far.
 */
export function rollTopCombosDfs(
  gear: GearPool,
  desiredSkills: Record<string, number>,
  setSkills: Record<string, number>,
  groupSkills: Record<string, number>,
  initialSetCounts: Record<string, number> = {},
  initialGroupCounts: Record<string, number> = {},
  maxPotential: Record<string, Record<string, number>> = {},
  skillMaxMap: Record<string, number> = {},
  limit = 200,
  acceptResult: (result: SearchResult) => boolean = () => true,
  beforePrepare: (result: SearchResult) => void = () => {},
  budgetMs = SEARCH_TIME_BUDGET_MS,
): SearchResult[] {
  let maxDefense = -Infinity
  let band: SearchResult[] = []
  const belowBand: SearchResult[] = []
  // Best `limit` defenses among accepted results, descending, and the derived floor.
  const topDefenses: number[] = []
  let defenseFloor = -Infinity

  // With an infinite max nothing is top-tier, so this is the defense-first order.
  const insertBelowBand = (result: SearchResult): void => {
    if (belowBand.length === limit && comparePreparedResults(result, belowBand[belowBand.length - 1], Infinity) >= 0) return
    let low = 0
    let high = belowBand.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (comparePreparedResults(result, belowBand[middle], Infinity) < 0) high = middle
      else low = middle + 1
    }
    belowBand.splice(low, 0, result)
    if (belowBand.length > limit) belowBand.pop()
  }

  walkCombosDfs(
    gear,
    desiredSkills,
    setSkills,
    groupSkills,
    initialSetCounts,
    initialGroupCounts,
    maxPotential,
    (result) => {
      if (!acceptResult(result)) return
      beforePrepare(result)
      prepareResult(result, skillMaxMap)

      if (result.defense > maxDefense) {
        maxDefense = result.defense
        const threshold = maxDefense - DEFENSE_BAND
        const kept: SearchResult[] = []
        for (const r of band) {
          if (r.defense >= threshold) kept.push(r)
          else insertBelowBand(r)
        }
        band = kept
      }

      if (result.defense >= maxDefense - DEFENSE_BAND) band.push(result)
      else insertBelowBand(result)

      if (topDefenses.length < limit || result.defense > topDefenses[limit - 1]) {
        let at = topDefenses.findIndex((d) => d < result.defense)
        if (at === -1) at = topDefenses.length
        topDefenses.splice(at, 0, result.defense)
        if (topDefenses.length > limit) topDefenses.pop()
      }
      if (topDefenses.length === limit) defenseFloor = Math.min(topDefenses[limit - 1], maxDefense - DEFENSE_BAND)
    },
    performance.now() + budgetMs,
    () => defenseFloor,
  )

  band.sort((a, b) => comparePreparedResults(a, b, maxDefense))
  return band.concat(belowBand).slice(0, limit)
}
