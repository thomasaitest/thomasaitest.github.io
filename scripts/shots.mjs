// Lokale skjermbilder (ikke en del av deploy). Krever playwright-core og en lokal Chrome.
import { chromium } from 'playwright-core';
const url = process.argv[2] || 'http://localhost:4750/';
const out = process.argv[3] || '/workspace/app-hub-shots';
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
const sets = [
  ['desktop', { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 }],
  ['iphone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
];
for (const scheme of ['light', 'dark']) {
  for (const [name, o] of sets) {
    const ctx = await b.newContext({ ...o, colorScheme: scheme });
    const p = await ctx.newPage();
    await p.goto(url); await p.waitForSelector('.card'); await p.waitForTimeout(200);
    await p.screenshot({ path: `${out}/hub-${name}-${scheme}.png`, fullPage: true });
    await ctx.close();
  }
}
await b.close();
