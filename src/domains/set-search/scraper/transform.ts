import { z } from 'zod'
import type { SeedData } from './types'

const CompactArmorSchema = z.tuple([
  z.string(), // type
  z.record(z.string(), z.number()), // skills
  z.array(z.string()), // groupSkills
  z.array(z.number()), // slots
  z.number(), // defense
  z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()]), // resists
  z.string(), // rank
  z.array(z.string()), // setSkills
  z.number(), // rarity
])

const CompactTalismanSchema = z.tuple([
  z.string(), // type
  z.record(z.string(), z.number()), // skills
])

const CompactDecorationSchema = z.tuple([
  z.string(), // type
  z.record(z.string(), z.number()), // skills
  z.number(), // slotSize
])

const CompactSetSkillSchema = z.tuple([
  z.string(), // skillName
  z.number(), // piecesRequired
  z.array(z.number()), // bonusLevels
])

const CompactGroupSkillSchema = z.tuple([
  z.string(), // skillName
  z.number(), // levelGranted
  z.number(), // piecesRequired
])

export const SeedDataSchema = z.object({
  armor: z.object({
    head: z.record(z.string(), CompactArmorSchema),
    chest: z.record(z.string(), CompactArmorSchema),
    arms: z.record(z.string(), CompactArmorSchema),
    waist: z.record(z.string(), CompactArmorSchema),
    legs: z.record(z.string(), CompactArmorSchema),
  }),
  talisman: z.record(z.string(), CompactTalismanSchema),
  decoration: z.record(z.string(), CompactDecorationSchema),
  skills: z.record(z.string(), z.number()),
  setSkills: z.record(z.string(), CompactSetSkillSchema),
  groupSkills: z.record(z.string(), CompactGroupSkillSchema),
  setMap: z.record(z.string(), z.string()),
  armorSkills: z.array(z.string()),
  weaponSkills: z.array(z.string()).optional(),
  // Raw MHDB icon category keyed by clean skill/set/group name, e.g. {"Attack Boost": "offense"}.
  skillIcons: z.record(z.string(), z.string()).optional(),
})

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface SkillInsert {
  name: string
  cleanName: string
  /** Ordinary skills only — Set/Group Bonuses are `BonusInsert` now (ADR-0011). */
  type: 'armor' | 'weapon'
  maxLevel: number
  /** Raw MHDB icon category, e.g. 'offense'. Undefined if MHDB omitted it. */
  icon?: string
}

/** A Set or Group Bonus catalog entity (ADR-0011). */
export interface BonusInsert {
  name: string
  cleanName: string
  kind: 'set' | 'group'
  icon?: string
}

/** One ordered activation threshold of a bonus. */
export interface BonusThresholdInsert {
  bonusName: string
  piecesRequired: number
  effectName: string
  level: number
}

/** Membership of an armor piece in a Set/Group bonus. */
export interface ArmorBonusInsert {
  armorName: string
  bonusName: string
}

export interface ArmorInsert {
  name: string
  type: string
  rank: string
  rarity: number
  defense: number
  fireRes: number
  waterRes: number
  thunderRes: number
  iceRes: number
  dragonRes: number
  slots: number[]
}

export interface ArmorRegularSkillInsert {
  armorName: string
  skillName: string
  level: number
}

export interface DecorationInsert {
  name: string
  type: string
  slotSize: number
}

/** One skill grant of a decoration (decorations are multi-grant). */
export interface DecorationSkillInsert {
  decorationName: string
  skillName: string
  level: number
}

function toCleanName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

export interface TransformResult {
  skills: SkillInsert[]
  bonuses: BonusInsert[]
  bonusThresholds: BonusThresholdInsert[]
  armor: ArmorInsert[]
  armorRegularSkills: ArmorRegularSkillInsert[]
  armorBonuses: ArmorBonusInsert[]
  decorations: DecorationInsert[]
  decorationSkills: DecorationSkillInsert[]
}

