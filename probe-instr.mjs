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

// Capture router events
page.on('console', m => {
  const t = m.text();
  if (/guard|permission|LMS_|403|navigate|router|ROUTER/.test(t)) console.log('[browser]', t);
});

const loginResp = await page.request.post(`${API_URL}/api/v1/auth/login`, {
  headers: { 'X-Tenant-Slug': TENANT, 'Content-Type': 'application/json' },
  data: { email: EMAIL, password: PASSWORD },
});
const loginBody = await loginResp.json();
const tok = loginBody?.data?.accessToken ?? loginBody.accessToken;
const ref = loginBody?.data?.refreshToken ?? loginBody.refreshToken;
const accessForMe = tok?.startsWith('"') ? JSON.parse(tok) : tok;

// Pre-fetch /me to get full user
const meResp = await page.request.get(`${API_URL}/api/v1/auth/me`, {
  headers: { 'X-Tenant-Slug': TENANT, 'Authorization': `Bearer ${accessForMe}` },
});
const meBody = await meResp.json();
const fullUser = meBody?.data ?? meBody;

await page.goto(`${FE_URL}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(({ tok, ref, tenant, usr }) => {
  localStorage.setItem('edushift.auth.token', JSON.stringify(tok));
  localStorage.setItem('edushift.auth.refreshToken', JSON.stringify(ref));
  localStorage.setItem('edushift.tenant.current', JSON.stringify(tenant));
  localStorage.setItem('edushift.auth.user', JSON.stringify(usr));
}, { tok, ref, tenant: TENANT, usr: fullUser });

// Reload so app boot reads the rich user from storage
await page.goto(`${FE_URL}/`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(2_000);

const before = await page.evaluate(() => {
  const raw = localStorage.getItem('edushift.auth.user');
  let u = null; try { u = JSON.parse(raw); } catch (_) {}
  return { perms: u?.permissions ?? null, roles: u?.roles ?? null };
});
console.log('before nav perms =', JSON.stringify(before));

// Patch router to log every nav
await page.evaluate(() => {
  // Patch console with timestamps
  const origLog = console.log;
  // Hook into the global Angular router (best-effort)
  const ng = window['ng'];
  if (ng && ng.getInjector) {
    origLog('router hook installed');
  } else {
    origLog('NO ng global');
  }
});

const resp = await page.goto(`${FE_URL}${ROUTE}`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(2_000);

console.log('after nav to', ROUTE);
console.log('  final url =', page.url());
const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 200));
console.log('  body =', bodyText);

await browser.close();