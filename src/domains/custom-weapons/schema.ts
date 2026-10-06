import { createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { customWeapon } from '../../infra/db/schema'
import { artianCustomizationRequestSchema } from '../mh-wilds-catalog/schema'

export const MAX_CUSTOM_WEAPONS_PER_USER = 50
export const MAX_CUSTOM_WEAPON_NAME_LENGTH = 100

/** Canonical response row, including owner for consistency with custom talismans. */
export const customWeaponSchema = createSelectSchema(customWeapon)
export type CustomWeaponDto = z.infer<typeof customWeaponSchema>
export const customWeaponsResponseSchema = z.array(customWeaponSchema)

export const createCustomWeaponSchema = z.object({
  name: z.string().trim().min(1).max(MAX_CUSTOM_WEAPON_NAME_LENGTH),
  weaponId: z.string().min(1),
  customization: artianCustomizationRequestSchema,
  setBonusId: z.string().min(1).nullable(),
  groupBonusId: z.string().min(1).nullable(),
})
export type CreateCustomWeaponInput = z.infer<typeof createCustomWeaponSchema>

export const customWeaponParamsSchema = z.object({ id: z.string().min(1) })
