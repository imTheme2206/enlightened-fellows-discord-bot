import { and, asc, count, desc, eq, gt, inArray, lt, or } from "drizzle-orm"
import { db } from "../../infra/db/client"
import {
  customTalisman,
  savedBuild,
  type NewSavedBuild,
  type SavedBuild,
} from "../../infra/db/schema"

/**
 * All Saved Build DB access (design doc §Persistence). Guarded mutations embed the
 * optimistic-concurrency `revision` check in their WHERE clause and return the
 * updated row (or nothing on a mismatch/ownership miss), so the service classifies
 * the failure with a single follow-up read. The `composition` column is `unknown`
 * at the infra boundary; the service casts it to the domain `BuildSnapshot`.
 */
export type SharedCursor = { sharedAt: Date; id: string }

export abstract class SetBuilderRepository {
  static async insert(row: NewSavedBuild): Promise<SavedBuild> {
    const [inserted] = await db.insert(savedBuild).values(row).returning()
    return inserted
  }

  static async findById(id: string): Promise<SavedBuild | undefined> {
    const [row] = await db
      .select()
      .from(savedBuild)
      .where(eq(savedBuild.id, id))
      .limit(1)
    return row
  }

  static async findByOwnerIdempotency(
    userId: string,
    idempotencyKey: string,
  ): Promise<SavedBuild | undefined> {
    const [row] = await db
      .select()
      .from(savedBuild)
      .where(
        and(
          eq(savedBuild.userId, userId),
          eq(savedBuild.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1)
    return row
  }

  /** All of an owner's builds, ordered `updated_at DESC, id ASC` (design §Ownership). */
  static async findByOwner(userId: string): Promise<SavedBuild[]> {
    return db
      .select()
      .from(savedBuild)
      .where(eq(savedBuild.userId, userId))
      .orderBy(desc(savedBuild.updatedAt), asc(savedBuild.id))
  }

  /** Shared builds, `shared_at DESC, id ASC`, cursor-paginated (design §Ownership). */
  static async findShared(
    limit: number,
    cursor?: SharedCursor,
  ): Promise<SavedBuild[]> {
    const shared = eq(savedBuild.isShared, true)
    // Keyset: everything after (cursor.sharedAt, cursor.id) in `sharedAt DESC, id ASC` order.
    const where = cursor
      ? and(
          shared,
          or(
            lt(savedBuild.sharedAt, cursor.sharedAt),
            and(
              eq(savedBuild.sharedAt, cursor.sharedAt),
              gt(savedBuild.id, cursor.id),
            ),
          ),
        )
      : shared
    return db
      .select()
      .from(savedBuild)
      .where(where)
      .orderBy(desc(savedBuild.sharedAt), asc(savedBuild.id))
      .limit(limit)
  }

  static async countByOwner(userId: string): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(savedBuild)
      .where(eq(savedBuild.userId, userId))
    return row?.value ?? 0
  }

  static async countSharedByOwner(userId: string): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(savedBuild)
      .where(and(eq(savedBuild.userId, userId), eq(savedBuild.isShared, true)))
    return row?.value ?? 0
  }

  /** Guarded full replace (PUT). Returns the new row, or undefined on a revision/ownership miss. */
  static async replaceComposition(
    id: string,
    userId: string,
    expectedRevision: number,
    patch: {
      name: string
      description: string | null
      isShared: boolean
      sharedAt: Date | null
      composition: unknown
    },
  ): Promise<SavedBuild | undefined> {
    const [row] = await db
      .update(savedBuild)
      .set({ ...patch, revision: expectedRevision + 1, updatedAt: new Date() })
      .where(_guard(id, userId, expectedRevision))
      .returning()
    return row
  }

  /** Guarded metadata/sharing update (PATCH); composition is untouched. */
  static async updateMetadata(
    id: string,
    userId: string,
    expectedRevision: number,
    patch: {
      name: string
      description: string | null
      isShared: boolean
      sharedAt: Date | null
    },
  ): Promise<SavedBuild | undefined> {
    const [row] = await db
      .update(savedBuild)
      .set({ ...patch, revision: expectedRevision + 1, updatedAt: new Date() })
      .where(_guard(id, userId, expectedRevision))
      .returning()
    return row
  }

  static async deleteOwned(id: string, userId: string): Promise<boolean> {
    const deleted = await db
      .delete(savedBuild)
      .where(and(eq(savedBuild.id, id), eq(savedBuild.userId, userId)))
      .returning({ id: savedBuild.id })
    return deleted.length > 0
  }

  /** Which of the given custom-talisman ids still exist (existence only — no owner scope, no leak). */
  static async findExistingTalismanIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set()
    const rows = await db
      .select({ id: customTalisman.id })
      .from(customTalisman)
      .where(inArray(customTalisman.id, ids))
    return new Set(rows.map((r) => r.id))
  }
}

function _guard(id: string, userId: string, expectedRevision: number) {
  return and(
    eq(savedBuild.id, id),
    eq(savedBuild.userId, userId),
    eq(savedBuild.revision, expectedRevision),
  )
}
