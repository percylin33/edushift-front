#!/usr/bin/env node
import { chromium } from 'playwright';

const FE_URL = 'http://localhost:4201';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const reqs = [];
page.on('request', r => reqs.push(r.url()));
const logs = [];
page.on('console', m => {
  const t = m.text();
  if (t.includes('perm-check') || t.includes('[guard]')) logs.push(t);
});

await page.goto(`${FE_URL}/`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
await page.waitForTimeout(1_000);

// Find any request to lms or ai modules
const modReqs = reqs.filter(u => /lms|ai|permission|guard/i.test(u));
console.log('module requests =', modReqs.length);
modReqs.slice(0, 30).forEach(u => console.log('  -', u));

console.log('console logs with [guard] =', logs.length);
logs.forEach(l => console.log('  log>', l));

await browser.close();