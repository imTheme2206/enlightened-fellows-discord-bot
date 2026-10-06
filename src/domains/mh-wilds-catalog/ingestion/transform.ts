import { z } from 'zod'
import { WEAPON_KINDS, type SeedData, type SeedWeaponSharpness, type SeedWeaponSpecial } from './types'

const CompactArmorSchema = z.tuple([
  z.string(), // type
  z.record(z.string(), z.number()), // skills
  z.array(z.string()), // groupSkills
  z.array(z.number()), // slots
  z.number(), // defense
  z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()]), // resists
  z.string(), // rank
  z.array(z.string()), // setSkills
  z.number(), // rarity
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

const SeedWeaponSchema = z.object({
  name: z.string(),
  gameId: z.number().int(),
  kind: z.enum(WEAPON_KINDS),
  rarity: z.number(),
  damage: z.object({ raw: z.number(), display: z.number() }),
  affinity: z.number(),
  specials: z.array(
    z.object({
      kind: z.enum(['element', 'status']),
      name: z.string(),
      damage: z.object({ raw: z.number(), display: z.number() }),
      hidden: z.boolean(),
    }),
  ),
  sharpness: z
    .object({
      red: z.number(),
      orange: z.number(),
      yellow: z.number(),
      green: z.number(),
      blue: z.number(),
      white: z.number(),
      purple: z.number(),
    })
    .nullable(),
  handicraft: z.array(z.number()).nullable(),
  slots: z.array(z.number()),
  skills: z.record(z.string(), z.number()),
  elderseal: z.string().nullable(),
  defenseBonus: z.number(),
  series: z.string().nullable(),
  kindSpecific: z.record(z.string(), z.unknown()),
})

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
  weaponSkills: z.array(z.string()).optional(),
  // Raw MHDB icon category keyed by clean skill/set/group name, e.g. {"Attack Boost": "offense"}.
  skillIcons: z.record(z.string(), z.string()).optional(),
  weapons: z.array(SeedWeaponSchema).optional(),
})

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface SkillInsert {
  name: string
  cleanName: string
  /** Ordinary skills only — Set/Group Bonuses are `BonusInsert` now (ADR-0011). */
  type: 'armor' | 'weapon'
  maxLevel: number
  /** Raw MHDB icon category, e.g. 'offense'. Undefined if MHDB omitted it. */
  icon?: string
}

/** A Set or Group Bonus catalog entity (ADR-0011). */
export interface BonusInsert {
  name: string
  cleanName: string
  kind: 'set' | 'group'
  icon?: string
}

/** One ordered activation threshold of a bonus. */
export interface BonusThresholdInsert {
  bonusName: string
  piecesRequired: number
  effectName: string
  level: number
}

/** Membership of an armor piece in a Set/Group bonus. */
export interface ArmorBonusInsert {
  armorName: string
  bonusName: string
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
}

/** One skill grant of a decoration (decorations are multi-grant). */
export interface DecorationSkillInsert {
  decorationName: string
  skillName: string
  level: number
}

/** A weapon catalog item (ADR-0013). Identity is `weaponKey` = kind + gameId. */
export interface WeaponInsert {
  /** The game's internal weapon id; stable, unique per kind. */
  gameId: number
  /** Display name; not identity (colliding upstream names get a suffix). */
  name: string
  kind: string
  rarity: number
  raw: number
  display: number
  affinity: number
  specials: SeedWeaponSpecial[]
  sharpness: SeedWeaponSharpness | null
  handicraft: number[] | null
  slots: number[]
  elderseal: string | null
  defenseBonus: number
  series: string | null
  kindSpecific: Record<string, unknown>
}

/** One skill grant of a weapon, keyed by the weapon's `weaponKey`. */
export interface WeaponSkillInsert {
  weaponKey: string
  skillName: string
  level: number
}

/** Stable weapon identity (ADR-0007/0013): the kind + upstream gameId pair; never a mutable stat. */
export const weaponKey = (w: { kind: string; gameId: number }): string => `${w.kind}:${w.gameId}`

const nameKey = (w: { kind: string; name: string }): string => `${w.kind}:${w.name}`

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n))

/**
 * Upstream reuses a (kind, name) for several distinct weapons (the three Artian
 * base templates, differing only in raw/affinity). Identity is (kind, gameId), so
 * this is display-only: colliding names get a deterministic affinity suffix, e.g.
 * "Calamitous Angel (-10% affinity)"; a residual tie gets a " #n" counter.
 */
export const disambiguateWeaponNames = <T extends { kind: string; name: string; affinity: number }>(weapons: T[]): T[] => {
  const groups = new Map<string, number>()
  for (const w of weapons) groups.set(nameKey(w), (groups.get(nameKey(w)) ?? 0) + 1)

  const seen = new Set<string>()
  return weapons.map((w) => {
    if ((groups.get(nameKey(w)) ?? 0) < 2) {
      seen.add(nameKey(w))
      return w
    }
    const base = `${w.name} (${signed(w.affinity)}% affinity)`
    let name = base
    for (let n = 2; seen.has(nameKey({ kind: w.kind, name })); n++) name = `${base} #${n}`
    seen.add(nameKey({ kind: w.kind, name }))
    return { ...w, name }
  })
}

function toCleanName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

export interface TransformResult {
  skills: SkillInsert[]
  bonuses: BonusInsert[]
  bonusThresholds: BonusThresholdInsert[]
  armor: ArmorInsert[]
  armorRegularSkills: ArmorRegularSkillInsert[]
  armorBonuses: ArmorBonusInsert[]
  decorations: DecorationInsert[]
  decorationSkills: DecorationSkillInsert[]
  weapons: WeaponInsert[]
  weaponSkills: WeaponSkillInsert[]
}

