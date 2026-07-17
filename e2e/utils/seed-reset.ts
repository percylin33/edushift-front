import { test, expect } from '@playwright/test';
import { apiContextFor } from './api-helpers';
import { TENANT_ADMIN } from '../fixtures/test-users';
import { CreatedEntity } from '../factories';

/**
 * Lifecycle helpers for parallel-safe cleanup of created entities.
 *
 * <p>The test factories ({@code e2e/factories/}) return
 * {@link CreatedEntity} handles with a {@link CreatedEntity.cleanup}
 * method. {@link collectCleanup} lets a spec register multiple handles
 * and dispose them all in LIFO order from a single `afterEach` block.</p>
 *
 * <h3>Usage</h3>
 *
 * <pre>{@code
 * let cleanup: CleanupRegistry;
 *
 * test.beforeEach(async () => {
 *   cleanup = collectCleanup();
 * });
 *
 * test.afterEach(async () => {
 *   await cleanup.runAll();
 * });
 *
 * test('something', async () => {
 *   const s = await makeStudent(api);
 *   cleanup.add(s);
 *   // ... no try/finally needed
 * });
 * }</pre>
 *
 * <p>Calling {@link CleanupRegistry.runAll} twice is safe (the inner
 * `cleanup` functions are best-effort and ignore 404s).</p>
 */
export class CleanupRegistry {
  private readonly handles: CreatedEntity[] = [];

  add<T>(handle: CreatedEntity<T>): CreatedEntity<T> {
    this.handles.push(handle as CreatedEntity);
    return handle;
  }

  async runAll(): Promise<void> {
    // LIFO so children are removed before parents (academic bundle etc.).
    for (let i = this.handles.length - 1; i >= 0; i--) {
      const h = this.handles[i];
      try {
        await h.cleanup();
      } catch (err) {
        console.warn('[cleanup] handle cleanup threw:', err);
      }
    }
    this.handles.length = 0;
  }
}

export function collectCleanup(): CleanupRegistry {
  return new CleanupRegistry();
}

/**
 * Helper test extension that auto-runs cleanup at the end of each test.
 *
 * <pre>{@code
 * const t = tenantScopedTest();
 * t('creates a student', async ({ api, cleanup }) => {
 *   const s = await makeStudent(api);
 *   cleanup.add(s);
 *   // ... no manual teardown
 * });
 * </pre>
 */
export function tenantScopedTest() {
  return test.extend<{ api: import('@playwright/test').APIRequestContext; cleanup: CleanupRegistry }>({
    api: async ({}, use) => {
      const ctx = await apiContextFor({ user: TENANT_ADMIN });
      await use(ctx);
      await ctx.dispose();
    },
    cleanup: async ({}, use) => {
      const reg = collectCleanup();
      await use(reg);
      await reg.runAll();
    },
  });
}

/**
 * Helper for sanity-checking that the BE is up before running a suite.
 * Use in {@code globalSetup} if you want to gate CI on BE availability.
 */
export async function expectBeUp(baseUrl: string = process.env['API_URL'] ?? 'http://localhost:8081'): Promise<void> {
  const { request } = await import('@playwright/test');
  const ctx = await request.newContext({ baseURL: baseUrl });
  try {
    const res = await ctx.get('/actuator/health');
    expect(res.ok(), `BE at ${baseUrl} is not up`).toBe(true);
  } finally {
    await ctx.dispose();
  }
}
