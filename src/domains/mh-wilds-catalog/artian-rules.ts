import type { WeaponKind } from './schema'

/**
 * Hand-maintained, version-tagged Artian / Gogma Artian rules table (ADR-0014).
 *
 * Upstream MHDB only publishes the Artian *bases* (rarity 6/7 "Artian X I/II",
 * rarity 8 per-kind template, and the three rarity-8 Gogma focus rows). Element
 * values, production bonuses, reinforcement values and Gogma focus deltas are
 * NOT in any scrapeable feed, so they live here — and every single number carries
 * the list of sources it was read from. NOTHING in this file is filled from memory:
 * a value that could not be confirmed on a fetched page is omitted and listed in
 * `ARTIAN_RULES_FOLLOW_UPS` instead.
 *
 * Units: element/status values are in the game's *display* units (what the weapon
 * screen shows, e.g. 450), which is `raw * 10` in MHDB's `{raw, display}` pairs.
 * Attack is always handled in MHDB *raw* (internal) units; the display value is
 * derived from each catalog row's own `display / raw` multiplier.
 *
 * Pages were fetched and read on 2026-10-06. Where two sources disagree the more
 * specific / more recent one is used and the disagreement is noted next to the
 * value (and in `ARTIAN_RULES_FOLLOW_UPS`).
 */

export const ARTIAN_RULES_GAME_VERSION = '1.041'
export const ARTIAN_RULES_RETRIEVED_AT = '2026-10-06'

export const ARTIAN_SOURCES = {
  game8Artian: {
    url: 'https://game8.co/games/Monster-Hunter-Wilds/archives/503103',
    title: 'Game8: Artian Weapons Guide (page updated 2025-12-17; site banner showed Ver 1.041)',
  },
  game8Gogma: {
    url: 'https://game8.co/games/Monster-Hunter-Wilds/archives/571311',
    title: 'Game8: Gogmazios Weapons Guide / Gogma Artian Weapons (page updated 2026-05-13)',
  },
  wikiArtian: {
    url: 'https://monsterhunterwiki.org/wiki/Artian_Weapons_(MHWilds)',
    title: 'Monster Hunter Wiki: Artian Weapons (MHWilds) (last edited 2026-09-29)',
  },
  wikiGogma: {
    url: 'https://monsterhunterwiki.org/wiki/Gogma_Artian_Weapons_(MHWilds)',
    title: 'Monster Hunter Wiki: Gogma Artian Weapons (MHWilds)',
  },
  fextraGogma: {
    url: 'https://monsterhunterwilds.wiki.fextralife.com/Gogma_Artian_Weapons',
    title: 'Fextralife: Gogma Artian Weapons (Title Update 4)',
  },
  mhdb: {
    url: 'https://wilds.mhdb.io/en/weapons',
    title: 'MHDB weapons feed (the catalog rows themselves; arithmetic cross-check only)',
  },
} as const

export type ArtianSourceKey = keyof typeof ARTIAN_SOURCES

export const ARTIAN_ELEMENTS = ['fire', 'water', 'thunder', 'ice', 'dragon', 'poison', 'paralysis', 'sleep', 'blast'] as const
export type ArtianElement = (typeof ARTIAN_ELEMENTS)[number]
/** Elements the game treats as status buildup rather than elemental damage. */
export const ARTIAN_STATUS_ELEMENTS: readonly ArtianElement[] = ['poison', 'paralysis', 'sleep', 'blast']

export const ARTIAN_REINFORCEMENT_TYPES = ['attack', 'affinity', 'element', 'sharpness', 'ammo'] as const
export type ArtianReinforcementType = (typeof ARTIAN_REINFORCEMENT_TYPES)[number]

export const ARTIAN_REINFORCEMENT_LEVELS = ['I', 'II', 'III', 'EX'] as const
export type ArtianReinforcementLevel = (typeof ARTIAN_REINFORCEMENT_LEVELS)[number]

