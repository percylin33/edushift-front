#!/usr/bin/env node
/**
 * role-screenshot.mjs — Operative role-based screenshot harness
 *
 * Usage (run from edushift-front/ so playwright resolves):
 *   node role-screenshot.mjs --email admin@tecnosur.edushift.pe --tenant tecnosur --out-prefix 01-tenant-admin
 *
 * What it does:
 *   1. Logs into the EduShift FE via the backend API (no UI typing),
 *      mirroring the encoding used by auth.setup.ts (JSON.stringify for
 *      every token so the FE's StorageService picks them up).
 *   2. Opens each route in `--routes` (comma-separated) in headed
 *      Chromium with a 1280x800 viewport.
 *   3. Captures a full-page PNG per route.
 *   4. Logs out (clear localStorage) at the end of every role.
 *
 * Flags:
 *   --email       seed email (mandatory)
 *   --password    password (default: EduShift2026!)
 *   --tenant      tenant slug (default: tecnosur)
 *   --api-url     backend root (default: http://localhost:8081)
 *   --fe-url      FE base URL (default: http://localhost:4200)
 *   --out-dir     output folder (default: docs/qa/e2e-fe-by-role/<role>)
 *   --out-prefix  file prefix (default: '')
 *   --routes      comma-separated routes (default: dashboard + sidebar
 *                 + a few smoke probes)
 *   --force-light force `light` color-scheme on Playwright
 *
 * The script does NOT create or modify Playwright specs; it is a
 * one-shot capture tool aligned with the FE role-based E2E verification
 * plan (docs/qa/e2e-fe-by-role/<date>/_findings.md).
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

const EMAIL    = args['email'];
const PASSWORD = args['password'] ?? 'EduShift2026!';
const TENANT   = args['tenant']   ?? 'tecnosur';
const API_URL  = args['api-url']  ?? 'http://localhost:8081';
const FE_URL   = args['fe-url']   ?? 'http://localhost:4201';
const OUT_DIR  = args['out-dir']  ?? resolve(process.cwd(), '..', 'docs', 'qa', 'e2e-fe-by-role', String(args['out-prefix'] || 'tmp'));
const PREFIX   = args['out-prefix'] ?? '';
const ROUTES   = (args['routes'] ?? '/dashboard,/ai/chat,/ai/usage,/learning-sessions/new,/users,/students,/403')
                   .split(',')
                   .map((r) => r.trim())
                   .filter(Boolean);
const FORCE_LIGHT = !!args['force-light'];

if (!EMAIL) {
  console.error('ERROR: --email is required');
  process.exit(2);
}

await mkdir(OUT_DIR, { recursive: true });
await mkdir(resolve(OUT_DIR, 'errors'), { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  colorScheme: FORCE_LIGHT ? 'light' : undefined,
});

const page = await context.newPage();

console.log(`[login] ${EMAIL} @ ${TENANT} via ${API_URL}`);
const loginResp = await page.request.post(`${API_URL}/api/v1/auth/login`, {
  headers: {
    'X-Tenant-Slug': TENANT,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  data: { email: EMAIL, password: PASSWORD },
});
if (!loginResp.ok()) {
  console.error(`[login] FAILED ${loginResp.status()} ${await loginResp.text()}`);
  await browser.close();
  process.exit(1);
}
const loginBody = await loginResp.json();
const accessToken = loginBody?.data?.accessToken ?? loginBody.accessToken;
const refreshToken = loginBody?.data?.refreshToken ?? loginBody.refreshToken;
const user = loginBody?.data?.user ?? loginBody.user;

if (!accessToken) {
  console.error('[login] no accessToken in response', loginBody);
  await browser.close();
  process.exit(1);
}

// Mirror writeAuthState() in e2e/fixtures/_write-auth-state.ts — the FE's
// StorageService JSON-stringifies the values again, so we pre-stringify
// before setItem so the FE's parser picks them up.
await page.goto(`${FE_URL}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(
  ({ tok, ref, tenant, usr }) => {
    localStorage.setItem('edushift.auth.token', JSON.stringify(tok));
    localStorage.setItem('edushift.auth.refreshToken', JSON.stringify(ref));
    localStorage.setItem('edushift.tenant.current', JSON.stringify(tenant));
    if (usr) localStorage.setItem('edushift.auth.user', JSON.stringify(usr));
  },
  { tok: accessToken, ref: refreshToken, tenant: TENANT, usr: user },
);

// Reload so Angular boots fresh from the seeded storage. The APP_INITIALIZER
// runs on boot and hydrates permissions via /auth/me before the router
// activates the first route, so permissionGuard sees the full authority set
// without needing a priming /dashboard visit.
//
// Why a reload is required: AuthService seeds `_accessToken` in its
// constructor from `storage.get(...)`, which runs once per Angular boot.
// Setting localStorage AFTER the constructor has run has no effect on the
// signal — we'd be talking to a stale service. Reloading forces a fresh
// constructor + APP_INITIALIZER pass, mirroring the real-world case of a
// user reopening the tab.
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
  if (resp) {
    console.log(`     status=${resp.status()} final=${page.url()}`);
  }
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  // Wait for canMatch guards + auth-me hydration to settle. permissionGuard
  // reads auth.permissions() which is only populated after /auth/me (called
  // on /dashboard boot). Give the router enough time to evaluate the guard
  // and redirect to /403 if the role lacks the required permission.
  await page.waitForTimeout(2_500);
  console.log(`     final=${page.url()}`);
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log(`     wrote ${fullPath}`);
}

for (const route of ROUTES) {
  const label = route
    .replace(/^\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '') || 'root';
  await shoot(route, label);
}

await browser.close();
console.log('[done]');