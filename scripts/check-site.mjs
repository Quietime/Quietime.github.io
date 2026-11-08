// Checks the built site in dist/ before it is published (run after `npm run build`; CI runs it on every deploy).
//   every local href / src / srcset / preload / CSS url() points at a file that exists
//   every page has a title, a description and a language; every page but 404 a canonical address and hreflang
//   the pictures a WebGL scene will load exist, and the sitemap lists only pages that exist
//   no link in a page uses a javascript: address
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './content.mjs';

const DIST = path.join(ROOT, 'dist');
const problems = [];
const bad = (file, msg) => problems.push(`${file}: ${msg}`);
const exists = async (p) => { try { await fs.access(p); return true; } catch { return false; } };

let pages;
try { pages = (await fs.readdir(DIST)).filter((f) => f.endsWith('.html')); } catch {
  console.error('dist/ not found: run `npm run build` first');
  process.exit(1);
}
if (!pages.length) bad('dist', 'no pages');

const local = (u) => u && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:)/i.test(u);
const target = (from, u) => path.join(path.dirname(from), decodeURIComponent(u.split(/[?#]/)[0]));
let refs = 0;

for (const f of pages) {
  const file = path.join(DIST, f);
  const html = await fs.readFile(file, 'utf8');
  const urls = new Set();
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) urls.add(m[1]);
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) m[1].split(',').forEach((c) => urls.add(c.trim().split(/\s+/)[0]));
  for (const u of urls) {
    if (/^\s*javascript:/i.test(u)) bad(f, `javascript: link ${u}`);
    if (!local(u)) continue;
    refs += 1;
    if (!(await exists(target(file, u)))) bad(f, `missing ${u}`);
  }
  if (!/<title>[^<]+<\/title>/.test(html)) bad(f, 'no <title>');
  if (!/<meta name="description" content="[^"]+">/.test(html)) bad(f, 'no description');
  if (!/<html lang="[^"]+"/.test(html)) bad(f, 'no lang');
  if (f.startsWith('404')) {
    if (!html.includes('name="robots" content="noindex"')) bad(f, '404 page is indexable');
  } else {
    if (!/<link rel="canonical" href="https:\/\/[^"]+">/.test(html)) bad(f, 'no canonical');
    if (!html.includes('hreflang="x-default"')) bad(f, 'no x-default hreflang');
  }
  for (const m of html.matchAll(/<script type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch { bad(f, 'a JSON block does not parse'); }
  }
  const scene = html.match(/<script type="application\/json" id="qt-scene">([\s\S]*?)<\/script>/);
  if (scene) {
    const data = JSON.parse(scene[1]);
    for (const u of [...(data.images || []), data.heroPhoto].filter(Boolean)) {
      refs += 1;
      if (!(await exists(target(file, u)))) bad(f, `scene picture missing ${u}`);
    }
    if (data.sizes && data.sizes.length !== data.images.length) bad(f, 'scene sizes and images differ in length');
  }
}

for (const f of (await fs.readdir(path.join(DIST, 'assets'))).filter((x) => x.endsWith('.css'))) {
  const css = await fs.readFile(path.join(DIST, 'assets', f), 'utf8');
  for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    if (!local(m[1])) continue;
    refs += 1;
    if (!(await exists(path.join(DIST, 'assets', m[1])))) bad(`assets/${f}`, `missing ${m[1]}`);
  }
}

const sitemap = await fs.readFile(path.join(DIST, 'sitemap.xml'), 'utf8').catch(() => '');
if (!sitemap) bad('sitemap.xml', 'missing');
for (const m of sitemap.matchAll(/<loc>https?:\/\/[^/]+\/([^<]*)<\/loc>/g)) {
  if (!(await exists(path.join(DIST, m[1] || 'index.html')))) bad('sitemap.xml', `lists a missing page /${m[1]}`);
}
if (!(await exists(path.join(DIST, 'robots.txt')))) bad('robots.txt', 'missing');

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\nsite: ${problems.length} problem(s)`);
  process.exitCode = 1;
} else {
  console.log(`site: ${pages.length} pages, ${refs} local references, all present`);
}
