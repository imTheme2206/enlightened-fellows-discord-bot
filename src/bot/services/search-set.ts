import { readFileSync } from "fs";
import { join } from "path";

export const loadWeaponSkills = () => {
  // try {
  const raw = readFileSync(
    join(__dirname, "..", "..", "data", "seed", "decoration.json"),
    "utf-8",
  );
  const data = JSON.parse(raw) as Record<
    string,
    [string, Record<string, number>, number]
  >;

  const allData = Object.keys(data)
    .filter(
      (d) => data[d][0] === "weapon" && Object.keys(data[d][1]).length === 1,
    )
    .map((d) => {
      const val = Object.keys(data[d][1])[0];
      return { label: val, value: val };
    });

  const uniqueData = Array.from(new Set(allData.map((d) => d.value))).map(
    (value) => {
      return allData.find((d) => d.value === value)!;
    },
  );

  return uniqueData;
  // } catch {
  //   return [];
  // }
};
export const loadArmorSkills = (slot: 1 | 2 | 3) => {
  // try {
  const raw = readFileSync(
    join(__dirname, "..", "..", "data", "seed", "decoration.json"),
    "utf-8",
  );
  const data = JSON.parse(raw) as Record<
    string,
    [string, Record<string, number>, number]
  >;

  const allData = Object.keys(data)
    .filter((d) => data[d][0] === "armor" && data[d][2] === slot)
    .map((d) => {
      const val = Object.keys(data[d][1])[0];
      return { label: val, value: val };
    });

  const uniqueData = Array.from(new Set(allData.map((d) => d.value))).map(
    (value) => {
      return allData.find((d) => d.value === value)!;
    },
  );

  return uniqueData;
  // } catch {
  //   return [];
  // }
};

export const SKILLS_BY_SLOT: Record<1 | 2 | 3, string[]> = {
  1: [
    "Flinch Free",
    "Stun Resistance",
    "Constitution",
    "Quick Sheathe",
    "Divine Blessing",
    "Wide-Range",
    "Recovery Up",
    "Item Prolonger",
    "Defense Boost",
    "Recovery Speed",
    "Free Meal",
    "Windproof",
    "Speed Eating",
    "Bombardier",
    "Marathon Runner",
  ],
  // Original slot-2 armor skills + weapon-type skills whose cheapest deco is slot 1.
  2: [
    "Attack Boost",
    "Critical Eye",
    "Critical Boost",
    "Offensive Guard",
    "Guard",
    "Guard Up",
    "Handicraft",
    "Focus",
    "Artillery",
    "Razor Sharp",
    "Protective Polish",
    "Speed Sharpening",
    "Critical Draw",
    "Earplugs",
    "Evade Window",
    "Evade Extender",
    "Resentment",
    "Peak Performance",
    "Coalescence",
    "Maximum Might",
    "Heroics",
    "Stamina Surge",
    "Counterstrike",
    "Partbreaker",
    "Horn Maestro",
  ],
  3: [
    "Agitator",
    "Burst",
    "Weakness Exploit",
    "Adrenaline Rush",
    "Foray",
    "Master's Touch",
    "Flayer",
    "Latent Power",
  ],
};

// ─── Set / group skill data (loaded from seed files) ─────────────────────────

interface SetSkillOption {
  label: string;
  description: string;
  value: string;
}
interface GroupSkillOption {
  label: string;
  description: string;
  value: string;
}

export function loadSetSkillOptions(): SetSkillOption[] {
  try {
    const raw = readFileSync(
      join(__dirname, "..", "..", "data", "seed", "set-skills.json"),
      "utf-8",
    );
    const data = JSON.parse(raw) as Record<string, [string, number, number[]]>;
    return Object.entries(data).map(([name, [effect]]) => ({
      label: name,
      description: `→ ${effect}`,
      value: name,
    }));
  } catch {
    return [];
  }
}

export function loadGroupSkillOptions(): GroupSkillOption[] {
  try {
    const raw = readFileSync(
      join(__dirname, "..", "..", "data", "seed", "group-skills.json"),
      "utf-8",
    );
    const data = JSON.parse(raw) as Record<string, [string, number, number]>;
    return Object.entries(data).map(([name, [effect]]) => ({
      label: name,
      description: `→ ${effect}`,
      value: name,
    }));
  } catch {
    return [];
  }
}
