import { test, expect } from '@playwright/test';
import { request } from '@playwright/test';

/**
 * F6 — Rate-limit integration (QA plan 2026-07-02 /
 * docs/qa/10-rate-limit-spec-y-status.md).
 *
 * <p>Specs run against a live BE+FE. Each case exhausts a known bucket
 * from a fresh IP via {@code X-Forwarded-For} (the rate-limit interceptor
 * honors this header for the FIRST hop, so we can simulate unique
 * clients without actually rotating the source IP).</p>
 *
 * <p>Skipped by default; enable via {@code npx playwright test rate-limit}
 * once the BE is running locally.</p>
 */

const PREFIX = '/v1';

function freshIP(idx: number): string {
  // RFC 5737 documentation range — perfectly safe to fabricate.
  return `198.51.100.${(idx % 250) + 1}`;
}

test.describe('F6 — Rate limit (live BE required)', () => {
  test.skip(true, 'BE must be reachable at localhost:8080');

  test('auth/login: 10 OK, 11th gets 429', async () => {
    const ctx = await request.newContext({
      baseURL: 'http://localhost:8080/api',
    });
    try {
      for (let i = 0; i < 10; i++) {
        const r = await ctx.post(`${PREFIX}/auth/login`, {
          headers: { 'X-Forwarded-For': freshIP(i) },
          data: { email: 'no@no.no', password: 'wrong' },
        });
        expect(r.status(), `login #${i}`).toBeGreaterThanOrEqual(400);
        expect(r.headers()['x-ratelimit-limit']).toBe('10');
        expect(r.headers()['x-ratelimit-remaining']).toBe(String(10 - i - 1));
      }
      const blocked = await ctx.post(`${PREFIX}/auth/login`, {
        headers: { 'X-Forwarded-For': freshIP(0) },
        data: { email: 'no@no.no', password: 'wrong' },
      });
      expect(blocked.status()).toBe(429);
      expect(blocked.headers()['retry-after']).toBeDefined();
      const body = await blocked.json();
      expect(body.error?.code).toBe('RATE_LIMITED');
    } finally {
      await ctx.dispose();
    }
  });

  test('auth/forgot-password: 5/h, 6th gets 429', async () => {
    const ctx = await request.newContext({
      baseURL: 'http://localhost:8080/api',
    });
    try {
      const ip = freshIP(20);
      for (let i = 0; i < 5; i++) {
        const r = await ctx.post(`${PREFIX}/auth/forgot-password`, {
          headers: { 'X-Forwarded-For': ip },
          data: { email: 'no@no.no' },
        });
        // Public anti-enumeration: always 200.
        expect(r.status()).toBe(200);
      }
      const blocked = await ctx.post(`${PREFIX}/auth/forgot-password`, {
        headers: { 'X-Forwarded-For': ip },
        data: { email: 'no@no.no' },
      });
      expect(blocked.status()).toBe(429);
    } finally {
      await ctx.dispose();
    }
  });

  test('tenants/register: 5/h, 6th gets 429 (DEBT-TEN-6)', async () => {
    const ctx = await request.newContext({
      baseURL: 'http://localhost:8080/api',
    });
    try {
      const ip = freshIP(40);
      const payload = {
        tenantName: 'X',
        tenantSlug: 'x',
        adminEmail: 'a@a.a',
        adminPassword: 'P4ssword!',
        adminFirstName: 'A',
        adminLastName: 'A',
      };
      for (let i = 0; i < 5; i++) {
        await ctx.post(`${PREFIX}/tenants/register`, {
          headers: { 'X-Forwarded-For': ip },
          data: payload,
        });
      }
      const blocked = await ctx.post(`${PREFIX}/tenants/register`, {
        headers: { 'X-Forwarded-For': ip },
        data: payload,
      });
      expect(blocked.status()).toBe(429);
    } finally {
      await ctx.dispose();
    }
  });

  test('paths without a configured rule are NOT rate-limited', async () => {
    const ctx = await request.newContext({
      baseURL: 'http://localhost:8080/api',
    });
    try {
      // 50 calls to /v1/students (no rule) — all allowed.
      for (let i = 0; i < 50; i++) {
        const r = await ctx.get(`${PREFIX}/students?page=0&size=10`, {
          headers: { Authorization: 'Bearer fake', 'X-Forwarded-For': freshIP(i) },
        });
        // 401 is fine (no real auth) — but should never be 429.
        expect(r.status()).not.toBe(429);
      }
    } finally {
      await ctx.dispose();
    }
  });
});
