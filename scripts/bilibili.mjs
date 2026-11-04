// Reads Bilibili metadata at build time (GitHub Actions has open internet access):
// title, description, cover, duration, publish date, plays and likes, plus aid/cid for the embed player.
// Results go to .cache/bili.json and covers to .cache/bili/<BV>.jpg. Failures never break the build.
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, parseBili } from './content.mjs';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Referer: 'https://www.bilibili.com/',
  Accept: 'application/json, text/plain, */*',
};
const OUT = path.join(ROOT, '.cache');
const timeout = (ms) => AbortSignal.timeout(ms);

async function getJSON(url) {
  const r = await fetch(url, { headers: HEADERS, signal: timeout(12000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function readOne(ref) {
  const q = ref.bvid ? `bvid=${ref.bvid}` : `aid=${ref.aid}`;
  const j = await getJSON(`https://api.bilibili.com/x/web-interface/view?${q}`);
  if (j.code !== 0 || !j.data) throw new Error(`api code ${j.code} ${j.message || ''}`);
  const d = j.data;
  const page = (d.pages || []).find((p) => p.page === ref.p) || (d.pages || [])[0] || {};
  const meta = {
    bvid: d.bvid, aid: d.aid, cid: page.cid || d.cid, p: ref.p,
    title: d.title, desc: d.desc, owner: d.owner?.name || '',
    duration: page.duration || d.duration || 0, pubdate: d.pubdate || 0,
    views: d.stat?.view ?? null, likes: d.stat?.like ?? null, danmaku: d.stat?.danmaku ?? null,
    cover: null,
  };
  if (d.pic) {
    try {
      const url = d.pic.replace(/^http:/, 'https:');
      const r = await fetch(url, { headers: HEADERS, signal: timeout(15000) });
      if (r.ok) {
        await fs.mkdir(path.join(OUT, 'bili'), { recursive: true });
        await fs.writeFile(path.join(OUT, 'bili', `${d.bvid}.jpg`), Buffer.from(await r.arrayBuffer()));
        meta.cover = `.cache/bili/${d.bvid}.jpg`;
      }
    } catch (e) {
      console.warn(`  bilibili cover ${d.bvid}: ${e.message}`);
    }
  }
  return meta;
}

const { films = [] } = JSON.parse(await fs.readFile(path.join(ROOT, 'content/films.json'), 'utf8'));
let old = {};
try { old = JSON.parse(await fs.readFile(path.join(OUT, 'bili.json'), 'utf8')); } catch { /* first run */ }
const out = {};
for (const f of films) {
  const ref = parseBili(f.bvid);
  if (!ref) continue;
  const key = ref.bvid || `av${ref.aid}`;
  try {
    out[key] = await readOne(ref);
    console.log(`bilibili: ${key} ok (${out[key].title})`);
  } catch (e) {
    if (old[key]) out[key] = old[key];
    console.warn(`bilibili: ${key} metadata unavailable (${e.message}), using the fields filled in the admin`);
  }
}
await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(OUT, 'bili.json'), JSON.stringify(out, null, 1));
