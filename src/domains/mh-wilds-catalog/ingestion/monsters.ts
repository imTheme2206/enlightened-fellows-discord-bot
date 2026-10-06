import { createHash } from "crypto"
import type { MonsterMultipliers } from "../../../infra/db/schema"
import type { MhdbMonster } from "./mhdb-types"

/**
 * Monster ingestion shapes and the pure replace-on-change reconcile (ADR-0015).
 * Persistence lives in `monster-service.ts`; nothing here touches the database.
 */

export type MonsterPartRecord = {
  upstreamId: number
  kind: string
  name: string
  health: number | null
  kinsectEssence: string | null
  multipliers: MonsterMultipliers
}

export type MonsterWeaknessRecord = {
  kind: "element" | "status" | "effect"
  name: string
  level: number
  condition: string | null
}

export type MonsterRecord = {
  name: string
  gameId: number
  kind: "large" | "small"
  species: string
  description: string
  baseHealth: number
  size: Record<string, number>
  parts: MonsterPartRecord[]
  weaknesses: MonsterWeaknessRecord[]
  /** SHA-256 over the canonical content above; changes iff any ingested value changes. */
  contentHash: string
}

const MULTIPLIER_KEYS = [
  "slash",
  "blunt",
  "pierce",
  "fire",
  "water",
  "thunder",
  "ice",
  "dragon",
  "stun",
] as const

const hashMonster = (m: Omit<MonsterRecord, "contentHash">): string =>
  createHash("sha256").update(JSON.stringify(m)).digest("hex")

/**
 * Maps the upstream feed to ingestion records. Only large monsters are
 * catalog data. Key order is fixed throughout so the content hash is stable.
 */
export const mapMhdbMonsters = (list: MhdbMonster[]): MonsterRecord[] =>
  list
    .filter((m) => m.kind === "large")
    .map((m) => {
      const base = {
        name: m.name,
        gameId: m.gameId,
        kind: m.kind,
        species: m.species,
        description: m.description ?? "",
        baseHealth: m.baseHealth,
        size: Object.fromEntries(
          Object.entries(m.size ?? {}).sort(([a], [b]) => a.localeCompare(b)),
        ),
        parts: m.parts.map((p) => ({
          upstreamId: p.id,
          kind: p.kind,
          name: p.name,
          health: p.health ?? null,
          kinsectEssence: p.kinsectEssence ?? null,
          multipliers: Object.fromEntries(
            MULTIPLIER_KEYS.map((k) => [k, p.multipliers[k]]),
          ) as MonsterMultipliers,
        })),
        weaknesses: m.weaknesses.map((w) => ({
          kind: w.kind,
          name: (w.element ?? w.status ?? w.effect)!,
          level: w.level,
          condition: w.condition ?? null,
        })),
      }
      return { ...base, contentHash: hashMonster(base) }
    })

export type ExistingMonster = { id: string; name: string; contentHash: string }

export type MonsterPlan = {
  inserts: MonsterRecord[]
  /** Existing monsters whose content changed: replaced in place under the same id. */
  updates: Array<{ id: string; record: MonsterRecord }>
  unchanged: number
}

/**
 * Diffs the scrape against stored monsters by canonical name. Identical
 * content is a no-op (not even `fetchedAt` moves); changed content replaces
 * the monster (ADR-0015). Monsters absent from the scrape are retained.
 */
export const reconcileMonsters = (
  existing: ExistingMonster[],
  next: MonsterRecord[],
): MonsterPlan => {
  const byName = new Map(existing.map((e) => [e.name, e]))
  const plan: MonsterPlan = { inserts: [], updates: [], unchanged: 0 }
  for (const record of next) {
    const current = byName.get(record.name)
    if (!current) plan.inserts.push(record)
    else if (current.contentHash !== record.contentHash)
      plan.updates.push({ id: current.id, record })
    else plan.unchanged++
  }
  return plan
}
