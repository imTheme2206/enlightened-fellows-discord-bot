import { randomUUID } from "crypto";
import logger from "../config/logger";
import { db } from "../db/client";
import { JobLogService } from "../modules/job-logs/service";
import { SeedDataSchema, transformSeedData } from "./scraper/transform";
import type {
  MhdbArmorPiece,
  MhdbArmorSet,
  MhdbCharmGroup,
  MhdbDecoration,
  MhdbSkill,
} from "./scraper/mhdb-types";

const BASE_URL = "https://wilds.mhdb.io/en";

function deKira(name: string): string {
  return name
    .replace(/α/g, "Alpha")
    .replace(/β/g, "Beta")
    .replace(/γ/g, "Gamma")
    .replace(/"/g, "'")
    .replace(/G\. /g, "G ");
}

function getBaseName(names: string[]): string {
  const suffixRegex = /\s(I|II)\s*$/;
  const stripped = names.map((n) => n.replace(suffixRegex, "").trim());
  return new Set(stripped).size === 1 ? stripped[0] : names.join("/");
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json() as Promise<T>;
}

async function fetchSeedData() {
  const [armorList, skillList, armorSetList, charmList, decorationList] =
    await Promise.all([
      fetchJson<MhdbArmorPiece[]>(`${BASE_URL}/armor`),
      fetchJson<MhdbSkill[]>(`${BASE_URL}/skills`),
      fetchJson<MhdbArmorSet[]>(`${BASE_URL}/armor/sets`),
      fetchJson<MhdbCharmGroup[]>(`${BASE_URL}/charms`),
      fetchJson<MhdbDecoration[]>(`${BASE_URL}/decorations`),
    ]);

  const pieceSetSkills = new Map<string, string[]>();
  const pieceGroupSkills = new Map<string, string[]>();

  for (const armorSet of armorSetList) {
    const setBonusName = armorSet.bonus?.skill?.name;
    const groupBonusName = armorSet.groupBonus?.skill?.name;

    for (const piece of armorSet.pieces) {
      if (setBonusName) {
        const arr = pieceSetSkills.get(piece.name) ?? [];
        if (!arr.includes(setBonusName)) arr.push(setBonusName);
        pieceSetSkills.set(piece.name, arr);
      }
      if (groupBonusName) {
        const arr = pieceGroupSkills.get(piece.name) ?? [];
        if (!arr.includes(groupBonusName)) arr.push(groupBonusName);
        pieceGroupSkills.set(piece.name, arr);
      }
    }
  }

  for (const piece of armorList) {
    const directSetSkills = piece.skills
      .filter((s) => s.skill.kind === "set")
      .map((s) => s.skill.name);
    if (directSetSkills.length > 0) {
      const arr = pieceSetSkills.get(piece.name) ?? [];
      for (const sk of directSetSkills) {
        if (!arr.includes(sk)) arr.push(sk);
      }
      pieceSetSkills.set(piece.name, arr);
    }
  }

  const armor: Record<string, Record<string, unknown[]>> = {
    head: {},
    chest: {},
    arms: {},
    waist: {},
    legs: {},
  };

  for (const piece of armorList) {
    const cleanName = deKira(piece.name);
    const skills: Record<string, number> = {};
    for (const s of piece.skills) {
      if (s.skill.kind === "armor") skills[s.skill.name] = s.level;
    }
    armor[piece.kind][cleanName] = [
      piece.kind,
      skills,
      pieceGroupSkills.get(piece.name) ?? [],
      piece.slots,
      piece.defense.base,
      [
        piece.resistances.fire,
        piece.resistances.water,
        piece.resistances.thunder,
        piece.resistances.ice,
        piece.resistances.dragon,
      ],
      piece.rank,
      pieceSetSkills.get(piece.name) ?? [],
    ];
  }

  const talisman: Record<string, unknown[]> = {};
  for (const group of charmList) {
    for (const charm of group.ranks) {
      const skills: Record<string, number> = {};
      for (const s of charm.skills) skills[s.skill.name] = s.level;
      talisman[deKira(charm.name)] = ["talisman", skills];
    }
  }

  const decoration: Record<string, unknown[]> = {};
  for (const deco of decorationList) {
    const rawName = deco.name
      .replace(/\[/g, "")
      .replace(/\]/g, "")
      .replace(/\//g, "-");
    const skills: Record<string, number> = {};
    for (const s of deco.skills) skills[s.skill.name] = s.level;
    decoration[deKira(rawName)] = [deco.kind, skills, deco.slot];
  }

  const skills: Record<string, number> = {};
  const setSkills: Record<string, unknown[]> = {};
  const groupSkills: Record<string, unknown[]> = {};
  const setMap: Record<string, string> = {};
  const armorSkills: string[] = [];

  for (const skill of skillList) {
    const cleanName = deKira(skill.name);
    switch (skill.kind) {
      case "armor":
      case "weapon":
        skills[cleanName] = skill.ranks.length;
        if (skill.kind === "armor") armorSkills.push(cleanName);
        break;
      case "set": {
        const effectName = getBaseName(skill.ranks.map((r) => r.name));
        setSkills[cleanName] = [effectName, 2, [2, 4]];
        setMap[cleanName] = effectName;
        break;
      }
      case "group": {
        const effectName = getBaseName(skill.ranks.map((r) => r.name));
        groupSkills[cleanName] = [effectName, 1, 3];
        setMap[cleanName] = effectName;
        break;
      }
    }
  }

  const raw = { armor, talisman, decoration, skills, setSkills, groupSkills, setMap, armorSkills };
  const parsed = SeedDataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Fetched data validation failed: ${JSON.stringify(parsed.error.flatten())}`,
    );
  }
  return parsed.data;
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
    const seedData = await fetchSeedData();
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

    JobLogService.log(jobName, "SUCCESS", JSON.stringify(result));

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const setSearchModule = require("./set-search") as {
        initSearchIndex: () => Promise<void>;
      };
      await setSearchModule.initSearchIndex();
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
      JobLogService.log(jobName, "FAILED", message);
    } catch {
      // ignore logging failure
    }
    throw err;
  }
}
