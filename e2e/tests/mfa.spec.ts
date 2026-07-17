import { test, expect } from '@playwright/test';
import { TENANT_ADMIN } from '../fixtures/test-users';
import { apiContextFor } from '../utils/api-helpers';

test.describe('MFA — enrollment + challenge flow', () => {
  test('enroll MFA via API, then complete challenge via UI with recovery code', async ({ page }) => {
    // --- Step 1: Login and enroll MFA via API ---
    const ctx = await apiContextFor({ user: TENANT_ADMIN });

    const startRes = await ctx.post('/api/v1/auth/mfa/enroll/start');
    expect(startRes.ok()).toBe(true);
    const startData = await startRes.json();
    const secret: string = startData.data.secret;

    const totpCode = await generateTotp(secret);
    const verifyRes = await ctx.post('/api/v1/auth/mfa/enroll/verify', {
      data: { secret, totpCode },
    });
    expect(verifyRes.ok()).toBe(true);
    const verifyData = await verifyRes.json();
    const recoveryCodes: string[] = verifyData.data.recoveryCodes;
    expect(recoveryCodes.length).toBeGreaterThanOrEqual(1);
    await ctx.dispose();

    // --- Step 2: Login via UI (will redirect to MFA challenge) ---
    await page.goto('/auth/login');
    await page.locator('#tenantSlug').fill(TENANT_ADMIN.tenantSlug);
    await page.locator('#email').fill(TENANT_ADMIN.email);
    await page.locator('#password').fill(TENANT_ADMIN.password);
    await page.locator('button[type="submit"]').click();

    // --- Step 3: Should land on MFA challenge page ---
    await expect(page).toHaveURL(/\/auth\/mfa-challenge/);
    await expect(page.locator('#code')).toBeVisible({ timeout: 10_000 });

    // --- Step 4: Complete challenge with the first recovery code ---
    await page.locator('#code').fill(recoveryCodes[0]);
    await page.locator('button[type="submit"]').click();

    // --- Step 5: Should land on dashboard ---
    await expect(page).not.toHaveURL(/\/auth\//);
    await expect(page.locator('a[href^="/students"], a[href^="/payments"]').first())
        .toBeVisible({ timeout: 10_000 });

    // --- Step 6: Cleanup — disable MFA so other tests are not affected ---
    const cleanCtx = await apiContextFor({ user: TENANT_ADMIN });
    await cleanCtx.post('/api/v1/auth/mfa/disable', {
      data: { currentPassword: TENANT_ADMIN.password, mfaCode: recoveryCodes[1] },
    });
    await cleanCtx.dispose();
  });
});

/* ------------------------------------------------------------------ */
/*  Minimal TOTP (RFC 6238) — HMAC-SHA1 / 6 digits / 30 s window     */
/* ------------------------------------------------------------------ */

/** RFC 4648 base32 decoding (no padding). */
function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = encoded.replace(/=+$/, '').toUpperCase();
  const bits: number[] = [];
  for (const ch of clean) {
    const val = alphabet.indexOf(ch);
    if (val < 0) throw new Error(`Invalid base32 char: ${ch}`);
    for (let i = 4; i >= 0; i--) bits.push((val >> i) & 1);
  }
  const bytes: number[] = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    bytes.push(byte);
  }
  return new Uint8Array(bytes);
}

/** 6-digit TOTP code for the given base32 secret at the current time step. */
async function generateTotp(base32Secret: string): Promise<string> {
  const key = base32Decode(base32Secret);
  const timeStep = Math.floor(Date.now() / 1000 / 30);
  const msg = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    msg[i] = Number((BigInt(timeStep) >> BigInt(8 * (7 - i))) & BigInt(0xff));
  }

  const hmacKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-1' },
    false, ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, msg));

  // Dynamic truncation (RFC 4226 §5.3).
  const offset = sig[sig.length - 1] & 0x0f;
  const code =
    ((sig[offset] & 0x7f) << 24) |
    (sig[offset + 1] << 16) |
    (sig[offset + 2] << 8) |
    sig[offset + 3];
  return String(code % 1_000_000).padStart(6, '0');
}

