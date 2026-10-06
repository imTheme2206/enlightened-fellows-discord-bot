import type {
  ArmorBonusInsert,
  ArmorInsert,
  ArmorRegularSkillInsert,
  BonusInsert,
  BonusThresholdInsert,
  DecorationInsert,
  DecorationSkillInsert,
  SkillInsert,
  TransformResult,
  WeaponInsert,
  WeaponSkillInsert,
} from './transform'
import { weaponKey } from './transform'

/**
 * Snapshot of the current catalog, keyed by the stable canonical identity
 * (name) of each entity, loaded from the DB before a scrape reconciles against
 * it. Child rows carry their parent's name so the reconciler never depends on
 * DB UUIDs — those are assigned only to genuinely new identities.
 */
export interface ExistingSkill {
  name: string
  cleanName: string
  type: string
  maxLevel: number
  icon: string | null
}
export interface ExistingBonus {
  name: string
  cleanName: string
  kind: string
  icon: string | null
}
export interface ExistingBonusThreshold {
  bonusName: string
  piecesRequired: number
  effectName: string
  level: number
}
export interface ExistingArmor {
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
export interface ExistingArmorSkill {
  armorName: string
  skillName: string
  level: number
}
export interface ExistingArmorBonus {
  armorName: string
  bonusName: string
}
export interface ExistingDecoration {
  name: string
  type: string
  slotSize: number
}
export interface ExistingDecorationSkill {
  decorationName: string
  skillName: string
  level: number
}

export type ExistingWeapon = WeaponInsert
export interface ExistingWeaponSkill {
  weaponKey: string
  skillName: string
  level: number
}

export interface ExistingCatalog {
  skills: ExistingSkill[]
  bonuses: ExistingBonus[]
  bonusThresholds: ExistingBonusThreshold[]
  armor: ExistingArmor[]
  armorSkills: ExistingArmorSkill[]
  armorBonuses: ExistingArmorBonus[]
  decorations: ExistingDecoration[]
  decorationSkills: ExistingDecorationSkill[]
  weapons: ExistingWeapon[]
  weaponSkills: ExistingWeaponSkill[]
}

/** A scraped value that differs from an existing identity's stored value. */
export interface Conflict {
  entity: 'skill' | 'bonus' | 'armor' | 'decoration' | 'weapon'
  name: string
  reason: string
}

/**
 * The insert-only plan: only genuinely new identities (and the children of those
 * new identities) appear here. Existing identities are either unchanged (absent)
 * or a `conflict`. If `conflicts` is non-empty the caller MUST insert nothing.
 */
export interface ReconcilePlan {
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
  conflicts: Conflict[]
  /** Identities that already existed with identical values (for logging). */
  unchanged: { skills: number; bonuses: number; armor: number; decorations: number; weapons: number }
}

// ---------------------------------------------------------------------------
// Comparison helpers
// ---------------------------------------------------------------------------

const nn = (v: string | null | undefined): string | null => v ?? null

function slotsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function levelMapEqual(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false
  for (const [k, v] of a) if (b.get(k) !== v) return false
  return true
}

function setEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const k of a) if (!b.has(k)) return false
  return true
}

function thresholdsEqual(
  a: { piecesRequired: number; effectName: string; level: number }[],
  b: { piecesRequired: number; effectName: string; level: number }[]
): boolean {
  if (a.length !== b.length) return false
  const key = (t: { piecesRequired: number; effectName: string; level: number }) => `${t.piecesRequired}|${t.effectName}|${t.level}`
  const setA = new Set(a.map(key))
  return b.every((t) => setA.has(key(t)))
}

