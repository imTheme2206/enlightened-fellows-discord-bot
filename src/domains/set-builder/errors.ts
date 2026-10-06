/**
 * Stable, machine-readable Set Builder errors (design doc §Errors). Each code maps
 * to a fixed HTTP status and a default plain-text message; `details` carries the
 * offending position/slot so the frontend can point at the exact field. The API
 * layer serializes these into the documented `{ error: { code, message, details } }`
 * envelope — the domain never throws bare `Error`s for expected rejections.
 */

export type SetBuilderErrorCode =
  // Request transport (§Save request).
  | "IDEMPOTENCY_KEY_REQUIRED"
  // Save validation (§Save validation) — well-formed request, rejected composition.
  | "ARMOR_NOT_FOUND"
  | "INVALID_ARMOR_POSITION"
  | "DECORATION_NOT_FOUND"
  | "DECORATION_SLOT_OUT_OF_RANGE"
  | "DECORATION_SLOT_DUPLICATE"
  | "DECORATION_SLOT_TYPE_MISMATCH"
  | "DECORATION_SLOT_TOO_SMALL"
  | "TALISMAN_NOT_FOUND"
  | "TALISMAN_NOT_OWNED"
  | "WEAPON_NOT_FOUND"
  | "WEAPON_BONUS_NOT_FOUND"
  | "WEAPON_BONUS_KIND_MISMATCH"
  | "WEAPON_BONUS_NOT_ALLOWED"
  | "WEAPON_BONUS_REQUIRED"
  | "WEAPON_CUSTOMIZATION_NOT_ALLOWED"
  | "WEAPON_CUSTOMIZATION_INVALID"
  // Persistence / lifecycle (§Lifecycle and concurrency, §Ownership).
  | "BUILD_NOT_FOUND"
  | "NOT_OWNER"
  | "REVISION_CONFLICT"
  | "IDEMPOTENCY_KEY_REUSED"
  | "SAVED_BUILD_LIMIT_REACHED"
  | "SHARED_BUILD_LIMIT_REACHED"

const STATUS: Record<SetBuilderErrorCode, number> = {
  IDEMPOTENCY_KEY_REQUIRED: 400,
  ARMOR_NOT_FOUND: 422,
  INVALID_ARMOR_POSITION: 422,
  DECORATION_NOT_FOUND: 422,
  DECORATION_SLOT_OUT_OF_RANGE: 422,
  DECORATION_SLOT_DUPLICATE: 422,
  DECORATION_SLOT_TYPE_MISMATCH: 422,
  DECORATION_SLOT_TOO_SMALL: 422,
  TALISMAN_NOT_FOUND: 422,
  // Ownership of a Custom Talisman cannot be confirmed → 403 (never leaks existence).
  TALISMAN_NOT_OWNED: 403,
  WEAPON_NOT_FOUND: 422,
  WEAPON_BONUS_NOT_FOUND: 422,
  WEAPON_BONUS_KIND_MISMATCH: 422,
  WEAPON_BONUS_NOT_ALLOWED: 422,
  WEAPON_BONUS_REQUIRED: 422,
  WEAPON_CUSTOMIZATION_NOT_ALLOWED: 422,
  WEAPON_CUSTOMIZATION_INVALID: 422,
  BUILD_NOT_FOUND: 404,
  NOT_OWNER: 403,
  REVISION_CONFLICT: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  SAVED_BUILD_LIMIT_REACHED: 409,
  SHARED_BUILD_LIMIT_REACHED: 409,
}

const DEFAULT_MESSAGE: Record<SetBuilderErrorCode, string> = {
  IDEMPOTENCY_KEY_REQUIRED: "A valid Idempotency-Key UUID header is required.",
  ARMOR_NOT_FOUND: "A selected armor piece no longer exists in the catalog.",
  INVALID_ARMOR_POSITION:
    "A selected armor piece does not belong to that body position.",
  DECORATION_NOT_FOUND:
    "A selected decoration no longer exists in the catalog.",
  DECORATION_SLOT_OUT_OF_RANGE:
    "A decoration is assigned to a slot that does not exist on this piece.",
  DECORATION_SLOT_DUPLICATE: "Two decorations are assigned to the same slot.",
  DECORATION_SLOT_TYPE_MISMATCH:
    "The selected decoration does not match this slot type.",
  DECORATION_SLOT_TOO_SMALL: "The selected decoration does not fit this slot.",
  TALISMAN_NOT_FOUND: "The selected talisman no longer exists in the catalog.",
  TALISMAN_NOT_OWNED: "The selected custom talisman is not available.",
  WEAPON_NOT_FOUND: "The selected weapon no longer exists in the catalog.",
  WEAPON_BONUS_NOT_FOUND:
    "A selected weapon bonus no longer exists in the catalog.",
  WEAPON_BONUS_KIND_MISMATCH:
    "A selected weapon bonus does not match its Set/Group slot.",
  WEAPON_BONUS_NOT_ALLOWED:
    "Only a Gogma Artian weapon carries a Set/Group Bonus.",
  WEAPON_BONUS_REQUIRED:
    "A Gogma Artian weapon always has both a Set Bonus and a Group Bonus.",
  WEAPON_CUSTOMIZATION_NOT_ALLOWED:
    "Only an Artian or Gogma Artian weapon can be customized.",
  WEAPON_CUSTOMIZATION_INVALID:
    "This Artian customization breaks the Artian rules.",
  BUILD_NOT_FOUND: "This build does not exist.",
  NOT_OWNER: "You do not own this build.",
  REVISION_CONFLICT: "This build was modified since you loaded it.",
  IDEMPOTENCY_KEY_REUSED:
    "This idempotency key was already used for a different build.",
  SAVED_BUILD_LIMIT_REACHED:
    "You have reached the maximum number of saved builds.",
  SHARED_BUILD_LIMIT_REACHED:
    "You have reached the maximum number of shared builds.",
}

export type SetBuilderErrorDetails = Record<string, unknown>

export class SetBuilderError extends Error {
  readonly code: SetBuilderErrorCode
  readonly status: number
  readonly details?: SetBuilderErrorDetails

  constructor(
    code: SetBuilderErrorCode,
    details?: SetBuilderErrorDetails,
    message?: string,
  ) {
    super(message ?? DEFAULT_MESSAGE[code])
    this.name = "SetBuilderError"
    this.code = code
    this.status = STATUS[code]
    this.details = details
  }

  /** The documented wire envelope: `{ error: { code, message, details } }`. */
  toResponse(): {
    error: {
      code: SetBuilderErrorCode
      message: string
      details?: SetBuilderErrorDetails
    }
  } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    }
  }
}