export const GOGMA_FOCUSES = ['attack', 'affinity', 'element'] as const
export type GogmaFocus = (typeof GOGMA_FOCUSES)[number]

// ── Sourced table ───────────────────────────────────────────────────────────

type Sourced<T> = { value: T; sources: ArtianSourceKey[]; note?: string }
const sv = <T>(value: T, sources: ArtianSourceKey[], note?: string): Sourced<T> => ({ value, sources, ...(note ? { note } : {}) })

type ElementValues = { r67: Sourced<number>; r8: Sourced<number> }
type ElementTable = Partial<Record<ArtianElement, ElementValues>>

type KindRulesSourced = {
  /** Catalog names of the three Artian tiers (rarity 6 / 7 / 8). */
  artianNames: Record<6 | 7 | 8, Sourced<string>>
  /** Base name shared by the three rarity-8 Gogma focus rows. */
  gogmaName: Sourced<string>
  /** Element/status value of an Artian by chosen element. Absent element = cannot be chosen. */
  elements: ElementTable
  /** Extra element value for 3 matching parts ("Element Infusion"); null when the kind has no element. */
  elementInfusion: Sourced<number> | null
  /** Element value change a Gogma upgrade applies (only when the weapon has an element). Attack focus changes none. */
  gogmaFocusElementDelta: { affinity: Sourced<number>; element: Sourced<number> } | null
  /** Element reinforcement value by level; no level III exists. Null for kinds that cannot roll it. */
  elementBoost: { I: Sourced<number>; II: Sourced<number>; EX: Sourced<number> } | null
}

const A = ['game8Artian', 'wikiArtian'] as ArtianSourceKey[]
const ELEMENT_GROUPS = {
  elemental: ['fire', 'water', 'thunder', 'ice', 'dragon'],
  poisonBlast: ['poison', 'blast'],
  paralysisSleep: ['paralysis', 'sleep'],
} as const

/** Builds the element table from the three wiki rows (elemental / poison+blast / paralysis+sleep). */
const elements = (
  rows: { elemental: [number, number]; poisonBlast: [number, number]; paralysisSleep: [number, number] },
  statusSources: ArtianSourceKey[] = ['wikiArtian'],
): ElementTable => {
  const table: ElementTable = {}
  for (const e of ELEMENT_GROUPS.elemental) table[e] = { r67: sv(rows.elemental[0], ['wikiArtian']), r8: sv(rows.elemental[1], ['wikiArtian']) }
  for (const e of ELEMENT_GROUPS.poisonBlast) table[e] = { r67: sv(rows.poisonBlast[0], statusSources), r8: sv(rows.poisonBlast[1], statusSources) }
  for (const e of ELEMENT_GROUPS.paralysisSleep) table[e] = { r67: sv(rows.paralysisSleep[0], statusSources), r8: sv(rows.paralysisSleep[1], statusSources) }
  return table
}

const infusion = (value: number) => sv(value, ['wikiArtian', 'game8Artian'], 'Game8 only states "+20 or +30 depending on weapon type"; the per-kind split is from the MH Wiki table.')

const G = ['game8Gogma', 'wikiGogma'] as ArtianSourceKey[]
const focusDelta = (affinity: number, element: number) => ({
  affinity: sv(affinity, G, 'Element value change of the Affinity Focus upgrade (Game8 "Elemental Values Vary Based on Weapon Type"; MH Wiki focus table agrees).'),
  element: sv(element, G, 'Element value change of the Element Focus upgrade.'),
})

const boost = (i: number, ii: number, ex: number) => ({
  I: sv(i, ['game8Gogma', 'game8Artian', 'wikiArtian']),
  II: sv(ii, ['game8Gogma', 'wikiGogma']),
  EX: sv(ex, ['game8Gogma', 'wikiGogma']),
})

