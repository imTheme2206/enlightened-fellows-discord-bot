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
import { db } from '../dbService'

const SEED_DIR = path.join(__dirname, '..', '..', 'data', 'seed')

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(SEED_DIR, file), 'utf-8')) as T
}

function buildMetaMap<TRaw extends unknown[], TMeta>(
  raw: Record<string, TRaw>,
  factory: (name: string, data: TRaw) => TMeta,
): Map<string, TMeta> {
  const map = new Map<string, TMeta>()
  for (const [name, data] of Object.entries(raw)) {
    map.set(name, factory(name, data))
  }
  return map
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

  // Compact armor format: [type, skills, groupSkills, slots, defense, resists, rank, setSkills]
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

  // Compact talisman format: [type, skills]
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

  const armorFiles: [string, Record<string, CompactArmor>][] = [
    ['head', headRaw],
    ['chest', chestRaw],
    ['arms', armsRaw],
    ['waist', waistRaw],
    ['legs', legsRaw],
  ]

  const byType: Record<ArmorType, ArmorPiece[]> = {
    head: [],
    chest: [],
    arms: [],
    waist: [],
    legs: [],
    talisman: Object.entries(talismanRaw).map(([n, d]) => mapTalisman(n, d)),
  }

  for (const [type, raw] of armorFiles) {
    byType[type as ArmorType] = Object.entries(raw).map(([n, d]) => mapArmor(n, d))
  }

  const allArmor: ArmorPiece[] = [
    ...byType.head,
    ...byType.chest,
    ...byType.arms,
    ...byType.waist,
    ...byType.legs,
    ...byType.talisman,
  ]

  // Compact decoration format: [_, skills, slotSize]
  const decorations: DecorationItem[] = Object.entries(decorationRaw).map(
    ([name, data]) => ({
      name,
      skills: data[1],
      slotSize: data[2],
    }),
  )

  // Compact set-skill format: [skillName, piecesRequired, bonusLevels]
  const setSkills = buildMetaMap<CompactSetSkill, SetSkillMeta>(
    setSkillsRaw,
    (name, data) => ({ name, skillName: data[0], piecesRequired: data[1], bonusLevels: data[2] }),
  )

  // Compact group-skill format: [skillName, levelGranted, piecesRequired]
  const groupSkills = buildMetaMap<CompactGroupSkill, GroupSkillMeta>(
    groupSkillsRaw,
    (name, data) => ({ name, skillName: data[0], levelGranted: data[1], piecesRequired: data[2] }),
  )

  // Skills seed is a plain name → maxLevel map
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

export function buildIndexFromDb(): SetSearchIndex {
  type SkillRow = { name: string; maxLevel: number; isSetSkill: number; isGroupSkill: number; requiredPieces: number | null; effectName: string | null }
  type ArmorRow = { name: string; type: string; rank: string; defense: number; slots: string; fireRes: number; waterRes: number; thunderRes: number; iceRes: number; dragonRes: number }
  type ArmorSkillRow = { armorName: string; skillName: string; level: number }
  type ArmorSetSkillRow = { armorName: string; skillName: string }
  type DecoRow = { name: string; slotSize: number; skillName: string; skillLevel: number }

  const skillRows = db.prepare('SELECT name, maxLevel, isSetSkill, isGroupSkill, requiredPieces, effectName FROM Skill').all() as SkillRow[]

  const skills = new Map<string, SkillMeta>()
  const setSkills = new Map<string, SetSkillMeta>()
  const groupSkills = new Map<string, GroupSkillMeta>()

  for (const row of skillRows) {
    if (!row.isSetSkill && !row.isGroupSkill) {
      skills.set(row.name, { name: row.name, maxLevel: row.maxLevel })
    }
    if (row.isSetSkill) {
      setSkills.set(row.name, { name: row.name, skillName: row.effectName ?? row.name, piecesRequired: row.requiredPieces ?? 2, bonusLevels: [] })
    }
    if (row.isGroupSkill) {
      groupSkills.set(row.name, { name: row.name, skillName: row.effectName ?? row.name, levelGranted: 1, piecesRequired: row.requiredPieces ?? 2 })
    }
  }

  const decoRows = db.prepare(`
    SELECT d.name, d.slotSize, s.name AS skillName, d.skillLevel
    FROM Decoration d JOIN Skill s ON d.skillId = s.id
  `).all() as DecoRow[]

  const decorations: DecorationItem[] = decoRows.map(row => ({
    name: row.name,
    skills: { [row.skillName]: row.skillLevel },
    slotSize: row.slotSize,
  }))

  const armorRows = db.prepare('SELECT name, type, rank, defense, slots, fireRes, waterRes, thunderRes, iceRes, dragonRes FROM Armor').all() as ArmorRow[]
  const armorSkillRows = db.prepare(`SELECT a.name AS armorName, s.name AS skillName, ak.level FROM ArmorSkill ak JOIN Armor a ON ak.armorId = a.id JOIN Skill s ON ak.skillId = s.id`).all() as ArmorSkillRow[]
  const armorSetSkillRows = db.prepare(`SELECT a.name AS armorName, s.name AS skillName FROM ArmorSetSkill ask JOIN Armor a ON ask.armorId = a.id JOIN Skill s ON ask.skillId = s.id`).all() as ArmorSetSkillRow[]
  const armorGroupSkillRows = db.prepare(`SELECT a.name AS armorName, s.name AS skillName FROM ArmorGroupSkill agk JOIN Armor a ON agk.armorId = a.id JOIN Skill s ON agk.skillId = s.id`).all() as ArmorSetSkillRow[]

  const armorMap = new Map<string, ArmorPiece>()
  for (const row of armorRows) {
    armorMap.set(row.name, {
      name: row.name,
      type: row.type as ArmorType,
      rank: row.rank.toLowerCase() as 'low' | 'high' | 'master',
      defense: row.defense,
      slots: JSON.parse(row.slots) as number[],
      resists: [row.fireRes, row.waterRes, row.thunderRes, row.iceRes, row.dragonRes],
      skills: {},
      setSkills: [],
      groupSkills: [],
    })
  }

  for (const row of armorSkillRows) {
    const piece = armorMap.get(row.armorName)
    if (piece) piece.skills[row.skillName] = row.level
  }
  for (const row of armorSetSkillRows) {
    armorMap.get(row.armorName)?.setSkills.push(row.skillName)
  }
  for (const row of armorGroupSkillRows) {
    armorMap.get(row.armorName)?.groupSkills.push(row.skillName)
  }

  const allArmor = Array.from(armorMap.values())
  const byType: Record<ArmorType, ArmorPiece[]> = { head: [], chest: [], arms: [], waist: [], legs: [], talisman: [] }
  for (const piece of allArmor) byType[piece.type].push(piece)

  return { version: '1.0.0', byType, allArmor, decorations, setSkills, groupSkills, skills }
}
