import { createHash } from "crypto"
import { randomUUID } from "crypto"
import type { SavedBuild } from "../../infra/db/schema"
import { CatalogService } from "../mh-wilds-catalog/service"
import type { SkillCatalogResponse } from "../mh-wilds-catalog/schema"
import { TalismanRepository } from "../talismans/repository"
import { buildCatalogView, type CatalogView } from "./catalog-view"
import { SetBuilderError } from "./errors"
import { SetBuilderRepository, type SharedCursor } from "./repository"
import {
  MAX_SAVED_BUILDS_PER_USER,
  MAX_SHARED_BUILDS_PER_USER,
  type BuildResponse,
  type BuildSnapshot,
  type BuildSummary,
  type CompositionRequest,
  type PatchBuildRequest,
  type SaveBuildRequest,
} from "./schema"
import { buildSnapshot } from "./snapshot"
import { deriveStaleness, type StalenessCatalog } from "./staleness"
import { validateSaveComposition } from "./validation"

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = "23505"

/**
 * Set Builder domain service (design doc §Save request / §Lifecycle). It owns
 * idempotent creation, optimistic-concurrency mutation, per-owner limits, sharing
 * transitions, and staleness derivation. Validation and snapshot construction are
 * delegated to their pure modules; catalog + owner-talisman reads come through the
 * catalog and talisman domains (never a second repository here).
 */
