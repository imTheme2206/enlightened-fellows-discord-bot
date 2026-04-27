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
// Output types (Prisma create inputs, described as plain objects)
// ---------------------------------------------------------------------------

export interface PrismaSkillCreateInput {
  name: string
  cleanName: string
  description: string
  kind: 'ARMOR' | 'SET' | 'GROUP'
  requiredPieces?: number
  ranks: Array<{ level: number; description: string }>
}

export interface PrismaArmorCreateInput {
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
}

export interface PrismaArmorSkillCreateInput {
  armorName: string
  skillName: string
  level: number
}

export interface PrismaDecorationCreateInput {
  name: string
  type: string
  slotSize: number
  skillName: string
  skillLevel: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalizes a skill name to a clean identifier.
 * Converts to lowercase, replaces spaces with underscores,
 * strips special characters (keeps letters, digits, underscores).
 */
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
  skills: PrismaSkillCreateInput[]
  armor: PrismaArmorCreateInput[]
  armorSkills: PrismaArmorSkillCreateInput[]
  decorations: PrismaDecorationCreateInput[]
}

/**
 * Converts validated SeedData into Prisma create input arrays.
 * Validates the source JSON using Zod before transforming.
 */
export function transformSeedData(data: SeedData): TransformResult {
  // Validate via Zod (throws on invalid data)
  SeedDataSchema.parse(data)

  const skills: PrismaSkillCreateInput[] = []
  const armor: PrismaArmorCreateInput[] = []
  const armorSkillsList: PrismaArmorSkillCreateInput[] = []
  const decorations: PrismaDecorationCreateInput[] = []

  // --- Skills (kind: ARMOR) ---
  for (const [name, maxLevel] of Object.entries(data.skills)) {
    const ranks: Array<{ level: number; description: string }> = []
    for (let lvl = 1; lvl <= maxLevel; lvl++) {
      ranks.push({ level: lvl, description: '' })
    }
    skills.push({
      name,
      cleanName: toCleanName(name),
      description: '',
      kind: 'ARMOR',
      ranks,
    })
  }

  // --- Set skills (kind: SET) ---
  for (const [setName, [skillName, piecesRequired, bonusLevels]] of Object.entries(
    data.setSkills
  )) {
    const ranks: Array<{ level: number; description: string }> = bonusLevels.map((_, i) => ({
      level: i + 1,
      description: '',
    }))
    skills.push({
      name: skillName,
      cleanName: toCleanName(skillName),
      description: '',
      kind: 'SET',
      requiredPieces: piecesRequired,
      ranks,
    })
    // Also add the set name as a skill entry for lookup purposes
    // (set name → skill name mapping handled via setMap)
    void setName // used by the set map, not stored as a separate skill row
  }

  // --- Group skills (kind: GROUP) ---
  for (const [groupName, [skillName, , piecesRequired]] of Object.entries(data.groupSkills)) {
    const ranks = [{ level: 1, description: '' }]
    skills.push({
      name: skillName,
      cleanName: toCleanName(skillName),
      description: '',
      kind: 'GROUP',
      requiredPieces: piecesRequired,
      ranks,
    })
    void groupName
  }

  // --- Armor pieces ---
  const armorTypes = ['head', 'chest', 'arms', 'waist', 'legs'] as const
  for (const armorType of armorTypes) {
    const pieces = data.armor[armorType]
    for (const [name, piece] of Object.entries(pieces)) {
      const [_type, pieceSkills, , slots, defense, resists, rank, setSkillNames] = piece

      armor.push({
        name,
        type: armorType,
        rank: rank.toUpperCase(),
        rarity: 0, // compact data has no rarity field
        defense,
        fireRes: resists[0],
        waterRes: resists[1],
        thunderRes: resists[2],
        iceRes: resists[3],
        dragonRes: resists[4],
        slots: slots ?? [],
        setSkillNames: setSkillNames ?? [],
      })

      // Armor skill links
      for (const [skillName, level] of Object.entries(pieceSkills)) {
        armorSkillsList.push({ armorName: name, skillName, level })
      }
    }
  }

  // --- Decorations ---
  for (const [name, [type, decoSkills, slotSize]] of Object.entries(data.decoration)) {
    const entries = Object.entries(decoSkills)
    const [skillName, skillLevel] = entries.length > 0 ? entries[0] : ['', 0]
    decorations.push({ name, type, slotSize, skillName, skillLevel })
  }

  return { skills, armor, armorSkills: armorSkillsList, decorations }
}
