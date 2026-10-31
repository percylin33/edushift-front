import { test, expect } from '@playwright/test';
import { TENANT_ADMIN, PARENT } from '../../fixtures/test-users';
import { apiContextFor, safeApiContextFor } from '../../utils/api-helpers';

/**
 * Payments school plan — emit + soft-gate smoke (API-level).
 *
 * Manual UI path (admin):
 *   1. Login TENANT_ADMIN → /payments/admin/emit
 *   2. Emit one invoice (student UUID + period + amount)
 *   3. Parent submits voucher on /payments/invoices/:uuid
 *   4. Admin reconciles on /payments/admin/invoices
 *
 * Canonical path requested by the school-plan FE task also lives at
 * {@code e2e/payments-emit-voucher.spec.ts} (pointer). Playwright
 * {@code testDir} is {@code e2e/tests}, so this file is the executable one.
 */
const ADMIN_PAY = '/api/v1/admin/payments';
const PAY = '/api/v1/payments';

test.describe('Payments school — emit + access-status', () => {
  test('ADMIN can hit emit/bulk/policy/subscriptions endpoints (non-5xx)', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const base = process.env['API_URL'] ?? 'http://localhost:8080';
    try {
      const policy = await api.get(`${base}${ADMIN_PAY}/policy`);
      expect(policy.status()).toBeLessThan(500);

      const subs = await api.get(`${base}${ADMIN_PAY}/subscriptions?page=0&size=5`);
      expect(subs.status()).toBeLessThan(500);

      const aging = await api.get(`${base}${ADMIN_PAY}/reports/aging`);
      expect(aging.status()).toBeLessThan(500);

      const bulk = await api.post(`${base}${ADMIN_PAY}/invoices/bulk`, {
        data: {
          allEnrolled: false,
          periodLabel: 'e2e-dry',
          dryRun: true,
        },
      });
      expect(bulk.status()).toBeLessThan(500);
    } finally {
      await api.dispose();
    }
  });

  test('PARENT access-status returns lmsRestricted boolean', async () => {
    const ctx = await safeApiContextFor({ user: PARENT });
    if (!ctx.api) {
      test.skip(true, ctx.reason);
      return;
    }
    const base = process.env['API_URL'] ?? 'http://localhost:8080';
    try {
      const res = await ctx.api.get(`${base}${PAY}/access-status`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      const payload = body?.data ?? body;
      expect(typeof payload.lmsRestricted).toBe('boolean');
    } finally {
      await ctx.api.dispose();
    }
  });
});
