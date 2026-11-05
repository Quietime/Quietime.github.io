// Custom cursor driven by two springs (physics/spring.js):
//   the dot is critically damped and stiff (f = 14 Hz, ζ = 1), so it follows exactly without overshoot;
//   the ring is under-damped and softer (f = 3.2 Hz, ζ = 0.62), so it trails and overshoots by about 8 %.
// Elements can ask for a label with data-cursor="查看"; data-cursor="hide" hides it (the loupe takes over).
import gsap from 'gsap';
import { Spring } from './physics/spring.js';

export default function cursor() {
  const root = document.documentElement;
  const wrap = document.createElement('div');
  wrap.className = 'cursor';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = '<div class="cur-ring"><span class="cur-label"></span></div><div class="cur-dot"></div>';
  document.body.append(wrap);
  root.classList.add('has-cursor');
  const ring = wrap.querySelector('.cur-ring');
  const dot = wrap.querySelector('.cur-dot');
  const label = wrap.querySelector('.cur-label');

  const dx = new Spring({ freq: 14, zeta: 1 }), dy = new Spring({ freq: 14, zeta: 1 });
  const rx = new Spring({ freq: 3.2, zeta: 0.62 }), ry = new Spring({ freq: 3.2, zeta: 0.62 });
  let started = false;

  let mode = '';
  function setMode(next, text = '') {
    if (next === mode && label.textContent === text) return;
    mode = next;
    wrap.dataset.mode = next;
    label.textContent = text;
  }

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (!started) { for (const s of [dx, rx]) s.x = e.clientX; for (const s of [dy, ry]) s.y = e.clientY; started = true; }
    dx.target = rx.target = e.clientX;
    dy.target = ry.target = e.clientY;
    wrap.classList.add('on');
    const t = e.target instanceof Element ? e.target : null;
    const tagged = t?.closest('[data-cursor]');
    if (tagged) {
      const v = tagged.dataset.cursor;
      if (v === 'hide') setMode('hide');
      else setMode('label', v);
      return;
    }
    if (t?.closest('input, textarea, select, [contenteditable]')) setMode('text');
    else if (t?.closest('a, button, summary, label, [role="button"]')) setMode('link');
    else setMode('');
  }, { passive: true });

  gsap.ticker.add((time, deltaMs) => {
    if (!started) return;
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    dot.style.transform = `translate3d(${dx.step(dt)}px, ${dy.step(dt)}px, 0)`;
    ring.style.transform = `translate3d(${rx.step(dt)}px, ${ry.step(dt)}px, 0)`;
  });

  addEventListener('pointerdown', () => wrap.classList.add('down'));
  addEventListener('pointerup', () => wrap.classList.remove('down'));
  document.addEventListener('pointerleave', () => wrap.classList.remove('on'));
  // leaving into an iframe (the Bilibili player) or out of the window
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) wrap.classList.remove('on'); });
  addEventListener('blur', () => wrap.classList.remove('on'));
}
