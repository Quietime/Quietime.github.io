#!/usr/bin/env node
// Reads the official React Bits registry (https://reactbits.dev/r/) and prints to stdout. Writes no files.
//   node .claude/skills/react-bits/scripts/rb.mjs list [words...]        components whose name or description match
//   node .claude/skills/react-bits/scripts/rb.mjs get <Name> [JS-CSS]     a component's files, dependencies and notes
// Variants: JS-CSS (default), JS-TW, TS-CSS, TS-TW. Needs Node 18+ (fetch).
const BASE = 'https://reactbits.dev/r';
const VARIANTS = ['JS-CSS', 'JS-TW', 'TS-CSS', 'TS-TW'];

async function json(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

async function list(words) {
  const { items = [] } = await json(`${BASE}/registry.json`);
  const seen = new Map();
  for (const it of items) {
    const title = it.title || it.name.replace(/-(JS|TS)-(CSS|TW)$/, '');
    if (seen.has(title)) continue;
    seen.set(title, { title, description: it.description || '', deps: it.dependencies || [] });
  }
  const q = words.map((w) => w.toLowerCase());
  const rows = [...seen.values()].filter((x) => q.every((w) => `${x.title} ${x.description}`.toLowerCase().includes(w)));
  for (const x of rows) console.log(`${x.title.padEnd(24)} ${x.description}${x.deps.length ? `  [${x.deps.join(', ')}]` : ''}`);
  console.error(`\n${rows.length} of ${seen.size} components. Get one with: rb.mjs get <Name> [${VARIANTS.join('|')}]`);
}

async function get(name, variant = 'JS-CSS') {
  if (!name) throw new Error('usage: rb.mjs get <Name> [variant]');
  if (!VARIANTS.includes(variant)) throw new Error(`variant must be one of ${VARIANTS.join(', ')}`);
  const it = await json(`${BASE}/${encodeURIComponent(name)}-${variant}.json`);
  console.log(`# ${it.title || name} (${variant})\n${it.description || ''}\n`);
  console.log(`npm dependencies: ${(it.dependencies || []).join(', ') || 'none'}`);
  if (it.registryDependencies?.length) console.log(`registry dependencies: ${it.registryDependencies.join(', ')}`);
  console.log('License: MIT + Commons Clause. Use it inside this website; do not redistribute the component itself.\n');
  for (const f of it.files || []) console.log(`----- ${f.path} -----\n${f.content}\n`);
}

const [cmd, ...args] = process.argv.slice(2);
try {
  if (cmd === 'list') await list(args);
  else if (cmd === 'get') await get(args[0], args[1]);
  else { console.error('usage: rb.mjs list [words...] | rb.mjs get <Name> [JS-CSS|JS-TW|TS-CSS|TS-TW]'); process.exit(2); }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