const artianNames = (r6: string, r7: string, r8: string): KindRulesSourced['artianNames'] => ({
  6: sv(r6, ['game8Artian', 'wikiArtian', 'mhdb']),
  7: sv(r7, ['game8Artian', 'wikiArtian', 'mhdb']),
  8: sv(r8, ['game8Artian', 'wikiArtian', 'mhdb']),
})
const gogmaName = (name: string) => sv(name, ['game8Gogma', 'wikiGogma', 'mhdb'])

const KINDS_SOURCED: Record<WeaponKind, KindRulesSourced> = {
  'great-sword': {
    artianNames: artianNames('Artian Blade I', 'Artian Blade II', 'Varianza'),
    gogmaName: gogmaName('Ostrak Oblivion'),
    elements: elements({ elemental: [300, 450], poisonBlast: [150, 300], paralysisSleep: [100, 250] }),
    elementInfusion: infusion(30),
    gogmaFocusElementDelta: focusDelta(-10, 50),
    elementBoost: boost(80, 90, 110),
  },
  'long-sword': {
    artianNames: artianNames('Artian Saber I', 'Artian Saber II', 'Dimensius'),
    gogmaName: gogmaName("Headsman's Hamus"),
    elements: elements({ elemental: [230, 270], poisonBlast: [80, 120], paralysisSleep: [30, 70] }),
    elementInfusion: infusion(30),
    gogmaFocusElementDelta: focusDelta(-20, 50),
    elementBoost: boost(50, 60, 90),
  },
  'sword-shield': {
    artianNames: artianNames('Artian Sword I', 'Artian Sword II', 'Verdoloto'),
    gogmaName: gogmaName('Kyrie Verd'),
    elements: elements({ elemental: [230, 260], poisonBlast: [80, 110], paralysisSleep: [30, 60] }),
    elementInfusion: infusion(20),
    gogmaFocusElementDelta: focusDelta(-20, 40),
    elementBoost: boost(30, 50, 80),
  },
  'dual-blades': {
    artianNames: artianNames('Artian Edges I', 'Artian Edges II', 'Tiltkreise'),
    gogmaName: gogmaName('Eternal Cusp'),
    elements: elements({ elemental: [220, 250], poisonBlast: [70, 100], paralysisSleep: [20, 50] }),
    elementInfusion: infusion(20),
    gogmaFocusElementDelta: focusDelta(-20, 30),
    elementBoost: boost(20, 30, 50),
  },
  hammer: {
    artianNames: artianNames('Artian Hammer I', 'Artian Hammer II', 'Moteurvankel'),
    gogmaName: gogmaName('Bound Admonition'),
    elements: elements({ elemental: [270, 320], poisonBlast: [120, 170], paralysisSleep: [70, 120] }),
    elementInfusion: infusion(30),
    gogmaFocusElementDelta: focusDelta(-10, 40),
    elementBoost: boost(50, 60, 90),
  },
  'hunting-horn': {
    artianNames: artianNames('Artian Sounder I', 'Artian Sounder II', 'Omiltika'),
    gogmaName: gogmaName('Onyx Choros'),
    elements: elements({ elemental: [270, 320], poisonBlast: [120, 170], paralysisSleep: [70, 120] }),
    elementInfusion: infusion(30),
    gogmaFocusElementDelta: focusDelta(20, 80),
    elementBoost: boost(50, 60, 90),
  },
  lance: {
    artianNames: artianNames('Artian Lance I', 'Artian Lance II', 'Skyscraper'),
    gogmaName: gogmaName('Aether Pike'),
    elements: elements({ elemental: [230, 270], poisonBlast: [80, 120], paralysisSleep: [30, 70] }),
    elementInfusion: infusion(30),
    gogmaFocusElementDelta: focusDelta(-20, 50),
    elementBoost: boost(50, 60, 90),
  },
  gunlance: {
    artianNames: artianNames('Artian Cannon I', 'Artian Cannon II', 'Argenesis'),
    gogmaName: gogmaName('Auguring Omen'),
    elements: elements({ elemental: [270, 320], poisonBlast: [120, 170], paralysisSleep: [70, 120] }),
    elementInfusion: infusion(30),
    gogmaFocusElementDelta: focusDelta(30, 80),
    elementBoost: boost(50, 60, 90),
  },
  'switch-axe': {
    artianNames: artianNames('Artian Saw I', 'Artian Saw II', 'Mundus Altus'),
    gogmaName: gogmaName('Wicked Regnum'),
    elements: elements({ elemental: [220, 260], poisonBlast: [70, 110], paralysisSleep: [20, 60] }),
    elementInfusion: infusion(20),
    gogmaFocusElementDelta: focusDelta(-20, 40),
    elementBoost: boost(30, 50, 80),
  },
  'charge-blade': {
    artianNames: artianNames('Artian Defender I', 'Artian Defender II', 'Chrono Gear'),
    gogmaName: gogmaName('Promised Abyss'),
    elements: elements({ elemental: [230, 270], poisonBlast: [80, 120], paralysisSleep: [30, 70] }),
    elementInfusion: infusion(30),
    gogmaFocusElementDelta: focusDelta(-20, 50),
    elementBoost: boost(50, 60, 80),
  },
  'insect-glaive': {
    artianNames: artianNames('Artian Glaive I', 'Artian Glaive II', 'Diprielcha'),
    gogmaName: gogmaName('Limbo Llor'),
    elements: elements({ elemental: [220, 260], poisonBlast: [70, 110], paralysisSleep: [20, 60] }),
    elementInfusion: infusion(20),
    gogmaFocusElementDelta: focusDelta(-20, 40),
    elementBoost: boost(30, 50, 80),
  },
  bow: {
    artianNames: artianNames('Artian Sight I', 'Artian Sight II', 'Angelbein'),
    gogmaName: gogmaName('Calamitous Angel'),
    // Poison / paralysis / sleep bows only change the coating (the wiki lists "-" for their element value), so they are not choosable.
    elements: {
      fire: { r67: sv(180, ['wikiArtian']), r8: sv(210, ['wikiArtian']) },
      water: { r67: sv(180, ['wikiArtian']), r8: sv(210, ['wikiArtian']) },
      thunder: { r67: sv(180, ['wikiArtian']), r8: sv(210, ['wikiArtian']) },
      ice: { r67: sv(180, ['wikiArtian']), r8: sv(210, ['wikiArtian']) },
      dragon: { r67: sv(180, ['wikiArtian']), r8: sv(210, ['wikiArtian']) },
      blast: { r67: sv(30, ['wikiArtian']), r8: sv(60, ['wikiArtian']) },
    },
    elementInfusion: infusion(20),
    gogmaFocusElementDelta: focusDelta(-20, 30),
    elementBoost: boost(30, 40, 60),
  },
  // Bowguns deal no element damage: an Artian bowgun's element only changes its ammo, which this model does not track.
  'light-bowgun': {
    artianNames: artianNames('Artian Blaster I', 'Artian Blaster II', 'Animilater'),
    gogmaName: gogmaName('Bethorned Agony'),
    elements: {},
    elementInfusion: null,
    gogmaFocusElementDelta: null,
    elementBoost: null,
  },
  'heavy-bowgun': {
    artianNames: artianNames('Artian Sheller I', 'Artian Sheller II', 'Greifen'),
    gogmaName: gogmaName('Trembling Hels'),
    elements: {},
    elementInfusion: null,
    gogmaFocusElementDelta: null,
    elementBoost: null,
  },
}

