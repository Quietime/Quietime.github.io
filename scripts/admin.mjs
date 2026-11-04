// Copies the Sveltia CMS bundle into site/public/admin so the admin backend is self-hosted.
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './content.mjs';
const from = path.join(ROOT, 'node_modules/@sveltia/cms/dist');
const to = path.join(ROOT, 'site/public/admin');
await fs.mkdir(path.join(to, 'chunks'), { recursive: true });
await fs.copyFile(path.join(from, 'sveltia-cms.mjs'), path.join(to, 'sveltia-cms.mjs'));
for (const f of await fs.readdir(path.join(from, 'chunks'), { withFileTypes: true })) {
  if (f.isFile() && f.name.endsWith('.js')) await fs.copyFile(path.join(from, 'chunks', f.name), path.join(to, 'chunks', f.name));
  if (f.isDirectory()) await fs.cp(path.join(from, 'chunks', f.name), path.join(to, 'chunks', f.name), { recursive: true });
}
console.log('admin ok');