export function transformSeedData(data: SeedData): TransformResult {
  SeedDataSchema.parse(data)

  const skillIcons = data.skillIcons ?? {}
  const skills: SkillInsert[] = []
  const bonuses: BonusInsert[] = []
  const bonusThresholds: BonusThresholdInsert[] = []
  const armor: ArmorInsert[] = []
  const armorRegularSkills: ArmorRegularSkillInsert[] = []
  const armorBonuses: ArmorBonusInsert[] = []
  const decorations: DecorationInsert[] = []
  const decorationSkills: DecorationSkillInsert[] = []

  // --- Regular skills (armor + weapon; data.skills is the merged set) ---
  const weaponSkillNames = new Set(data.weaponSkills ?? [])
  for (const [name, maxLevel] of Object.entries(data.skills)) {
    skills.push({
      name,
      cleanName: toCleanName(name),
      type: weaponSkillNames.has(name) ? 'weapon' : 'armor',
      maxLevel,
      icon: skillIcons[name],
    })
  }

  // --- Set bonuses: one bonus + one threshold per source rank (ADR-0011). ---
  // Compact shape: [baseEffectName, piecesRequired0, thresholds[]], where
  // `thresholds` is the piece-count for each successive rank. We restore the
  // full ordered threshold list the previous pipeline collapsed to one row.
  for (const [setName, [effectName, , thresholds]] of Object.entries(data.setSkills)) {
    bonuses.push({ name: setName, cleanName: toCleanName(setName), kind: 'set', icon: skillIcons[setName] })
    const seenPieces = new Set<number>()
    thresholds.forEach((piecesRequired, i) => {
      if (seenPieces.has(piecesRequired)) return // PK is (bonus, piecesRequired)
      seenPieces.add(piecesRequired)
      bonusThresholds.push({ bonusName: setName, piecesRequired, effectName, level: i + 1 })
    })
  }

  // --- Group bonuses: single 3-piece threshold. ---
  for (const [groupName, [effectName, levelGranted, piecesRequired]] of Object.entries(data.groupSkills)) {
    bonuses.push({ name: groupName, cleanName: toCleanName(groupName), kind: 'group', icon: skillIcons[groupName] })
    bonusThresholds.push({ bonusName: groupName, piecesRequired, effectName, level: levelGranted })
  }

  // --- Armor pieces ---
  const armorTypes = ['head', 'chest', 'arms', 'waist', 'legs'] as const
  for (const armorType of armorTypes) {
    const pieces = data.armor[armorType]
    for (const [name, piece] of Object.entries(pieces)) {
      const [, pieceSkills, groupSkillsList, slots, defense, resists, rank, setSkillNames, rarity] = piece

      armor.push({
        name,
        type: armorType,
        rank: rank.toUpperCase(),
        rarity: rarity ?? 0,
        defense,
        fireRes: resists[0],
        waterRes: resists[1],
        thunderRes: resists[2],
        iceRes: resists[3],
        dragonRes: resists[4],
        slots: slots ?? [],
      })

      for (const [skillName, level] of Object.entries(pieceSkills)) {
        armorRegularSkills.push({ armorName: name, skillName, level })
      }
      for (const bonusName of [...(setSkillNames ?? []), ...(groupSkillsList ?? [])]) {
        armorBonuses.push({ armorName: name, bonusName })
      }
    }
  }

  // --- Talismans ---
  for (const [name, [, talisSkills]] of Object.entries(data.talisman)) {
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
    })
    for (const [skillName, level] of Object.entries(talisSkills)) {
      armorRegularSkills.push({ armorName: name, skillName, level })
    }
  }

  // --- Decorations (multi-grant: keep every skill, not just the first) ---
  for (const [name, [type, decoSkills, slotSize]] of Object.entries(data.decoration)) {
    decorations.push({ name, type, slotSize })
    for (const [skillName, level] of Object.entries(decoSkills)) {
      decorationSkills.push({ decorationName: name, skillName, level })
    }
  }

  // --- Weapons (ADR-0013) ---
  const weapons: WeaponInsert[] = []
  const weaponSkills: WeaponSkillInsert[] = []
  const missingWeaponSkills = new Set<string>()
  for (const w of disambiguateWeaponNames(data.weapons ?? [])) {
    weapons.push({
      gameId: w.gameId,
      name: w.name,
      kind: w.kind,
      rarity: w.rarity,
      raw: w.damage.raw,
      display: w.damage.display,
      affinity: w.affinity,
      specials: w.specials,
      sharpness: w.sharpness,
      handicraft: w.handicraft,
      slots: w.slots,
      elderseal: w.elderseal,
      defenseBonus: w.defenseBonus,
      series: w.series,
      kindSpecific: w.kindSpecific,
    })
    for (const [skillName, level] of Object.entries(w.skills)) {
      if (!(skillName in data.skills)) missingWeaponSkills.add(skillName)
      weaponSkills.push({ weaponKey: weaponKey(w), skillName, level })
    }
  }
  if (missingWeaponSkills.size > 0) {
    throw new Error(`Weapons reference unknown skill(s): ${[...missingWeaponSkills].join(', ')}`)
  }

  return {
    skills,
    bonuses,
    bonusThresholds,
    armor,
    armorRegularSkills,
    armorBonuses,
    decorations,
    decorationSkills,
    weapons,
    weaponSkills,
  }
}
