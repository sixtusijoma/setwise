// Renders mockups.html to JPEGs: one board per theme plus each screen in both themes.
// Usage: node docs/mockups/render.mjs   (needs `playwright` and a Chromium; set CHROME to override)
import { chromium } from 'playwright';

const dir = new URL('.', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1772, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(`file://${dir}mockups.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

for (const theme of ['light', 'dark']) {
  await page.evaluate((dark) => document.querySelectorAll('.phone').forEach((p) => p.classList.toggle('dark', dark)), theme === 'dark');
  await page.screenshot({ path: `${dir}board-${theme}.jpg`, fullPage: true, quality: 82, scale: 'css' });
  for (const phone of await page.$$('.phone')) {
    const id = await phone.getAttribute('id');
    await phone.screenshot({ path: `${dir}screens/${id}-${theme}.jpg`, quality: 88 });
  }
}
await browser.close();
