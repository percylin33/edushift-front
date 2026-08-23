#!/usr/bin/env node
/**
 * probe-permissions.mjs — instrumented probe to see what auth.permissions()
 * contains for a given user right after login.
 */
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : undefined;
}

const EMAIL    = getArg('email')    ?? 'lucia.student@tecnosur.edushift.pe';
const PASSWORD = getArg('password') ?? 'EduShift2026!';
const TENANT   = getArg('tenant')   ?? 'tecnosur';
const API_URL  = getArg('api-url')  ?? 'http://localhost:8081';
const FE_URL   = getArg('fe-url')   ?? 'http://localhost:4201';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const loginResp = await page.request.post(`${API_URL}/api/v1/auth/login`, {
  headers: {
    'X-Tenant-Slug': TENANT,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  data: { email: EMAIL, password: PASSWORD },
});
const loginBody = await loginResp.json();
const accessToken = loginBody?.data?.accessToken ?? loginBody.accessToken;
const refreshToken = loginBody?.data?.refreshToken ?? loginBody.refreshToken;
const user = loginBody?.data?.user ?? loginBody.user;
console.log('login response user =', JSON.stringify(user));

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

// Visit /dashboard and let the FE call /me and populate _user
await page.goto(`${FE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(1_500);

const snapshot = await page.evaluate(() => {
  const raw = localStorage.getItem('edushift.auth.user');
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (_) { parsed = null; }
  return {
    raw,
    parsed,
    keys: parsed && typeof parsed === 'object' ? Object.keys(parsed) : null,
    roles: parsed?.roles,
    permissions: parsed?.permissions,
  };
});

console.log('post-/me localStorage user =', JSON.stringify(snapshot, null, 2));

await browser.close();