import type { ArmorPiece, DecorationItem } from '../types'
import type { SearchResult } from '../types'
import type { GearPool, PieceEntry } from './constants'
import { ARMOR_SLOT_TYPES, MAX_RESULTS } from './constants'
import { armorCombo, testCombo, canArmorFulfillSkill } from './combo'

export function rollCombosDfs(
  gear: GearPool,
  desiredSkills: Record<string, number>,
  setSkills: Record<string, number>,
  groupSkills: Record<string, number>,
  initialSetCounts: Record<string, number> = {},
  initialGroupCounts: Record<string, number> = {},
): SearchResult[] {
  const results: SearchResult[] = []

  function dfs(
    index: number,
    currentArmor: Record<string, PieceEntry>,
    usedNames: Set<string>,
    setCounts: Record<string, number>,
    groupCounts: Record<string, number>,
  ): void {
    if (results.length >= MAX_RESULTS) return

    if (index === ARMOR_SLOT_TYPES.length) {
      const pieces = ARMOR_SLOT_TYPES.map((t) => currentArmor[t] as PieceEntry)
      const fullSet = armorCombo(pieces)
      const result = testCombo(
        fullSet,
        gear.decos as unknown as Record<string, DecorationItem>,
        desiredSkills,
      )
      if (result) {
        result.armorNames = [...result.armorNames]
        results.push(result)
      }
      return
    }

    const slot = ARMOR_SLOT_TYPES[index]
    const pieces = gear[slot] as Record<string, ArmorPiece>

    for (const [name, piece] of Object.entries(pieces)) {
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
      const remainingSlots = ARMOR_SLOT_TYPES.length - (index + 1)
      for (const sk of Object.keys(setSkills)) {
        const needed = setSkills[sk] * 2 - (setCounts[sk] ?? 0)
        if (needed > remainingSlots) {
          shouldContinue = false
          break
        }
      }
      if (shouldContinue) {
        for (const gk of Object.keys(groupSkills)) {
          const needed = 3 - (groupCounts[gk] ?? 0)
          if (needed > remainingSlots) {
            shouldContinue = false
            break
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
            shouldContinue = false
            break
          }
        }
      }

      if (shouldContinue) {
        dfs(index + 1, currentArmor, usedNames, setCounts, groupCounts)
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
