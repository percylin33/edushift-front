import { APIRequestContext } from '@playwright/test';

/**
 * Internal utilities for the test factories.
 *
 * <p>Every factory follows the same pattern:
 * (1) POST a creation payload via the BE,
 * (2) capture the public UUID of the resulting entity,
 * (3) return a {@link CreatedEntity} handle so the spec can `cleanup()`.</p>
 *
 * <p>Uniqueness within a parallel run is guaranteed by {@link seqId} —
 * a counter-based suffix appended to every name/document so two
 * parallel specs creating the same entity type never collide on
 * the BE's uniqueness constraints (which are mostly partial-unique
 * indexes, see {@code docs/qa/migrations-lessons.md}).</p>
 */

let counter = 0;

/**
 * Returns a unique-per-process suffix for use in entity names.
 * Format: `<prefix>-<time36>-<seq36>-<pid36>`. {@code Date.now()} gives
 * millisecond resolution (unique even across workers), {@code seq}
 * disambiguates calls within the same millisecond, {@code pid}
 * disambiguates across processes. The combined value is unique enough
 * to satisfy the BE's per-tenant unique constraints on
 * {@code documentNumber}, email, etc.
 */
export function seqId(prefix: string): string {
  counter = (counter + 1) & 0xffff;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${process.pid.toString(36)}`;
}

/**
 * Returns a unique-per-call 8-digit numeric suffix suitable for DNI-style
 * identity documents. The BE enforces
 * {@code uk_students_document_per_tenant}, so the value MUST be unique
 * across parallel runs.
 *
 * <p>Implementation: 8 hex chars from {@code crypto.randomUUID()} give
 * 16^8 = ~4 billion possible values. For a typical Playwright run
 * (< 10000 factory calls per spec) the collision probability is
 * astronomically low (~2.5e-6).</p>
 */
export function seqDocumentNumber(): string {
  const { randomBytes } = require('node:crypto') as typeof import('node:crypto');
  const hex = randomBytes(4).toString('hex'); // 8 hex chars
  // Convert to digits by taking the modulo. We keep the leading chars
  // looking like a DNI (start with 1-9, no zero-padding collapse).
  const num = parseInt(hex, 16) % 100_000_000;
  return num.toString().padStart(8, '1');
}

/**
 * Common handle returned by every factory. {@link cleanup} is idempotent
 * and safe to call from `afterEach` even if the entity was already
 * removed by the test body.
 */
export interface CreatedEntity<TPublic = string> {
  /** Public UUID surfaced to clients (always `publicUuid` in the BE responses). */
  publicUuid: TPublic;
  /** Free-form payload echo — useful when the test wants the slug/code/email. */
  payload: Record<string, unknown>;
  /**
   * DELETE the entity on the BE. Safe to call multiple times.
   * Uses an internal request context (does not borrow the test's auth
   * context) so a disposed parent context doesn't break cleanup.
   */
  cleanup: () => Promise<void>;
}

const BASE = process.env['API_URL'] ?? 'http://localhost:8081';

/**
 * Single-flight DELETE that swallows 404 and 204. Used by every
 * factory's {@link CreatedEntity.cleanup}.
 */
export async function bestEffortDelete(
  api: APIRequestContext,
  path: string,
): Promise<void> {
  try {
    const res = await api.delete(`${BASE}${path}`);
    if (res.status() >= 500) {
      // Surface but don't crash — cleanup runs in afterEach.
      console.warn(`[factory] cleanup ${path} returned ${res.status()}`);
    }
  } catch (err) {
    console.warn(`[factory] cleanup ${path} threw:`, err);
  }
}

/**
 * Asserts that a factory POST succeeded; logs the BE body on failure
 * so spec failures show the actual validation error from the BE
 * rather than an opaque `expect(res.ok()).toBe(true)`.
 */
export function expectCreatedOk(
  res: { ok(): boolean; status(): number; text(): Promise<string> },
  label: string,
): asserts res is { ok(): true; status(): number; text(): Promise<string> } {
  if (!res.ok()) {
    // Synchronous-looking async — actually fires-and-forgets the body
    // fetch. We don't await it so callers don't have to wrap every
    // call in `await`. The log is best-effort.
    res.text().then((t) =>
      console.error(`[factory] ${label} failed: ${res.status()} ${t}`),
    ).catch(() => undefined);
  }
}
