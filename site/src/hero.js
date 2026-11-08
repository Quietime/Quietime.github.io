// The title card on the home page.
// The letters fall in under gravity (1 m drawn as 400 px, so g = 3920 px/s²) and bounce on the baseline with a
// coefficient of restitution of 0.32 until they come to rest. After that each letter hangs on a spring
// (f = 2.2 Hz, ζ = 0.45): a pointer sweeping through hands it a quarter of its velocity (Gaussian falloff, capped
// at 900 px/s) and it swings back. The photograph inside the stencilled letters follows the pointer on a soft
// spring, as if the print slid under the stencil.
import { Spring } from './physics/spring.js';

const G = 3920, E = 0.32;

export default function hero(root, { photo, reduce }) {
  const title = root.querySelector('[data-hero-title]');
  const zh = root.querySelector('[data-hero-zh]');
  if (!title) return;
  const letters = [];
  const split = (el, delay0) => {
    if (!el) return;
    const txt = el.textContent.trim();
    el.textContent = '';
    [...txt].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'l'; s.textContent = ch; s.setAttribute('aria-hidden', 'true');
      el.append(s);
      letters.push({ el: s, x: 0, y: reduce ? 0 : -(0.7 + 0.5 * Math.random()) * innerHeight, vx: 0, vy: 0,
        a: reduce ? 0 : (Math.random() - 0.5) * 0.5, va: 0, t0: delay0 + i * 0.075, landed: reduce });
    });
  };
  split(title, 0.15); split(zh, 0.75);
  // an absolute address: a relative url() inside a custom property would resolve against the stylesheet
  if (photo) title.style.setProperty('--img', `url("${new URL(photo, location.href).href}")`);
  else title.classList.add('no-img');

  // the title fills the width: measured at 100 px, then scaled
  const fit = () => {
    title.style.fontSize = '100px';
    const cs = getComputedStyle(root);
    const room = root.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    title.style.fontSize = `${Math.floor(((100 * room) / title.scrollWidth) * 0.985)}px`;
    title.style.setProperty('--bw', `${title.scrollWidth * 1.18}px`);
    title.querySelectorAll('.l').forEach((l) => l.style.setProperty('--ox', `${l.offsetLeft}px`));
  };
  fit();
  addEventListener('resize', fit);
  document.fonts?.load('400 100px "Anton"', 'QUIETIME').then(fit).catch(() => {});

  // the loop runs only while the card is on screen and something is still moving; a pointer wakes it
  let visible = true, raf = 0, last = 0;
  const wake = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) wake(); }).observe(root);

  const pan = new Spring({ freq: 0.7, zeta: 0.9 });
  let px = 0, py = 0, pt = 0;
  addEventListener('pointermove', (e) => {
    const now = performance.now(), dt = Math.max(0.008, (now - pt) / 1000);
    const vx = pt ? (e.clientX - px) / dt : 0, vy = pt ? (e.clientY - py) / dt : 0;
    px = e.clientX; py = e.clientY; pt = now;
    if (!visible) return;
    pan.target = -(e.clientX / innerWidth - 0.5) * innerWidth * 0.16;
    wake();
    if (reduce) return;
    for (const L of letters) {
      if (!L.landed) continue;
      const r = L.el.getBoundingClientRect(), dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2);
      const fall = Math.exp(-(dx * dx + dy * dy) / (2 * (r.height * 0.5) ** 2));
      if (fall < 0.03) continue;
      L.vx += vx * 0.25 * fall; L.vy += vy * 0.25 * fall;
      const sp = Math.hypot(L.vx, L.vy);
      if (sp > 900) { L.vx *= 900 / sp; L.vy *= 900 / sp; }
      L.va = Math.max(-1.2, Math.min(1.2, L.va + vx * 0.00005 * fall));
    }
  }, { passive: true });

  let clock = 0;
  const w = 2 * Math.PI * 2.2, z = 0.45, wr = 2 * Math.PI * 1.6;
  const lastStart = letters.reduce((m, L) => Math.max(m, L.t0), 0);
  const still = (L) => L.landed && Math.abs(L.x) + Math.abs(L.y) < 0.05 && Math.abs(L.vx) + Math.abs(L.vy) < 0.5 && Math.abs(L.a) + Math.abs(L.va) < 1e-3;
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
    title.style.setProperty('--pan', `${pan.step(dt).toFixed(1)}px`);
    const n = Math.max(1, Math.round(dt / (1 / 240))), h = dt / n;
    for (const L of letters) {
      if (clock < L.t0) { L.el.style.transform = `translate(0, ${L.y}px)`; continue; }
      for (let i = 0; i < n; i++) {
        if (!L.landed) {
          L.vy += G * h; L.y += L.vy * h;
          L.va += (-(wr * wr) * L.a - 2 * 0.3 * wr * L.va) * h; L.a += L.va * h;
          if (L.y >= 0) { L.y = 0; L.vy = -E * L.vy; L.va -= 2.2 * L.a; if (Math.abs(L.vy) < 60) { L.vy = 0; L.landed = true; } }
        } else {
          L.vx += (-w * w * L.x - 2 * z * w * L.vx) * h; L.x += L.vx * h;
          L.vy += (-w * w * L.y - 2 * z * w * L.vy) * h; L.y += L.vy * h;
          L.va += (-w * w * L.a - 2 * z * w * L.va) * h; L.a += L.va * h;
        }
      }
      L.el.style.transform = `translate(${L.x.toFixed(1)}px, ${L.y.toFixed(1)}px) rotate(${L.a.toFixed(4)}rad)`;
    }
    const busy = clock < lastStart + 0.1 || !pan.atRest(0.1) || !letters.every(still);
    raf = busy && visible ? requestAnimationFrame(tick) : 0;
  }
  wake();
}
