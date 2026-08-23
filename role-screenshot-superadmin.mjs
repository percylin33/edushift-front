#!/usr/bin/env node
/**
 * role-screenshot-superadmin.mjs — SUPER_ADMIN screenshot harness
 *
 * SUPER_ADMIN uses a separate auth pipeline (/admin/login, not /auth/login)
 * because it's cross-tenant. This script adapts role-screenshot.mjs for that.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

const args = parseArgs(process.argv);
const EMAIL    = args['email']    ?? 'super@edushift.pe';
const PASSWORD = args['password'] ?? 'SuperAdmin2026!';
const API_URL  = args['api-url']  ?? 'http://localhost:8081';
const FE_URL   = args['fe-url']   ?? 'http://localhost:4201';
const OUT_DIR  = args['out-dir']  ?? resolve(process.cwd(), '..', 'docs', 'qa', 'e2e-fe-by-role', '2026-07-28-rerun', '06-super-admin');
const PREFIX   = args['out-prefix'] ?? '06-super-admin';
const ROUTES   = (args['routes'] ?? '/dashboard,/ai/chat,/ai/usage,/users,/403')
                   .split(',').map((r) => r.trim()).filter(Boolean);
const FORCE_LIGHT = !!args['force-light'];

await mkdir(OUT_DIR, { recursive: true });
await mkdir(resolve(OUT_DIR, 'errors'), { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  colorScheme: FORCE_LIGHT ? 'light' : undefined,
});
const page = await context.newPage();

// Step 1: Admin login (cross-tenant)
console.log(`[admin-login] ${EMAIL} via ${API_URL}/admin/login`);
const loginResp = await page.request.post(`${API_URL}/api/v1/admin/login`, {
  headers: { 'Content-Type': 'application/json' },
  data: { email: EMAIL, password: PASSWORD },
});
if (!loginResp.ok()) {
  console.error(`[admin-login] FAILED ${loginResp.status()} ${await loginResp.text()}`);
  await browser.close();
  process.exit(1);
}
const loginBody = await loginResp.json();
let accessToken, refreshToken, user;
if (loginBody.reason === 'MFA_ENROLMENT_REQUIRED') {
  console.log('[mfa] MFA enrolment required; completing via dev bypass...');
  const r2 = await page.request.post(`${API_URL}/api/v1/admin/dev/complete-mfa`, {
    headers: {
      'Authorization': `Bearer ${loginBody.onboardingToken}`,
      'X-Dev-Code': 'dev-bypass',
    },
  });
  if (!r2.ok()) {
    console.error('[mfa] FAILED', r2.status(), await r2.text());
    await browser.close();
    process.exit(1);
  }
  const sess = JSON.parse(await r2.text()).data.session;
  accessToken = sess.accessToken;
  refreshToken = sess.refreshToken;
  user = loginBody.user;
} else {
  accessToken = loginBody.accessToken;
  refreshToken = loginBody.refreshToken;
  user = loginBody.user;
}

if (!accessToken) {
  console.error('[admin-login] no accessToken in response', loginBody);
  await browser.close();
  process.exit(1);
}
console.log(`[admin-login] OK; session obtained.`);

// Step 2: /auth/me to populate permissions
const meResp = await page.request.get(`${API_URL}/api/v1/auth/me`, {
  headers: { 'Authorization': `Bearer ${accessToken}` },
});
const meBody = await meResp.json();
const meData = meBody.data;
console.log(`[/auth/me] roles=${JSON.stringify(meData.roles)} perms=${meData.permissions.length}`);

// Step 3: Seed localStorage and reload
await page.goto(`${FE_URL}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(({ tok, ref, tenant, usr }) => {
  localStorage.setItem('edushift.auth.token', JSON.stringify(tok));
  localStorage.setItem('edushift.auth.refreshToken', JSON.stringify(ref));
  localStorage.setItem('edushift.tenant.current', JSON.stringify(tenant));
  localStorage.setItem('edushift.auth.user', JSON.stringify(usr));
}, { tok: accessToken, ref: refreshToken, tenant: 'edushift-system', usr: meData });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(2_000);

console.log(`[out] ${OUT_DIR}`);
const idx = { n: 0 };
async function shoot(route, label) {
  idx.n += 1;
  const pad = String(idx.n).padStart(2, '0');
  const fname = `${PREFIX ? PREFIX + '-' : ''}${pad}-${label}.png`;
  const fullPath = resolve(OUT_DIR, fname);
  const url = new URL(route, FE_URL).toString();
  console.log(`  -> ${url}`);
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch((e) => {
    console.error(`[goto] ${url} failed: ${e.message}`);
    return null;
  });
  if (resp) console.log(`     status=${resp.status()}`);
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(2_500);
  console.log(`     final=${page.url()}`);
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log(`     wrote ${fullPath}`);
}

for (const r of ROUTES) {
  const label = r.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';
  await shoot(r, label);
}

await browser.close();
console.log('[done]');
