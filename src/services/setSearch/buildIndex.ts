import fs from 'fs'
import path from 'path'
import type {
  SetSearchIndex,
  ArmorPiece,
  DecorationItem,
  SetSkillMeta,
  GroupSkillMeta,
  SkillMeta,
  ArmorType,
} from './types'
import type { CompactArmor, CompactTalisman, CompactDecoration, CompactSetSkill, CompactGroupSkill } from '../scraper/types'

const SEED_DIR = path.join(__dirname, '..', '..', 'data', 'seed')

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(SEED_DIR, file), 'utf-8')) as T
}

/**
 * Builds the in-memory search index from seed JSON files.
 * Does NOT touch Prisma — reads JSON directly for speed.
 */
export function buildSearchIndex(): SetSearchIndex {
  // Read all seed files
  const headRaw = readJson<Record<string, CompactArmor>>('head.json')
  const chestRaw = readJson<Record<string, CompactArmor>>('chest.json')
  const armsRaw = readJson<Record<string, CompactArmor>>('arms.json')
  const waistRaw = readJson<Record<string, CompactArmor>>('waist.json')
  const legsRaw = readJson<Record<string, CompactArmor>>('legs.json')
  const talismanRaw = readJson<Record<string, CompactTalisman>>('talisman.json')
  const decorationRaw = readJson<Record<string, CompactDecoration>>('decoration.json')
  const setSkillsRaw = readJson<Record<string, CompactSetSkill>>('set-skills.json')
  const groupSkillsRaw = readJson<Record<string, CompactGroupSkill>>('group-skills.json')
  const skillsRaw = readJson<Record<string, number>>('skills.json')

  // Map compact armor → ArmorPiece
  const mapArmor = (name: string, data: CompactArmor): ArmorPiece => ({
    name,
    type: data[0] as ArmorType,
    skills: data[1],
    groupSkills: data[2],
    slots: data[3],
    defense: data[4],
    resists: data[5],
    rank: data[6] as 'low' | 'high' | 'master',
    setSkills: data[7],
  })

  // Map compact talisman → ArmorPiece (shorter format: [type, skills])
  const mapTalisman = (name: string, data: CompactTalisman): ArmorPiece => ({
    name,
    type: 'talisman',
    skills: data[1],
    groupSkills: [],
    slots: [],
    defense: 0,
    resists: [0, 0, 0, 0, 0],
    rank: 'high',
    setSkills: [],
  })

  const headPieces = Object.entries(headRaw).map(([n, d]) => mapArmor(n, d))
  const chestPieces = Object.entries(chestRaw).map(([n, d]) => mapArmor(n, d))
  const armsPieces = Object.entries(armsRaw).map(([n, d]) => mapArmor(n, d))
  const waistPieces = Object.entries(waistRaw).map(([n, d]) => mapArmor(n, d))
  const legsPieces = Object.entries(legsRaw).map(([n, d]) => mapArmor(n, d))
  const talismanPieces = Object.entries(talismanRaw).map(([n, d]) => mapTalisman(n, d))

  const byType: Record<ArmorType, ArmorPiece[]> = {
    head: headPieces,
    chest: chestPieces,
    arms: armsPieces,
    waist: waistPieces,
    legs: legsPieces,
    talisman: talismanPieces,
  }

  const allArmor: ArmorPiece[] = [
    ...headPieces,
    ...chestPieces,
    ...armsPieces,
    ...waistPieces,
    ...legsPieces,
    ...talismanPieces,
  ]

  // Map decorations
  const decorations: DecorationItem[] = Object.entries(decorationRaw).map(
    ([name, data]) => ({
      name,
      skills: data[1],
      slotSize: data[2],
    })
  )

  // Map set skills
  const setSkills = new Map<string, SetSkillMeta>()
  for (const [name, data] of Object.entries(setSkillsRaw)) {
    setSkills.set(name, {
      name,
      skillName: data[0],
      piecesRequired: data[1],
      bonusLevels: data[2],
    })
  }

  // Map group skills
  const groupSkills = new Map<string, GroupSkillMeta>()
  for (const [name, data] of Object.entries(groupSkillsRaw)) {
    groupSkills.set(name, {
      name,
      skillName: data[0],
      levelGranted: data[1],
      piecesRequired: data[2],
    })
  }

  // Map skills
  const skills = new Map<string, SkillMeta>()
  for (const [name, maxLevel] of Object.entries(skillsRaw)) {
    skills.set(name, { name, maxLevel })
  }

  return {
    version: '1.0.0',
    byType,
    allArmor,
    decorations,
    setSkills,
    groupSkills,
    skills,
  }
}
