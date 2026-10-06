import { describe, expect, it } from 'vitest'
import {
  classifyArtianWeapon,
  deriveArtianStats,
  findArtianConfigIssue,
  stripAffinitySuffix,
  EMPTY_ARTIAN_CUSTOMIZATION,
} from '../artian'
import {
  ARTIAN_RULES,
  ARTIAN_RULES_SOURCED,
  ARTIAN_SOURCES,
  ARTIAN_RULES_GAME_VERSION,
} from '../artian-rules'
import type { ArtianCustomization, WeaponArtian, WeaponCatalogItem } from '../schema'

const config = (overrides: Partial<ArtianCustomization> = {}): ArtianCustomization => ({ ...EMPTY_ARTIAN_CUSTOMIZATION, ...overrides })

const row = (overrides: Partial<WeaponCatalogItem>): WeaponCatalogItem => ({
  id: 'w',
  name: 'x',
  kind: 'great-sword',
  rarity: 8,
  damage: { raw: 190, display: 912 },
  affinity: 5,
  specials: [],
  sharpness: { red: 80, orange: 40, yellow: 60, green: 80, blue: 70, white: 20, purple: 0 },
  handicraft: null,
  slots: [3, 3, 3],
  skills: [],
  elderseal: null,
  defenseBonus: 0,
  series: null,
  artian: null,
  kindSpecific: {},
  ...overrides,
})

const ARTIAN_8: WeaponArtian = { family: 'artian', tier: 8, focus: null }
const gogma = (focus: 'attack' | 'affinity' | 'element'): WeaponArtian => ({ family: 'gogma', tier: 8, focus })

describe('rules table provenance', () => {
  const walk = (node: unknown, path: string, visit: (path: string, leaf: { value: unknown; sources: string[] }) => void) => {
    if (typeof node !== 'object' || node === null) return
    if ('value' in node && 'sources' in node) {
      visit(path, node as { value: unknown; sources: string[] })
      return
    }
    for (const [key, child] of Object.entries(node)) walk(child, `${path}.${key}`, visit)
  }

  it('gives every value at least one known source', () => {
    let leaves = 0
    walk(ARTIAN_RULES_SOURCED, 'rules', (path, leaf) => {
      leaves += 1
      expect(leaf.sources.length, path).toBeGreaterThan(0)
      for (const source of leaf.sources) expect(ARTIAN_SOURCES, `${path} -> ${source}`).toHaveProperty(source)
    })
    expect(leaves).toBeGreaterThan(150)
  })

  it('is tagged with a game version and covers all 14 kinds', () => {
    expect(ARTIAN_RULES.gameVersion).toBe(ARTIAN_RULES_GAME_VERSION)
    expect(Object.keys(ARTIAN_RULES.kinds)).toHaveLength(14)
  })

  it('carries the figures read from Game8 / MH Wiki', () => {
    const r = ARTIAN_RULES.reinforcement
    expect(r.attack).toEqual({ I: 5, II: 6, III: 9, EX: 12 })
    expect(r.affinity).toEqual({ I: 5, II: 6, III: 8, EX: 10 })
    expect(r.sharpness).toEqual({ I: 30, EX: 50 })
    expect(r.maxCount).toBe(5)
    expect(ARTIAN_RULES.kinds['great-sword'].elementBoost).toEqual({ I: 80, II: 90, EX: 110 })
    expect(ARTIAN_RULES.kinds['dual-blades'].elementBoost).toEqual({ I: 20, II: 30, EX: 50 })
    expect(ARTIAN_RULES.kinds.bow.elementBoost).toEqual({ I: 30, II: 40, EX: 60 })
    expect(ARTIAN_RULES.kinds['great-sword'].elements.fire).toEqual({ r67: 300, r8: 450 })
    expect(ARTIAN_RULES.kinds['great-sword'].elements.poison).toEqual({ r67: 150, r8: 300 })
    expect(ARTIAN_RULES.kinds['great-sword'].elements.sleep).toEqual({ r67: 100, r8: 250 })
    expect(ARTIAN_RULES.kinds['hunting-horn'].gogmaFocusElementDelta).toEqual({ affinity: 20, element: 80 })
    expect(ARTIAN_RULES.kinds.gunlance.gogmaFocusElementDelta).toEqual({ affinity: 30, element: 80 })
    expect(ARTIAN_RULES.kinds['light-bowgun'].elements).toEqual({})
  })

  it('keeps status elements 150 / 200 below the elemental value, as Game8 states', () => {
    for (const [kind, rules] of Object.entries(ARTIAN_RULES.kinds)) {
      const e = rules.elements
      if (!e.fire || !e.poison || !e.sleep) continue
      expect(e.fire.r8 - e.poison.r8, kind).toBe(150)
      expect(e.fire.r8 - e.sleep.r8, kind).toBe(200)
    }
  })
})

