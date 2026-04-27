import { z } from 'zod'
import type { SeedData } from './types'

// ---------------------------------------------------------------------------
// Zod schemas for source JSON validation
// ---------------------------------------------------------------------------

const CompactArmorSchema = z.tuple([
  z.string(), // type
  z.record(z.string(), z.number()), // skills
  z.array(z.string()), // groupSkills
  z.array(z.number()), // slots
  z.number(), // defense
  z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()]), // resists
  z.string(), // rank
  z.array(z.string()), // setSkills
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
})

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface SkillInsert {
  name: string
  cleanName: string
  /** 'armor' | 'set' | 'group' */
  type: 'armor' | 'set' | 'group'
  maxLevel: number
  isSetSkill: boolean
  isGroupSkill: boolean
  requiredPieces?: number
  /** For set/group skills: the actual granted skill name */
  effectName?: string
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
  setSkillNames: string[]
  groupSkillNames: string[]
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
  skillName: string
  skillLevel: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toCleanName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

export interface TransformResult {
  skills: SkillInsert[]
  armor: ArmorInsert[]
  armorRegularSkills: ArmorRegularSkillInsert[]
  decorations: DecorationInsert[]
}

export function transformSeedData(data: SeedData): TransformResult {
  SeedDataSchema.parse(data)

  const skills: SkillInsert[] = []
  const armor: ArmorInsert[] = []
  const armorRegularSkills: ArmorRegularSkillInsert[] = []
  const decorations: DecorationInsert[] = []

  // --- Regular armor skills ---
  for (const [name, maxLevel] of Object.entries(data.skills)) {
    skills.push({
      name,
      cleanName: toCleanName(name),
      type: 'armor',
      maxLevel,
      isSetSkill: false,
      isGroupSkill: false,
    })
  }

  // --- Set skills: stored by SET NAME so armor pieces can reference them ---
  for (const [setName, [effectName, piecesRequired, bonusLevels]] of Object.entries(
    data.setSkills
  )) {
    skills.push({
      name: setName,
      cleanName: toCleanName(setName),
      type: 'set',
      maxLevel: bonusLevels.length,
      isSetSkill: true,
      isGroupSkill: false,
      requiredPieces: piecesRequired,
      effectName,
    })
  }

  // --- Group skills: stored by GROUP NAME so armor pieces can reference them ---
  for (const [groupName, [effectName, levelGranted, piecesRequired]] of Object.entries(
    data.groupSkills
  )) {
    skills.push({
      name: groupName,
      cleanName: toCleanName(groupName),
      type: 'group',
      maxLevel: levelGranted,
      isSetSkill: false,
      isGroupSkill: true,
      requiredPieces: piecesRequired,
      effectName,
    })
  }

  // --- Armor pieces ---
  const armorTypes = ['head', 'chest', 'arms', 'waist', 'legs'] as const
  for (const armorType of armorTypes) {
    const pieces = data.armor[armorType]
    for (const [name, piece] of Object.entries(pieces)) {
      const [_type, pieceSkills, groupSkillsList, slots, defense, resists, rank, setSkillNames] =
        piece

      armor.push({
        name,
        type: armorType,
        rank: rank.toUpperCase(),
        rarity: 0,
        defense,
        fireRes: resists[0],
        waterRes: resists[1],
        thunderRes: resists[2],
        iceRes: resists[3],
        dragonRes: resists[4],
        slots: slots ?? [],
        setSkillNames: setSkillNames ?? [],
        groupSkillNames: groupSkillsList ?? [],
      })

      for (const [skillName, level] of Object.entries(pieceSkills)) {
        armorRegularSkills.push({ armorName: name, skillName, level })
      }
    }
  }

  // --- Talismans ---
  for (const [name, [_type, talisSkills]] of Object.entries(data.talisman)) {
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
      setSkillNames: [],
      groupSkillNames: [],
    })
    for (const [skillName, level] of Object.entries(talisSkills)) {
      armorRegularSkills.push({ armorName: name, skillName, level })
    }
  }

  // --- Decorations ---
  for (const [name, [type, decoSkills, slotSize]] of Object.entries(data.decoration)) {
    const entries = Object.entries(decoSkills)
    const [skillName, skillLevel] = entries.length > 0 ? entries[0] : ['', 0]
    decorations.push({ name, type, slotSize, skillName, skillLevel })
  }

  return { skills, armor, armorRegularSkills, decorations }
}
