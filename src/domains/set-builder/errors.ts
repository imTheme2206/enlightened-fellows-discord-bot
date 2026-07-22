/**
 * Stable, machine-readable Set Builder errors (design doc §Errors). Each code maps
 * to a fixed HTTP status and a default plain-text message; `details` carries the
 * offending position/slot so the frontend can point at the exact field. The API
 * layer serializes these into the documented `{ error: { code, message, details } }`
 * envelope — the domain never throws bare `Error`s for expected rejections.
 */

export type SetBuilderErrorCode =
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
  // Persistence / lifecycle (§Lifecycle and concurrency, §Ownership).
  | "BUILD_NOT_FOUND"
  | "NOT_OWNER"
  | "REVISION_CONFLICT"
  | "IDEMPOTENCY_KEY_REUSED"
  | "SAVED_BUILD_LIMIT_REACHED"
  | "SHARED_BUILD_LIMIT_REACHED"

const STATUS: Record<SetBuilderErrorCode, number> = {
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
  BUILD_NOT_FOUND: 404,
  NOT_OWNER: 403,
  REVISION_CONFLICT: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  SAVED_BUILD_LIMIT_REACHED: 409,
  SHARED_BUILD_LIMIT_REACHED: 409,
}

const DEFAULT_MESSAGE: Record<SetBuilderErrorCode, string> = {
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
