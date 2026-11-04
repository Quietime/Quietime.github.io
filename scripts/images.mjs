// Turns content/photos/<series>/* into responsive WebP + JPEG files under site/public/photos,
// and writes content/photos.json (sizes, average colour, EXIF). GPS data is never copied.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import exifReader from 'exif-reader';
import { moonSVG } from './moon.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'content/photos');
const OUT = path.join(ROOT, 'site/public/photos');
const STEPS = [480, 960, 1600, 2400];
const EXT = /\.(jpe?g|png|webp|tiff?)$/i;

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function mtime(p) { try { return (await fs.stat(p)).mtimeMs; } catch { return 0; } }

function readExif(buf) {
  if (!buf) return null;
  try {
    const e = exifReader(buf);
    const ph = e.Photo || e.exif || {};
    const im = e.Image || e.image || {};
    const out = {
      camera: [im.Make, im.Model].filter(Boolean).join(' ').trim() || undefined,
      lens: ph.LensModel || undefined,
      aperture: ph.FNumber ? `f/${+ph.FNumber.toFixed(1)}` : undefined,
      shutter: ph.ExposureTime ? (ph.ExposureTime >= 1 ? `${ph.ExposureTime}s` : `1/${Math.round(1 / ph.ExposureTime)}s`) : undefined,
      iso: ph.ISOSpeedRatings ? `ISO ${ph.ISOSpeedRatings}` : undefined,
      focal: ph.FocalLength ? `${Math.round(ph.FocalLength)}mm` : undefined,
    };
    return Object.values(out).some(Boolean) ? out : null;
  } catch { return null; }
}

const manifest = {};
const dirs = (await fs.readdir(SRC, { withFileTypes: true })).filter((d) => d.isDirectory());
for (const d of dirs) {
  const slug = d.name;
  const files = (await fs.readdir(path.join(SRC, slug))).filter((f) => EXT.test(f)).sort();
  await fs.mkdir(path.join(OUT, slug), { recursive: true });
  manifest[slug] = [];
  for (const [i, file] of files.entries()) {
    const src = path.join(SRC, slug, file);
    const base = String(i + 1).padStart(2, '0');
    const img = sharp(src).rotate();
    const meta = await sharp(src).metadata();
    const swap = (meta.orientation || 1) >= 5;
    const W = swap ? meta.height : meta.width;
    const H = swap ? meta.width : meta.height;
    const widths = [...STEPS.filter((w) => w < W), Math.min(W, 2400)].filter((v, k, a) => a.indexOf(v) === k);
    const srcTime = await mtime(src);
    for (const w of widths) {
      for (const [ext, opts] of [['webp', { quality: 82 }], ['jpg', { quality: 84, mozjpeg: true, progressive: true }]]) {
        const out = path.join(OUT, slug, `${base}-${w}.${ext}`);
        if ((await mtime(out)) > srcTime) continue;
        const pipe = img.clone().resize({ width: w, withoutEnlargement: true }).toColourspace('srgb');
        await (ext === 'webp' ? pipe.webp(opts) : pipe.jpeg(opts)).toFile(out);
      }
    }
    const { dominant } = await sharp(src).resize(32).stats();
    const color = `rgb(${dominant.r} ${dominant.g} ${dominant.b})`;
    manifest[slug].push({ n: i + 1, base, w: W, h: H, widths, color, exif: readExif(meta.exif) });
  }
  console.log(`photos: ${slug} ${files.length}`);
}
await fs.writeFile(path.join(ROOT, 'content/photos.json'), JSON.stringify(manifest, null, 1));

// Brand assets: favicon, touch icon, social card.
const fixed = {
  'm-d0': '#B9B2A8', 'm-d1': '#B1AAA0', 'm-d2': '#A9A298', 'm-d3': '#A19A90', 'm-d4': '#999288',
  'm-d5': '#918A80', 'm-d6': '#888177', 'm-d7': '#7F786E', 'm-d8': '#756E64',
  'm-l0': '#FBF8F2', 'm-l1': '#F2EEE7', 'm-l2': '#E8E3DB', 'm-l3': '#DFD9D0', 'm-l4': '#D6D0C6',
  'm-l5': '#CEC8BE', 'm-l6': '#C6C0B6', 'm-l7': '#BEB8AE', 'm-l8': '#B6B0A6', 'm-hl': '#FFFFFF',
};
let staticMoon = moonSVG({ id: 'f' }).replace(/var\(--([a-z0-9-]+)\)/g, (_, k) => fixed[k] || '#999');
staticMoon = staticMoon.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
await fs.writeFile(path.join(ROOT, 'site/public/favicon.svg'), staticMoon);
const moonBuf = Buffer.from(staticMoon);
if (!(await exists(path.join(ROOT, 'site/public/apple-touch-icon.png')))) {
  await sharp({ create: { width: 180, height: 180, channels: 3, background: '#EFE6D8' } })
    .composite([{ input: await sharp(moonBuf, { density: 144 }).resize(140, 140).png().toBuffer(), top: 20, left: 20 }])
    .png().toFile(path.join(ROOT, 'site/public/apple-touch-icon.png'));
}
if (!(await exists(path.join(ROOT, 'site/public/og.jpg')))) {
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#1B1612' } })
    .composite([{ input: await sharp(moonBuf, { density: 300 }).resize(470, 470).png().toBuffer(), top: 80, left: 640 }])
    .jpeg({ quality: 86 }).toFile(path.join(ROOT, 'site/public/og.jpg'));
}
console.log('brand assets ok');
