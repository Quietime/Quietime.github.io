// Turns every photo referenced by the content into responsive WebP + JPEG files under
// site/public/photos and writes .cache/photos.json (sizes, average colour, EXIF).
// GPS and other metadata are never copied into the published files.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import exifReader from 'exif-reader';
import { moonSVG } from './moon.mjs';
import { ROOT, loadContent } from './content.mjs';

const OUT = path.join(ROOT, 'site/public/photos');
const STEPS = [480, 960, 1600, 2400];

const mtime = async (p) => { try { return (await fs.stat(p)).mtimeMs; } catch { return 0; } };
const exists = async (p) => (await mtime(p)) > 0;
const clean = (s) => s.toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-|-$/g, '') || 'img';

function readExif(buf) {
  if (!buf) return null;
  try {
    const e = exifReader(buf);
    const ph = e.Photo || e.exif || {};
    const im = e.Image || e.image || {};
    const make = String(im.Make || '').trim();
    let model = String(im.Model || '').trim();
    if (make && model.toLowerCase().startsWith(make.toLowerCase())) model = model.slice(make.length).trim();
    const out = {
      camera: [make, model].filter(Boolean).join(' ') || undefined,
      lens: ph.LensModel || undefined,
      focal: ph.FocalLength ? `${Math.round(ph.FocalLength)}mm` : undefined,
      aperture: ph.FNumber ? `f/${+Number(ph.FNumber).toFixed(1)}` : undefined,
      shutter: ph.ExposureTime ? (ph.ExposureTime >= 1 ? `${ph.ExposureTime}s` : `1/${Math.round(1 / ph.ExposureTime)}s`) : undefined,
      iso: ph.ISOSpeedRatings ? `ISO ${[].concat(ph.ISOSpeedRatings)[0]}` : undefined,
    };
    return Object.values(out).some(Boolean) ? out : null;
  } catch { return null; }
}

async function processImage(rel, group) {
  const src = path.join(ROOT, rel);
  if (!(await exists(src))) { console.warn(`  missing image: ${rel}`); return null; }
  const meta = await sharp(src).metadata();
  const swap = (meta.orientation || 1) >= 5;
  const W = swap ? meta.height : meta.width;
  const H = swap ? meta.width : meta.height;
  const base = clean(path.basename(rel));
  const widths = [...STEPS.filter((w) => w < W), Math.min(W, 2400)].filter((v, k, a) => a.indexOf(v) === k);
  await fs.mkdir(path.join(OUT, group), { recursive: true });
  const srcTime = await mtime(src);
  for (const w of widths) {
    for (const ext of ['webp', 'jpg']) {
      const out = path.join(OUT, group, `${base}-${w}.${ext}`);
      if ((await mtime(out)) > srcTime) continue;
      const pipe = sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).toColourspace('srgb');
      await (ext === 'webp' ? pipe.webp({ quality: 82 }) : pipe.jpeg({ quality: 84, mozjpeg: true, progressive: true })).toFile(out);
    }
  }
  const { dominant } = await sharp(src).rotate().resize(32).stats();
  return {
    dir: `photos/${group}`, base, w: W, h: H, widths,
    color: `rgb(${dominant.r} ${dominant.g} ${dominant.b})`, exif: readExif(meta.exif),
  };
}

const content = await loadContent();
const manifest = {};
for (const s of content.series) {
  for (const f of s.frames) manifest[f.src] ??= await processImage(f.src, s.slug);
  console.log(`photos: ${s.slug} ${s.frames.length}`);
}
for (const f of content.films) if (f.src) manifest[f.src] ??= await processImage(f.src, 'films');
if (content.contact.qr) manifest[content.contact.qr] ??= await processImage(content.contact.qr, 'brand');
await fs.mkdir(path.join(ROOT, '.cache'), { recursive: true });
await fs.writeFile(path.join(ROOT, '.cache/photos.json'), JSON.stringify(manifest, null, 1));

// background music uploaded in the admin
const media = {};
if (content.music.file && (await exists(path.join(ROOT, content.music.file)))) {
  const name = `music${path.extname(content.music.file).toLowerCase() || '.mp3'}`;
  await fs.mkdir(path.join(ROOT, 'site/public/media'), { recursive: true });
  await fs.copyFile(path.join(ROOT, content.music.file), path.join(ROOT, 'site/public/media', name));
  media.music = `media/${name}`;
}
await fs.writeFile(path.join(ROOT, '.cache/media.json'), JSON.stringify(media));

// Brand assets: favicon, touch icon, social card.
const fixed = {
  'm-d0': '#B9B2A8', 'm-d1': '#B1AAA0', 'm-d2': '#A9A298', 'm-d3': '#A19A90', 'm-d4': '#999288',
  'm-d5': '#918A80', 'm-d6': '#888177', 'm-d7': '#7F786E', 'm-d8': '#756E64',
  'm-l0': '#FBF8F2', 'm-l1': '#F2EEE7', 'm-l2': '#E8E3DB', 'm-l3': '#DFD9D0', 'm-l4': '#D6D0C6',
  'm-l5': '#CEC8BE', 'm-l6': '#C6C0B6', 'm-l7': '#BEB8AE', 'm-l8': '#B6B0A6', 'm-hl': '#FFFFFF',
};
const staticMoon = moonSVG({ id: 'f' })
  .replace(/var\(--([a-z0-9-]+)\)/g, (_, k) => fixed[k] || '#999')
  .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
await fs.writeFile(path.join(ROOT, 'site/public/favicon.svg'), staticMoon);
const moonPng = (size, density) => sharp(Buffer.from(staticMoon), { density }).resize(size, size).png().toBuffer();
if (!(await exists(path.join(ROOT, 'site/public/apple-touch-icon.png')))) {
  await sharp({ create: { width: 180, height: 180, channels: 3, background: '#EFE6D8' } })
    .composite([{ input: await moonPng(140, 144), top: 20, left: 20 }]).png()
    .toFile(path.join(ROOT, 'site/public/apple-touch-icon.png'));
}
if (!(await exists(path.join(ROOT, 'site/public/og.jpg')))) {
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#1B1612' } })
    .composite([{ input: await moonPng(470, 300), top: 80, left: 640 }]).jpeg({ quality: 86 })
    .toFile(path.join(ROOT, 'site/public/og.jpg'));
}
// installable app icons (plain and maskable)
for (const [file, size, pad] of [['icon-192.png', 192, 0.14], ['icon-512.png', 512, 0.14], ['icon-maskable-512.png', 512, 0.24]]) {
  if (await exists(path.join(ROOT, 'site/public', file))) continue;
  const inner = Math.round(size * (1 - pad * 2));
  await sharp({ create: { width: size, height: size, channels: 3, background: '#1B1612' } })
    .composite([{ input: await moonPng(inner, 300), top: Math.round(size * pad), left: Math.round(size * pad) }]).png()
    .toFile(path.join(ROOT, 'site/public', file));
}
console.log('brand assets ok');
