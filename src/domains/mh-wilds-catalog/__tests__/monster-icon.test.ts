import { describe, expect, it } from 'vitest'
import { monsterIconUrl, resolveExistingMonsterIcon, resolveMonsterIcon } from '../monster-icon'

describe('monster icons', () => {
  it('maps names to icon files', () => {
    expect(resolveMonsterIcon('Yian Kut-Ku')).toBe('Yian_Kut-Ku_Icon.png')
    expect(resolveMonsterIcon('Unknown')).toBe('Unknown_Icon.png')
  })

  it('falls back to Unknown when the file does not exist', () => {
    expect(resolveExistingMonsterIcon('Rathalos')).toBe('Rathalos_Icon.png')
    expect(resolveExistingMonsterIcon('Nonexistent Beast')).toBe('Unknown_Icon.png')
  })

  it('builds the served URL', () => {
    expect(monsterIconUrl('Guardian Rathalos')).toBe('/api/mh-wilds/monster-icons/Guardian_Rathalos_Icon.png')
  })
})
