import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, 'site');
const pages = readdirSync(root).filter((f) => f.endsWith('.html'));

export default defineConfig({
  root,
  base: './',
  publicDir: resolve(root, 'public'),
  build: {
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: { input: Object.fromEntries(pages.map((f) => [f.replace(/\.html$/, ''), resolve(root, f)])) },
  },
  server: { host: true },
});
