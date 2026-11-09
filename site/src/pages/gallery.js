// The gallery page.
import { gsap, ScrollTrigger, Flip, reduce, $, $$, devIO, splitReveal } from '../core.js';
import justifiedLayout from 'justified-layout';
import photoLightbox from '../parts/lightbox.js';

/* ── gallery: justified rows (flickr/justified-layout), filters animated with Flip ── */
export default function gallery() {
  splitReveal(document, 0.05);
  const grid = $('[data-gallery-grid]');
  if (!grid) return;
  const tiles = $$('.gl-tile', grid);
  let shown = tiles;
  function layout() {
    const w = grid.clientWidth;
    const narrow = w < 700;
    const geo = justifiedLayout(shown.map((t) => Number(t.dataset.ar) || 1.5), {
      containerWidth: w,
      containerPadding: 0,
      boxSpacing: narrow ? 6 : 14,
      targetRowHeight: narrow ? 150 : Math.max(240, Math.min(360, w / 4.2)),
      targetRowHeightTolerance: 0.25,
    });
    shown.forEach((t, i) => {
      const b = geo.boxes[i];
      Object.assign(t.style, { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` });
    });
    grid.style.height = `${geo.containerHeight}px`;
  }
  layout();
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layout(); ScrollTrigger.refresh(); }, 120); });

  const btns = $$('[data-filter]');
  btns.forEach((b) => b.addEventListener('click', () => {
    btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const f = b.dataset.filter;
    const state = Flip.getState(tiles);
    shown = tiles.filter((t) => f === 'all' || t.dataset.series === f);
    tiles.forEach((t) => t.classList.toggle('is-out', !shown.includes(t)));
    layout();
    shown.forEach((t) => devIO.observe($('img', t)));
    if (!reduce) {
      Flip.from(state, {
        duration: 0.8, ease: 'springCrit', absolute: true, stagger: 0.012,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'springFirm' }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.9, duration: 0.4 }),
      });
    }
    ScrollTrigger.refresh();
  }));

  if (!reduce) {
    tiles.forEach((t) => gsap.fromTo($('img', t), { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: t, start: 'top bottom', end: 'center 60%', scrub: true } }));
  }
  photoLightbox('[data-gallery-grid]', 'a.gl-tile:not(.is-out)');
}