describe('classifyArtianWeapon', () => {
  it('recognises the three Artian tiers by name and rarity', () => {
    expect(classifyArtianWeapon(row({ name: 'Artian Blade I', rarity: 6, damage: { raw: 170, display: 816 } }))).toEqual({ family: 'artian', tier: 6, focus: null })
    expect(classifyArtianWeapon(row({ name: 'Artian Blade II', rarity: 7 }))).toEqual({ family: 'artian', tier: 7, focus: null })
    expect(classifyArtianWeapon(row({ name: 'Varianza' }))).toEqual(ARTIAN_8)
    expect(classifyArtianWeapon(row({ name: 'Angelbein', kind: 'bow' }))).toEqual(ARTIAN_8)
  })

  it('recognises each Gogma focus row by the raw/affinity the focus produces', () => {
    const base = { name: 'Ostrak Oblivion', series: null }
    expect(classifyArtianWeapon(row({ ...base, name: 'Ostrak Oblivion (-10% affinity)', damage: { raw: 200, display: 960 }, affinity: -10 }))).toEqual(gogma('attack'))
    expect(classifyArtianWeapon(row({ ...base, name: 'Ostrak Oblivion (+15% affinity)', damage: { raw: 180, display: 864 }, affinity: 15 }))).toEqual(gogma('affinity'))
    expect(classifyArtianWeapon(row({ ...base, name: 'Ostrak Oblivion (0% affinity)', damage: { raw: 190, display: 912 }, affinity: 0 }))).toEqual(gogma('element'))
  })

  it('treats near-misses as ordinary weapons rather than guessing', () => {
    expect(classifyArtianWeapon(row({ name: 'Ostrak Oblivion (0% affinity)', affinity: 3 }))).toBeNull()
    expect(classifyArtianWeapon(row({ name: 'Varianza', series: 'Some Tree' }))).toBeNull()
    expect(classifyArtianWeapon(row({ name: 'Varianza', rarity: 7 }))).toBeNull()
    expect(classifyArtianWeapon(row({ name: 'Rathalos Blade' }))).toBeNull()
    expect(classifyArtianWeapon(row({ name: 'Varianza', kind: 'long-sword' }))).toBeNull()
  })

  it('strips only the display affinity suffix', () => {
    expect(stripAffinitySuffix('Calamitous Angel (+15% affinity)')).toBe('Calamitous Angel')
    expect(stripAffinitySuffix('Calamitous Angel (0% affinity) #2')).toBe('Calamitous Angel')
    expect(stripAffinitySuffix("Headsman's Hamus")).toBe("Headsman's Hamus")
  })
})