/** Key-order-independent JSON, since Postgres jsonb does not preserve key order. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v ?? null)
}

function weaponScalarsEqual(a: WeaponInsert, b: WeaponInsert): boolean {
  return (
    a.name === b.name &&
    a.rarity === b.rarity &&
    a.raw === b.raw &&
    a.display === b.display &&
    a.affinity === b.affinity &&
    a.defenseBonus === b.defenseBonus &&
    nn(a.elderseal) === nn(b.elderseal) &&
    nn(a.series) === nn(b.series) &&
    canonical(a.specials) === canonical(b.specials) &&
    canonical(a.sharpness) === canonical(b.sharpness) &&
    canonical(a.handicraft) === canonical(b.handicraft) &&
    canonical(a.slots) === canonical(b.slots) &&
    canonical(a.kindSpecific) === canonical(b.kindSpecific)
  )
}

function groupLevels<T extends { skillName: string; level: number }>(rows: T[], nameOf: (r: T) => string, target: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) if (nameOf(r) === target) m.set(r.skillName, r.level)
  return m
}

// ---------------------------------------------------------------------------
// Reconcile
// ---------------------------------------------------------------------------

/**
 * Diffs a freshly transformed scrape against the existing catalog by stable
 * identity. Returns the new-identity inserts plus any conflicts on existing
 * identities. Pure — no DB, no UUIDs. Missing identities (present in the DB but
 * absent from the scrape) are silently retained.
 */
