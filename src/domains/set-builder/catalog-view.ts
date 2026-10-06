import type { CustomTalisman } from "../../infra/db/schema"
import type {
  ArmorCatalogItem,
  DecorationCatalogItem,
  SkillCatalogResponse,
  WeaponCatalogItem,
} from "../mh-wilds-catalog/schema"

type SkillCatalogEntry = SkillCatalogResponse["skills"][number]
type BonusCatalogEntry = SkillCatalogResponse["bonuses"][number]

/**
 * The backend-owned, id-keyed view of catalog + owner data that both Save
 * validation and snapshot construction read from. Building it from a single set
 * of catalog reads keeps validation and the snapshot consistent (a piece that
 * validated is the exact piece that gets snapshotted). It is a pure structure —
 * fetching the underlying data (catalog service, owner-scoped talisman) is the
 * service layer's job.
 *
 * `customTalisman` is populated only when a Save references `source: 'custom'` and
 * the talisman was resolved through the owner-scoped repository; a `null` here for
 * a custom reference means "not found or not owned".
 */
export type CatalogView = {
  armorsById: Map<string, ArmorCatalogItem>
  decorationsById: Map<string, DecorationCatalogItem>
  weaponsById: Map<string, WeaponCatalogItem>
  skillsById: Map<string, SkillCatalogEntry>
  bonusesById: Map<string, BonusCatalogEntry>
  customTalisman: CustomTalisman | null
}

export function buildCatalogView(input: {
  armors: ArmorCatalogItem[]
  decorations: DecorationCatalogItem[]
  /** Optional: callers load the (large) weapon catalog only when a weapon is referenced. */
  weapons?: WeaponCatalogItem[]
  skills: SkillCatalogResponse
  customTalisman: CustomTalisman | null
}): CatalogView {
  return {
    armorsById: new Map(input.armors.map((a) => [a.id, a])),
    decorationsById: new Map(input.decorations.map((d) => [d.id, d])),
    weaponsById: new Map((input.weapons ?? []).map((w) => [w.id, w])),
    skillsById: new Map(input.skills.skills.map((s) => [s.id, s])),
    bonusesById: new Map(input.skills.bonuses.map((b) => [b.id, b])),
    customTalisman: input.customTalisman,
  }
}
