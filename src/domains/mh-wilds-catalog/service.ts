import type { CatalogIndexProjection } from './projection'
import { CatalogRepository } from './repository'
import type { ArmorCatalogItem, DecorationCatalogItem, SkillCatalogResponse } from './schema'

/**
 * MH Wilds Catalog domain service (ADR-0009): the shared read boundary over
 * armor, decorations, skills, and set/group bonuses. Set Search and Set Builder
 * both consume catalog reads from here rather than owning competing repositories.
 */
export abstract class CatalogService {
  static getArmors(): Promise<ArmorCatalogItem[]> {
    return CatalogRepository.findArmorCatalog()
  }

  static getDecorations(): Promise<DecorationCatalogItem[]> {
    return CatalogRepository.findDecorationCatalog()
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
