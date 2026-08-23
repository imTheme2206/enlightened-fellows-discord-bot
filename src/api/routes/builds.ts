import { Elysia, ValidationError } from "elysia"
import { z } from "zod"
import { SetBuilderError } from "../../domains/set-builder/errors"
import type { SharedCursor } from "../../domains/set-builder/repository"
import {
  buildParamsSchema,
  buildResponseSchema,
  buildSummarySchema,
  importBuildRequestSchema,
  patchBuildRequestSchema,
  revisionQuerySchema,
  saveBuildRequestSchema,
  sharedBuildListResponseSchema,
  sharedListQuerySchema,
} from "../../domains/set-builder/schema"
import { SetBuilderService } from "../../domains/set-builder/service"
import { verifyIdentity } from "../middleware/user-auth-guard"

/**
 * `/api/mh-wilds/builds` — Set Builder Saved Build API (design doc §HTTP surface).
 * Access is mixed, so the surface is split into two Elysia instances that mount
 * side by side under the public `/api/mh-wilds` group:
 *
 *   - `buildsPublicRoutes` — anonymous UUID reads and the shared listing;
 *   - `buildsOwnerRoutes` — everything an owner mutates, gated by a Supabase JWT
 *     (docs/adr/0003, 0004), independent of the admin `authGuard`.
 *
 * Domain rejections surface as `SetBuilderError`, whose stable code + HTTP status
 * are mapped by `domainErrorResponse`; malformed request schemas become `400`.
 */

/**
 * Maps thrown domain/validation errors onto the documented HTTP envelope. Called
 * from an inlined `.error()` arrow so Elysia infers the context; this helper takes
 * the destructured primitives to stay reusable across both route instances.
 *
 * Elysia 2.0 dropped the `code` discriminator from the error context, so schema
 * rejections are now identified by the exported `ValidationError` class instead
 * of the old `code === 'VALIDATION'` string.
 */
function domainErrorResponse(
  error: unknown,
  set: { status?: number | string },
) {
  if (error instanceof SetBuilderError) {
    set.status = error.status
    return error.toResponse()
  }
  if (error instanceof ValidationError) {
    set.status = 400
    return {
      error: { code: "BAD_REQUEST", message: "The request is malformed." },
    }
  }
  // Anything else is unexpected — let Elysia produce its default 500.
  return undefined
}

const IDEMPOTENCY_HEADER = "idempotency-key"

// ── public: anonymous UUID reads + shared listing ────────────────────────────

export const buildsPublicRoutes = new Elysia({ tags: ["mh-wilds"] })
  .error(({ error, set }) => domainErrorResponse(error, set))
  .get(
    "/builds/shared",
    { query: sharedListQuerySchema, response: sharedBuildListResponseSchema },
    async ({ query }) => {
      const cursor = query.cursor ? decodeCursor(query.cursor) : undefined
      const items = await SetBuilderService.listShared(query.limit, cursor)
      const nextCursor =
        items.length === query.limit
          ? encodeCursor(items[items.length - 1])
          : null
      return { items, nextCursor }
    },
  )
  .get(
    "/builds/:id",
    {
      params: buildParamsSchema,
      response: buildResponseSchema,
    },
    ({ params }) => SetBuilderService.get(params.id),
  )

// ── owner: JWT-gated create / list / mutate ──────────────────────────────────

export const buildsOwnerRoutes = new Elysia({ tags: ["mh-wilds"] })
  .error(({ error, set }) => domainErrorResponse(error, set))
  .derive(async ({ request, status }) => {
    const identity = await verifyIdentity(request.headers.get("authorization"))
    if (!identity)
      return status(401, {
        error: { code: "UNAUTHORIZED", message: "Authentication is required." },
      })
    return {
      discordId: identity.discordId,
      owner: {
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl,
      },
    }
  })
  .get(
    "/builds",
    { response: z.array(buildSummarySchema) },
    ({ discordId }) => SetBuilderService.listOwned(discordId),
  )
  .post(
    "/builds",
    { body: saveBuildRequestSchema, response: { 200: buildResponseSchema } },
    ({ discordId, owner, body, request }) => {
      const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER)
      if (
        !idempotencyKey ||
        !z.string().uuid().safeParse(idempotencyKey).success
      ) {
        throw new SetBuilderError("IDEMPOTENCY_KEY_REQUIRED")
      }
      return SetBuilderService.create(discordId, body, idempotencyKey, owner)
    },
  )
  .post(
    "/builds/import",
    { body: importBuildRequestSchema, response: { 200: buildResponseSchema } },
    ({ discordId, owner, body, request }) => {
      const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER)
      if (
        !idempotencyKey ||
        !z.string().uuid().safeParse(idempotencyKey).success
      ) {
        throw new SetBuilderError("IDEMPOTENCY_KEY_REQUIRED")
      }
      return SetBuilderService.importFromOptimizer(
        discordId,
        body,
        owner,
        idempotencyKey,
      )
    },
  )
  .put(
    "/builds/:id",
    {
      params: buildParamsSchema,
      query: revisionQuerySchema,
      body: saveBuildRequestSchema,
      response: { 200: buildResponseSchema },
    },
    ({ discordId, owner, params, body, query }) =>
      SetBuilderService.replace(
        discordId,
        params.id,
        body,
        query.revision,
        owner,
      ),
  )
  .patch(
    "/builds/:id",
    {
      params: buildParamsSchema,
      query: revisionQuerySchema,
      body: patchBuildRequestSchema,
      response: { 200: buildResponseSchema },
    },
    ({ discordId, owner, params, body, query }) =>
      SetBuilderService.updateMetadata(
        discordId,
        params.id,
        body,
        query.revision,
        owner,
      ),
  )
  .delete(
    "/builds/:id",
    { params: buildParamsSchema },
    async ({ discordId, params }) => {
      await SetBuilderService.remove(discordId, params.id)
      return { ok: true }
    },
  )

// ── cursor codec ─────────────────────────────────────────────────────────────

/** Opaque cursor = base64url(`<sharedAt ISO>|<id>`); shared builds always have a sharedAt. */
function encodeCursor(summary: {
  sharedAt: string | null
  id: string
}): string {
  return Buffer.from(`${summary.sharedAt ?? ""}|${summary.id}`).toString(
    "base64url",
  )
}

function decodeCursor(cursor: string): SharedCursor | undefined {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8")
  const sep = decoded.indexOf("|")
  if (sep < 0) return undefined
  const sharedAt = new Date(decoded.slice(0, sep))
  const id = decoded.slice(sep + 1)
  if (Number.isNaN(sharedAt.getTime()) || !id) return undefined
  return { sharedAt, id }
}
