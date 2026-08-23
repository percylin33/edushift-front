#!/usr/bin/env node
import { chromium } from 'playwright';

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : undefined;
}
const EMAIL    = getArg('email')    ?? 'lucia.student@tecnosur.edushift.pe';
const PASSWORD = getArg('password') ?? 'EduShift2026!';
const TENANT   = getArg('tenant')   ?? 'tecnosur';
const ROUTE    = getArg('route')    ?? '/lms';
const API_URL  = getArg('api-url')  ?? 'http://localhost:8081';
const FE_URL   = getArg('fe-url')   ?? 'http://localhost:4201';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const loginResp = await page.request.post(`${API_URL}/api/v1/auth/login`, {
  headers: { 'X-Tenant-Slug': TENANT, 'Content-Type': 'application/json' },
  data: { email: EMAIL, password: PASSWORD },
});
const loginBody = await loginResp.json();
const tok = loginBody?.data?.accessToken ?? loginBody.accessToken;
const ref = loginBody?.data?.refreshToken ?? loginBody.refreshToken;
const accessForMe = tok?.startsWith('"') ? JSON.parse(tok) : tok;

// Pre-fetch /auth/me
const meResp = await page.request.get(`${API_URL}/api/v1/auth/me`, {
  headers: { 'X-Tenant-Slug': TENANT, 'Authorization': `Bearer ${accessForMe}` },
});
const meBody = await meResp.json();
const fullUser = meBody?.data ?? meBody;
console.log('me perms =', fullUser?.permissions);

// Seed storage with the *rich* user BEFORE first nav
await page.goto(`${FE_URL}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(({ tok, ref, tenant, usr }) => {
  localStorage.setItem('edushift.auth.token', JSON.stringify(tok));
  localStorage.setItem('edushift.auth.refreshToken', JSON.stringify(ref));
  localStorage.setItem('edushift.tenant.current', JSON.stringify(tenant));
  localStorage.setItem('edushift.auth.user', JSON.stringify(usr));
}, { tok, ref, tenant: TENANT, usr: fullUser });

// Now go directly to the route (no /dashboard priming)
await page.goto(`${FE_URL}${ROUTE}`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(1_500);

console.log('after nav to', ROUTE);
console.log('  final url =', page.url());

const ls = await page.evaluate(() => {
  const raw = localStorage.getItem('edushift.auth.user');
  let u = null; try { u = JSON.parse(raw); } catch (_) {}
  return { perms: u?.permissions ?? null, roles: u?.roles ?? null };
});
console.log('  ls after =', JSON.stringify(ls));

const outName = ROUTE.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
await page.screenshot({ path: `probe-hydrate-${outName}.png`, fullPage: true });

await browser.close();