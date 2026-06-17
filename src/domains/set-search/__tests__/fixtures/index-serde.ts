import type { ArmorPiece, ArmorType, DecorationItem, GroupSkillMeta, SetSearchIndex, SetSkillMeta, SkillMeta } from '../../types'

/**
 * JSON-safe form of {@link SetSearchIndex}: the `Map` fields are stored as entry
 * arrays, and `allArmor` is dropped (it's rebuilt from `byType` on load).
 */
export interface SerializedIndex {
  version: string
  byType: Record<ArmorType, ArmorPiece[]>
  decorations: DecorationItem[]
  skills: [string, SkillMeta][]
  setSkills: [string, SetSkillMeta][]
  groupSkills: [string, GroupSkillMeta][]
}

export function serializeIndex(index: SetSearchIndex): SerializedIndex {
  return {
    version: index.version,
    byType: index.byType,
    decorations: index.decorations,
    skills: [...index.skills.entries()],
    setSkills: [...index.setSkills.entries()],
    groupSkills: [...index.groupSkills.entries()],
  }
}

export function deserializeIndex(data: SerializedIndex): SetSearchIndex {
  const byType = data.byType
  return {
    version: data.version,
    byType,
    allArmor: Object.values(byType).flat(),
    decorations: data.decorations,
    skills: new Map(data.skills),
    setSkills: new Map(data.setSkills),
    groupSkills: new Map(data.groupSkills),
  }
}
