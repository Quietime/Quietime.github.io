// Opens every page of the built site (dist/) in a real browser, at desktop and phone size, and fails on:
//   a script error or console error; a footer that cannot be reached; a link that does not navigate at once;
//   music that starts without being switched on;
//   the contact form accepting an empty submission; an old Japanese address or the first-visit language rule not
//   landing on the right page.
// Run after `npm run build`. CI installs Chromium first: npx playwright install --with-deps chromium
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { ROOT } from './content.mjs';

const DIST = path.join(ROOT, 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg' };
const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  try { const body = await fs.readFile(path.join(DIST, p)); res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const pages = (await fs.readdir(DIST)).filter((f) => f.endsWith('.html') && !f.includes('.ja.'));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
const bad = (where, msg) => problems.push(`${where}: ${msg}`);

for (const [size, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['phone', devices['iPhone 13']]]) {
  for (const f of pages) {
    const ctx = await browser.newContext({ ...opts, locale: 'zh-CN' });
    // a returning visitor who chose this language and switched the music off
    await ctx.addInitScript(() => { try { localStorage.setItem('qt-lang', 'set'); localStorage.setItem('qt-sound', 'off'); } catch { /* */ } });
    const page = await ctx.newPage(), where = `${size} ${f}`, errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) errors.push(m.text()); });
    try {
      await page.goto(base + f, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1500);
      if (!(await page.locator('h1').first().count())) bad(where, 'no h1');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(800);
      if (!(await page.locator('footer').first().isVisible())) bad(where, 'footer not visible at the bottom of the page');
      if (f.startsWith('contact') && size === 'desktop') {
        await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
        await page.locator('[data-send]').click();
        const invalid = await page.locator('[aria-invalid="true"]').count();
        if (invalid < 3) bad(where, `empty form submitted with only ${invalid} fields marked invalid`);
      }
    } catch (e) { bad(where, e.message.split('\n')[0]); }
    for (const e of errors) bad(where, `error: ${e.slice(0, 160)}`);
    await ctx.close();
  }
}

// a first-time visitor: clicking anywhere does not start the music, and an internal link navigates within a second
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' }), page = await ctx.newPage();
  await page.goto(`${base}about.html`); await page.waitForTimeout(1200);
  await page.mouse.click(700, 500); await page.waitForTimeout(1500);
  const playing = await page.evaluate(() => document.querySelector('[data-sound]')?.getAttribute('aria-pressed'));
  if (playing === 'true') bad('music', 'started on the first click without being switched on');
  const t0 = Date.now();
  await Promise.all([page.waitForURL(/contact\.html$/, { timeout: 5000 }).catch(() => {}), page.locator('.nav a[href="contact.html"]').click()]);
  if (!page.url().endsWith('contact.html')) bad('navigation', 'clicking a header link did not navigate');
  else if (Date.now() - t0 > 1000) bad('navigation', `a header link took ${Date.now() - t0} ms to navigate`);
  await ctx.close();
}
// old Japanese addresses forward to the English page, keeping the hash
{
  const ctx = await browser.newContext(), page = await ctx.newPage();
  await page.goto(`${base}series-old-garden.ja.html#f3`); await page.waitForTimeout(800);
  if (!page.url().endsWith('series-old-garden.en.html#f3')) bad('redirect', `old Japanese address ended at ${page.url()}`);
  await ctx.close();
}
// first visit: a Chinese browser stays on Chinese, any other language goes to English
for (const [locale, want] of [['zh-CN', 'index.html'], ['en-US', 'index.en.html'], ['ja-JP', 'index.en.html']]) {
  const ctx = await browser.newContext({ locale }), page = await ctx.newPage();
  await page.goto(`${base}index.html`); await page.waitForTimeout(600);
  if (!page.url().endsWith(want)) bad('first visit', `${locale} browser ended at ${page.url()}, expected ${want}`);
  await ctx.close();
}

await browser.close(); server.close();
if (problems.length) { console.error(problems.join('\n')); console.error(`\nsmoke: ${problems.length} problem(s)`); process.exit(1); }
console.log(`smoke: ${pages.length} pages at desktop and phone size, redirects and first-visit language all fine`);
