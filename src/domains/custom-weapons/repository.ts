import { randomUUID } from 'crypto'
import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '../../infra/db/client'
import { customWeapon, type CustomWeapon, type SavedWeaponCustomization } from '../../infra/db/schema'

export abstract class CustomWeaponRepository {
  static async findByUser(userId: string): Promise<CustomWeapon[]> {
    return db.query.customWeapon.findMany({
      where: (row, { eq }) => eq(row.userId, userId),
      orderBy: (row) => [desc(row.createdAt)],
    })
  }

  static async countByUser(userId: string): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(customWeapon)
      .where(eq(customWeapon.userId, userId))
    return row?.value ?? 0
  }

  static async insert(
    userId: string,
    input: {
      name: string
      weaponId: string
      customization: SavedWeaponCustomization
      setBonusId: string | null
      groupBonusId: string | null
    },
  ): Promise<CustomWeapon> {
    const [row] = await db
      .insert(customWeapon)
      .values({ id: randomUUID(), userId, ...input })
      .returning()
    return row
  }

  static async deleteOwned(userId: string, id: string): Promise<boolean> {
    const deleted = await db
      .delete(customWeapon)
      .where(and(eq(customWeapon.id, id), eq(customWeapon.userId, userId)))
      .returning({ id: customWeapon.id })
    return deleted.length > 0
  }
}
