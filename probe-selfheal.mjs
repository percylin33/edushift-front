#!/usr/bin/env node
// Verifies DEBT-QA-FE-4 self-healing: when a session is valid but
// permissions() is empty (simulating /auth/me bootstrap that hasn't
// completed or failed), the guard fires a /auth/me and re-evaluates.
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

page.on('framenavigated', f => {
  if (f === page.mainFrame()) console.log('[nav]', f.url());
});
page.on('request', r => {
  if (/auth\/me/.test(r.url())) console.log('[req]', r.method(), r.url());
});

const loginRes = await page.request.post('http://localhost:8081/api/v1/auth/login', {
  headers: { 'X-Tenant-Slug': 'tecnosur', 'Content-Type': 'application/json' },
  data: { email: 'lucia.student@tecnosur.edushift.pe', password: 'EduShift2026!' },
});
const loginBody = await loginRes.json();

// Seed storage with UserSummary (no permissions) + valid token.
await page.goto('http://localhost:4201/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
await page.evaluate(({ tok, ref, tenant, usr }) => {
  localStorage.setItem('edushift.auth.token', JSON.stringify(tok));
  localStorage.setItem('edushift.auth.refreshToken', JSON.stringify(ref));
  localStorage.setItem('edushift.tenant.current', JSON.stringify(tenant));
  localStorage.setItem('edushift.auth.user', JSON.stringify(usr));
}, {
  tok: loginBody.accessToken,
  ref: loginBody.refreshToken,
  tenant: 'tecnosur',
  usr: loginBody.user, // UserSummary only — no permissions
});

// Reload so APP_INITIALIZER boots with token + UserSummary in storage.
// /auth/me should fire during boot, populate permissions.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(2_000);

console.log('--- after reload (expect /auth/me fired + permissions populated) ---');

// Now manually clear permissions in storage to simulate boot where /auth/me failed.
await page.evaluate(() => {
  const raw = localStorage.getItem('edushift.auth.user');
  if (raw) {
    const u = JSON.parse(raw);
    delete u.permissions;
    delete u.roles;
    localStorage.setItem('edushift.auth.user', JSON.stringify(u));
  }
});
// Reload again — _user will reload without permissions, _accessToken still set.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(2_000);

const ls = await page.evaluate(() => {
  const raw = localStorage.getItem('edushift.auth.user');
  let u = null; try { u = JSON.parse(raw); } catch (_) {}
  return { hasPerms: Array.isArray(u?.permissions), nPerms: u?.permissions?.length };
});
console.log('--- after 2nd reload ---');
console.log('  ls perms =', JSON.stringify(ls));
console.log('  url =', page.url());

// Now navigate to /ai/chat — guard should self-heal via /auth/me.
console.log('--- navigating to /ai/chat (expect guard self-heal) ---');
await page.goto('http://localhost:4201/ai/chat', { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(3_000);
console.log('  final =', page.url());

await browser.close();