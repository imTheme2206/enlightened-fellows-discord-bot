import { describe, expect, it } from 'vitest'
import { reconcileCatalog, type ExistingCatalog } from '../reconcile'
import type { TransformResult, WeaponInsert } from '../transform'

// --- builders ---------------------------------------------------------------

const sampleWeapon = (): WeaponInsert => ({
  name: 'Rey Tonitrus I',
  kind: 'long-sword',
  rarity: 3,
  raw: 140,
  display: 462,
  affinity: 0,
  specials: [{ kind: 'element', name: 'thunder', damage: { raw: 15, display: 150 }, hidden: false }],
  sharpness: { red: 10, orange: 10, yellow: 150, green: 80, blue: 0, white: 0, purple: 0 },
  handicraft: [5],
  slots: [],
  elderseal: null,
  defenseBonus: 0,
  series: 'Rey Dau Tree',
  kindSpecific: { phial: 'impact', ammo: [{ a: 1, b: 2 }] },
})

function emptyExisting(): ExistingCatalog {
  return { skills: [], bonuses: [], bonusThresholds: [], armor: [], armorSkills: [], armorBonuses: [], decorations: [], decorationSkills: [], weapons: [], weaponSkills: [] }
}

function emptyNext(): TransformResult {
  return { skills: [], bonuses: [], bonusThresholds: [], armor: [], armorRegularSkills: [], armorBonuses: [], decorations: [], decorationSkills: [], weapons: [], weaponSkills: [] }
}

// A small but complete scrape: 1 skill, 1 set bonus (2 thresholds), 1 armor piece
// (has the skill + belongs to the bonus), 1 multi-grant decoration.
function sampleNext(): TransformResult {
  return {
    skills: [{ name: 'Attack Boost', cleanName: 'attack_boost', type: 'armor', maxLevel: 5, icon: 'offense' }],
    bonuses: [{ name: "Gore's Tyranny", cleanName: 'gores_tyranny', kind: 'set', icon: undefined }],
    bonusThresholds: [
      { bonusName: "Gore's Tyranny", piecesRequired: 2, effectName: 'Antivirus', level: 1 },
      { bonusName: "Gore's Tyranny", piecesRequired: 4, effectName: 'Antivirus', level: 2 },
    ],
    armor: [{ name: 'Gore Helm', type: 'head', rank: 'HIGH', rarity: 8, defense: 100, fireRes: 1, waterRes: 0, thunderRes: -2, iceRes: 0, dragonRes: 3, slots: [3, 1] }],
    armorRegularSkills: [{ armorName: 'Gore Helm', skillName: 'Attack Boost', level: 2 }],
    armorBonuses: [{ armorName: 'Gore Helm', bonusName: "Gore's Tyranny" }],
    decorations: [{ name: 'Crit Jwl', type: 'armor', slotSize: 3 }],
    decorationSkills: [
      { decorationName: 'Crit Jwl', skillName: 'Critical Status', level: 3 },
      { decorationName: 'Crit Jwl', skillName: 'Handicraft', level: 1 },
    ],
    weapons: [sampleWeapon()],
    weaponSkills: [{ weaponKey: 'long-sword:Rey Tonitrus I', skillName: 'Attack Boost', level: 1 }],
  }
}

// The DB state equivalent to sampleNext() (same values), for no-op assertions.
function sampleExisting(): ExistingCatalog {
  return {
    skills: [{ name: 'Attack Boost', cleanName: 'attack_boost', type: 'armor', maxLevel: 5, icon: 'offense' }],
    bonuses: [{ name: "Gore's Tyranny", cleanName: 'gores_tyranny', kind: 'set', icon: null }],
    bonusThresholds: [
      { bonusName: "Gore's Tyranny", piecesRequired: 2, effectName: 'Antivirus', level: 1 },
      { bonusName: "Gore's Tyranny", piecesRequired: 4, effectName: 'Antivirus', level: 2 },
    ],
    armor: [{ name: 'Gore Helm', type: 'head', rank: 'HIGH', rarity: 8, defense: 100, fireRes: 1, waterRes: 0, thunderRes: -2, iceRes: 0, dragonRes: 3, slots: [3, 1] }],
    armorSkills: [{ armorName: 'Gore Helm', skillName: 'Attack Boost', level: 2 }],
    armorBonuses: [{ armorName: 'Gore Helm', bonusName: "Gore's Tyranny" }],
    decorations: [{ name: 'Crit Jwl', type: 'armor', slotSize: 3 }],
    decorationSkills: [
      { decorationName: 'Crit Jwl', skillName: 'Critical Status', level: 3 },
      { decorationName: 'Crit Jwl', skillName: 'Handicraft', level: 1 },
    ],
    // jsonb does not preserve key order; reversed kindSpecific key order must not conflict.
    weapons: [{ ...sampleWeapon(), kindSpecific: { ammo: [{ b: 2, a: 1 }], phial: 'impact' } }],
    weaponSkills: [{ weaponKey: 'long-sword:Rey Tonitrus I', skillName: 'Attack Boost', level: 1 }],
  }
}