export const ARTIAN_RULES_SOURCED = {
  gameVersion: ARTIAN_RULES_GAME_VERSION,
  retrievedAt: ARTIAN_RULES_RETRIEVED_AT,
  /** Forging combines exactly three Artian parts; each carries one Artian bonus. */
  production: {
    parts: sv(3, ['wikiArtian', 'game8Artian']),
    attackPerPart: sv(5, ['wikiArtian', 'game8Artian'], 'Raw (internal) attack; the wiki shows 24 display for a 4.8x Great Sword.'),
    affinityPerPart: sv(5, ['wikiArtian', 'game8Artian']),
  },
  /** Template stats of the three Artian tiers before any production bonus ("starting values" on the MH Wiki). */
  baseStats: {
    raw: { 6: sv(170, ['wikiArtian', 'mhdb']), 7: sv(180, ['wikiArtian', 'mhdb']), 8: sv(190, ['wikiArtian', 'mhdb']) },
    affinity: sv(5, ['wikiArtian', 'mhdb']),
  },
  /** Gogma upgrade of a rarity-8 Artian by focus. Raw in MHDB units; verified against the three MHDB rows per kind. */
  gogmaFocus: {
    attack: { raw: sv(10, ['game8Gogma', 'fextraGogma', 'wikiGogma']), affinity: sv(-15, ['game8Gogma', 'fextraGogma', 'wikiGogma']) },
    affinity: { raw: sv(-10, ['game8Gogma', 'fextraGogma', 'mhdb']), affinity: sv(10, ['game8Gogma', 'fextraGogma', 'mhdb']) },
    element: { raw: sv(0, ['game8Gogma', 'fextraGogma', 'mhdb'], 'No attack change is listed for Element Focus; the MHDB Element Focus rows keep the 190 raw of the Artian base.'), affinity: sv(-5, ['game8Gogma', 'fextraGogma', 'wikiGogma']) },
  },
  reinforcement: {
    maxCount: sv(5, ['wikiArtian', 'game8Artian', 'wikiGogma']),
    /** Per-level values. Artian weapons only ever hold level I; Gogma Artian can roll the others. */
    attack: {
      I: sv(5, ['game8Gogma', 'game8Artian', 'wikiArtian']),
      II: sv(6, ['game8Gogma', 'fextraGogma', 'wikiGogma']),
      III: sv(9, ['game8Gogma', 'fextraGogma', 'wikiGogma']),
      EX: sv(12, ['game8Gogma', 'fextraGogma', 'wikiGogma']),
    },
    affinity: {
      I: sv(5, ['game8Gogma', 'game8Artian', 'wikiArtian']),
      II: sv(6, ['game8Gogma', 'fextraGogma', 'wikiGogma']),
      III: sv(8, ['game8Gogma', 'fextraGogma', 'wikiGogma']),
      EX: sv(10, ['game8Gogma', 'fextraGogma', 'wikiGogma']),
    },
    /** Extra sharpness points (the bar is not recoloured: how the points distribute is unconfirmed). */
    sharpness: {
      I: sv(30, ['game8Gogma', 'game8Artian', 'wikiArtian']),
      EX: sv(50, ['game8Gogma', 'fextraGogma', 'wikiGogma']),
    },
    sharpnessInsectGlaiveI: sv(20, ['game8Artian', 'wikiArtian'], 'Both Artian pages give Insect Glaive +20 at level I; the Game8 Gogma table lists a flat +30 without an Insect Glaive exception. The kind-specific value is used.'),
    /** Ammo capacity; bowguns only. */
    ammo: {
      I: sv(1, ['game8Gogma', 'game8Artian', 'wikiArtian']),
      EX: sv(2, ['game8Gogma', 'fextraGogma', 'wikiGogma']),
    },
    /** Gogma: no more than 2 EX reinforcements of the same type. */
    maxExPerType: sv(2, ['wikiGogma']),
    /** Artian (non-Gogma) per-type caps, from Game8's reinforcement list. */
    artianMaxPerType: {
      attack: sv(5, ['game8Artian']),
      affinity: sv(3, ['game8Artian']),
      element: sv(4, ['game8Artian']),
      sharpness: sv(2, ['game8Artian'], 'The MH Wiki footnote agrees that no Artian has more than 2 sharpness boosts.'),
      ammo: sv(2, ['game8Artian']),
    },
  },
  kinds: KINDS_SOURCED,
} as const

