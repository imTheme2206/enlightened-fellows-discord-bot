import {
  ARTIAN_ELEMENTS,
  ARTIAN_REINFORCEMENT_LEVELS,
  ARTIAN_REINFORCEMENT_TYPES,
  ARTIAN_RULES,
  ARTIAN_STATUS_ELEMENTS,
  GOGMA_FOCUSES,
  type ArtianReinforcementLevel,
  type ArtianReinforcementType,
  type ArtianRules,
} from './artian-rules'
import type { ArtianCustomization, ArtianCustomizationRequest, WeaponArtian, WeaponCatalogItem } from './schema'

/**
 * Pure Artian / Gogma Artian logic (ADR-0014): classify a catalog row, validate a
 * hunter's configuration against the rules table, and derive the weapon's
 * effective stats from the two. No I/O; every number comes from `ArtianRules`, so
 * the frontend (which receives the same table over the API) can mirror it.
 */

type WeaponLike = Pick<WeaponCatalogItem, 'kind' | 'name' | 'rarity' | 'series' | 'damage' | 'affinity'>

/** Display-only affinity suffix the ingestion adds to colliding names ("Foo (-10% affinity)"). */
const AFFINITY_SUFFIX = / \([-+]?\d+% affinity\)(?: #\d+)?$/

export const stripAffinitySuffix = (name: string): string => name.replace(AFFINITY_SUFFIX, '')

/**
 * Recognises Artian bases by their documented names and Gogma Artian rows by
 * name plus the exact raw/affinity a focus produces on the rarity-8 Artian base.
 * A row that matches a name but not a focus (an upstream rebalance) is treated
 * as an ordinary weapon rather than guessed at.
 */
export const classifyArtianWeapon = (weapon: WeaponLike, rules: ArtianRules = ARTIAN_RULES): WeaponArtian | null => {
  if (weapon.series !== null) return null
  const kind = rules.kinds[weapon.kind]

  for (const tier of [6, 7, 8] as const) {
    if (weapon.rarity === tier && weapon.name === kind.artianNames[`${tier}`]) {
      return { family: 'artian', tier, focus: null }
    }
  }

  if (weapon.rarity === 8 && stripAffinitySuffix(weapon.name) === kind.gogmaName) {
    for (const focus of GOGMA_FOCUSES) {
      const delta = rules.gogmaFocus[focus]
      if (
        weapon.damage.raw === rules.baseStats.raw['8'] + delta.raw &&
        weapon.affinity === rules.baseStats.affinity + delta.affinity
      ) {
        return { family: 'gogma', tier: 8, focus }
      }
    }
  }
  return null
}

// ── Validation ──────────────────────────────────────────────────────────────

export type ArtianConfigIssue = {
  reason:
    | 'unknown_value'
    | 'element_not_available'
    | 'infusion_requires_element'
    | 'production_parts_exceeded'
    | 'too_many_reinforcements'
    | 'reinforcement_not_available'
    | 'reinforcement_level_not_available'
    | 'too_many_ex_of_type'
    | 'too_many_of_type'
  details?: Record<string, unknown>
}

const isOneOf = <T extends string>(values: readonly T[], value: string): value is T => (values as readonly string[]).includes(value)

/**
 * Narrows a request's loosely-typed configuration to the strict one, or names the
 * first value that is not a known element / reinforcement type / level, or a
 * production part count outside 0..3.
 */
export const parseArtianCustomization = (
  input: ArtianCustomizationRequest,
  rules: ArtianRules = ARTIAN_RULES,
): { config: ArtianCustomization } | { issue: ArtianConfigIssue } => {
  const unknown = (field: string, value: unknown) => ({ issue: { reason: 'unknown_value' as const, details: { field, value } } })

  if (input.element !== null && !isOneOf(ARTIAN_ELEMENTS, input.element)) return unknown('element', input.element)
  for (const field of ['attackParts', 'affinityParts'] as const) {
    if (input[field] < 0 || input[field] > rules.production.parts) return unknown(field, input[field])
  }
  const reinforcements: ArtianCustomization['reinforcements'] = []
  for (const r of input.reinforcements) {
    if (!isOneOf(ARTIAN_REINFORCEMENT_TYPES, r.type)) return unknown('reinforcement.type', r.type)
    if (!isOneOf(ARTIAN_REINFORCEMENT_LEVELS, r.level)) return unknown('reinforcement.level', r.level)
    reinforcements.push({ type: r.type, level: r.level })
  }
  return {
    config: {
      element: input.element,
      attackParts: input.attackParts,
      affinityParts: input.affinityParts,
      elementInfusion: input.elementInfusion,
      reinforcements,
    },
  }
}

/** Levels each reinforcement type can roll. Plain Artian weapons only ever hold level I. */
const gogmaLevels = (type: ArtianReinforcementType, kind: WeaponLike['kind'], rules: ArtianRules): ArtianReinforcementLevel[] => {
  switch (type) {
    case 'attack':
    case 'affinity':
      return ['I', 'II', 'III', 'EX']
    case 'element':
      return rules.kinds[kind].elementBoost ? ['I', 'II', 'EX'] : []
    case 'sharpness':
    case 'ammo':
      return ['I', 'EX']
  }
}

/** First rule the configuration breaks, or `null` when it is valid for this weapon. */
export const findArtianConfigIssue = (
  weapon: Pick<WeaponCatalogItem, 'kind' | 'sharpness'>,
  artian: WeaponArtian,
  config: ArtianCustomization,
  rules: ArtianRules = ARTIAN_RULES,
): ArtianConfigIssue | null => {
  const kind = rules.kinds[weapon.kind]

  if (config.element !== null && !kind.elements[config.element]) {
    return { reason: 'element_not_available', details: { element: config.element } }
  }
  if (config.elementInfusion && (config.element === null || kind.elementInfusion === null)) {
    return { reason: 'infusion_requires_element' }
  }
  if (config.attackParts + config.affinityParts > rules.production.parts) {
    return { reason: 'production_parts_exceeded', details: { max: rules.production.parts } }
  }
  if (config.reinforcements.length > rules.reinforcement.maxCount) {
    return { reason: 'too_many_reinforcements', details: { max: rules.reinforcement.maxCount } }
  }

  const counts = new Map<ArtianReinforcementType, number>()
  const exCounts = new Map<ArtianReinforcementType, number>()
  for (const { type, level } of config.reinforcements) {
    const isBowgun = weapon.kind === 'light-bowgun' || weapon.kind === 'heavy-bowgun'
    const unavailable =
      (type === 'element' && (config.element === null || !kind.elementBoost)) ||
      (type === 'sharpness' && weapon.sharpness === null) ||
      (type === 'ammo' && !isBowgun)
    if (unavailable) return { reason: 'reinforcement_not_available', details: { type } }

    const levels = artian.family === 'gogma' ? gogmaLevels(type, weapon.kind, rules) : (['I'] as ArtianReinforcementLevel[])
    if (!levels.includes(level)) return { reason: 'reinforcement_level_not_available', details: { type, level } }

    counts.set(type, (counts.get(type) ?? 0) + 1)
    if (level === 'EX') exCounts.set(type, (exCounts.get(type) ?? 0) + 1)
  }

  for (const [type, count] of exCounts) {
    if (count > rules.reinforcement.maxExPerType) {
      return { reason: 'too_many_ex_of_type', details: { type, max: rules.reinforcement.maxExPerType } }
    }
  }
  if (artian.family === 'artian') {
    for (const [type, count] of counts) {
      if (count > rules.reinforcement.artianMaxPerType[type]) {
        return { reason: 'too_many_of_type', details: { type, max: rules.reinforcement.artianMaxPerType[type] } }
      }
    }
  }
  return null
}

// ── Derivation ──────────────────────────────────────────────────────────────

export type DerivedArtianStats = {
  damage: { raw: number; display: number }
  affinity: number
  specials: { kind: 'element' | 'status'; name: string; damage: { raw: number; display: number }; hidden: boolean }[]
  /** Extra sharpness points from reinforcements; the colour bar itself is left as the catalog row has it. */
  sharpnessBonus: number
  /** Extra ammo capacity from reinforcements (bowguns). */
  ammoBonus: number
}

type DeriveInput = Pick<WeaponCatalogItem, 'kind' | 'rarity' | 'damage' | 'affinity'>

/**
 * Effective stats of a configured Artian / Gogma Artian weapon. The catalog row
 * is the base: for a Gogma row it already includes the focus's raw/affinity
 * change, and the focus's element change is added here when an element is set.
 * Assumes the config passed `findArtianConfigIssue`.
 */
export const deriveArtianStats = (
  weapon: DeriveInput,
  artian: WeaponArtian,
  config: ArtianCustomization,
  rules: ArtianRules = ARTIAN_RULES,
): DerivedArtianStats => {
  const kind = rules.kinds[weapon.kind]
  const rf = rules.reinforcement

  let raw = weapon.damage.raw + config.attackParts * rules.production.attackPerPart
  let affinity = weapon.affinity + config.affinityParts * rules.production.affinityPerPart
  let elementBoost = 0
  let sharpnessBonus = 0
  let ammoBonus = 0

  for (const { type, level } of config.reinforcements) {
    switch (type) {
      case 'attack':
        raw += rf.attack[level]
        break
      case 'affinity':
        affinity += rf.affinity[level]
        break
      case 'element':
        if (kind.elementBoost && level !== 'III') elementBoost += kind.elementBoost[level]
        break
      case 'sharpness':
        if (level === 'I' || level === 'EX') {
          sharpnessBonus += weapon.kind === 'insect-glaive' && level === 'I' ? rf.sharpnessInsectGlaiveI : rf.sharpness[level]
        }
        break
      case 'ammo':
        if (level === 'I' || level === 'EX') ammoBonus += rf.ammo[level]
        break
    }
  }

  const specials: DerivedArtianStats['specials'] = []
  const base = config.element ? kind.elements[config.element] : undefined
  if (config.element && base) {
    let value = weapon.rarity === 8 ? base.r8 : base.r67
    if (config.elementInfusion && kind.elementInfusion !== null) value += kind.elementInfusion
    if (artian.family === 'gogma' && artian.focus && artian.focus !== 'attack' && kind.gogmaFocusElementDelta) {
      value += kind.gogmaFocusElementDelta[artian.focus]
    }
    value += elementBoost
    specials.push({
      kind: ARTIAN_STATUS_ELEMENTS.includes(config.element) ? 'status' : 'element',
      name: config.element,
      damage: { raw: value / 10, display: value },
      hidden: false,
    })
  }

  // Display attack scales with the weapon's own multiplier (e.g. 4.8x Great Sword).
  const multiplier = weapon.damage.raw > 0 ? weapon.damage.display / weapon.damage.raw : 1
  return {
    damage: { raw, display: Math.round(raw * multiplier) },
    affinity,
    specials,
    sharpnessBonus,
    ammoBonus,
  }
}

/** The configuration a weapon holds when the hunter has set nothing yet. */
export const EMPTY_ARTIAN_CUSTOMIZATION: ArtianCustomization = {
  element: null,
  attackParts: 0,
  affinityParts: 0,
  elementInfusion: false,
  reinforcements: [],
}