export abstract class SetBuilderService {
  static async create(
    userId: string,
    request: SaveBuildRequest,
    idempotencyKey: string,
  ): Promise<BuildResponse> {
    const payloadHash = hashPayload(request)

    const prior = await SetBuilderRepository.findByOwnerIdempotency(
      userId,
      idempotencyKey,
    )
    if (prior) return this.resolveIdempotent(prior, payloadHash)

    const view = await this.loadView(userId, request.composition)
    validateSaveComposition(request, view)
    const snapshot = buildSnapshot(request, view)

    await this.assertWithinSaveLimit(userId)
    if (request.isShared) await this.assertWithinShareLimit(userId, 0)

    const now = new Date()
    try {
      const inserted = await SetBuilderRepository.insert({
        id: randomUUID(),
        userId,
        name: request.name,
        description: request.description ?? null,
        isShared: request.isShared,
        sharedAt: request.isShared ? now : null,
        revision: 1,
        idempotencyKey,
        idempotencyPayloadHash: payloadHash,
        composition: snapshot,
      })
      // Freshly validated against the current catalog ⇒ never stale.
      return toResponse(inserted, false)
    } catch (err) {
      // Concurrent create with the same (userId, idempotencyKey) — resolve as a retry/reuse.
      if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
        const raced = await SetBuilderRepository.findByOwnerIdempotency(
          userId,
          idempotencyKey,
        )
        if (raced) return this.resolveIdempotent(raced, payloadHash)
      }
      throw err
    }
  }

  static async get(id: string): Promise<BuildResponse> {
    const row = await SetBuilderRepository.findById(id)
    if (!row) throw new SetBuilderError("BUILD_NOT_FOUND", { id })
    const [withStale] = await this.withStaleness([row])
    return withStale
  }

  static async listOwned(userId: string): Promise<BuildSummary[]> {
    const rows = await SetBuilderRepository.findByOwner(userId)
    const responses = await this.withStaleness(rows)
    return responses.map(toSummary)
  }

  static async listShared(
    limit: number,
    cursor?: SharedCursor,
  ): Promise<BuildSummary[]> {
    const rows = await SetBuilderRepository.findShared(limit, cursor)
    const responses = await this.withStaleness(rows)
    return responses.map(toSummary)
  }

  static async replace(
    userId: string,
    id: string,
    request: SaveBuildRequest,
    expectedRevision: number,
  ): Promise<BuildResponse> {
    const existing = await this.loadOwnedAtRevision(
      userId,
      id,
      expectedRevision,
    )

    const view = await this.loadView(userId, request.composition)
    validateSaveComposition(request, view)
    const snapshot = buildSnapshot(request, view)

    const sharing = await this.resolveSharing(
      userId,
      existing,
      request.isShared,
    )

    const updated = await SetBuilderRepository.replaceComposition(
      id,
      userId,
      expectedRevision,
      {
        name: request.name,
        description: request.description ?? null,
        isShared: sharing.isShared,
        sharedAt: sharing.sharedAt,
        composition: snapshot,
      },
    )
    if (!updated) await this.throwMutationFailure(userId, id, expectedRevision)
    // Freshly revalidated against the current catalog ⇒ never stale.
    return toResponse(updated!, false)
  }

  static async updateMetadata(
    userId: string,
    id: string,
    patch: PatchBuildRequest,
    expectedRevision: number,
  ): Promise<BuildResponse> {
    const existing = await this.loadOwnedAtRevision(
      userId,
      id,
      expectedRevision,
    )

    const requestedShared = patch.isShared ?? existing.isShared
    const sharing = await this.resolveSharing(userId, existing, requestedShared)

    const updated = await SetBuilderRepository.updateMetadata(
      id,
      userId,
      expectedRevision,
      {
        name: patch.name ?? existing.name,
        description:
          patch.description !== undefined
            ? patch.description
            : existing.description,
        isShared: sharing.isShared,
        sharedAt: sharing.sharedAt,
      },
    )
    if (!updated) await this.throwMutationFailure(userId, id, expectedRevision)
    // Composition is unchanged by PATCH, so it may still be stale.
    const [withStale] = await this.withStaleness([updated!])
    return withStale
  }

  static async remove(userId: string, id: string): Promise<void> {
    const deleted = await SetBuilderRepository.deleteOwned(id, userId)
    if (deleted) return
    // Distinguish a missing build from one owned by someone else.
    const row = await SetBuilderRepository.findById(id)
    if (!row) throw new SetBuilderError("BUILD_NOT_FOUND", { id })
    throw new SetBuilderError("NOT_OWNER", { id })
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private static resolveIdempotent(
    existing: SavedBuild,
    payloadHash: string,
  ): Promise<BuildResponse> {
    if (existing.idempotencyPayloadHash !== payloadHash) {
      throw new SetBuilderError("IDEMPOTENCY_KEY_REUSED", { id: existing.id })
    }
    // A true retry returns the original build, computed exactly like any read.
    return this.get(existing.id)
  }

  /** Builds the id-keyed catalog view, resolving the owner's talisman only when referenced. */
  private static async loadView(
    userId: string,
    composition: CompositionRequest,
  ): Promise<CatalogView> {
    const [armors, decorations, skills] = await Promise.all([
      CatalogService.getArmors(),
      CatalogService.getDecorations(),
      CatalogService.getSkills(),
    ])

    const talisman = composition.talisman
    const customTalisman =
      talisman?.source === "custom"
        ? ((await TalismanRepository.findOwned(userId, talisman.talismanId)) ??
          null)
        : null

    return buildCatalogView({ armors, decorations, skills, customTalisman })
  }

  private static async loadOwnedAtRevision(
    userId: string,
    id: string,
    expectedRevision: number,
  ): Promise<SavedBuild> {
    const existing = await SetBuilderRepository.findById(id)
    if (!existing) throw new SetBuilderError("BUILD_NOT_FOUND", { id })
    if (existing.userId !== userId)
      throw new SetBuilderError("NOT_OWNER", { id })
    if (existing.revision !== expectedRevision) {
      throw new SetBuilderError("REVISION_CONFLICT", {
        id,
        expected: expectedRevision,
        actual: existing.revision,
      })
    }
    return existing
  }

  /** Reclassifies a guarded-update miss after the pre-read passed (lost a concurrent race). */
  private static async throwMutationFailure(
    userId: string,
    id: string,
    expectedRevision: number,
  ): Promise<never> {
    const row = await SetBuilderRepository.findById(id)
    if (!row) throw new SetBuilderError("BUILD_NOT_FOUND", { id })
    if (row.userId !== userId) throw new SetBuilderError("NOT_OWNER", { id })
    throw new SetBuilderError("REVISION_CONFLICT", {
      id,
      expected: expectedRevision,
      actual: row.revision,
    })
  }

  /**
   * Resolves the sharing state + `shared_at` for a mutation. Editing a shared build
   * does not move it; sharing (re)assigns `shared_at`; unsharing clears it. A
   * transition into shared is limit-checked, excluding this build's current state.
   */
  private static async resolveSharing(
    userId: string,
    existing: SavedBuild,
    requestedShared: boolean,
  ): Promise<{ isShared: boolean; sharedAt: Date | null }> {
    if (requestedShared === existing.isShared) {
      return { isShared: existing.isShared, sharedAt: existing.sharedAt }
    }
    if (requestedShared) {
      await this.assertWithinShareLimit(userId, existing.isShared ? 1 : 0)
      return { isShared: true, sharedAt: new Date() }
    }
    return { isShared: false, sharedAt: null }
  }

  private static async assertWithinSaveLimit(userId: string): Promise<void> {
    const saved = await SetBuilderRepository.countByOwner(userId)
    if (saved >= MAX_SAVED_BUILDS_PER_USER)
      throw new SetBuilderError("SAVED_BUILD_LIMIT_REACHED", {
        limit: MAX_SAVED_BUILDS_PER_USER,
      })
  }

  /** `selfCounts` = 1 when this build already counts toward the shared total, else 0. */
  private static async assertWithinShareLimit(
    userId: string,
    selfCounts: number,
  ): Promise<void> {
    const shared = await SetBuilderRepository.countSharedByOwner(userId)
    if (shared - selfCounts >= MAX_SHARED_BUILDS_PER_USER) {
      throw new SetBuilderError("SHARED_BUILD_LIMIT_REACHED", {
        limit: MAX_SHARED_BUILDS_PER_USER,
      })
    }
  }

  /** Attaches computed staleness to rows using one shared catalog + talisman-existence read. */
  private static async withStaleness(
    rows: SavedBuild[],
  ): Promise<BuildResponse[]> {
    if (rows.length === 0) return []

    const snapshots = rows.map((r) => r.composition as BuildSnapshot)
    const talismanIds = collectCustomTalismanIds(snapshots)

    const [armors, decorations, skills, existingTalismanIds] =
      await Promise.all([
        CatalogService.getArmors(),
        CatalogService.getDecorations(),
        CatalogService.getSkills(),
        SetBuilderRepository.findExistingTalismanIds(talismanIds),
      ])

    const catalog = buildStalenessCatalog(
      armors,
      decorations,
      skills,
      existingTalismanIds,
    )
    return rows.map((row, i) =>
      toResponse(row, deriveStaleness(snapshots[i], catalog)),
    )
  }
}

