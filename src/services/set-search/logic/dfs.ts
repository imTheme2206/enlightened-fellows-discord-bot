import type { ArmorPiece, DecorationItem } from '../types'
import type { SearchResult } from '../types'
import type { GearPool, PieceEntry } from './constants'
import { ARMOR_SLOT_TYPES, LIMIT } from './constants'
import { armorCombo, testCombo, canArmorFulfillSkill } from './combo'

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
  let visited = 0

  // Pre-compute entry arrays once — avoids Object.entries() allocation on every DFS node
  const slotEntries: Record<string, [string, ArmorPiece][]> = {}
  for (const slot of ARMOR_SLOT_TYPES) {
    slotEntries[slot] = Object.entries(gear[slot] as Record<string, ArmorPiece>)
  }
  const decos = gear.decos as unknown as Record<string, DecorationItem>
  const setSkillKeys = Object.keys(setSkills)
  const groupSkillKeys = Object.keys(groupSkills)
  const desiredSkillEntries = Object.entries(desiredSkills)

  function dfs(
    index: number,
    currentArmor: Record<string, PieceEntry>,
    usedNames: Set<string>,
    setCounts: Record<string, number>,
    groupCounts: Record<string, number>,
  ): void {
    if (++visited > LIMIT) return

    if (index === ARMOR_SLOT_TYPES.length) {
      const pieces = ARMOR_SLOT_TYPES.map((t) => currentArmor[t] as PieceEntry)
      const fullSet = armorCombo(pieces)
      const result = testCombo(fullSet, decos, desiredSkills)
      if (result) {
        result.armorNames = [...result.armorNames]
        result._originalIndex = results.length
        results.push(result)
      }
      return
    }

    const slot = ARMOR_SLOT_TYPES[index]
    const pieces = slotEntries[slot]
    const nextIndex = index + 1
    const remainingSlots = ARMOR_SLOT_TYPES.length - nextIndex

    for (const [name, piece] of pieces) {
      if (usedNames.has(name) && name !== 'None') continue

      currentArmor[slot] = [name, piece]
      usedNames.add(name)

      const addedSetCounts: Record<string, number> = {}
      const addedGroupCounts: Record<string, number> = {}

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

      let shouldContinue = true

      // Prune by set/group skill feasibility
      for (const sk of setSkillKeys) {
        if (setSkills[sk] * 2 - (setCounts[sk] ?? 0) > remainingSlots) {
          shouldContinue = false
          break
        }
      }
      if (shouldContinue) {
        for (const gk of groupSkillKeys) {
          if (3 - (groupCounts[gk] ?? 0) > remainingSlots) {
            shouldContinue = false
            break
          }
        }
      }

      // Prune by skill feasibility — pass nextIndex to avoid filter() inside
      if (shouldContinue) {
        for (const [skillName, level] of desiredSkillEntries) {
          if (!canArmorFulfillSkill(currentArmor, decos, skillName, level, maxPotential, nextIndex)) {
            shouldContinue = false
            break
          }
        }
      }

      if (shouldContinue) {
        dfs(nextIndex, currentArmor, usedNames, setCounts, groupCounts)
      }

      // Backtrack
      usedNames.delete(name)
      delete currentArmor[slot]
      for (const sk of Object.keys(addedSetCounts)) setCounts[sk] -= addedSetCounts[sk]
      for (const gk of Object.keys(addedGroupCounts)) groupCounts[gk] -= addedGroupCounts[gk]
    }
  }

  dfs(0, {}, new Set(), { ...initialSetCounts }, { ...initialGroupCounts })
  return results
}
