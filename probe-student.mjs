#!/usr/bin/env node
import { chromium } from 'playwright';

const API_URL = 'http://localhost:8081';
const FE_URL = 'http://localhost:4201';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

page.on('console', m => {
  const t = m.text();
  if (/\[guard\]|\[router\]|router|403/i.test(t)) console.log('[browser]', t);
});

const loginResp = await page.request.post(`${API_URL}/api/v1/auth/login`, {
  headers: { 'X-Tenant-Slug': 'tecnosur', 'Content-Type': 'application/json' },
  data: { email: 'lucia.student@tecnosur.edushift.pe', password: 'EduShift2026!' },
});
const loginBody = await loginResp.json();
const tok = loginBody.accessToken;
const ref = loginBody.refreshToken;
const usr = loginBody.user;

await page.goto(`${FE_URL}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(({ tok, ref, tenant, usr }) => {
  localStorage.setItem('edushift.auth.token', JSON.stringify(tok));
  localStorage.setItem('edushift.auth.refreshToken', JSON.stringify(ref));
  localStorage.setItem('edushift.tenant.current', JSON.stringify(tenant));
  localStorage.setItem('edushift.auth.user', JSON.stringify(usr));
}, { tok, ref, tenant: 'tecnosur', usr });

await page.goto(`${FE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(2_000);

const ls = await page.evaluate(() => {
  const raw = localStorage.getItem('edushift.auth.user');
  let u = null; try { u = JSON.parse(raw); } catch (_) {}
  return { keys: u ? Object.keys(u) : null, perms: u?.permissions ?? null };
});
console.log('after /dashboard ls =', JSON.stringify(ls));

const resp = await page.goto(`${FE_URL}/ai/chat`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(2_000);

console.log('after /ai/chat final =', page.url());

await browser.close();