export function transformSeedData(data: SeedData): TransformResult {
  SeedDataSchema.parse(data)

  const skillIcons = data.skillIcons ?? {}
  const skills: SkillInsert[] = []
  const bonuses: BonusInsert[] = []
  const bonusThresholds: BonusThresholdInsert[] = []
  const armor: ArmorInsert[] = []
  const armorRegularSkills: ArmorRegularSkillInsert[] = []
  const armorBonuses: ArmorBonusInsert[] = []
  const decorations: DecorationInsert[] = []
  const decorationSkills: DecorationSkillInsert[] = []

  // --- Regular skills (armor + weapon; data.skills is the merged set) ---
  const weaponSkillNames = new Set(data.weaponSkills ?? [])
  for (const [name, maxLevel] of Object.entries(data.skills)) {
    skills.push({
      name,
      cleanName: toCleanName(name),
      type: weaponSkillNames.has(name) ? 'weapon' : 'armor',
      maxLevel,
      icon: skillIcons[name],
    })
  }

  // --- Set bonuses: one bonus + one threshold per source rank (ADR-0011). ---
  // Compact shape: [baseEffectName, piecesRequired0, thresholds[]], where
  // `thresholds` is the piece-count for each successive rank. We restore the
  // full ordered threshold list the previous pipeline collapsed to one row.
  for (const [setName, [effectName, , thresholds]] of Object.entries(data.setSkills)) {
    bonuses.push({ name: setName, cleanName: toCleanName(setName), kind: 'set', icon: skillIcons[setName] })
    const seenPieces = new Set<number>()
    thresholds.forEach((piecesRequired, i) => {
      if (seenPieces.has(piecesRequired)) return // PK is (bonus, piecesRequired)
      seenPieces.add(piecesRequired)
      bonusThresholds.push({ bonusName: setName, piecesRequired, effectName, level: i + 1 })
    })
  }

  // --- Group bonuses: single 3-piece threshold. ---
  for (const [groupName, [effectName, levelGranted, piecesRequired]] of Object.entries(data.groupSkills)) {
    bonuses.push({ name: groupName, cleanName: toCleanName(groupName), kind: 'group', icon: skillIcons[groupName] })
    bonusThresholds.push({ bonusName: groupName, piecesRequired, effectName, level: levelGranted })
  }

  // --- Armor pieces ---
  const armorTypes = ['head', 'chest', 'arms', 'waist', 'legs'] as const
  for (const armorType of armorTypes) {
    const pieces = data.armor[armorType]
    for (const [name, piece] of Object.entries(pieces)) {
      const [, pieceSkills, groupSkillsList, slots, defense, resists, rank, setSkillNames, rarity] = piece

      armor.push({
        name,
        type: armorType,
        rank: rank.toUpperCase(),
        rarity: rarity ?? 0,
        defense,
        fireRes: resists[0],
        waterRes: resists[1],
        thunderRes: resists[2],
        iceRes: resists[3],
        dragonRes: resists[4],
        slots: slots ?? [],
      })

      for (const [skillName, level] of Object.entries(pieceSkills)) {
        armorRegularSkills.push({ armorName: name, skillName, level })
      }
      for (const bonusName of [...(setSkillNames ?? []), ...(groupSkillsList ?? [])]) {
        armorBonuses.push({ armorName: name, bonusName })
      }
    }
  }

  // --- Talismans ---
  for (const [name, [, talisSkills]] of Object.entries(data.talisman)) {
    armor.push({
      name,
      type: 'talisman',
      rank: 'HIGH',
      rarity: 0,
      defense: 0,
      fireRes: 0,
      waterRes: 0,
      thunderRes: 0,
      iceRes: 0,
      dragonRes: 0,
      slots: [],
    })
    for (const [skillName, level] of Object.entries(talisSkills)) {
      armorRegularSkills.push({ armorName: name, skillName, level })
    }
  }

  // --- Decorations (multi-grant: keep every skill, not just the first) ---
  for (const [name, [type, decoSkills, slotSize]] of Object.entries(data.decoration)) {
    decorations.push({ name, type, slotSize })
    for (const [skillName, level] of Object.entries(decoSkills)) {
      decorationSkills.push({ decorationName: name, skillName, level })
    }
  }

  return {
    skills,
    bonuses,
    bonusThresholds,
    armor,
    armorRegularSkills,
    armorBonuses,
    decorations,
    decorationSkills,
  }
}