export function reconcileCatalog(existing: ExistingCatalog, next: TransformResult): ReconcilePlan {
  const conflicts: Conflict[] = []
  const unchanged = { skills: 0, bonuses: 0, armor: 0, decorations: 0, weapons: 0 }

  // --- skills ---
  const existingSkill = new Map(existing.skills.map((s) => [s.name, s]))
  const newSkills: SkillInsert[] = []
  for (const s of next.skills) {
    const ex = existingSkill.get(s.name)
    if (!ex) {
      newSkills.push(s)
      continue
    }
    if (ex.cleanName !== s.cleanName || ex.type !== s.type || ex.maxLevel !== s.maxLevel || nn(ex.icon) !== nn(s.icon)) {
      conflicts.push({ entity: 'skill', name: s.name, reason: 'skill definition changed' })
    } else {
      unchanged.skills++
    }
  }

  // --- bonuses (+ thresholds) ---
  const existingBonus = new Map(existing.bonuses.map((b) => [b.name, b]))
  const existingThr = new Map<string, ExistingBonusThreshold[]>()
  for (const t of existing.bonusThresholds) {
    const list = existingThr.get(t.bonusName) ?? []
    list.push(t)
    existingThr.set(t.bonusName, list)
  }
  const nextThr = new Map<string, BonusThresholdInsert[]>()
  for (const t of next.bonusThresholds) {
    const list = nextThr.get(t.bonusName) ?? []
    list.push(t)
    nextThr.set(t.bonusName, list)
  }
  const newBonuses: BonusInsert[] = []
  const newThresholds: BonusThresholdInsert[] = []
  for (const b of next.bonuses) {
    const thr = nextThr.get(b.name) ?? []
    const ex = existingBonus.get(b.name)
    if (!ex) {
      newBonuses.push(b)
      newThresholds.push(...thr)
      continue
    }
    if (ex.cleanName !== b.cleanName || ex.kind !== b.kind || nn(ex.icon) !== nn(b.icon)) {
      conflicts.push({ entity: 'bonus', name: b.name, reason: 'bonus definition changed' })
    } else if (!thresholdsEqual(existingThr.get(b.name) ?? [], thr)) {
      conflicts.push({ entity: 'bonus', name: b.name, reason: 'activation thresholds changed' })
    } else {
      unchanged.bonuses++
    }
  }

  // --- armor (+ skills + bonus memberships) ---
  const existingArmor = new Map(existing.armor.map((a) => [a.name, a]))
  const existingArmorBonusSet = new Map<string, Set<string>>()
  for (const ab of existing.armorBonuses) {
    const set = existingArmorBonusSet.get(ab.armorName) ?? new Set<string>()
    set.add(ab.bonusName)
    existingArmorBonusSet.set(ab.armorName, set)
  }
  const nextArmorBonusSet = new Map<string, Set<string>>()
  for (const ab of next.armorBonuses) {
    const set = nextArmorBonusSet.get(ab.armorName) ?? new Set<string>()
    set.add(ab.bonusName)
    nextArmorBonusSet.set(ab.armorName, set)
  }
  const newArmor: ArmorInsert[] = []
  const newArmorSkills: ArmorRegularSkillInsert[] = []
  const newArmorBonuses: ArmorBonusInsert[] = []
  for (const a of next.armor) {
    const ex = existingArmor.get(a.name)
    if (!ex) {
      newArmor.push(a)
      newArmorSkills.push(...next.armorRegularSkills.filter((r) => r.armorName === a.name))
      for (const bonusName of nextArmorBonusSet.get(a.name) ?? new Set<string>()) {
        newArmorBonuses.push({ armorName: a.name, bonusName })
      }
      continue
    }
    const scalarSame =
      ex.type === a.type &&
      ex.rank === a.rank &&
      ex.rarity === a.rarity &&
      ex.defense === a.defense &&
      ex.fireRes === a.fireRes &&
      ex.waterRes === a.waterRes &&
      ex.thunderRes === a.thunderRes &&
      ex.iceRes === a.iceRes &&
      ex.dragonRes === a.dragonRes &&
      slotsEqual(ex.slots, a.slots)
    if (!scalarSame) {
      conflicts.push({ entity: 'armor', name: a.name, reason: 'armor stats changed' })
    } else if (
      !levelMapEqual(
        groupLevels(existing.armorSkills, (r) => r.armorName, a.name),
        groupLevels(next.armorRegularSkills, (r) => r.armorName, a.name)
      )
    ) {
      conflicts.push({ entity: 'armor', name: a.name, reason: 'armor skills changed' })
    } else if (!setEqual(existingArmorBonusSet.get(a.name) ?? new Set(), nextArmorBonusSet.get(a.name) ?? new Set())) {
      conflicts.push({ entity: 'armor', name: a.name, reason: 'armor bonus membership changed' })
    } else {
      unchanged.armor++
    }
  }

  // --- decorations (+ skills) ---
  const existingDeco = new Map(existing.decorations.map((d) => [d.name, d]))
  const newDecorations: DecorationInsert[] = []
  const newDecorationSkills: DecorationSkillInsert[] = []
  for (const d of next.decorations) {
    const ex = existingDeco.get(d.name)
    if (!ex) {
      newDecorations.push(d)
      newDecorationSkills.push(...next.decorationSkills.filter((r) => r.decorationName === d.name))
      continue
    }
    const nextDecoSkills = new Map<string, number>()
    for (const r of next.decorationSkills) if (r.decorationName === d.name) nextDecoSkills.set(r.skillName, r.level)
    const exDecoSkills = new Map<string, number>()
    for (const r of existing.decorationSkills) if (r.decorationName === d.name) exDecoSkills.set(r.skillName, r.level)
    if (ex.type !== d.type || ex.slotSize !== d.slotSize) {
      conflicts.push({ entity: 'decoration', name: d.name, reason: 'decoration definition changed' })
    } else if (!levelMapEqual(exDecoSkills, nextDecoSkills)) {
      conflicts.push({ entity: 'decoration', name: d.name, reason: 'decoration skills changed' })
    } else {
      unchanged.decorations++
    }
  }

  // --- weapons (+ skills), identity = kind + name (ADR-0013) ---
  const existingWeapon = new Map(existing.weapons.map((w) => [weaponKey(w), w]))
  const levelsFor = (rows: { weaponKey: string; skillName: string; level: number }[], key: string) => {
    const m = new Map<string, number>()
    for (const r of rows) if (r.weaponKey === key) m.set(r.skillName, r.level)
    return m
  }
  const newWeapons: WeaponInsert[] = []
  const newWeaponSkills: WeaponSkillInsert[] = []
  for (const w of next.weapons) {
    const key = weaponKey(w)
    const ex = existingWeapon.get(key)
    if (!ex) {
      newWeapons.push(w)
      newWeaponSkills.push(...next.weaponSkills.filter((r) => r.weaponKey === key))
      continue
    }
    if (!weaponScalarsEqual(ex, w)) {
      conflicts.push({ entity: 'weapon', name: key, reason: 'weapon stats changed' })
    } else if (!levelMapEqual(levelsFor(existing.weaponSkills, key), levelsFor(next.weaponSkills, key))) {
      conflicts.push({ entity: 'weapon', name: key, reason: 'weapon skills changed' })
    } else {
      unchanged.weapons++
    }
  }

  return {
    skills: newSkills,
    bonuses: newBonuses,
    bonusThresholds: newThresholds,
    armor: newArmor,
    armorRegularSkills: newArmorSkills,
    armorBonuses: newArmorBonuses,
    decorations: newDecorations,
    decorationSkills: newDecorationSkills,
    weapons: newWeapons,
    weaponSkills: newWeaponSkills,
    conflicts,
    unchanged,
  }
}
