import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, 'site');
const pages = readdirSync(root).filter((f) => f.endsWith('.html'));

// Every browser that runs this site reads WOFF2, so the WOFF fallbacks in the font packages are dropped from
// each @font-face: half the font CSS, and about 25 MB of files that were never requested are not published.
const woff2Only = {
  postcssPlugin: 'woff2-only',
  AtRule: {
    'font-face': (rule) => {
      rule.walkDecls('src', (d) => {
        const parts = d.value.split(/,(?![^(]*\))/).map((s) => s.trim());
        const kept = parts.filter((s) => !/format\(\s*['"]?woff['"]?\s*\)/i.test(s));
        if (kept.length && kept.length < parts.length) d.value = kept.join(', ');
      });
    },
  },
};

// Vite has already emitted those files by the time the CSS is rewritten; leave out any font no CSS still names.
const dropUnusedFonts = {
  name: 'drop-unused-fonts',
  apply: 'build',
  generateBundle(_, bundle) {
    const text = Object.values(bundle)
      .map((f) => (f.type === 'chunk' ? f.code : /\.(css|html)$/.test(f.fileName) ? String(f.source) : ''))
      .join('\n');
    for (const [name, f] of Object.entries(bundle)) {
      if (f.type === 'asset' && /\.woff2?$/.test(name) && !text.includes(name.split('/').pop())) delete bundle[name];
    }
  },
};

export default defineConfig({
  root,
  base: './',
  publicDir: resolve(root, 'public'),
  css: { postcss: { plugins: [woff2Only] } },
  plugins: [dropUnusedFonts],
  build: {
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 700,
    rollupOptions: { input: Object.fromEntries(pages.map((f) => [f.replace(/\.html$/, ''), resolve(root, f)])) },
  },
  server: { host: true },
});
