import { test, expect } from '@playwright/test';
import { apiContextFor } from '../utils/api-helpers';
import { TENANT_ADMIN } from '../fixtures/test-users';
import { tenantAdminStorageState } from '../auth.setup';

/**
 * Reports wizard end-to-end spec (Sprint 13 / FE-13.2).
 *
 * <p>Validates the report-job lifecycle through the same APIs the wizard
 * uses:</p>
 * <ol>
 *   <li>POST {@code /v1/reports} enqueues a job and returns its publicUuid.</li>
 *   <li>GET {@code /v1/reports/{uuid}} reports the current status
 *       (PENDING / RUNNING / DONE / FAILED / CANCELLED).</li>
 *   <li>GET {@code /v1/reports/{uuid}/download} returns 200 + bytes only
 *       when the job is DONE; otherwise 4xx with a {@code REPORT_NOT_READY}
 *       or {@code REPORT_OUTPUT_EXPIRED} code.</li>
 * </ol>
 *
 * <h3>Why not a UI flow</h3>
 * <p>The wizard component ({@code ReportsWizardPageComponent}) is
 * implemented but the route that loads it ({@code /reports/wizard}) is
 * not yet wired in {@code reports.routes.ts} — that wiring is a Sprint
 * 14 item. So this spec drives the wizard's <em>backend</em> contract
 * directly, which is what the wizard would do in a real flow. When the
 * route lands, this spec can be extended with {@code page.goto('/reports/wizard')}
 * + button clicks.</p>
 *
 * <h3>Status expectations</h3>
 * <p>The dev profile does not seed report-ready data (no students per
 * section, no attendance rows, etc.), so the job may stay PENDING or
 * move to FAILED depending on the report type. We assert <em>the
 * lifecycle contract is honored</em>, not that a specific type finishes
 * green — that's the backend's IT (BE-9.2) job.</p>
 */
test.describe('Reports — wizard backend lifecycle (FE-13.2)', () => {
  test.use({ storageState: tenantAdminStorageState });

  // ----------------------------------------------------------------- tests

  test('POST /v1/reports returns a job with publicUuid + status', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const idemKey = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const response = await api.post('/v1/reports', {
        data: {
          reportType: 'STUDENT_TRANSCRIPT',
          format: 'PDF',
          params: '{}',
          idemKey,
        },
      });
      expect(response.ok(), `expected 2xx, got ${response.status()}`)
          .toBe(true);
      const body = await response.json();
      expect(body).toHaveProperty('publicUuid');
      expect(typeof body.publicUuid).toBe('string');
      // Status must be one of the known lifecycle states.
      expect(['PENDING', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED'])
          .toContain(body.status);
    } finally {
      await api.dispose();
    }
  });

  test('GET /v1/reports/{uuid} is observable in <2s and status is one of the lifecycle states', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      // 1. Create a job
      const create = await api.post('/v1/reports', {
        data: {
          reportType: 'ATTENDANCE_SUMMARY',
          format: 'CSV',
          params: '{}',
          idemKey: `e2e-poll-${Date.now()}`,
        },
      });
      expect(create.ok()).toBe(true);
      const { publicUuid } = await create.json();
      expect(publicUuid).toBeTruthy();

      // 2. Poll the same wizard the FE would poll. The wizard polls on
      //    a 2s / 4s / 8s backoff (Sprint 10 / FE-10.4). We replicate
      //    the first 2 polls (2s + 4s) to assert the status is observable
      //    and the lifecycle is honored.
      const statuses: string[] = [];
      for (let i = 0; i < 2; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 2000 : 4000));
        const get = await api.get(`/v1/reports/${publicUuid}`);
        expect(get.ok(), `poll #${i + 1} must succeed (got ${get.status()})`)
            .toBe(true);
        const body = await get.json();
        expect(body.publicUuid).toBe(publicUuid);
        statuses.push(body.status);
        if (['DONE', 'FAILED', 'CANCELLED'].includes(body.status)) break;
      }
      // At least one poll must have returned a valid status. The first
      // poll can return the same status (PENDING) on a slow CI; we
      // assert we never received garbage.
      for (const s of statuses) {
        expect(['PENDING', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED'])
            .toContain(s);
      }
    } finally {
      await api.dispose();
    }
  });

  test('GET /v1/reports/{uuid}/download returns 4xx when the job is not DONE', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const create = await api.post('/v1/reports', {
        data: {
          reportType: 'PERIOD_CLOSE',
          format: 'PDF',
          params: '{}',
          idemKey: `e2e-dl-${Date.now()}`,
        },
      });
      expect(create.ok()).toBe(true);
      const { publicUuid } = await create.json();

      // Wait a short while so the job is at least picked up.
      await new Promise((r) => setTimeout(r, 1500));
      const get = await api.get(`/v1/reports/${publicUuid}`);
      const body = await get.json();

      if (body.status !== 'DONE') {
        // If not done, the download endpoint must return a 4xx with a
        // REPORT_NOT_READY code (or REPORT_OUTPUT_EXPIRED if the cache
        // had already been cleared — unlikely after 1.5s but possible).
        const download = await api.get(`/v1/reports/${publicUuid}/download`);
        expect([404, 409]).toContain(download.status());
        const errBody = await download.text();
        expect(errBody).toMatch(/REPORT_NOT_READY|REPORT_OUTPUT_EXPIRED/);
      }
      // If it IS done (fast path in dev), the download must return 2xx
      // with application/pdf (or whichever Content-Type the job chose).
      // We don't assert the body bytes — only the surface contract.
      else {
        const download = await api.get(`/v1/reports/${publicUuid}/download`);
        expect(download.ok(), `download must be 2xx for DONE job`)
            .toBe(true);
        const ct = download.headers()['content-type'] ?? '';
        expect(ct).toMatch(/pdf|csv|spreadsheetml/);
      }
    } finally {
      await api.dispose();
    }
  });

  test('idempotency key: same key in same tenant returns the SAME job publicUuid', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const idemKey = `e2e-idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const first = await api.post('/v1/reports', {
        data: { reportType: 'GRADE_BOOK', format: 'CSV', params: '{}', idemKey },
      });
      const second = await api.post('/v1/reports', {
        data: { reportType: 'GRADE_BOOK', format: 'CSV', params: '{}', idemKey },
      });

      expect(first.ok()).toBe(true);
      expect(second.ok()).toBe(true);
      const a = await first.json();
      const b = await second.json();
      expect(a.publicUuid, 'idempotency key must collapse to the same job')
          .toBe(b.publicUuid);
    } finally {
      await api.dispose();
    }
  });

  test('the /reports home page renders the H1 and the empty-state copy', async ({ page }) => {
    // The home page is the only piece of /reports the FE actually routes to.
    // Even when there are no reports, the empty-state copy must be visible
    // and the page must not throw.
    await page.goto('/reports');

    await expect(
      page.getByRole('heading', { name: /Reportes/i }),
    ).toBeVisible({ timeout: 10_000 });

    // The empty state — same copy as on a fresh tenant.
    await expect(
      page.getByText(/Sin reportes generados/i),
    ).toBeVisible({ timeout: 5_000 });
  });
});
