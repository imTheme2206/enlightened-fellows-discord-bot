import type { DecorationItem, SearchResult } from '../types'
import type { ArmorComboResult, DecoResult, PieceEntry } from './constants'
import { mergeSumMaps } from './pool-helpers'

export function armorCombo(pieces: PieceEntry[]): ArmorComboResult {
  const [head, chest, arms, waist, legs, talisman] = pieces
  const allPieces = [head, chest, arms, waist, legs, talisman]
  const armorBodyPieces = [head, chest, arms, waist, legs]

  const skillTotals: Record<string, number> = {}
  for (const [, piece] of allPieces) {
    for (const [sk, lv] of Object.entries(piece.skills)) {
      skillTotals[sk] = (skillTotals[sk] ?? 0) + lv
    }
  }

  const slots: number[] = []
  for (const [, piece] of armorBodyPieces) {
    slots.push(...piece.slots)
  }

  const setSkillCounts: Record<string, number> = {}
  const groupSkillCounts: Record<string, number> = {}
  let defense = 0
  // Elemental defenses aggregate over the same 5 body pieces as `defense`
  // (talisman excluded). resists tuple order: [fire, water, thunder, ice, dragon].
  const elementalDefenses = { fire: 0, water: 0, thunder: 0, ice: 0, dragon: 0 }
  for (const [, piece] of armorBodyPieces) {
    defense += piece.defense
    elementalDefenses.fire += piece.resists[0]
    elementalDefenses.water += piece.resists[1]
    elementalDefenses.thunder += piece.resists[2]
    elementalDefenses.ice += piece.resists[3]
    elementalDefenses.dragon += piece.resists[4]
    for (const sk of piece.setSkills) {
      setSkillCounts[sk] = (setSkillCounts[sk] ?? 0) + 1
    }
    for (const gk of piece.groupSkills) {
      groupSkillCounts[gk] = (groupSkillCounts[gk] ?? 0) + 1
    }
  }

  return {
    names: allPieces.map(([n]) => n),
    rarities: allPieces.map(([, piece]) => piece.rarity ?? 0),
    skills: Object.fromEntries(Object.entries(skillTotals).sort((a, b) => b[1] - a[1])),
    slots,
    setSkills: setSkillCounts,
    groupSkills: groupSkillCounts,
    defense,
    elementalDefenses,
  }
}

export function getDecosToFulfillSkills(
  decos: Record<string, DecorationItem>,
  desiredSkills: Record<string, number>,
  slotsAvailable: number[],
  startingSkills: Record<string, number>
): DecoResult | null {
  if (!decos || Object.keys(decos).length === 0) return null

  const skillsNeeded = { ...desiredSkills }
  for (const [sk, lv] of Object.entries(startingSkills)) {
    if (skillsNeeded[sk] !== undefined) {
      skillsNeeded[sk] -= lv
      if (skillsNeeded[sk] <= 0) delete skillsNeeded[sk]
    }
  }

  if (Object.keys(skillsNeeded).length === 0) {
    return { decoNames: [], freeSlots: slotsAvailable }
  }

  const slotPool = [...slotsAvailable].sort((a, b) => a - b)

  const sortedDecos = Object.entries(decos).sort((a, b) => {
    const totalA = Object.values(a[1].skills).reduce((s, v) => s + v, 0)
    const totalB = Object.values(b[1].skills).reduce((s, v) => s + v, 0)
    if (totalB !== totalA) return totalB - totalA
    return a[1].slotSize - b[1].slotSize
  })

  const usedDecos: string[] = []

  for (const [sk, neededPoints] of Object.entries(skillsNeeded)) {
    let remaining = neededPoints
    while (remaining > 0) {
      let foundMatch = false

      for (const [decoName, deco] of sortedDecos) {
        if (!(sk in deco.skills)) continue
        // No inventory limits in this bot context — use decos freely
        const decoSlot = deco.slotSize

        for (let i = 0; i < slotPool.length; i++) {
          if (slotPool[i] >= decoSlot) {
            usedDecos.push(decoName)
            slotPool.splice(i, 1)
            remaining -= deco.skills[sk]
            foundMatch = true
            break
          }
        }

        if (foundMatch) break
      }

      if (!foundMatch) return null
    }
  }

  return { decoNames: usedDecos, freeSlots: slotPool }
}

/**
 * Tests whether an armor combo satisfies the desired skills (with decos).
 * Returns a SearchResult if successful, null otherwise.
 */
export function testCombo(
  armorSet: ArmorComboResult,
  decos: Record<string, DecorationItem>,
  desiredSkills: Record<string, number>
): SearchResult | null {
  const have: Record<string, number> = {}
  const need: Record<string, number> = {}
  let done = true

  for (const [sk, lv] of Object.entries(desiredSkills)) {
    have[sk] = armorSet.skills[sk] ?? 0
    need[sk] = lv - have[sk]
    if (need[sk] > 0) done = false
  }

  if (done) {
    return {
      armorNames: armorSet.names,
      rarities: armorSet.rarities,
      slots: armorSet.slots,
      decoNames: [],
      skills: armorSet.skills,
      setSkills: armorSet.setSkills,
      groupSkills: armorSet.groupSkills,
      freeSlots: armorSet.slots,
      defense: armorSet.defense,
      elementalDefenses: armorSet.elementalDefenses,
    }
  }

  const decosUsed = getDecosToFulfillSkills(decos, desiredSkills, armorSet.slots, armorSet.skills)
  if (!decosUsed) return null

  const decoSkillsMap = mergeSumMaps(decosUsed.decoNames.map((name) => decos[name]?.skills ?? {}))
  const combinedSkills = mergeSumMaps([armorSet.skills, decoSkillsMap])

  return {
    armorNames: armorSet.names,
    rarities: armorSet.rarities,
    slots: armorSet.slots,
    decoNames: decosUsed.decoNames,
    skills: combinedSkills,
    setSkills: armorSet.setSkills,
    groupSkills: armorSet.groupSkills,
    freeSlots: decosUsed.freeSlots,
    defense: armorSet.defense,
    elementalDefenses: armorSet.elementalDefenses,
  }
}
