import { db } from "../../services/dbService";

const EXCLUDE_SLOT_1_SKILLS = [
  "Survival Expert",
  "Jump Master",
  "Leap of Faith",
  "Jump Master",
  "Cliffhanger",
  "Botanist",
  "Geologist",
  "Entomologist",
  "Outdoorsman",
  "Palico Rally",
  "Self-Improvement",
  "Fire Resistance",
  "Water Resistance",
  "Thunder Resistance",
  "Ice Resistance",
  "Dragon Resistance",
  "Hunger Resistance",
  "Bombardier",
  "Blindsider",
  "Iron Skin",
  "Flinch Free",
  "Blast Resistance",
  "Entomologist",
  "Grillmaster",
  "Poison Resistance",
  "Paralysis Resistance",
];

interface SkillOption {
  label: string;
  value: string;
}

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

/** All unique skill names available via weapon-slot decorations. */
export function loadWeaponSkills(): SkillOption[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT s.name
       FROM Decoration d
       JOIN Skill s ON d.skillId = s.id
       WHERE d.type = 'weapon'
       ORDER BY s.name`,
    )
    .all() as { name: string }[];

  return rows.map((r) => ({ label: r.name, value: r.name }));
}

/** All unique skill names available via armor decorations of the given slot size. */
export function loadArmorSkills(slot: 1 | 2 | 3): SkillOption[] {
  const rows = db
    .prepare(
      `SELECT DISTINCT s.name
       FROM Decoration d
       JOIN Skill s ON d.skillId = s.id
       WHERE d.type = 'armor' AND d.slotSize = ?
       AND s.name NOT IN (${EXCLUDE_SLOT_1_SKILLS.map((s) => `'${s}'`).join(", ")})
       ORDER BY s.name`,
    )
    .all(slot) as { name: string }[];

  return rows.map((r) => ({ label: r.name, value: r.name }));
}

/** All set skills (keyed by set name) for the weapon-contribution dropdown. */
export function loadSetSkillOptions(): SetSkillOption[] {
  const rows = db
    .prepare(
      `SELECT name, effectName
       FROM Skill
       WHERE isSetSkill = 1
       ORDER BY name`,
    )
    .all() as { name: string; effectName: string | null }[];

  return rows.map((r) => ({
    label: r.name,
    description: r.effectName ? `→ ${r.effectName}` : r.name,
    value: r.name,
  }));
}

/** Max level for each skill name in the given list. */
export function getSkillMaxLevels(names: string[]): Map<string, number> {
  if (names.length === 0) return new Map();
  const placeholders = names.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT name, maxLevel FROM Skill WHERE name IN (${placeholders})`,
    )
    .all(...names) as { name: string; maxLevel: number }[];
  return new Map(rows.map((r) => [r.name, r.maxLevel]));
}

/** All group skills (keyed by group name) for the weapon-contribution dropdown. */
export function loadGroupSkillOptions(): GroupSkillOption[] {
  const rows = db
    .prepare(
      `SELECT name, effectName
       FROM Skill
       WHERE isGroupSkill = 1
       ORDER BY name`,
    )
    .all() as { name: string; effectName: string | null }[];

  return rows.map((r) => ({
    label: r.name,
    description: r.effectName ? `→ ${r.effectName}` : r.name,
    value: r.name,
  }));
}
