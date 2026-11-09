// Checks everything the admin backend writes into content/ before the site is built, and names the exact file and
// field when something is wrong. Errors stop the build (they would publish a page with a hole in it); warnings are
// printed and the build goes on.
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, resolveImage, parseBili } from './content.mjs';

const errors = [], warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);
const exists = async (rel) => { try { await fs.access(path.join(ROOT, rel)); return true; } catch { return false; } };
async function readJSON(rel) {
  try { return JSON.parse(await fs.readFile(path.join(ROOT, rel), 'utf8')); } catch (e) {
    err(rel, e.code === 'ENOENT' ? 'file is missing' : `not valid JSON (${e.message})`);
    return null;
  }
}
const LAYOUTS = ['wide', 'right', 'left', 'small', 'pair'];
const isUrl = (u) => /^(https?:\/\/|mailto:|tel:)/i.test(String(u || '').trim());

// site settings
const S = await readJSON('content/settings.json');
if (S) {
  const f = 'content/settings.json';
  if (!S.name) err(f, 'name is empty');
  if (!/^https:\/\/.+\/$/.test(S.url || '')) err(f, `url must be the site address ending in "/", got "${S.url || ''}"`);
  if (S.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.email)) err(f, `email "${S.email}" is not an email address`);
  if (S.music_volume != null && !(Number(S.music_volume) >= 0 && Number(S.music_volume) <= 100)) err(f, 'music_volume must be 0–100');
  for (const k of ['wechat_qr', 'music_file']) {
    const rel = S[k] && resolveImage(S[k], 'content/uploads');
    if (rel && !(await exists(rel))) err(f, `${k} points to "${S[k]}", which does not exist`);
  }
  if (S.studio_lat != null && S.studio_lat !== '' && !(Math.abs(Number(S.studio_lat)) <= 90)) err(f, `studio_lat "${S.studio_lat}" is not a latitude (−90 to 90)`);
  if (S.studio_lon != null && S.studio_lon !== '' && !(Math.abs(Number(S.studio_lon)) <= 180)) err(f, `studio_lon "${S.studio_lon}" is not a longitude (−180 to 180)`);
  (S.socials || []).forEach((s, i) => { if (s?.url && !isUrl(s.url)) warn(f, `socials[${i}] (${s.label}) "${s.url}" is not a web, mail or phone link and will not be shown`); });
  if (S.form_endpoint && !/^https:\/\//i.test(S.form_endpoint)) warn(f, 'form_endpoint must start with https:// to be used');
  for (const k of ['description', 'statement', 'about_intro', 'contact_lede']) if (S[`${k}_zh`] && !S[`${k}_en`]) warn(f, `${k}_en is empty; the English pages show the Chinese text`);
}

// films
const FL = await readJSON('content/films.json');
if (FL) {
  const f = 'content/films.json';
  for (const [i, x] of (FL.films || []).entries()) {
    if (!x.title_zh) err(f, `films[${i}] has no title_zh`);
    if (x.bvid && !parseBili(x.bvid)) warn(f, `films[${i}] "${x.title_zh}": "${x.bvid}" is not a BV id, av number, video link or embed code`);
    const rel = x.cover && resolveImage(x.cover, 'content/films');
    if (rel && !(await exists(rel))) err(f, `films[${i}] cover "${x.cover}" does not exist`);
  }
}

// series
const dirs = (await fs.readdir(path.join(ROOT, 'content/series'), { withFileTypes: true })).filter((d) => d.isDirectory());
let published = 0;
for (const d of dirs) {
  const dir = `content/series/${d.name}`, f = `${dir}/index.json`;
  if (!(await exists(f))) { warn(dir, 'has no index.json and is skipped'); continue; }
  const e = await readJSON(f);
  if (!e) continue;
  if (!/^[a-z0-9-]+$/.test(d.name)) err(dir, 'folder name must use lowercase letters, digits and hyphens (it becomes the page address)');
  if (!e.title_zh) err(f, 'title_zh is empty');
  if (e.order != null && !Number.isFinite(Number(e.order))) err(f, `order "${e.order}" is not a number`);
  const frames = [...(e.frames || []), ...[].concat(e.bulk || []).filter(Boolean).map((image) => ({ image }))];
  if (!frames.length && !e.draft) err(f, 'has no photographs; add some or mark the series as a draft');
  for (const [i, fr] of (e.frames || []).entries()) {
    if (!fr.image) { err(f, `frames[${i}] has no image`); continue; }
    if (fr.layout && !LAYOUTS.includes(fr.layout)) err(f, `frames[${i}] layout "${fr.layout}" is not one of ${LAYOUTS.join(', ')}`);
  }
  const pairs = (e.frames || []).map((x) => x.layout === 'pair');
  for (let i = 0; i < pairs.length; i++) if (pairs[i]) { if (pairs[i + 1]) i++; else warn(f, `frames[${i}] is a "pair" without a partner and is shown on its own`); }
  for (const fr of frames) {
    const rel = fr.image && resolveImage(fr.image, dir);
    if (rel && !(await exists(rel))) err(f, `image "${fr.image}" does not exist`);
  }
  if (!e.draft && frames.length) published += 1;
}
if (!published) err('content/series', 'no published series; the home page and works page would be empty');

for (const w of warnings) console.warn(`  warning  ${w}`);
if (errors.length) {
  for (const x of errors) console.error(`  error    ${x}`);
  console.error(`\ncontent: ${errors.length} error(s); fix them in the admin (or the files above) and save again`);
  process.exit(1);
}
console.log(`content ok: ${published} series${warnings.length ? `, ${warnings.length} warning(s)` : ''}`);
