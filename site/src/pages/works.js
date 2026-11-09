// The works page.
import { gsap, ScrollTrigger, reduce, fine, $, $$, go, devIO, splitReveal, sceneData, mountScene } from '../core.js';

export default function works() {
  splitReveal(document, 0.05);
  // the darkroom walk through every series; a print leads to its frame on the series page
  const data = sceneData();
  mountScene('darkroom', data, (si, fi) => { const s = data.series[si]; if (s?.href) go(`${s.href}#f${fi + 1}`); });
  if (!reduce) {
    $$('.ws').forEach((ws) => {
      gsap.fromTo($('.ws-img img', ws), { scale: 1.14 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: ws, start: 'top bottom', end: 'center 55%', scrub: true } });
      gsap.fromTo($('.ws-text', ws), { y: 90 }, { y: 0, ease: 'none', scrollTrigger: { trigger: ws, start: 'top bottom', end: 'center 50%', scrub: true } });
    });
  }
  const btns = $$('[data-view]');
  const panels = $$('[data-panel]');
  btns.forEach((b) => b.addEventListener('click', () => {
    btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    panels.forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.view; });
    const shown = $(`[data-panel="${b.dataset.view}"]`);
    $$('img.dev', shown).forEach((img) => devIO.observe(img));
    if (!reduce) gsap.fromTo($$('.ws, .sheet', shown), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: 'springFirm', stagger: 0.06 });
    ScrollTrigger.refresh();
  }));

  // loupe over the contact sheet
  const sheet = $('[data-panel="sheet"]');
  const loupe = $('[data-loupe]');
  if (sheet && loupe && fine) {
    sheet.classList.add('has-loupe');
    const Z = 2.6, R = 95;
    sheet.addEventListener('pointermove', (e) => {
      const cell = e.target.closest('.sc');
      if (!cell) { loupe.classList.remove('on'); return; }
      const im = $('img', cell);
      const r = im.getBoundingClientRect();
      const nr = im.naturalWidth / im.naturalHeight || 1.5;
      let w = r.width, h = r.width / nr;
      if (h > r.height) { h = r.height; w = h * nr; }
      const ox = r.left + (r.width - w) / 2, oy = r.top + (r.height - h) / 2;
      const px = e.clientX - ox, py = e.clientY - oy;
      if (loupe.dataset.src !== cell.dataset.full) { loupe.style.backgroundImage = `url(${cell.dataset.full})`; loupe.dataset.src = cell.dataset.full; }
      loupe.style.backgroundSize = `${w * Z}px ${h * Z}px`;
      loupe.style.backgroundPosition = `${R - px * Z}px ${R - py * Z}px`;
      loupe.style.left = `${e.clientX}px`;
      loupe.style.top = `${e.clientY}px`;
      loupe.classList.add('on');
    });
    sheet.addEventListener('pointerleave', () => loupe.classList.remove('on'));
  }
}
