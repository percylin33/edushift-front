#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

page.on('console', m => {
  const t = m.text();
  if (/guard|403|navigate/i.test(t)) console.log('[browser]', t);
});
page.on('framenavigated', f => {
  if (f === page.mainFrame()) console.log('[nav]', f.url());
});

const loginRes = await page.request.post('http://localhost:8081/api/v1/auth/login', {
  headers: { 'X-Tenant-Slug': 'tecnosur', 'Content-Type': 'application/json' },
  data: { email: 'coordinador@tecnosur.edushift.pe', password: 'EduShift2026!' },
});
const loginBody = await loginRes.json();
console.log('loginBody.user =', loginBody.user);

await page.goto('http://localhost:4201/', { waitUntil: 'domcontentloaded' });
await page.evaluate(({ tok, ref, tenant, usr }) => {
  localStorage.setItem('edushift.auth.token', JSON.stringify(tok));
  localStorage.setItem('edushift.auth.refreshToken', JSON.stringify(ref));
  localStorage.setItem('edushift.tenant.current', JSON.stringify(tenant));
  localStorage.setItem('edushift.auth.user', JSON.stringify(usr));
}, {
  tok: loginBody.accessToken,
  ref: loginBody.refreshToken,
  tenant: 'tecnosur',
  usr: loginBody.user,
});

await page.goto('http://localhost:4201/dashboard', { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(3_000);
console.log('final dashboard =', page.url());

await browser.close();