/**
 * Values that could not be confirmed on a fetched page. They are deliberately
 * absent from the table above; the same list is appended to the issue file.
 */
export const ARTIAN_RULES_FOLLOW_UPS: readonly string[] = [
  'Element reinforcement level III: neither Game8 nor the MH Wiki lists a level III value (only I / II / EX), so level III element boosts are not modelled.',
  'Sharpness reinforcement: how the +30 / +50 points distribute across the coloured bar is not documented, so the rules expose a point total (sharpnessBonus) and leave the bar colours as the catalog row has them. Level II / III sharpness do not exist in the sources.',
  'Insect Glaive sharpness at Gogma EX: only the generic +50 is documented; the Insect Glaive level I value of +20 comes from the Artian pages and conflicts with the flat +30 in the Game8 Gogma table.',
  'Gogma per-type reinforcement caps: only "no more than 2 EX of the same type" is documented for Gogma; Game8\'s Artian per-type caps (attack 5, affinity 3, element 4, sharpness 2, ammo 2) are applied to plain Artian only.',
  'Ammo capacity reinforcement: Game8 says Light AND Heavy Bowgun can roll it, the MH Wiki says Light Bowgun only. Both are accepted; it does not change any derived damage stat.',
  'Whether a Gogma upgrade keeps the Artian production bonuses (attack/affinity parts) and the Element Infusion is not stated explicitly (Game8 only says reinforcement bonuses are retained and the element is kept), so the config lets the hunter set them on Gogma weapons rather than assuming a value.',
  'Poison / Paralysis / Sleep Artian Bows have no element value in the MH Wiki table (coating only), so those elements are not choosable on Bows; Artian bowgun elements only change ammo and are not modelled.',
  'Gogma Element Focus on a non-elemental Artian: a Game8 reader comment suggests it still grants an element, but no source documents the value, so no element is added when none is chosen.',
  'Attack Focus on the MH Wiki Lance / Hunting Horn / Gunlance rows shows extra figures (e.g. -15, +40) that could not be read unambiguously from the table; Game8 lists no element change for Attack Focus and the MHDB rows confirm 200 raw / -10% affinity for every kind, so none is applied.',
  'Sharpness bar colours of the Gogma focus rows come from MHDB (they differ per focus); the "blue / white sharpness reduction" wording in Game8 matches them.',
  'MH Wiki shows Long Sword Dimensius as 643 display for 190 raw; every other row (and MHDB) implies 627 (3.3x). Treated as a wiki typo; MHDB display values are used.',
  'Fextralife could only be read through a summariser (direct fetch failed); it is cited only for values also present verbatim on Game8 / MH Wiki.',
]

