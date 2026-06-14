import { randomUUID } from 'crypto'
import logger from '../config/logger'
import { db } from '../db/client'
import { armor, armorGroupSkill, armorSetSkill, armorSkill, decoration, skill } from '../db/schema'
import { JobLogService } from '../modules/job-logs/service'
import type { MhdbArmorPiece, MhdbArmorSet, MhdbCharmGroup, MhdbDecoration, MhdbSkill } from './scraper/mhdb-types'
import { SeedDataSchema, transformSeedData } from './scraper/transform'
import { initSearchIndex } from './set-search'

const BASE_URL = 'https://wilds.mhdb.io/en'

function deKira(name: string): string {
  return name.replace(/α/g, 'Alpha').replace(/β/g, 'Beta').replace(/γ/g, 'Gamma').replace(/"/g, "'").replace(/G\. /g, 'G ')
}

function getBaseName(names: string[]): string {
  const suffixRegex = /\s(I|II)\s*$/
  const stripped = names.map((n) => n.replace(suffixRegex, '').trim())
  return new Set(stripped).size === 1 ? stripped[0] : names.join('/')
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  return res.json() as Promise<T>
}

async function fetchSeedData() {
  const [armorList, skillList, armorSetList, charmList, decorationList] = await Promise.all([
    fetchJson<MhdbArmorPiece[]>(`${BASE_URL}/armor`),
    fetchJson<MhdbSkill[]>(`${BASE_URL}/skills`),
    fetchJson<MhdbArmorSet[]>(`${BASE_URL}/armor/sets`),
    fetchJson<MhdbCharmGroup[]>(`${BASE_URL}/charms`),
    fetchJson<MhdbDecoration[]>(`${BASE_URL}/decorations`),
  ])

  const pieceSetSkills = new Map<string, string[]>()
  const pieceGroupSkills = new Map<string, string[]>()

  for (const armorSet of armorSetList) {
    const setBonusName = armorSet.bonus?.skill?.name
    const groupBonusName = armorSet.groupBonus?.skill?.name

    for (const piece of armorSet.pieces) {
      if (setBonusName) {
        const arr = pieceSetSkills.get(piece.name) ?? []
        if (!arr.includes(setBonusName)) arr.push(setBonusName)
        pieceSetSkills.set(piece.name, arr)
      }
      if (groupBonusName) {
        const arr = pieceGroupSkills.get(piece.name) ?? []
        if (!arr.includes(groupBonusName)) arr.push(groupBonusName)
        pieceGroupSkills.set(piece.name, arr)
      }
    }
  }

  for (const piece of armorList) {
    const directSetSkills = piece.skills.filter((s) => s.skill.kind === 'set').map((s) => s.skill.name)
    if (directSetSkills.length > 0) {
      const arr = pieceSetSkills.get(piece.name) ?? []
      for (const sk of directSetSkills) {
        if (!arr.includes(sk)) arr.push(sk)
      }
      pieceSetSkills.set(piece.name, arr)
    }
  }

  const armorData: Record<string, Record<string, unknown[]>> = { head: {}, chest: {}, arms: {}, waist: {}, legs: {} }

  for (const piece of armorList) {
    const cleanName = deKira(piece.name)
    const skills: Record<string, number> = {}
    for (const s of piece.skills) {
      if (s.skill.kind === 'armor') skills[s.skill.name] = s.level
    }
    armorData[piece.kind][cleanName] = [
      piece.kind,
      skills,
      pieceGroupSkills.get(piece.name) ?? [],
      piece.slots,
      piece.defense.base,
      [piece.resistances.fire, piece.resistances.water, piece.resistances.thunder, piece.resistances.ice, piece.resistances.dragon],
      piece.rank,
      pieceSetSkills.get(piece.name) ?? [],
    ]
  }

  const talisman: Record<string, unknown[]> = {}
  for (const group of charmList) {
    for (const charm of group.ranks) {
      const skills: Record<string, number> = {}
      for (const s of charm.skills) skills[s.skill.name] = s.level
      talisman[deKira(charm.name)] = ['talisman', skills]
    }
  }

  const decorationData: Record<string, unknown[]> = {}
  for (const deco of decorationList) {
    const rawName = deco.name.replace(/\[/g, '').replace(/\]/g, '').replace(/\//g, '-')
    const skills: Record<string, number> = {}
    for (const s of deco.skills) skills[s.skill.name] = s.level
    decorationData[deKira(rawName)] = [deco.kind, skills, deco.slot]
  }

  const skillsData: Record<string, number> = {}
  const setSkills: Record<string, unknown[]> = {}
  const groupSkills: Record<string, unknown[]> = {}
  const setMap: Record<string, string> = {}
  const armorSkills: string[] = []

  for (const s of skillList) {
    const cleanName = deKira(s.name)
    switch (s.kind) {
      case 'armor':
      case 'weapon':
        skillsData[cleanName] = s.ranks.length
        if (s.kind === 'armor') armorSkills.push(cleanName)
        break
      case 'set': {
        const effectName = getBaseName(s.ranks.map((r) => r.name))
        const thresholds = s.ranks.map((r) => r.setPiecesRequired ?? 2)
        setSkills[cleanName] = [effectName, thresholds[0] ?? 2, thresholds]
        setMap[cleanName] = effectName
        break
      }
      case 'group': {
        const effectName = getBaseName(s.ranks.map((r) => r.name))
        groupSkills[cleanName] = [effectName, 1, 3]
        setMap[cleanName] = effectName
        break
      }
    }
  }

  const raw = { armor: armorData, talisman, decoration: decorationData, skills: skillsData, setSkills, groupSkills, setMap, armorSkills }
  const parsed = SeedDataSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Fetched data validation failed: ${JSON.stringify(parsed.error.flatten())}`)
  }
  return parsed.data
}

export interface ScraperResult {
  armorCount: number
  skillCount: number
  decoCount: number
}

export async function runScraper(options: { source?: 'cron' | 'manual' | 'boot' } = {}): Promise<ScraperResult> {
  const source = options.source ?? 'manual'
  const jobName = `scraper:${source}`

  logger.info(`[scraperService] Starting scraper (source: ${source})`)

  let result: ScraperResult = { armorCount: 0, skillCount: 0, decoCount: 0 }

  try {
    const seedData = await fetchSeedData()
    const { skills, armor: armorPieces, armorRegularSkills, decorations } = transformSeedData(seedData)

    await db.transaction(async (tx) => {
      await tx.delete(armorGroupSkill)
      await tx.delete(armorSetSkill)
      await tx.delete(armorSkill)
      await tx.delete(decoration)
      await tx.delete(armor)
      await tx.delete(skill)

      const skillIdMap = new Map<string, string>()
      for (const s of skills) {
        const id = randomUUID()
        skillIdMap.set(s.name, id)
      }

      await tx.insert(skill).values(
        skills.map((s) => ({
          id: skillIdMap.get(s.name)!,
          name: s.name,
          cleanName: s.cleanName,
          type: s.type,
          maxLevel: s.maxLevel,
          isSetSkill: s.isSetSkill,
          isGroupSkill: s.isGroupSkill,
          requiredPieces: s.requiredPieces ?? null,
          effectName: s.effectName ?? null,
        }))
      )

      const armorIdMap = new Map<string, string>()
      for (const piece of armorPieces) {
        const id = randomUUID()
        armorIdMap.set(piece.name, id)
      }

      await tx.insert(armor).values(
        armorPieces.map((piece) => ({
          id: armorIdMap.get(piece.name)!,
          name: piece.name,
          type: piece.type,
          rank: piece.rank,
          rarity: piece.rarity,
          defense: piece.defense,
          fireRes: piece.fireRes,
          waterRes: piece.waterRes,
          thunderRes: piece.thunderRes,
          iceRes: piece.iceRes,
          dragonRes: piece.dragonRes,
          slots: piece.slots,
        }))
      )

      const armorSkillRows = armorRegularSkills.flatMap((link) => {
        const armorId = armorIdMap.get(link.armorName)
        const skillId = skillIdMap.get(link.skillName)
        if (!armorId || !skillId) {
          logger.warn(`[scraperService] Skipping ArmorSkill: armor=${link.armorName} skill=${link.skillName} (not found)`)
          return []
        }
        return [{ armorId, skillId, level: link.level }]
      })
      if (armorSkillRows.length) await tx.insert(armorSkill).values(armorSkillRows)

      const setSkillRows = armorPieces.flatMap((piece) => {
        const armorId = armorIdMap.get(piece.name)
        if (!armorId) return []
        return piece.setSkillNames.flatMap((setName) => {
          const skillId = skillIdMap.get(setName)
          if (!skillId) {
            logger.warn(`[scraperService] Skipping ArmorSetSkill: armor=${piece.name} set=${setName} (not found)`)
            return []
          }
          return [{ armorId, skillId }]
        })
      })
      if (setSkillRows.length) await tx.insert(armorSetSkill).values(setSkillRows)

      const groupSkillRows = armorPieces.flatMap((piece) => {
        const armorId = armorIdMap.get(piece.name)
        if (!armorId) return []
        return piece.groupSkillNames.flatMap((groupName) => {
          const skillId = skillIdMap.get(groupName)
          if (!skillId) {
            logger.warn(`[scraperService] Skipping ArmorGroupSkill: armor=${piece.name} group=${groupName} (not found)`)
            return []
          }
          return [{ armorId, skillId }]
        })
      })
      if (groupSkillRows.length) await tx.insert(armorGroupSkill).values(groupSkillRows)

      const decoRows = decorations.flatMap((deco) => {
        const skillId = skillIdMap.get(deco.skillName)
        if (!skillId) {
          logger.warn(`[scraperService] Skipping Decoration: ${deco.name} (skill=${deco.skillName} not found)`)
          return []
        }
        return [{ id: randomUUID(), name: deco.name, type: deco.type, slotSize: deco.slotSize, skillId, skillLevel: deco.skillLevel }]
      })
      if (decoRows.length) await tx.insert(decoration).values(decoRows)
    })

    result = {
      armorCount: armorPieces.length,
      skillCount: skills.length,
      decoCount: decorations.length,
    }

    logger.info(`[scraperService] Success: ${result.armorCount} armor, ${result.skillCount} skills, ${result.decoCount} decorations`)
    await JobLogService.log(jobName, 'SUCCESS', JSON.stringify(result))

    try {
      await initSearchIndex()
      logger.info('[scraperService] Search index rebuilt successfully')
    } catch (indexErr) {
      logger.warn('[scraperService] Failed to rebuild search index (non-fatal):', { indexErr })
    }

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[scraperService] Failed: ${message}`, { err })
    try {
      await JobLogService.log(jobName, 'FAILED', message)
    } catch {
      // ignore logging failure
    }
    throw err
  }
}
