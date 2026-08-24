import type { ArmorPiece } from '../types'
import type { SearchResult } from '../types'
import type { GearPool, PieceEntry } from './constants'
import { ARMOR_SLOT_TYPES, LIMIT } from './constants'
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
): void {
  let visited = 0
  let matched = 0

  // Pre-compute entry arrays once — avoids Object.entries() allocation on every DFS node
  const slotEntries: Record<string, [string, ArmorPiece][]> = {}
  for (const slot of ARMOR_SLOT_TYPES) {
    slotEntries[slot] = Object.entries(gear[slot])
  }
  const decos = gear.decos
  const setSkillKeys = Object.keys(setSkills)
  const groupSkillKeys = Object.keys(groupSkills)
  const desiredSkillEntries = Object.entries(desiredSkills)

  // Pre-compute each piece's contribution to desired skills (innate + best deco fit).
  // Maintained incrementally during DFS so the feasibility check is O(remaining_slots)
  // rather than O(depth × skills) from re-iterating currentArmor every time.
  const pieceContrib: Record<string, Record<string, number>> = {}
  for (const slot of ARMOR_SLOT_TYPES) {
    for (const [name, piece] of slotEntries[slot]) {
      const contrib: Record<string, number> = {}
      for (const [skillName] of desiredSkillEntries) {
        let pts = piece.skills[skillName] ?? 0
        for (const deco of Object.values(decos)) {
          const decoLevel = deco.skills[skillName]
          if (decoLevel) {
            pts += decoLevel * piece.slots.filter((s) => s >= deco.slotSize).length
            break
          }
        }
        if (pts > 0) contrib[skillName] = pts
      }
      pieceContrib[name] = contrib
    }
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

  // Tracks cumulative skill points already covered by placed armor pieces.
  // Updated on enter/backtrack so canFulfill checks are O(remaining_slots).
  const assignedPoints: Record<string, number> = {}

  function dfs(index: number, currentArmor: Record<string, PieceEntry>, usedNames: Set<string>, setCounts: Record<string, number>, groupCounts: Record<string, number>): void {
    if (++visited > LIMIT) return

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
      if (usedNames.has(name) && name !== 'None') continue

      currentArmor[slot] = [name, piece]
      usedNames.add(name)

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
      if (contrib) {
        for (const [sk, pts] of Object.entries(contrib)) {
          assignedPoints[sk] = (assignedPoints[sk] ?? 0) + pts
        }
      }

      let shouldContinue = true

      // Prune by set/group skill feasibility.
      // Tighter check: count how many remaining slots actually carry the skill,
      // not just how many slots remain overall.
      for (const sk of setSkillKeys) {
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
        for (const [skillName, level] of desiredSkillEntries) {
          let total = assignedPoints[skillName] ?? 0
          if (total >= level) continue
          for (let i = nextIndex; i < ARMOR_SLOT_TYPES.length; i++) {
            total += maxPotential[ARMOR_SLOT_TYPES[i]]?.[skillName] ?? 0
            if (total >= level) break
          }
          if (total < level) {
            shouldContinue = false
            break
          }
        }
      }

      if (shouldContinue) {
        dfs(nextIndex, currentArmor, usedNames, setCounts, groupCounts)
      }

      // Backtrack — also clears addedSetCounts/addedGroupCounts for the next iteration
      if (contrib) {
        for (const [sk, pts] of Object.entries(contrib)) {
          assignedPoints[sk] = (assignedPoints[sk] ?? 0) - pts
        }
      }
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
 * Exact bounded alternative to exhaustive collection. The first traversal
 * discovers the global maximum defense required by the ranking's defense
 * band; the second retains only the best `limit` prepared results.
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
): SearchResult[] {
  let maxDefense = 0
  walkCombosDfs(gear, desiredSkills, setSkills, groupSkills, initialSetCounts, initialGroupCounts, maxPotential, (result) => {
    if (!acceptResult(result)) return
    maxDefense = Math.max(maxDefense, result.defense)
  })

  const top: SearchResult[] = []
  walkCombosDfs(gear, desiredSkills, setSkills, groupSkills, initialSetCounts, initialGroupCounts, maxPotential, (result) => {
    if (!acceptResult(result)) return
    beforePrepare(result)
    prepareResult(result, skillMaxMap)
    if (top.length === limit && comparePreparedResults(result, top[top.length - 1], maxDefense) >= 0) return

    let low = 0
    let high = top.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (comparePreparedResults(result, top[middle], maxDefense) < 0) high = middle
      else low = middle + 1
    }
    top.splice(low, 0, result)
    if (top.length > limit) top.pop()
  })

  return top
}