// ── pure helpers ───────────────────────────────────────────────────────────────

/** Stable hash of the create payload so a retry (same content) is told apart from key reuse. */
export function hashPayload(request: SaveBuildRequest): string {
  const canonical = {
    name: request.name,
    description: request.description ?? null,
    isShared: request.isShared,
    composition: request.composition,
  }
  return createHash("sha256").update(stableStringify(canonical)).digest("hex")
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`
}

function collectCustomTalismanIds(snapshots: BuildSnapshot[]): string[] {
  const ids = new Set<string>()
  for (const s of snapshots) {
    const t = s.positions.talisman
    if (t?.source === "custom") ids.add(t.talismanId)
  }
  return [...ids]
}

function buildStalenessCatalog(
  armors: Awaited<ReturnType<typeof CatalogService.getArmors>>,
  decorations: Awaited<ReturnType<typeof CatalogService.getDecorations>>,
  skills: SkillCatalogResponse,
  existingCustomTalismanIds: Set<string>,
): StalenessCatalog {
  return {
    armorsById: new Map(armors.map((a) => [a.id, a])),
    decorationsById: new Map(decorations.map((d) => [d.id, d])),
    skillMaxByName: new Map(skills.skills.map((s) => [s.name, s.maxLevel])),
    bonusesByName: new Map(
      skills.bonuses.map((b) => [
        b.name,
        { kind: b.kind, thresholds: b.thresholds },
      ]),
    ),
    existingCustomTalismanIds,
  }
}

function toResponse(row: SavedBuild, isStale: boolean): BuildResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    isShared: row.isShared,
    sharedAt: row.sharedAt ? row.sharedAt.toISOString() : null,
    revision: row.revision,
    isStale,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    composition: row.composition as BuildSnapshot,
  }
}

function toSummary(response: BuildResponse): BuildSummary {
  return {
    id: response.id,
    name: response.name,
    description: response.description,
    isShared: response.isShared,
    sharedAt: response.sharedAt,
    revision: response.revision,
    isStale: response.isStale,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  }
}
