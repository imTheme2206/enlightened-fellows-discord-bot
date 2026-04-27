import fs from 'fs'
import path from 'path'
import logger from '../config/logger'
import { prisma, logJob } from './dbService'
import { transformSeedData, SeedDataSchema } from './scraper/transform'
import type { SeedData } from './scraper/types'

const SEED_DIR = path.join(__dirname, '..', 'data', 'seed')

function readSeedJson<T>(filename: string): T {
  const filePath = path.join(SEED_DIR, filename)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
}

function loadSeedData(): SeedData {
  const raw = {
    armor: {
      head: readSeedJson('head.json'),
      chest: readSeedJson('chest.json'),
      arms: readSeedJson('arms.json'),
      waist: readSeedJson('waist.json'),
      legs: readSeedJson('legs.json'),
    },
    talisman: readSeedJson('talisman.json'),
    decoration: readSeedJson('decoration.json'),
    skills: readSeedJson('skills.json'),
    setSkills: readSeedJson('set-skills.json'),
    groupSkills: readSeedJson('group-skills.json'),
    setMap: readSeedJson('set-map.json'),
    armorSkills: readSeedJson('armor-skills.json'),
  }

  // Validate using Zod schema
  const parsed = SeedDataSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Seed data validation failed: ${JSON.stringify(parsed.error.flatten())}`)
  }

  return parsed.data as SeedData
}

export interface ScraperResult {
  armorCount: number
  skillCount: number
  decoCount: number
}

/**
 * Runs the full data scrape: reads seed JSON, validates, transforms, and
 * writes everything to the database in a single transaction.
 *
 * After a successful run, the in-memory search index is rebuilt via a
 * late dynamic import to avoid circular dependency issues.
 */
export async function runScraper(
  options: { source?: 'cron' | 'manual' | 'boot' } = {}
): Promise<ScraperResult> {
  const source = options.source ?? 'manual'
  const jobName = `scraper:${source}`

  logger.info(`[scraperService] Starting scraper (source: ${source})`)

  let result: ScraperResult = { armorCount: 0, skillCount: 0, decoCount: 0 }

  try {
    const seedData = loadSeedData()
    const { skills, armor, armorSkills, decorations } = transformSeedData(seedData)

    await prisma.$transaction(async (tx) => {
      // Clear existing data (order matters for FK constraints)
      await tx.armorSkill.deleteMany()
      await tx.skillRank.deleteMany()
      await tx.decoration.deleteMany()
      await tx.armor.deleteMany()
      await tx.skill.deleteMany()

      // Insert skills
      for (const skill of skills) {
        await tx.skill.create({
          data: {
            name: skill.name,
            cleanName: skill.cleanName,
            description: skill.description,
            kind: skill.kind,
            requiredPieces: skill.requiredPieces ?? null,
            ranks: {
              create: skill.ranks,
            },
          },
        })
      }

      // Insert armor pieces
      for (const piece of armor) {
        await tx.armor.create({
          data: {
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
            setSkillNames: piece.setSkillNames,
          },
        })
      }

      // Insert armor-skill links (must resolve IDs)
      for (const link of armorSkills) {
        const armorRow = await tx.armor.findUnique({ where: { name: link.armorName } })
        const skillRow = await tx.skill.findUnique({ where: { name: link.skillName } })
        if (!armorRow || !skillRow) {
          logger.warn(
            `[scraperService] Skipping ArmorSkill: armor=${link.armorName} skill=${link.skillName} (not found)`
          )
          continue
        }
        await tx.armorSkill.create({
          data: {
            armorId: armorRow.id,
            skillId: skillRow.id,
            level: link.level,
          },
        })
      }

      // Insert decorations
      for (const deco of decorations) {
        await tx.decoration.create({
          data: {
            name: deco.name,
            type: deco.type,
            slotSize: deco.slotSize,
            skillName: deco.skillName,
            skillLevel: deco.skillLevel,
          },
        })
      }
    })

    result = {
      armorCount: armor.length,
      skillCount: skills.length,
      decoCount: decorations.length,
    }

    logger.info(
      `[scraperService] Success: ${result.armorCount} armor, ${result.skillCount} skills, ${result.decoCount} decorations`
    )

    await logJob(jobName, 'SUCCESS', JSON.stringify(result))

    // Rebuild the in-memory search index without creating a circular import
    // by using a late dynamic require.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const setSearchModule = require('./setSearch') as { rebuildSearchIndex: () => Promise<void> }
      await setSearchModule.rebuildSearchIndex()
      logger.info('[scraperService] Search index rebuilt successfully')
    } catch (indexErr) {
      logger.warn('[scraperService] Failed to rebuild search index (non-fatal):', { indexErr })
    }

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`[scraperService] Failed: ${message}`, { err })
    await logJob(jobName, 'FAILED', message).catch(() => undefined)
    throw err
  }
}
