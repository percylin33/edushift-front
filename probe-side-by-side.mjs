#!/usr/bin/env node
import { chromium } from 'playwright';

const API_URL = 'http://localhost:8081';
const FE_URL = 'http://localhost:4201';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

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

// Inspect what _user holds after storage seeding
const ls1 = await page.evaluate(() => {
  const raw = localStorage.getItem('edushift.auth.user');
  let u = null; try { u = JSON.parse(raw); } catch (_) {}
  return { keys: u ? Object.keys(u) : null, perms: u?.permissions ?? null, roles: u?.roles ?? null };
});
console.log('after seed ls =', JSON.stringify(ls1));

// Now do a reload to force app bootstrap to read storage
await page.goto(`${FE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(2_000);

const ls2 = await page.evaluate(() => {
  const raw = localStorage.getItem('edushift.auth.user');
  let u = null; try { u = JSON.parse(raw); } catch (_) {}
  return { keys: u ? Object.keys(u) : null, perms: u?.permissions ?? null, roles: u?.roles ?? null };
});
console.log('after /dashboard ls =', JSON.stringify(ls2));

// Now go to /ai/chat
const resp = await page.goto(`${FE_URL}/ai/chat`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(2_000);

const ls3 = await page.evaluate(() => {
  const raw = localStorage.getItem('edushift.auth.user');
  let u = null; try { u = JSON.parse(raw); } catch (_) {}
  return { keys: u ? Object.keys(u) : null, perms: u?.permissions ?? null, roles: u?.roles ?? null };
});
console.log('after /ai/chat ls =', JSON.stringify(ls3));
console.log('final url =', page.url());

await browser.close();