describe('deriveArtianStats', () => {
  it('reproduces the MH Wiki worked example (Artian Blade I, 2 attack + 1 affinity part)', () => {
    const blade = row({ name: 'Artian Blade I', rarity: 6, damage: { raw: 170, display: 816 } })
    const stats = deriveArtianStats(blade, { family: 'artian', tier: 6, focus: null }, config({ attackParts: 2, affinityParts: 1 }))
    expect(stats.damage).toEqual({ raw: 180, display: 864 })
    expect(stats.affinity).toBe(10)
    expect(stats.specials).toEqual([])
  })

  it('applies the rarity-8 element value and the element infusion', () => {
    const varianza = row({})
    const plain = deriveArtianStats(varianza, ARTIAN_8, config({ element: 'fire' }))
    expect(plain.specials).toEqual([{ kind: 'element', name: 'fire', damage: { raw: 45, display: 450 }, hidden: false }])
    const infused = deriveArtianStats(varianza, ARTIAN_8, config({ element: 'fire', elementInfusion: true }))
    expect(infused.specials[0]?.damage).toEqual({ raw: 48, display: 480 })

    const r6 = row({ rarity: 6, name: 'Artian Blade I' })
    expect(deriveArtianStats(r6, { family: 'artian', tier: 6, focus: null }, config({ element: 'fire' })).specials[0]?.damage.display).toBe(300)
  })

  it('classifies poison / paralysis / sleep / blast as status', () => {
    const poison = deriveArtianStats(row({}), ARTIAN_8, config({ element: 'poison' }))
    expect(poison.specials).toEqual([{ kind: 'status', name: 'poison', damage: { raw: 30, display: 300 }, hidden: false }])
    expect(deriveArtianStats(row({}), ARTIAN_8, config({ element: 'sleep' })).specials[0]?.damage.display).toBe(250)
  })

  it('adds level-I reinforcements on a plain Artian weapon', () => {
    const stats = deriveArtianStats(
      row({}),
      ARTIAN_8,
      config({
        element: 'water',
        attackParts: 1,
        affinityParts: 2,
        reinforcements: [
          { type: 'attack', level: 'I' },
          { type: 'attack', level: 'I' },
          { type: 'affinity', level: 'I' },
          { type: 'element', level: 'I' },
          { type: 'sharpness', level: 'I' },
        ],
      }),
    )
    // 190 + 5 (part) + 5 + 5 (reinforcements) = 205; display 205 * 4.8 = 984.
    expect(stats.damage).toEqual({ raw: 205, display: 984 })
    expect(stats.affinity).toBe(5 + 10 + 5)
    expect(stats.specials[0]?.damage.display).toBe(450 + 80)
    expect(stats.sharpnessBonus).toBe(30)
  })

  it('derives a Gogma Artian from its focus row, element focus delta and EX reinforcements', () => {
    const ostrak = row({ name: 'Ostrak Oblivion (+15% affinity)', damage: { raw: 180, display: 864 }, affinity: 15 })
    const stats = deriveArtianStats(
      ostrak,
      gogma('affinity'),
      config({
        element: 'water',
        reinforcements: [
          { type: 'attack', level: 'EX' },
          { type: 'attack', level: 'EX' },
          { type: 'affinity', level: 'III' },
          { type: 'element', level: 'EX' },
          { type: 'sharpness', level: 'EX' },
        ],
      }),
    )
    expect(stats.damage).toEqual({ raw: 204, display: 979 })
    expect(stats.affinity).toBe(23)
    // Water r8 450, Affinity Focus -10 (Great Sword), Element EX +110.
    expect(stats.specials[0]?.damage.display).toBe(450 - 10 + 110)
    expect(stats.sharpnessBonus).toBe(50)
  })

  it('applies the Element Focus delta per kind and none for Attack Focus', () => {
    const horn = row({ kind: 'hunting-horn', name: 'Onyx Choros (0% affinity)', damage: { raw: 190, display: 798 }, affinity: 0 })
    const element = deriveArtianStats(horn, gogma('element'), config({ element: 'fire' }))
    expect(element.specials[0]?.damage.display).toBe(320 + 80)
    const affinity = deriveArtianStats(horn, gogma('affinity'), config({ element: 'fire' }))
    expect(affinity.specials[0]?.damage.display).toBe(320 + 20)
    const attack = deriveArtianStats(horn, gogma('attack'), config({ element: 'fire' }))
    expect(attack.specials[0]?.damage.display).toBe(320)
    expect(deriveArtianStats(horn, gogma('element'), config()).specials).toEqual([])
  })

  it('uses the Insect Glaive level-I sharpness value and counts bowgun ammo', () => {
    const glaive = row({ kind: 'insect-glaive', damage: { raw: 190, display: 589 } })
    expect(deriveArtianStats(glaive, ARTIAN_8, config({ reinforcements: [{ type: 'sharpness', level: 'I' }] })).sharpnessBonus).toBe(20)
    const bowgun = row({ kind: 'light-bowgun', damage: { raw: 190, display: 247 }, sharpness: null })
    expect(deriveArtianStats(bowgun, ARTIAN_8, config({ reinforcements: [{ type: 'ammo', level: 'I' }] })).ammoBonus).toBe(1)
  })

  it('leaves the catalog row untouched for an empty configuration', () => {
    const stats = deriveArtianStats(row({}), ARTIAN_8, EMPTY_ARTIAN_CUSTOMIZATION)
    expect(stats).toEqual({ damage: { raw: 190, display: 912 }, affinity: 5, specials: [], sharpnessBonus: 0, ammoBonus: 0 })
  })
})

