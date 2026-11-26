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
    grid.classList.add('is-laid');
  }
  layout();
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layout(); ScrollTrigger.refresh(); }, 120); });

  // a filter: the prints that go shrink and fade first; then the grid is laid out again. Prints that were on or near
  // the screen slide to their new places (Flip); prints coming from far down the page appear where they land
  // instead of flying across it. A quick second click wins.
  const btns = $$('[data-filter]');
  let turn = 0;
  const near = (r) => r.bottom > -innerHeight * 0.5 && r.top < innerHeight * 1.5;
  btns.forEach((b) => b.addEventListener('click', async () => {
    btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const f = b.dataset.filter, me = ++turn;
    const next = tiles.filter((t) => f === 'all' || t.dataset.series === f);
    const going = shown.filter((t) => !next.includes(t));
    if (!reduce && going.length) {
      await gsap.to(going, { opacity: 0, scale: 0.92, duration: 0.22, ease: 'power2.in', stagger: { amount: 0.08 }, overwrite: true });
      if (me !== turn) return;
    }
    const was = new Map(tiles.map((t) => [t, t.classList.contains('is-out') ? null : t.getBoundingClientRect()]));
    const state = Flip.getState(next);
    shown = next;
    tiles.forEach((t) => t.classList.toggle('is-out', !shown.includes(t)));
    gsap.set(going, { clearProps: 'opacity,transform' });
    layout();
    shown.forEach((t) => devIO.observe($('img', t)));
    if (!reduce) {
      const movers = shown.filter((t) => was.get(t) && near(was.get(t)) && near(t.getBoundingClientRect()));
      const arrivals = shown.filter((t) => !movers.includes(t) && near(t.getBoundingClientRect()));
      Flip.from(state, { targets: movers, duration: 0.8, ease: 'springCrit', stagger: 0.012 });
      gsap.fromTo(arrivals, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'springFirm', stagger: { amount: 0.25 }, overwrite: true });
    }
    ScrollTrigger.refresh();
  }));

  if (!reduce) {
    tiles.forEach((t) => gsap.fromTo($('img', t), { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: t, start: 'top bottom', end: 'center 60%', scrub: true } }));
  }
  photoLightbox('[data-gallery-grid]', 'a.gl-tile:not(.is-out)');
}
