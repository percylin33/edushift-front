#!/usr/bin/env node
// Reproduction of role-screenshot.mjs with guard log listener added
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
function ga(name) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : undefined;
}

const EMAIL    = ga('email')    ?? 'lucia.student@tecnosur.edushift.pe';
const PASSWORD = ga('password') ?? 'EduShift2026!';
const TENANT   = ga('tenant')   ?? 'tecnosur';
const API_URL  = ga('api-url')  ?? 'http://localhost:8081';
const FE_URL   = ga('fe-url')   ?? 'http://localhost:4201';
const OUT_DIR  = ga('out-dir')  ?? resolve(process.cwd(), 'tmp-repro');

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

page.on('console', m => {
  const t = m.text();
  if (/\[guard\]|\[router\]|guard|403/i.test(t)) console.log('[browser]', t);
});
page.on('framenavigated', f => {
  if (f === page.mainFrame()) console.log('[nav]', f.url());
});

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

await page.goto(`${FE_URL}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(({ tok, ref, tenant, usr }) => {
  localStorage.setItem('edushift.auth.token', JSON.stringify(tok));
  localStorage.setItem('edushift.auth.refreshToken', JSON.stringify(ref));
  localStorage.setItem('edushift.tenant.current', JSON.stringify(tenant));
  if (usr) localStorage.setItem('edushift.auth.user', JSON.stringify(usr));
}, { tok: accessToken, ref: refreshToken, tenant: TENANT, usr: user });

await page.goto(`${FE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(1_000);

console.log('about to goto /lms');
await page.goto(`${FE_URL}/lms`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(2_500);
console.log('after /lms final =', page.url());

await browser.close();