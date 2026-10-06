import { ARTIAN_RULES } from './artian-rules'
import type { CatalogIndexProjection } from './projection'
import { CatalogRepository } from './repository'
import type { ArmorCatalogItem, ArtianRulesResponse, DecorationCatalogItem, MonsterDetail, MonsterListItem, SkillCatalogResponse, WeaponCatalogItem, WeaponCatalogQuery } from './schema'

/**
 * MH Wilds Catalog domain service (ADR-0009): the shared read boundary over
 * armor, weapons (ADR-0013), decorations, skills, and set/group bonuses. Set Search and Set Builder
 * both consume catalog reads from here rather than owning competing repositories.
 */
export abstract class CatalogService {
  static getArmors(): Promise<ArmorCatalogItem[]> {
    return CatalogRepository.findArmorCatalog()
  }

  static getDecorations(): Promise<DecorationCatalogItem[]> {
    return CatalogRepository.findDecorationCatalog()
  }

  static getWeapons(query: WeaponCatalogQuery = {}): Promise<WeaponCatalogItem[]> {
    return CatalogRepository.findWeaponCatalog(query)
  }

  /** The hand-maintained Artian / Gogma Artian rules table (ADR-0014); static, no I/O. */
  static getArtianRules(): ArtianRulesResponse {
    return ARTIAN_RULES
  }

  static getMonsters(): Promise<MonsterListItem[]> {
    return CatalogRepository.findMonsterList()
  }

  static getMonster(id: string): Promise<MonsterDetail | null> {
    return CatalogRepository.findMonsterDetail(id)
  }

  static getSkills(): Promise<SkillCatalogResponse> {
    return CatalogRepository.findSkillsAndBonuses()
  }

  /**
   * Projection for consumers that build their own in-memory index (currently
   * only Set Search) rather than the nested API DTOs above.
   */
  static getIndexProjection(): Promise<CatalogIndexProjection> {
    return CatalogRepository.findIndexProjection()
  }
}
