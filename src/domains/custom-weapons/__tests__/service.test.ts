import { beforeEach, describe, expect, it, vi } from 'vitest'

const repository = {
  findByUser: vi.fn(),
  countByUser: vi.fn(),
  insert: vi.fn(),
  deleteOwned: vi.fn(),
}
const catalog = {
  getWeapons: vi.fn(),
  getSkills: vi.fn(),
}

vi.mock('../repository', () => ({ CustomWeaponRepository: repository }))
vi.mock('../../mh-wilds-catalog/service', () => ({ CatalogService: catalog }))

const { CustomWeaponConflictError, CustomWeaponService, CustomWeaponValidationError } = await import('../service')

const artianWeapon = {
  id: 'artian-gs', name: 'Varianza', kind: 'great-sword', rarity: 8,
  damage: { raw: 200, display: 960 }, affinity: 0,
  specials: [], sharpness: { red: 50, orange: 50, yellow: 50, green: 50, blue: 50, white: 50, purple: 0 },
  handicraft: [0, 0, 0, 0, 0], slots: [], skills: [], elderseal: null,
  defenseBonus: 0, series: null, kindSpecific: {},
  artian: { family: 'artian', tier: 8, focus: null },
}
const gogmaWeapon = {
  ...artianWeapon,
  id: 'gogma-gs', name: 'Ostrak Oblivion',
  artian: { family: 'gogma', tier: 8, focus: 'attack' },
}
const bonuses = [
  { id: 'set-1', name: 'Set Bonus', kind: 'set', icon: null, thresholds: [] },
  { id: 'group-1', name: 'Group Bonus', kind: 'group', icon: null, thresholds: [] },
]
const input = {
  name: 'My Gogma',
  weaponId: 'gogma-gs',
  customization: { element: null, attackParts: 0, affinityParts: 0, elementInfusion: false, reinforcements: [] },
  setBonusId: 'set-1',
  groupBonusId: 'group-1',
}

const setupCatalog = (weapons: unknown[] = [artianWeapon, gogmaWeapon]) => {
  catalog.getWeapons.mockResolvedValue(weapons)
  catalog.getSkills.mockResolvedValue({ skills: [], bonuses })
}

beforeEach(() => {
  vi.clearAllMocks()
  repository.countByUser.mockResolvedValue(0)
  setupCatalog()
})

describe('CustomWeaponService.create', () => {
  it('rejects a catalog weapon that is not Artian or Gogma Artian', async () => {
    setupCatalog([{ ...artianWeapon, artian: null }])
    await expect(CustomWeaponService.create('owner-1', input)).rejects.toBeInstanceOf(CustomWeaponValidationError)
    expect(repository.insert).not.toHaveBeenCalled()
  })

  it('rejects an invalid Artian configuration', async () => {
    const invalid = { ...input, weaponId: 'artian-gs', setBonusId: null, groupBonusId: null, customization: { ...input.customization, element: 'plasma' } }
    await expect(CustomWeaponService.create('owner-1', invalid)).rejects.toThrow('Invalid weapon customization')
    expect(repository.insert).not.toHaveBeenCalled()
  })

  it('requires Set and Group Bonuses for a Gogma Artian', async () => {
    await expect(CustomWeaponService.create('owner-1', { ...input, setBonusId: null })).rejects.toThrow('require a Set Bonus')
    await expect(CustomWeaponService.create('owner-1', { ...input, groupBonusId: null })).rejects.toThrow('require a Group Bonus')
    expect(repository.insert).not.toHaveBeenCalled()
  })

  it('checks selected bonus kinds against their catalog slots', async () => {
    await expect(CustomWeaponService.create('owner-1', { ...input, setBonusId: 'group-1' })).rejects.toThrow('Set Bonus must be a set bonus')
    expect(repository.insert).not.toHaveBeenCalled()
  })

  it('enforces the per-owner collection cap', async () => {
    repository.countByUser.mockResolvedValue(50)
    await expect(CustomWeaponService.create('owner-1', input)).rejects.toThrow('up to 50 custom weapons')
    expect(catalog.getWeapons).not.toHaveBeenCalled()
    expect(repository.insert).not.toHaveBeenCalled()
  })

  it('stores the validated configuration under its owner', async () => {
    repository.insert.mockResolvedValue({ id: 'saved-1', userId: 'owner-1', ...input })
    await CustomWeaponService.create('owner-1', input)
    expect(repository.insert).toHaveBeenCalledWith('owner-1', expect.objectContaining({
      name: input.name,
      weaponId: input.weaponId,
      setBonusId: input.setBonusId,
      groupBonusId: input.groupBonusId,
      customization: input.customization,
    }))
  })

  it('maps owner/name uniqueness into a conflict', async () => {
    repository.insert.mockRejectedValue({ code: '23505' })
    await expect(CustomWeaponService.create('owner-1', input)).rejects.toBeInstanceOf(CustomWeaponConflictError)
  })
})