describe('findArtianConfigIssue', () => {
  const issue = (weapon: Partial<WeaponCatalogItem>, artian: WeaponArtian, cfg: Partial<ArtianCustomization>) =>
    findArtianConfigIssue(row(weapon), artian, config(cfg))?.reason ?? null

  it('accepts a legal Gogma configuration', () => {
    expect(
      issue({}, gogma('element'), {
        element: 'thunder',
        attackParts: 2,
        affinityParts: 1,
        elementInfusion: true,
        reinforcements: [
          { type: 'attack', level: 'EX' },
          { type: 'attack', level: 'EX' },
          { type: 'affinity', level: 'EX' },
          { type: 'element', level: 'II' },
          { type: 'sharpness', level: 'I' },
        ],
      }),
    ).toBeNull()
  })

  it('rejects an element the kind cannot take', () => {
    expect(issue({ kind: 'bow' }, ARTIAN_8, { element: 'poison' })).toBe('element_not_available')
    expect(issue({ kind: 'light-bowgun', sharpness: null }, ARTIAN_8, { element: 'fire' })).toBe('element_not_available')
  })

  it('rejects an infusion without an element and more than three parts', () => {
    expect(issue({}, ARTIAN_8, { elementInfusion: true })).toBe('infusion_requires_element')
    expect(issue({}, ARTIAN_8, { attackParts: 2, affinityParts: 2 })).toBe('production_parts_exceeded')
  })

  it('rejects more than five reinforcements', () => {
    const six = Array.from({ length: 6 }, () => ({ type: 'attack' as const, level: 'I' as const }))
    expect(issue({}, ARTIAN_8, { reinforcements: six })).toBe('too_many_reinforcements')
  })

  it('rejects reinforcement types the weapon cannot roll', () => {
    expect(issue({}, ARTIAN_8, { reinforcements: [{ type: 'element', level: 'I' }] })).toBe('reinforcement_not_available')
    expect(issue({ kind: 'bow', sharpness: null }, ARTIAN_8, { element: 'fire', reinforcements: [{ type: 'sharpness', level: 'I' }] })).toBe('reinforcement_not_available')
    expect(issue({}, ARTIAN_8, { reinforcements: [{ type: 'ammo', level: 'I' }] })).toBe('reinforcement_not_available')
  })

  it('only allows level I on a plain Artian and no level III element on Gogma', () => {
    expect(issue({}, ARTIAN_8, { reinforcements: [{ type: 'attack', level: 'EX' }] })).toBe('reinforcement_level_not_available')
    expect(issue({}, gogma('attack'), { element: 'fire', reinforcements: [{ type: 'element', level: 'III' }] })).toBe('reinforcement_level_not_available')
    expect(issue({}, gogma('attack'), { reinforcements: [{ type: 'sharpness', level: 'II' }] })).toBe('reinforcement_level_not_available')
  })

  it('caps EX reinforcements at two per type and plain Artian per-type counts', () => {
    const ex3 = Array.from({ length: 3 }, () => ({ type: 'attack' as const, level: 'EX' as const }))
    expect(issue({}, gogma('attack'), { reinforcements: ex3 })).toBe('too_many_ex_of_type')
    const affinity4 = Array.from({ length: 4 }, () => ({ type: 'affinity' as const, level: 'I' as const }))
    expect(issue({}, ARTIAN_8, { reinforcements: affinity4 })).toBe('too_many_of_type')
    const attack5 = Array.from({ length: 5 }, () => ({ type: 'attack' as const, level: 'I' as const }))
    expect(issue({}, ARTIAN_8, { reinforcements: attack5 })).toBeNull()
  })
})
