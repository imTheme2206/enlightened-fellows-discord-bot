import { deKira } from './names'
import type { MhdbWeapon } from './mhdb-types'
import type { SeedWeapon, WeaponKind } from './types'

const KIND_SPECIFIC_FIELDS = [
  'phial',
  'shell',
  'shellLevel',
  'coatings',
  'ammo',
  'specialAmmo',
  'kinsectLevel',
  'melody',
  'echoBubble',
  'echoWave',
] as const

/**
 * Maps the MHDB `/weapons` wire format to the normalised seed shape. Pure — the
 * scraper owns the fetch, this owns the format knowledge so it is unit-testable.
 * Unknown skills/specials are passed through untouched; validation happens in
 * `transformSeedData`.
 */
export const mapMhdbWeapons = (list: MhdbWeapon[]): SeedWeapon[] =>
  list.map((w) => {
    const skills: Record<string, number> = {}
    for (const s of w.skills) skills[deKira(s.skill.name)] = s.level

    const kindSpecific: Record<string, unknown> = {}
    for (const field of KIND_SPECIFIC_FIELDS) {
      if (w[field] !== undefined) kindSpecific[field] = w[field]
    }

    return {
      name: deKira(w.name),
      kind: w.kind as WeaponKind,
      rarity: w.rarity,
      damage: { raw: w.damage.raw, display: w.damage.display },
      affinity: w.affinity,
      specials: w.specials.map((s) => ({
        kind: s.kind,
        name: (s.kind === 'element' ? s.element : s.status) ?? 'unknown',
        damage: { raw: s.damage.raw, display: s.damage.display },
        hidden: s.hidden,
      })),
      sharpness: w.sharpness
        ? {
            red: w.sharpness.red ?? 0,
            orange: w.sharpness.orange ?? 0,
            yellow: w.sharpness.yellow ?? 0,
            green: w.sharpness.green ?? 0,
            blue: w.sharpness.blue ?? 0,
            white: w.sharpness.white ?? 0,
            purple: w.sharpness.purple ?? 0,
          }
        : null,
      handicraft: w.handicraft ?? null,
      slots: w.slots,
      skills,
      elderseal: w.elderseal ?? null,
      defenseBonus: w.defenseBonus,
      series: w.series?.name ?? null,
      kindSpecific,
    }
  })
