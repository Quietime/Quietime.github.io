// Reads everything the admin backend (Sveltia CMS) edits:
//   content/settings.json        site name, statement, contact, socials, about
//   content/films.json           Bilibili films
//   content/series/<slug>/index.json + the photos next to it
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

export async function loadContent() {
  const settings = await read('content/settings.json');
  let bili = {};
  try { bili = await read('.cache/bili.json'); } catch { /* no metadata yet */ }
  const { films = [] } = await read('content/films.json');
  const dirs = (await fs.readdir(path.join(ROOT, 'content/series'), { withFileTypes: true })).filter((d) => d.isDirectory());
  const series = [];
  for (const d of dirs) {
    const dir = `content/series/${d.name}`;
    let entry;
    try { entry = await read(`${dir}/index.json`); } catch { continue; }
    if (entry.draft) continue;
    const frames = (entry.frames || [])
      .map((f) => ({ ...f, src: resolveImage(f.image, dir) }))
      .filter((f) => f.src);
    if (!frames.length) continue;
    series.push({
      slug: d.name,
      zh: entry.title_zh || d.name,
      en: entry.title_en || '',
      order: Number(entry.order ?? 100),
      statement: { zh: entry.statement_zh || '', en: entry.statement_en || '' },
      meta: (entry.meta || []).filter((m) => m && m.k && m.v).map((m) => [m.k, m.v]),
      frames,
    });
  }
  series.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  return {
    site: {
      name: settings.name || 'Quietime',
      nameZh: settings.name_zh || '静夜工作室',
      title: `${settings.name || 'Quietime'} ${settings.name_zh || '静夜工作室'}`,
      description: settings.description || '',
      url: settings.url || 'https://quietime.github.io/',
      statement: { zh: String(settings.statement_zh || '').split('\n').filter(Boolean), en: settings.statement_en || '' },
      edgeCode: settings.edge_code || 'QUIETIME 400',
      samples: Boolean(settings.samples),
      sampleCredit: settings.sample_credit || '',
    },
    contact: {
      wechat: settings.wechat || '', email: settings.email || '', copyright: settings.copyright || '',
      lede: settings.contact_lede || '', formEndpoint: settings.form_endpoint || '',
      qr: resolveImage(settings.wechat_qr, 'content/uploads'),
      process: (settings.process || []).filter((s) => s && s.title),
      faq: (settings.faq || []).filter((s) => s && s.q),
    },
    music: {
      on: settings.music_on !== false,
      file: settings.music_file ? resolveImage(settings.music_file, 'content/uploads') : '',
      volume: Math.min(100, Math.max(5, Number(settings.music_volume ?? 40))) / 100,
    },
    socials: (settings.socials || []).filter((s) => s && s.label),
    homeTeaser: settings.home_teaser || '',
    about: {
      intro: String(settings.about_intro || '').split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean),
      services: (settings.services || []).filter((s) => s && s.title).map((s) => [s.title, s.text || '']),
    },
    films: films.map((f) => {
      const ref = parseBili(f.bvid);
      const meta = ref ? bili[ref.bvid || `av${ref.aid}`] || null : null;
      const bvid = meta?.bvid || ref?.bvid || '';
      return {
        ...f,
        ref, meta, bvid,
        aid: meta?.aid || ref?.aid || '',
        cid: meta?.cid || '',
        p: ref?.p || 1,
        title_zh: f.title_zh || meta?.title || '影片',
        src: resolveImage(f.cover, 'content/films') || meta?.cover || null,
      };
    }),
    series,
  };
}