// ── Plain (API / calculation) shape ─────────────────────────────────────────

export type ArtianElementTable = Partial<Record<ArtianElement, { r67: number; r8: number }>>
export type ArtianKindRules = {
  artianNames: Record<'6' | '7' | '8', string>
  gogmaName: string
  elements: ArtianElementTable
  elementInfusion: number | null
  gogmaFocusElementDelta: { affinity: number; element: number } | null
  elementBoost: { I: number; II: number; EX: number } | null
}
export type ArtianRules = {
  gameVersion: string
  retrievedAt: string
  production: { parts: number; attackPerPart: number; affinityPerPart: number }
  baseStats: { raw: Record<'6' | '7' | '8', number>; affinity: number }
  gogmaFocus: Record<GogmaFocus, { raw: number; affinity: number }>
  reinforcement: {
    maxCount: number
    attack: Record<ArtianReinforcementLevel, number>
    affinity: Record<ArtianReinforcementLevel, number>
    sharpness: { I: number; EX: number }
    sharpnessInsectGlaiveI: number
    ammo: { I: number; EX: number }
    maxExPerType: number
    artianMaxPerType: Record<ArtianReinforcementType, number>
  }
  kinds: Record<WeaponKind, ArtianKindRules>
}

const plain = <T>(s: Sourced<T>): T => s.value

