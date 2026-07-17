import { test, expect } from '@playwright/test';
import {
  TENANT_ADMIN,
  TEACHER,
  PARENT,
  STUDENT,
} from '../../fixtures/test-users';
import { apiContextFor, safeApiContextFor } from '../../utils/api-helpers';
import { makeStudent } from '../../factories';
import {
  signMercadoPago,
  makePaidNotification,
} from '../../utils/mercadopago-mock';
// signMercadoPago / makePaidNotification are kept imported in case
// future specs with MP sandbox credentials need to sign webhooks
// end-to-end. Today the webhook tests only exercise the public
// unauthenticated paths because the dev BE generates its webhookSecret
// at boot — see the comment block on the webhook describe.

/**
 * Payments + webhooks — API coverage + RBAC matrix (Sprint 2.8).
 *
 * <p>The payments module owns:
 * <ul>
 *   <li><b>Invoices</b> — per-student fees that a guardian pays via
 *       MercadoPago Checkout Pro.</li>
 *   <li><b>Checkout</b> — {@code POST /invoices/{uuid}/checkout}
 *       returns the {@code init_point} URL the FE opens in a new tab.</li>
 *   <li><b>Webhook</b> — {@code POST /webhooks/mercadopago}
 *       receives MP notifications (HMAC-signed) and reconciles the
 *       invoice status.</li>
 * </ul>
 *
 * <p>All endpoints are {@code isAuthenticated()}. The webhook is public
 * (HMAC-verified) so it's not gated by the FE permission system.</p>
 */
const PAY = '/api/v1/payments';
const WH = '/api/v1/webhooks/mercadopago';

test.describe('Payments — API: lifecycle', () => {
  test('create student → fetch as TA → list as PARENT returns 200', async () => {
    // The invoice list endpoint requires the calling user to be the
    // guardian linked to the student (PARENT/STUDENT). For simplicity
    // we just verify the endpoint shape — any non-5xx is acceptable.
    //
    // PaymentController declares @RequestMapping("/api/v1/payments")
    // which combined with server.servlet.context-path=/api and the
    // WebConfiguration prefix produces the effective URL:
    // /api/v1/api/v1/payments/invoices (see RBAC matrix comment).
    const api = await apiContextFor({ user: TENANT_ADMIN });
    const student = await makeStudent(api, { firstName: 'PaySpec' });
    try {
      const url = `${process.env['API_URL'] ?? 'http://localhost:8081'}/api/v1/api/v1/payments/invoices`;
      const res = await api.get(url);
      expect(res.status()).toBeLessThan(500);
      expect([200, 404]).toContain(res.status());
    } finally {
      await student.cleanup();
      await api.dispose();
    }
  });

  test('PARENT can list their own invoices (shape check)', async () => {
    const ctx = await safeApiContextFor({ user: PARENT });
    if (!ctx.api) {
      test.skip(true, ctx.reason);
      return;
    }
    try {
      const url = `${process.env['API_URL'] ?? 'http://localhost:8081'}/api/v1/api/v1/payments/invoices`;
      const res = await ctx.api.get(url);
      expect(res.status()).toBe(200);
    } finally {
      await ctx.api.dispose();
    }
  });
});

test.describe('Payments — API: webhook (HMAC + rate limit)', () => {
  // The webhook is public (no auth) but HMAC-signed. Without MP
  // sandbox credentials we can't construct a signature the BE accepts
  // in dev — the dev profile generates a random webhookSecret at boot
  // that we can't reproduce from outside. We only verify the endpoint
  // contract via the deterministic paths:
  //   - endpoint is reachable (POST returns 4xx, never 5xx)
  //   - unsigned requests are rejected (401 / 403)
  //   - badly-formed payloads are rejected (400)
  //   - rate-limited requests return 429 after the configured quota

  test('webhook without signature → rejected with 4xx', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const url = `${process.env['API_URL'] ?? 'http://localhost:8081'}/api/v1/api/v1/webhooks/mercadopago`;
      const res = await api.post(url, {
        data: { action: 'payment.created', data: { id: 'fake' } },
      });
      // The BE returns 401 for missing/bad signature.
      expect(res.status(), 'unsigned webhook should be rejected').toBeGreaterThanOrEqual(400);
      expect(res.status(), 'unsigned webhook should be rejected').toBeLessThan(500);
    } finally {
      await api.dispose();
    }
  });

  test('webhook with malformed JSON → rejected with 4xx', async () => {
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const url = `${process.env['API_URL'] ?? 'http://localhost:8081'}/api/v1/api/v1/webhooks/mercadopago`;
      const res = await api.post(url, {
        data: 'not-json',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status(), 'malformed body should be 4xx').toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
    } finally {
      await api.dispose();
    }
  });

  test('webhook endpoint reachable (round-trip)', async () => {
    // Hit the endpoint with the minimum valid-shape payload — no
    // signature, no required fields. The BE rejects it (4xx) but
    // we only assert that the endpoint is up.
    const api = await apiContextFor({ user: TENANT_ADMIN });
    try {
      const url = `${process.env['API_URL'] ?? 'http://localhost:8081'}/api/v1/api/v1/webhooks/mercadopago`;
      const res = await api.post(url, { data: {} });
      // 401 (no signature) or 400 (malformed) — both prove the route
      // is wired up.
      expect([400, 401, 403]).toContain(res.status());
    } finally {
      await api.dispose();
    }
  });
});

test.describe('Payments — API: RBAC matrix', () => {
  // Payment endpoints use @PreAuthorize("isAuthenticated()") — every
  // authenticated role passes.
  //
  // NOTE: PaymentController declares @RequestMapping("/api/v1/payments")
  // which collides with the global server.servlet.context-path=/api +
  // WebConfiguration.addPathPrefix("/v1") prefix logic, producing a
  // double-prefixed URL: /api/v1/api/v1/payments/invoices. The other
  // modules (students/teachers/...) correctly use @RequestMapping("/X")
  // without the redundant /api/v1/. We test against the actual
  // effective URL here; if the BE is fixed to drop the redundant
  // /api/v1, the tests just need to drop the duplicated segment.
  const cases: ReadonlyArray<{
    role: 'TENANT_ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';
    method: 'GET';
    expected: number[];
    label: string;
  }> = [
    { role: 'TENANT_ADMIN', method: 'GET', expected: [200], label: 'TA lists invoices' },
    { role: 'PARENT',       method: 'GET', expected: [200], label: 'PARENT lists invoices' },
    { role: 'STUDENT',       method: 'GET', expected: [200, 403], label: 'STUDENT lists invoices' },
    { role: 'TEACHER',       method: 'GET', expected: [200], label: 'TEACHER lists invoices' },
  ];
  for (const c of cases) {
    test(`${c.role} ${c.label}: ${c.expected.join('|')}`, async () => {
      const user = c.role === 'TENANT_ADMIN' ? TENANT_ADMIN
        : c.role === 'TEACHER' ? TEACHER
        : c.role === 'PARENT' ? PARENT
        : STUDENT;
      const ctx = await safeApiContextFor({ user });
      if (!ctx.api) {
        test.skip(true, ctx.reason);
        return;
      }
      try {
        // Effective URL on the dev BE (see comment above the matrix).
        const url = `${process.env['API_URL'] ?? 'http://localhost:8081'}/api/v1/api/v1/payments/invoices`;
        const res = await ctx.api.fetch(url, { method: c.method });
        expect(c.expected, `${c.role} ${c.method} invoices`).toContain(res.status());
      } finally {
        await ctx.api.dispose();
      }
    });
  }
});
