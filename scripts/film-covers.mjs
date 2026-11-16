// Makes a cover for each film in content/films.json: its still (a frame from the film) with the city, the date and
// the show set over it in the site's own type and colours, so every cover says where and when at a glance.
// Writes content/films/<BV>.jpg at 1920×1080. Run it after changing a film's still, city, date or type:
//   npm run covers            every film that has a still
//   npm run covers -- BV1...  only the films named
// A film without a still keeps whatever cover it has (for example one uploaded in the admin).
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { ROOT, resolveImage } from './content.mjs';

const only = process.argv.slice(2);
const { films = [] } = JSON.parse(await fs.readFile(path.join(ROOT, 'content/films.json'), 'utf8'));
const { edge_code: edge = 'QUIETIME 400' } = JSON.parse(await fs.readFile(path.join(ROOT, 'content/settings.json'), 'utf8'));
const font = (f) => pathToFileURL(path.join(ROOT, 'node_modules/@fontsource', f)).href;
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const page = (f, n, still) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${font('noto-serif-sc/500.css')}"><link rel="stylesheet" href="${font('noto-serif-sc/400.css')}">
<link rel="stylesheet" href="${font('anton/400.css')}"><link rel="stylesheet" href="${font('barlow-condensed/500.css')}">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1920px; height: 1080px; overflow: hidden; background: #151517; color: #E7E2D7; }
  .still { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  /* darkened from the lower left, where the words sit, and a little along the top for the edge code */
  .shade { position: absolute; inset: 0; background:
    linear-gradient(to top, rgba(14,12,11,.9) 0%, rgba(14,12,11,.55) 34%, rgba(14,12,11,0) 62%),
    linear-gradient(to right, rgba(14,12,11,.55) 0%, rgba(14,12,11,0) 55%),
    linear-gradient(to bottom, rgba(14,12,11,.55) 0%, rgba(14,12,11,0) 16%); }
  .edge { position: absolute; top: 46px; left: 96px; right: 96px; display: flex; justify-content: space-between;
    font: 500 30px "Barlow Condensed", sans-serif; letter-spacing: .2em; color: #D99A5B; }
  .edge b { font-weight: 500; color: #E7E2D7; letter-spacing: .26em; }
  .words { position: absolute; left: 96px; bottom: 92px; right: 96px; }
  .city { display: flex; align-items: baseline; gap: 36px; }
  .zh { font: 500 210px/1 "Noto Serif SC", serif; letter-spacing: .06em; }
  .en { font: 500 52px "Barlow Condensed", sans-serif; letter-spacing: .32em; color: #E7E2D7; opacity: .85; }
  .when { display: flex; align-items: baseline; gap: 34px; margin-top: 30px; }
  .date { font: 400 120px/1 Anton, sans-serif; letter-spacing: .03em; }
  .show { font: 500 64px "Noto Serif SC", serif; letter-spacing: .08em; }
  .show i { font: 500 40px "Barlow Condensed", sans-serif; font-style: normal; letter-spacing: .2em; margin-left: 18px; opacity: .8; }
  .kind { display: inline-block; margin-top: 34px; padding: 10px 22px 12px; background: #A93A2A; color: #F3EEE4;
    font: 400 38px "Noto Serif SC", serif; letter-spacing: .1em; }
  .kind i { font: 500 32px "Barlow Condensed", sans-serif; font-style: normal; letter-spacing: .2em; margin-left: 18px; text-transform: uppercase; }
</style></head><body>
<img class="still" src="${pathToFileURL(still).href}" alt="">
<div class="shade"></div>
<div class="edge"><span>${esc(edge)} ▸ ${String(n).padStart(2, '0')}</span><b>火星演唱会 · MARS CONCERT</b></div>
<div class="words">
  <div class="city"><span class="zh">${esc(f.city_zh)}</span><span class="en">${esc((f.city_en || '').toUpperCase())}</span></div>
  <div class="when"><span class="date">${esc(f.date)}</span>${f.show_zh ? `<span class="show">${esc(f.show_zh)}<i>${esc((f.show_en || '').toUpperCase())}</i></span>` : ''}</div>
  ${f.kind_zh ? `<div class="kind">${esc(f.kind_zh)}<i>${esc(f.kind_en)}</i></div>` : ''}
</div></body></html>`;

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'covers-'));
let made = 0;
for (const [i, f] of films.entries()) {
  if (only.length && !only.includes(f.bvid)) continue;
  const still = f.still && resolveImage(f.still, 'content/films');
  if (!still || !f.bvid) continue;
  const html = path.join(tmp, `${f.bvid}.html`);
  await fs.writeFile(html, page(f, i + 1, path.join(ROOT, still)));
  await tab.goto(pathToFileURL(html).href);
  await tab.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((im) => im.decode().catch(() => {}))); });
  const out = path.join(ROOT, 'content/films', `${f.bvid}.jpg`);
  await tab.screenshot({ path: out, type: 'jpeg', quality: 88 });
  made += 1;
  console.log(`covers: ${path.relative(ROOT, out)}  ${f.city_zh} ${f.date} ${f.show_zh || ''} ${f.kind_zh || ''}`);
}
await browser.close();
await fs.rm(tmp, { recursive: true, force: true });
console.log(`covers: ${made} made`);
