import { describe, expect, it } from 'vitest'
import type { MhdbWeapon } from '../mhdb-types'
import { disambiguateWeaponNames, SeedDataSchema, transformSeedData } from '../transform'
import type { SeedData, SeedWeapon } from '../types'
import { mapMhdbWeapons } from '../weapons'

const mhdbLongSword: MhdbWeapon = {
  id: 841,
  name: 'Rey Tonitrus I',
  kind: 'long-sword',
  rarity: 3,
  damage: { raw: 140, display: 462 },
  affinity: 0,
  specials: [{ kind: 'element', element: 'thunder', damage: { raw: 15, display: 150 }, hidden: false }],
  sharpness: { red: 10, orange: 10, yellow: 150, green: 80, blue: 0, white: 0, purple: 0 },
  handicraft: [5],
  slots: [],
  skills: [{ skill: { name: 'Punishing Draw' }, level: 1 }],
  elderseal: null,
  defenseBonus: 0,
  series: { name: 'Rey Dau Tree' },
}

const mhdbBow: MhdbWeapon = {
  id: 1139,
  name: 'Calamitous Angel',
  kind: 'bow',
  rarity: 8,
  damage: { raw: 200, display: 240 },
  affinity: -10,
  specials: [{ kind: 'status', status: 'paralysis', damage: { raw: 10, display: 100 }, hidden: false }],
  slots: [3, 3, 3],
  skills: [],
  elderseal: null,
  defenseBonus: 0,
  series: null,
  coatings: ['power', 'paralysis'],
}

describe('mapMhdbWeapons', () => {
  const [sword, bow] = mapMhdbWeapons([mhdbLongSword, mhdbBow])

  it('flattens damage, series, skills and element specials', () => {
    expect(sword).toMatchObject({
      name: 'Rey Tonitrus I',
      kind: 'long-sword',
      damage: { raw: 140, display: 462 },
      series: 'Rey Dau Tree',
      skills: { 'Punishing Draw': 1 },
      specials: [{ kind: 'element', name: 'thunder', damage: { raw: 15, display: 150 }, hidden: false }],
      handicraft: [5],
    })
    expect(sword.sharpness?.yellow).toBe(150)
  })

  it('maps status specials, null sharpness for ranged weapons and kind-specific fields', () => {
    expect(bow.specials[0]).toMatchObject({ kind: 'status', name: 'paralysis' })
    expect(bow.sharpness).toBeNull()
    expect(bow.handicraft).toBeNull()
    expect(bow.series).toBeNull()
    expect(bow.kindSpecific).toEqual({ coatings: ['power', 'paralysis'] })
  })
})

describe('disambiguateWeaponNames', () => {
  const artian = (affinity: number) => ({ kind: 'bow', name: 'Calamitous Angel', affinity })

  it('leaves unique (kind, name) pairs alone', () => {
    const out = disambiguateWeaponNames([artian(0), { kind: 'hammer', name: 'Calamitous Angel', affinity: 0 }])
    expect(out.map((w) => w.name)).toEqual(['Calamitous Angel', 'Calamitous Angel'])
  })

  it('suffixes colliding names with their affinity, deterministically', () => {
    const out = disambiguateWeaponNames([artian(-10), artian(15), artian(0)])
    expect(out.map((w) => w.name)).toEqual([
      'Calamitous Angel (-10% affinity)',
      'Calamitous Angel (+15% affinity)',
      'Calamitous Angel (0% affinity)',
    ])
  })

  it('adds a counter when affinity ties', () => {
    const out = disambiguateWeaponNames([artian(5), artian(5)])
    expect(new Set(out.map((w) => `${w.kind}:${w.name}`)).size).toBe(2)
  })
})

describe('transformSeedData weapons', () => {
  const emptySeed = (weapons: SeedWeapon[], skills: Record<string, number>): SeedData => ({
    armor: { head: {}, chest: {}, arms: {}, waist: {}, legs: {} },
    talisman: {},
    decoration: {},
    skills,
    setSkills: {},
    groupSkills: {},
    setMap: {},
    armorSkills: [],
    weaponSkills: Object.keys(skills),
    weapons,
  })

  it('produces weapon inserts and skill grants keyed by kind:name', () => {
    const result = transformSeedData(emptySeed(mapMhdbWeapons([mhdbLongSword]), { 'Punishing Draw': 3 }))
    expect(result.weapons).toHaveLength(1)
    expect(result.weapons[0]).toMatchObject({ name: 'Rey Tonitrus I', raw: 140, display: 462, series: 'Rey Dau Tree' })
    expect(result.weaponSkills).toEqual([{ weaponKey: 'long-sword:Rey Tonitrus I', skillName: 'Punishing Draw', level: 1 }])
  })

  it('rejects a weapon that references an unknown skill', () => {
    expect(() => transformSeedData(emptySeed(mapMhdbWeapons([mhdbLongSword]), {}))).toThrow(/Punishing Draw/)
  })

  it('rejects an unknown weapon kind at the schema boundary', () => {
    const seed = emptySeed(mapMhdbWeapons([{ ...mhdbLongSword, kind: 'boomerang' }]), { 'Punishing Draw': 3 })
    expect(SeedDataSchema.safeParse(seed).success).toBe(false)
  })

  it('treats a seed without weapons as no weapons', () => {
    const result = transformSeedData({ ...emptySeed([], {}), weapons: undefined })
    expect(result.weapons).toEqual([])
  })
})
