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
const usr = loginBody?.data?.user ?? loginBody.user;
console.log('login user perms =', usr?.permissions);

await page.goto(`${FE_URL}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(({ tok, ref, tenant, usr }) => {
  localStorage.setItem('edushift.auth.token', JSON.stringify(tok));
  localStorage.setItem('edushift.auth.refreshToken', JSON.stringify(ref));
  localStorage.setItem('edushift.tenant.current', JSON.stringify(tenant));
  if (usr) localStorage.setItem('edushift.auth.user', JSON.stringify(usr));
}, { tok, ref, tenant: TENANT, usr });

await page.goto(`${FE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(2_000);

// Inspect what auth.permissions() actually returns inside the running app
const sig = await page.evaluate(() => {
  const raw = localStorage.getItem('edushift.auth.user');
  let u = null; try { u = JSON.parse(raw); } catch (_) {}
  return {
    lsUserPerms: u?.permissions ?? null,
    lsUserRoles: u?.roles ?? null,
    lsUserKeys: u ? Object.keys(u) : null,
  };
});
console.log('in-browser perms =', JSON.stringify(sig));

const resp = await page.goto(`${FE_URL}${ROUTE}`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(1_000);

console.log('after nav to', ROUTE);
console.log('  status =', resp?.status());
console.log('  final url =', page.url());

const outName = ROUTE.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
await page.screenshot({ path: `probe-${outName}.png`, fullPage: true });
console.log('  screenshot = probe-' + outName + '.png');

await browser.close();