// --- tests ------------------------------------------------------------------

describe('reconcileCatalog', () => {
  it('empty DB → inserts everything, no conflicts (seed case)', () => {
    const plan = reconcileCatalog(emptyExisting(), sampleNext())
    expect(plan.conflicts).toEqual([])
    expect(plan.skills).toHaveLength(1)
    expect(plan.bonuses).toHaveLength(1)
    expect(plan.bonusThresholds).toHaveLength(2)
    expect(plan.armor).toHaveLength(1)
    expect(plan.armorRegularSkills).toHaveLength(1)
    expect(plan.armorBonuses).toHaveLength(1)
    expect(plan.decorations).toHaveLength(1)
    expect(plan.decorationSkills).toHaveLength(2)
    expect(plan.weapons).toHaveLength(1)
    expect(plan.weaponSkills).toHaveLength(1)
  })

  it('identical scrape → pure no-op (0 inserts, 0 conflicts, all unchanged)', () => {
    const plan = reconcileCatalog(sampleExisting(), sampleNext())
    expect(plan.conflicts).toEqual([])
    expect(plan.skills).toHaveLength(0)
    expect(plan.bonuses).toHaveLength(0)
    expect(plan.bonusThresholds).toHaveLength(0)
    expect(plan.armor).toHaveLength(0)
    expect(plan.decorations).toHaveLength(0)
    expect(plan.weapons).toHaveLength(0)
    expect(plan.weaponSkills).toHaveLength(0)
    expect(plan.unchanged).toEqual({ skills: 1, bonuses: 1, armor: 1, decorations: 1, weapons: 1 })
  })

  it('new identities are inserted; existing ones stay untouched', () => {
    const next = sampleNext()
    next.skills.push({ name: 'Guard', cleanName: 'guard', type: 'armor', maxLevel: 5, icon: undefined })
    next.armor.push({ name: 'Guard Mail', type: 'chest', rank: 'HIGH', rarity: 5, defense: 80, fireRes: 0, waterRes: 0, thunderRes: 0, iceRes: 0, dragonRes: 0, slots: [1] })
    next.armorRegularSkills.push({ armorName: 'Guard Mail', skillName: 'Guard', level: 1 })

    const plan = reconcileCatalog(sampleExisting(), next)
    expect(plan.conflicts).toEqual([])
    expect(plan.skills.map((s) => s.name)).toEqual(['Guard'])
    expect(plan.armor.map((a) => a.name)).toEqual(['Guard Mail'])
    expect(plan.armorRegularSkills).toEqual([{ armorName: 'Guard Mail', skillName: 'Guard', level: 1 }])
    expect(plan.unchanged.skills).toBe(1) // Attack Boost unchanged
  })

  it('changed armor scalar → conflict, nothing inserted for it', () => {
    const next = sampleNext()
    next.armor[0].defense = 999
    const plan = reconcileCatalog(sampleExisting(), next)
    expect(plan.conflicts).toEqual([{ entity: 'armor', name: 'Gore Helm', reason: 'armor stats changed' }])
    expect(plan.armor).toHaveLength(0)
  })

  it('changed armor skill level → conflict', () => {
    const next = sampleNext()
    next.armorRegularSkills[0].level = 3
    const plan = reconcileCatalog(sampleExisting(), next)
    expect(plan.conflicts).toEqual([{ entity: 'armor', name: 'Gore Helm', reason: 'armor skills changed' }])
  })

  it('changed armor bonus membership → conflict', () => {
    const next = sampleNext()
    next.armorBonuses = [] // piece no longer in the set
    const plan = reconcileCatalog(sampleExisting(), next)
    expect(plan.conflicts).toEqual([{ entity: 'armor', name: 'Gore Helm', reason: 'armor bonus membership changed' }])
  })

  it('changed bonus threshold → conflict', () => {
    const next = sampleNext()
    next.bonusThresholds[1].piecesRequired = 3 // 4 → 3
    const plan = reconcileCatalog(sampleExisting(), next)
    expect(plan.conflicts).toEqual([{ entity: 'bonus', name: "Gore's Tyranny", reason: 'activation thresholds changed' }])
  })

  it('changed decoration grant → conflict', () => {
    const next = sampleNext()
    next.decorationSkills[0].level = 2 // Critical Status 3 → 2
    const plan = reconcileCatalog(sampleExisting(), next)
    expect(plan.conflicts).toEqual([{ entity: 'decoration', name: 'Crit Jwl', reason: 'decoration skills changed' }])
  })

  it('item missing from scrape is retained (no conflict, no insert)', () => {
    const plan = reconcileCatalog(sampleExisting(), emptyNext())
    expect(plan.conflicts).toEqual([])
    expect(plan.skills).toHaveLength(0)
    expect(plan.armor).toHaveLength(0)
    expect(plan.unchanged).toEqual({ skills: 0, bonuses: 0, armor: 0, decorations: 0, weapons: 0 })
  })

  it('null vs undefined icon is treated as equal (no false conflict)', () => {
    // existing icon null, next icon undefined for the bonus — must NOT conflict.
    const plan = reconcileCatalog(sampleExisting(), sampleNext())
    expect(plan.conflicts).toEqual([])
  })

  it('new weapon is inserted with its skills; existing weapon untouched', () => {
    const next = sampleNext()
    next.weapons.push({ ...sampleWeapon(), name: 'Rey Tonitrus II', raw: 150 })
    next.weaponSkills.push({ weaponKey: 'long-sword:Rey Tonitrus II', skillName: 'Attack Boost', level: 2 })
    const plan = reconcileCatalog(sampleExisting(), next)
    expect(plan.conflicts).toEqual([])
    expect(plan.weapons.map((w) => w.name)).toEqual(['Rey Tonitrus II'])
    expect(plan.weaponSkills).toEqual([{ weaponKey: 'long-sword:Rey Tonitrus II', skillName: 'Attack Boost', level: 2 }])
  })

  it('same name on a different weapon kind is a distinct identity', () => {
    const next = sampleNext()
    next.weapons.push({ ...sampleWeapon(), kind: 'great-sword' })
    const plan = reconcileCatalog(sampleExisting(), next)
    expect(plan.conflicts).toEqual([])
    expect(plan.weapons.map((w) => w.kind)).toEqual(['great-sword'])
  })

  it('changed weapon stats → conflict, nothing inserted for it', () => {
    const next = sampleNext()
    next.weapons[0].raw = 999
    const plan = reconcileCatalog(sampleExisting(), next)
    expect(plan.conflicts).toEqual([{ entity: 'weapon', name: 'long-sword:Rey Tonitrus I', reason: 'weapon stats changed' }])
    expect(plan.weapons).toHaveLength(0)
  })

  it('changed weapon sharpness → conflict', () => {
    const next = sampleNext()
    next.weapons[0].sharpness = { red: 10, orange: 10, yellow: 150, green: 80, blue: 1, white: 0, purple: 0 }
    expect(reconcileCatalog(sampleExisting(), next).conflicts).toHaveLength(1)
  })

  it('changed weapon skill level → conflict', () => {
    const next = sampleNext()
    next.weaponSkills[0].level = 2
    const plan = reconcileCatalog(sampleExisting(), next)
    expect(plan.conflicts).toEqual([{ entity: 'weapon', name: 'long-sword:Rey Tonitrus I', reason: 'weapon skills changed' }])
  })

  it('weapon missing from scrape is retained', () => {
    const next = sampleNext()
    next.weapons = []
    next.weaponSkills = []
    const plan = reconcileCatalog(sampleExisting(), next)
    expect(plan.conflicts).toEqual([])
    expect(plan.weapons).toHaveLength(0)
  })
})
