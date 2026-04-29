import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import logger from "../config/logger";
import { db, logJob } from "./db-service";
import { SeedDataSchema, transformSeedData } from "./scraper/transform";
import type { SeedData } from "./scraper/types";

const SEED_DIR = path.join(process.cwd(), "assets", "seed");

function readSeedJson<T>(filename: string): T {
  const filePath = path.join(SEED_DIR, filename);
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function loadSeedData(): SeedData {
  const raw = {
    armor: {
      head: readSeedJson("head.json"),
      chest: readSeedJson("chest.json"),
      arms: readSeedJson("arms.json"),
      waist: readSeedJson("waist.json"),
      legs: readSeedJson("legs.json"),
    },
    talisman: readSeedJson("talisman.json"),
    decoration: readSeedJson("decoration.json"),
    skills: readSeedJson("skills.json"),
    setSkills: readSeedJson("set-skills.json"),
    groupSkills: readSeedJson("group-skills.json"),
    setMap: readSeedJson("set-map.json"),
    armorSkills: readSeedJson("armor-skills.json"),
  };

  const parsed = SeedDataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Seed data validation failed: ${JSON.stringify(parsed.error.flatten())}`,
    );
  }

  return parsed.data as SeedData;
}

export interface ScraperResult {
  armorCount: number;
  skillCount: number;
  decoCount: number;
}

export async function runScraper(
  options: { source?: "cron" | "manual" | "boot" } = {},
): Promise<ScraperResult> {
  const source = options.source ?? "manual";
  const jobName = `scraper:${source}`;

  logger.info(`[scraperService] Starting scraper (source: ${source})`);

  let result: ScraperResult = { armorCount: 0, skillCount: 0, decoCount: 0 };

  try {
    const seedData = loadSeedData();
    const { skills, armor, armorRegularSkills, decorations } =
      transformSeedData(seedData);

    const insertSkill = db.prepare(
      "INSERT INTO Skill (id, name, cleanName, type, maxLevel, isSetSkill, isGroupSkill, requiredPieces, effectName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const insertArmor = db.prepare(
      "INSERT INTO Armor (id, name, type, rank, rarity, defense, fireRes, waterRes, thunderRes, iceRes, dragonRes, slots) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const insertArmorSkill = db.prepare(
      "INSERT INTO ArmorSkill (armorId, skillId, level) VALUES (?, ?, ?)",
    );
    const insertArmorSetSkill = db.prepare(
      "INSERT INTO ArmorSetSkill (armorId, skillId) VALUES (?, ?)",
    );
    const insertArmorGroupSkill = db.prepare(
      "INSERT INTO ArmorGroupSkill (armorId, skillId) VALUES (?, ?)",
    );
    const insertDeco = db.prepare(
      "INSERT INTO Decoration (id, name, type, slotSize, skillId, skillLevel) VALUES (?, ?, ?, ?, ?, ?)",
    );

    const seed = db.transaction(() => {
      db.prepare("DELETE FROM ArmorGroupSkill").run();
      db.prepare("DELETE FROM ArmorSetSkill").run();
      db.prepare("DELETE FROM ArmorSkill").run();
      db.prepare("DELETE FROM Decoration").run();
      db.prepare("DELETE FROM Armor").run();
      db.prepare("DELETE FROM Skill").run();

      const skillIdMap = new Map<string, string>();
      for (const skill of skills) {
        const id = randomUUID();
        skillIdMap.set(skill.name, id);
        insertSkill.run(
          id,
          skill.name,
          skill.cleanName,
          skill.type,
          skill.maxLevel,
          skill.isSetSkill ? 1 : 0,
          skill.isGroupSkill ? 1 : 0,
          skill.requiredPieces ?? null,
          skill.effectName ?? null,
        );
      }

      const armorIdMap = new Map<string, string>();
      for (const piece of armor) {
        const id = randomUUID();
        armorIdMap.set(piece.name, id);
        insertArmor.run(
          id,
          piece.name,
          piece.type,
          piece.rank,
          piece.rarity,
          piece.defense,
          piece.fireRes,
          piece.waterRes,
          piece.thunderRes,
          piece.iceRes,
          piece.dragonRes,
          JSON.stringify(piece.slots),
        );
      }

      for (const link of armorRegularSkills) {
        const armorId = armorIdMap.get(link.armorName);
        const skillId = skillIdMap.get(link.skillName);
        if (!armorId || !skillId) {
          logger.warn(
            `[scraperService] Skipping ArmorSkill: armor=${link.armorName} skill=${link.skillName} (not found)`,
          );
          continue;
        }
        insertArmorSkill.run(armorId, skillId, link.level);
      }

      for (const piece of armor) {
        const armorId = armorIdMap.get(piece.name);
        if (!armorId) continue;

        for (const setName of piece.setSkillNames) {
          const skillId = skillIdMap.get(setName);
          if (!skillId) {
            logger.warn(
              `[scraperService] Skipping ArmorSetSkill: armor=${piece.name} set=${setName} (not found)`,
            );
            continue;
          }
          insertArmorSetSkill.run(armorId, skillId);
        }

        for (const groupName of piece.groupSkillNames) {
          const skillId = skillIdMap.get(groupName);
          if (!skillId) {
            logger.warn(
              `[scraperService] Skipping ArmorGroupSkill: armor=${piece.name} group=${groupName} (not found)`,
            );
            continue;
          }
          insertArmorGroupSkill.run(armorId, skillId);
        }
      }

      for (const deco of decorations) {
        const skillId = skillIdMap.get(deco.skillName);
        if (!skillId) {
          logger.warn(
            `[scraperService] Skipping Decoration: ${deco.name} (skill=${deco.skillName} not found)`,
          );
          continue;
        }
        insertDeco.run(
          randomUUID(),
          deco.name,
          deco.type,
          deco.slotSize,
          skillId,
          deco.skillLevel,
        );
      }
    });

    seed();

    result = {
      armorCount: armor.length,
      skillCount: skills.length,
      decoCount: decorations.length,
    };

    logger.info(
      `[scraperService] Success: ${result.armorCount} armor, ${result.skillCount} skills, ${result.decoCount} decorations`,
    );

    logJob(jobName, "SUCCESS", JSON.stringify(result));

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const setSearchModule = require("./set-search") as {
        rebuildSearchIndex: () => Promise<void>;
      };
      await setSearchModule.rebuildSearchIndex();
      logger.info("[scraperService] Search index rebuilt successfully");
    } catch (indexErr) {
      logger.warn(
        "[scraperService] Failed to rebuild search index (non-fatal):",
        { indexErr },
      );
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[scraperService] Failed: ${message}`, { err });
    try {
      logJob(jobName, "FAILED", message);
    } catch {
      // ignore logging failure
    }
    throw err;
  }
}
