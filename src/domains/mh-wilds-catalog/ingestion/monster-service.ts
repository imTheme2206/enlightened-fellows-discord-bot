import { randomUUID } from "crypto"
import { count, eq } from "drizzle-orm"
import { db } from "../../../infra/db/client"
import { monster, monsterPart, monsterWeakness } from "../../../infra/db/schema"
import { reconcileMonsters, type MonsterRecord } from "./monsters"

/** Monsters written by one ingestion run (0/0 on a no-op scrape). */
export type MonsterIngestResult = {
  inserted: number
  updated: number
  unchanged: number
}

/**
 * Monster ingestion (ADR-0015). Runs in its own transaction, separate from
 * `CatalogIngestionService`, so an equipment conflict cannot block monsters
 * and a monster failure cannot block equipment.
 */
export abstract class MonsterIngestionService {
  static async isEmpty(): Promise<boolean> {
    const [{ value }] = await db.select({ value: count() }).from(monster)
    return value === 0
  }

  static async reconcileAndPersist(
    records: MonsterRecord[],
    now: Date = new Date(),
  ): Promise<MonsterIngestResult> {
    const existing = await db
      .select({
        id: monster.id,
        name: monster.name,
        contentHash: monster.contentHash,
      })
      .from(monster)
    const plan = reconcileMonsters(existing, records)
    if (plan.inserts.length === 0 && plan.updates.length === 0) {
      return { inserted: 0, updated: 0, unchanged: plan.unchanged }
    }

    await db.transaction(async (tx) => {
      const write = async (id: string, r: MonsterRecord) => {
        if (r.parts.length)
          await tx.insert(monsterPart).values(
            r.parts.map((p, position) => ({
              // Deterministic: a part keeps its id across replacements of its monster.
              id: `${id}:${p.upstreamId}`,
              monsterId: id,
              upstreamId: p.upstreamId,
              position,
              kind: p.kind,
              name: p.name,
              health: p.health,
              kinsectEssence: p.kinsectEssence,
              multipliers: p.multipliers,
            })),
          )
        if (r.weaknesses.length)
          await tx
            .insert(monsterWeakness)
            .values(
              r.weaknesses.map((w, position) => ({
                monsterId: id,
                position,
                ...w,
              })),
            )
      }
      const fields = (r: MonsterRecord) => ({
        gameId: r.gameId,
        kind: r.kind,
        species: r.species,
        description: r.description,
        baseHealth: r.baseHealth,
        size: r.size,
        contentHash: r.contentHash,
        fetchedAt: now,
      })

      for (const r of plan.inserts) {
        const id = randomUUID()
        await tx.insert(monster).values({ id, name: r.name, ...fields(r) })
        await write(id, r)
      }
      for (const { id, record } of plan.updates) {
        await tx.update(monster).set(fields(record)).where(eq(monster.id, id))
        await tx.delete(monsterPart).where(eq(monsterPart.monsterId, id))
        await tx
          .delete(monsterWeakness)
          .where(eq(monsterWeakness.monsterId, id))
        await write(id, record)
      }
    })

    return {
      inserted: plan.inserts.length,
      updated: plan.updates.length,
      unchanged: plan.unchanged,
    }
  }
}
