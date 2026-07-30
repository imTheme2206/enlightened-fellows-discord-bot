/**
 * Catalog projection for consumers that need the fully-joined dataset shaped
 * for in-memory indexing (currently only `set-search/build-index.ts`), rather
 * than the nested API DTOs in `schema.ts`. Plain catalog-domain types only —
 * no Drizzle table types cross this seam.
 */
export interface CatalogSkillRow {
  name: string
  maxLevel: number
}

export interface CatalogBonusThresholdRow {
  bonusName: string
  kind: 'set' | 'group'
  piecesRequired: number
  effectName: string
  level: number
}

export interface CatalogDecorationGrantRow {
  decorationName: string
  slotSize: number
  skillName: string
  level: number
}

export interface CatalogArmorRow {
  name: string
  type: string
  rank: string
  rarity: number
  defense: number
  fireRes: number
  waterRes: number
  thunderRes: number
  iceRes: number
  dragonRes: number
  slots: number[]
}

export interface CatalogArmorSkillRow {
  armorName: string
  skillName: string
  level: number
}

export interface CatalogArmorBonusRow {
  armorName: string
  bonusName: string
  kind: 'set' | 'group'
}

/** The full joined dataset a set-search-style in-memory index is built from. */
export interface CatalogIndexProjection {
  skills: CatalogSkillRow[]
  bonusThresholds: CatalogBonusThresholdRow[]
  decorationGrants: CatalogDecorationGrantRow[]
  armor: CatalogArmorRow[]
  armorSkills: CatalogArmorSkillRow[]
  armorBonuses: CatalogArmorBonusRow[]
}