const toPlainKind = (k: KindRulesSourced): ArtianKindRules => ({
  artianNames: { '6': plain(k.artianNames[6]), '7': plain(k.artianNames[7]), '8': plain(k.artianNames[8]) },
  gogmaName: plain(k.gogmaName),
  elements: Object.fromEntries(
    Object.entries(k.elements).map(([e, v]) => [e, { r67: plain(v.r67), r8: plain(v.r8) }]),
  ) as ArtianElementTable,
  elementInfusion: k.elementInfusion ? plain(k.elementInfusion) : null,
  gogmaFocusElementDelta: k.gogmaFocusElementDelta
    ? { affinity: plain(k.gogmaFocusElementDelta.affinity), element: plain(k.gogmaFocusElementDelta.element) }
    : null,
  elementBoost: k.elementBoost ? { I: plain(k.elementBoost.I), II: plain(k.elementBoost.II), EX: plain(k.elementBoost.EX) } : null,
})

const toPlainRules = (): ArtianRules => {
  const r = ARTIAN_RULES_SOURCED
  const rf = r.reinforcement
  return {
    gameVersion: r.gameVersion,
    retrievedAt: r.retrievedAt,
    production: { parts: plain(r.production.parts), attackPerPart: plain(r.production.attackPerPart), affinityPerPart: plain(r.production.affinityPerPart) },
    baseStats: {
      raw: { '6': plain(r.baseStats.raw[6]), '7': plain(r.baseStats.raw[7]), '8': plain(r.baseStats.raw[8]) },
      affinity: plain(r.baseStats.affinity),
    },
    gogmaFocus: {
      attack: { raw: plain(r.gogmaFocus.attack.raw), affinity: plain(r.gogmaFocus.attack.affinity) },
      affinity: { raw: plain(r.gogmaFocus.affinity.raw), affinity: plain(r.gogmaFocus.affinity.affinity) },
      element: { raw: plain(r.gogmaFocus.element.raw), affinity: plain(r.gogmaFocus.element.affinity) },
    },
    reinforcement: {
      maxCount: plain(rf.maxCount),
      attack: { I: plain(rf.attack.I), II: plain(rf.attack.II), III: plain(rf.attack.III), EX: plain(rf.attack.EX) },
      affinity: { I: plain(rf.affinity.I), II: plain(rf.affinity.II), III: plain(rf.affinity.III), EX: plain(rf.affinity.EX) },
      sharpness: { I: plain(rf.sharpness.I), EX: plain(rf.sharpness.EX) },
      sharpnessInsectGlaiveI: plain(rf.sharpnessInsectGlaiveI),
      ammo: { I: plain(rf.ammo.I), EX: plain(rf.ammo.EX) },
      maxExPerType: plain(rf.maxExPerType),
      artianMaxPerType: {
        attack: plain(rf.artianMaxPerType.attack),
        affinity: plain(rf.artianMaxPerType.affinity),
        element: plain(rf.artianMaxPerType.element),
        sharpness: plain(rf.artianMaxPerType.sharpness),
        ammo: plain(rf.artianMaxPerType.ammo),
      },
    },
    kinds: Object.fromEntries(
      Object.entries(r.kinds).map(([kind, rules]) => [kind, toPlainKind(rules)]),
    ) as Record<WeaponKind, ArtianKindRules>,
  }
}

/** The plain numbers every consumer calculates with (served by `GET /api/mh-wilds/artian-rules`). */
export const ARTIAN_RULES: ArtianRules = toPlainRules()
