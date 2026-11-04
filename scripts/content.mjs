// Reads everything the admin backend (Sveltia CMS) edits and resolves it for one language:
//   content/settings.json        site wording, contact, socials, about, music
//   content/films.json           Bilibili films
//   content/series/<slug>/index.json + the photos next to it
// Text fields carry a language suffix (title_zh, title_en, title_ja). A missing translation
// falls back to Chinese, so a new language can be filled in gradually.
import fs from 'node:fs/promises';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = async (p) => JSON.parse(await fs.readFile(path.join(ROOT, p), 'utf8'));

// Image values come either relative to the entry ("03.jpg") or from the repo root ("/content/films/x.jpg").
export function resolveImage(value, entryDir) {
  if (!value) return null;
  const v = String(value).trim();
  const rel = v.startsWith('/') ? v.slice(1) : path.posix.join(entryDir, v);
  return path.posix.normalize(rel);
}

// Accepts a BV id, a video URL, an "av" number, or the iframe embed code from Bilibili's share menu.
export function parseBili(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const bv = s.match(/BV[0-9A-Za-z]{10}/);
  const av = s.match(/(?:[?&]aid=|\bav)(\d+)/i);
  const p = Number((s.match(/[?&](?:p|page)=(\d+)/) || [])[1] || 1);
  if (bv) return { bvid: bv[0], aid: null, p };
  if (av) return { bvid: null, aid: av[1], p };
  return null;
}

// pick(obj, 'title', 'en') -> obj.title_en, then obj.title_zh, then obj.title
export const pick = (o, key, lang) => (o ? o[`${key}_${lang}`] || o[`${key}_zh`] || o[key] || '' : '');

export async function loadContent(lang = 'zh') {
  const S = await read('content/settings.json');
  let bili = {};
  try { bili = await read('.cache/bili.json'); } catch { /* no metadata yet */ }
  const { films = [] } = await read('content/films.json');
  const dirs = (await fs.readdir(path.join(ROOT, 'content/series'), { withFileTypes: true })).filter((d) => d.isDirectory());
  const series = [];
  for (const d of dirs) {
    const dir = `content/series/${d.name}`;
    let e;
    try { e = await read(`${dir}/index.json`); } catch { continue; }
    if (e.draft) continue;
    const frames = (e.frames || [])
      .map((f) => ({ src: resolveImage(f.image, dir), caption: pick(f, 'caption', lang), layout: f.layout || 'right' }))
      .filter((f) => f.src);
    if (!frames.length) continue;
    series.push({
      slug: d.name,
      title: pick(e, 'title', lang) || d.name,
      sub: lang === 'en' ? e.title_zh || '' : e.title_en || '',
      order: Number(e.order ?? 100),
      statement: pick(e, 'statement', lang),
      meta: (e.meta || []).map((m) => [pick(m, 'k', lang), pick(m, 'v', lang)]).filter(([k, v]) => k && v),
      frames,
    });
  }
  series.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  const name = S.name || 'Quietime';
  const nameZh = S.name_zh || '静夜工作室';
  return {
    site: {
      name, nameZh, title: `${name} ${nameZh}`,
      description: pick(S, 'description', lang),
      url: S.url || 'https://quietime.github.io/',
      statement: pick(S, 'statement', lang).split('\n').filter(Boolean),
      edgeCode: S.edge_code || 'QUIETIME 400',
      samples: Boolean(S.samples),
      sampleCredit: pick(S, 'sample_credit', lang),
    },
    contact: {
      wechat: S.wechat || '', email: S.email || '', copyright: S.copyright || '',
      lede: pick(S, 'contact_lede', lang), formEndpoint: S.form_endpoint || '',
      qr: resolveImage(S.wechat_qr, 'content/uploads'),
      process: (S.process || []).map((p) => ({ title: pick(p, 'title', lang), text: pick(p, 'text', lang) })).filter((p) => p.title),
      faq: (S.faq || []).map((q) => ({ q: pick(q, 'q', lang), a: pick(q, 'a', lang) })).filter((q) => q.q),
    },
    music: {
      on: S.music_on !== false,
      file: S.music_file ? resolveImage(S.music_file, 'content/uploads') : '',
      volume: Math.min(100, Math.max(5, Number(S.music_volume ?? 40))) / 100,
    },
    socials: (S.socials || []).filter((s) => s && s.label),
    homeTeaser: pick(S, 'home_teaser', lang),
    about: {
      intro: pick(S, 'about_intro', lang).split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean),
      services: (S.services || []).map((s) => [pick(s, 'title', lang), pick(s, 'text', lang)]).filter(([t]) => t),
    },
    films: films.map((f) => {
      const ref = parseBili(f.bvid);
      const meta = ref ? bili[ref.bvid || `av${ref.aid}`] || null : null;
      return {
        ref, meta,
        bvid: meta?.bvid || ref?.bvid || '',
        aid: meta?.aid || ref?.aid || '',
        cid: meta?.cid || '',
        p: ref?.p || 1,
        title: pick(f, 'title', lang) || meta?.title || '',
        sub: lang === 'en' ? f.title_zh || '' : f.title_en || '',
        kind: pick(f, 'kind', lang),
        src: resolveImage(f.cover, 'content/films') || meta?.cover || null,
      };
    }),
    series,
  };
}
