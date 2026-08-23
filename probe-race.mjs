#!/usr/bin/env node
// Verifies that permissionGuard self-heals when storage is set AFTER boot.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

page.on('framenavigated', f => {
  if (f === page.mainFrame()) console.log('[nav]', f.url());
});
page.on('console', m => {
  const t = m.text();
  if (/guard|403|permission|warn/i.test(t)) console.log('[browser]', t);
});

const loginRes = await page.request.post('http://localhost:8081/api/v1/auth/login', {
  headers: { 'X-Tenant-Slug': 'tecnosur', 'Content-Type': 'application/json' },
  data: { email: 'admin@tecnosur.edushift.pe', password: 'EduShift2026!' },
});
const loginBody = await loginRes.json();
const tok = loginBody.accessToken;
const ref = loginBody.refreshToken;
const usr = loginBody.user;

// Step 1: load the app once so AuthService constructor seeds from EMPTY storage.
// _accessToken will be null, _user will be null.
await page.goto('http://localhost:4201/', { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(1_500);

// Step 2: seed storage WITHOUT reloading. (Simulates the harness / test path.)
await page.evaluate(({ tok, ref, tenant, usr }) => {
  localStorage.setItem('edushift.auth.token', JSON.stringify(tok));
  localStorage.setItem('edushift.auth.refreshToken', JSON.stringify(ref));
  localStorage.setItem('edushift.tenant.current', JSON.stringify(tenant));
  localStorage.setItem('edushift.auth.user', JSON.stringify(usr));
}, { tok, ref, tenant: 'tecnosur', usr });

// Step 3: navigate to a permission-gated route. Self-healing should kick in
// because _accessToken signal is still null in the running service (constructor
// already ran with empty storage). We expect: the guard calls /auth/me, gets
// 403 because STUDENT lacks LMS_AI_GENERATE, redirects to /403.
const resp = await page.goto('http://localhost:4201/ai/chat', { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(3_000);

console.log('after /ai/chat (no reload, race condition simulation)');
console.log('  final =', page.url());
console.log('  expected: /403 (STUDENT blocked because no session in AuthService signal)');

// Step 4: now reload to actually pick up the storage, and re-verify.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(3_000);
console.log('after reload + /dashboard');
console.log('  final =', page.url());

const resp2 = await page.goto('http://localhost:4201/ai/chat', { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(3_000);
console.log('after /ai/chat post-reload');
console.log('  final =', page.url());

await browser.close();