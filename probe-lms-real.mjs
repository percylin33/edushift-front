#!/usr/bin/env node
// Probe: does STUDENT get blocked at /lms/sections/<real_uuid>/assignments?
import { chromium } from 'playwright';
import { resolve, join } from 'node:path';

const SECTION_UUID = process.argv[2] ?? 'e93150d0-0bd7-42ba-ac79-2774b6814fd9';
const OUT_DIR = 'C:/Users/USUARIO/Desktop/personales/proyectos/new - proyecto multi school/edushift/docs/qa/e2e-fe-by-role/2026-07-28-rerun/04-student';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

// Login as STUDENT
const login = await page.request.post('http://localhost:8081/api/v1/auth/login', {
  headers: { 'X-Tenant-Slug': 'tecnosur', 'Content-Type': 'application/json' },
  data: { email: 'lucia.student@tecnosur.edushift.pe', password: 'EduShift2026!' },
});
const body = await login.json();
const tok = body.accessToken, ref = body.refreshToken, usr = body.user;

await page.goto('http://localhost:4201/', { waitUntil: 'domcontentloaded' });
await page.evaluate(({ tok, ref, tenant, usr }) => {
  localStorage.setItem('edushift.auth.token', JSON.stringify(tok));
  localStorage.setItem('edushift.auth.refreshToken', JSON.stringify(ref));
  localStorage.setItem('edushift.tenant.current', JSON.stringify(tenant));
  localStorage.setItem('edushift.auth.user', JSON.stringify(usr));
}, { tok, ref, tenant: 'tecnosur', usr });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(2_000);

const routes = [
  `/lms/sections/${SECTION_UUID}/assignments`,
  `/lms/sections/${SECTION_UUID}/materials`,
];
for (const r of routes) {
  const label = r.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  console.log(`-> ${r}`);
  await page.goto(`http://localhost:4201${r}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(2_500);
  console.log(`   final=${page.url()}`);
  await page.screenshot({ path: join(OUT_DIR, `04-student-real-${label}.png`), fullPage: true });
  console.log(`   shot=${label}.png`);
}

await browser.close();
console.log('[done]');
