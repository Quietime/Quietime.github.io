// The faces a scene paints onto canvases and the words it paints with them. Kept apart from three.js so a page can
// ask for these glyphs the moment it starts, while three.js is still downloading.
export const FONTS = {
  edge: '"Barlow Condensed", "Arial Narrow", sans-serif',
  display: '"Noto Serif SC", "Songti SC", serif',
  serif: '"Noto Serif SC", "Songti SC", serif',
};

/** [font, text] pairs: the film's edge codes for the spine; the slates' four lines for the darkroom. */
export function canvasText(kind, data) {
  if (kind === 'spine') return [[`500 40px ${FONTS.edge}`, `0123456789A▸ ${data.edge || ''}`]];
  const slates = [data.slates?.head, data.slates?.end, ...(data.series || []).map((s) => s.slate)].filter(Boolean);
  const at = (k) => slates.map((l) => l[k] || '').join('');
  return [[`500 54px ${FONTS.edge}`, `${at(0)}${at(3)}`], [`500 150px ${FONTS.display}`, at(1)], [`400 46px ${FONTS.serif}`, at(2)]];
}

/** Waits for those faces (each Chinese face arrives as the unicode-range slices the words need), at most `ms`. */
export function canvasFonts(specs, ms = 2000) {
  if (!document.fonts?.load) return Promise.resolve();
  const all = Promise.all(specs.filter(([, text]) => text).map(([font, text]) => document.fonts.load(font, text).catch(() => {})));
  return Promise.race([all, new Promise((ok) => { setTimeout(ok, ms); })]);
}
