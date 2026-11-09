// The title card on the home page. QUIETIME is painted on a canvas behind the page text (sky/scene.js): the sky over
// the studio at this moment, from the sun's and moon's real positions and the weather outside its window, seen
// through the letters as ink spreads into them. The h1 stays real text for screen readers and search, transparent
// once the canvas has drawn.
// After the entrance each letter hangs on a spring (f = 2.2 Hz, ζ = 0.45): a pointer sweeping through hands it a
// quarter of its velocity (Gaussian falloff, capped at 900 px/s) and it swings back.
import { frameTime, substeps } from './physics/spring.js';
import { astro, phaseKey } from './sky/astro.js';
import { makeSky } from './sky/scene.js';
import { studioWeather } from './sky/weather.js';

const TEXT = 'QUIETIME', FONT = (px) => `400 ${px}px Anton, Impact, "Arial Narrow", sans-serif`;

export default async function hero(root, { reduce, sky = {}, words = {}, edgeCode = 'QUIETIME 400' }) {
  const title = root.querySelector('[data-hero-title]');
  if (!title) return;
  const edgeEl = root.querySelector('[data-hero-edge]');

  // the title fills the width: measured at 100 px, then scaled
  const fit = () => {
    title.style.fontSize = '100px';
    const cs = getComputedStyle(root);
    const room = root.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    title.style.fontSize = `${Math.floor(((100 * room) / title.scrollWidth) * 0.985)}px`;
  };
  fit();
  await Promise.race([document.fonts?.load(FONT(100), TEXT), new Promise((ok) => { setTimeout(ok, 1500); })]).catch(() => {});
  fit();

  // the weather outside the studio, if it answers within 1.5 s; otherwise the time of day alone
  const weather = reduce ? null : await studioWeather({ lat: sky.lat, lon: sky.lon }, 1500);
  const kind = weather?.kind || 'clear';
  const lat = Number.isFinite(sky.lat) ? sky.lat : 31.2304, lon = Number.isFinite(sky.lon) ? sky.lon : 121.4737;
  const offsetSec = weather?.utcOffset ?? sky.utcOffset ?? Math.round(lon / 15) * 3600;

  const canvas = document.createElement('canvas');
  canvas.className = 'h-sky'; canvas.setAttribute('aria-hidden', 'true');
  root.prepend(canvas);
  let scene = null, glyph = null, dpr = 1, lastW = 0;
  const build = () => {
    const r = root.getBoundingClientRect(), tr = title.getBoundingClientRect();
    // sharp enough for paper, ink and sky, and at most about 1.6 million pixels to paint each frame
    dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(1.6e6 / Math.max(1, r.width * r.height)));
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    const g = canvas.getContext('2d');
    g.font = FONT(100);
    const fontPx = (100 * tr.width * dpr) / g.measureText(TEXT).width;
    g.font = FONT(fontPx);
    const m = g.measureText(TEXT), x = (tr.left - r.left) * dpr;
    const base = (tr.top - r.top + tr.height / 2) * dpr + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    const edges = Array.from({ length: TEXT.length + 1 }, (_, i) => x + g.measureText(TEXT.slice(0, i)).width);
    glyph = { x, base, fontPx, edges };
    scene = makeSky(canvas, glyph, { animated: !reduce });
    lastW = r.width;
  };

  const params = (now = Date.now()) => {
    const A = astro(now, lat, lon), rising = astro(now + 600000, lat, lon).sun.alt > A.sun.alt;
    return { A, rising, kind, w: weather || {} };
  };
  const clock = () => { const d = new Date(Date.now() + offsetSec * 1000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
  const nameOf = (P) => {
    const base = words[phaseKey(P.A.sun.alt, P.rising)] || '';
    const w = kind === 'clear' ? '' : words[kind] || '';
    return w ? (words.join || '{p} · {w}').replace('{p}', base).replace('{w}', w) : base;
  };

  // the card's own text takes the colours of the sky: ink on light paper, pale ink on the night's paper
  const tone = (sk) => {
    const lum = (0.2126 * sk.paper[0] + 0.7152 * sk.paper[1] + 0.0722 * sk.paper[2]) / 255;
    root.style.setProperty('--bg', `rgb(${sk.paper.map((v) => v | 0).join(' ')})`);
    root.style.setProperty('--fg', `rgb(${sk.text.map((v) => v | 0).join(' ')})`);
    root.style.setProperty('--fg-2', `rgb(${sk.text.map((v) => v | 0).join(' ')} / .72)`);
    document.documentElement.dataset.sky = lum < 0.4 ? 'dark' : 'light';
  };

  /* pointer push: each letter on a spring */
  const letters = Array.from({ length: TEXT.length }, () => ({ x: 0, y: 0, a: 0, vx: 0, vy: 0, va: 0 }));
  const w = 2 * Math.PI * 2.2, z = 0.45;
  let px = 0, py = 0, pt = 0, pushed = false;
  root.addEventListener('pointermove', (e) => {
    const now = performance.now(), dt = Math.max(0.008, (now - pt) / 1000);
    const vx = pt ? (e.clientX - px) / dt : 0, vy = pt ? (e.clientY - py) / dt : 0;
    px = e.clientX; py = e.clientY; pt = now;
    if (reduce || !glyph) return;
    const r = root.getBoundingClientRect(), h = (glyph.fontPx * 0.78) / dpr, cy = r.top + (glyph.base - glyph.fontPx * 0.39) / dpr;
    letters.forEach((L, k) => {
      const cx = r.left + (glyph.edges[k] + glyph.edges[k + 1]) / 2 / dpr;
      const dx = px - (cx + L.x), dy = py - (cy + L.y), fall = Math.exp(-(dx * dx + dy * dy) / (2 * (h * 0.5) ** 2));
      if (fall < 0.03) return;
      L.vx += vx * 0.25 * fall; L.vy += vy * 0.25 * fall;
      const sp = Math.hypot(L.vx, L.vy); if (sp > 900) { L.vx *= 900 / sp; L.vy *= 900 / sp; }
      L.va = Math.max(-1.2, Math.min(1.2, L.va + vx * 0.00005 * fall));
      pushed = true;
    });
  }, { passive: true });
  const stepLetters = (dt) => {
    const n = substeps(dt), h = dt / n;
    let moving = false;
    for (const L of letters) {
      for (let i = 0; i < n; i++) {
        L.vx += (-w * w * L.x - 2 * z * w * L.vx) * h; L.x += L.vx * h;
        L.vy += (-w * w * L.y - 2 * z * w * L.vy) * h; L.y += L.vy * h;
        L.va += (-w * w * L.a - 2 * z * w * L.va) * h; L.a += L.va * h;
      }
      if (Math.abs(L.x) + Math.abs(L.y) > 0.05 || Math.abs(L.vx) + Math.abs(L.vy) > 0.5) moving = true;
    }
    return moving;
  };

  /* the loop: 60 fps while ink spreads or letters swing, 30 fps after, stopped off screen */
  let visible = true, raf = 0, last = performance.now(), t0 = performance.now(), frameNo = 0, lastBoil = 0, boilIdx = 0;
  let P = params(), lastParams = -Infinity, failed = false;
  const fail = (e) => { failed = true; cancelAnimationFrame(raf); canvas.remove(); root.classList.remove('sky-on'); delete document.documentElement.dataset.sky; console.error(e); };
  const draw = (now) => {
    const dt = frameTime(now, last); last = now;
    const t = (now - t0) / 1000;
    if (now - lastParams > 1000) {
      P = params(); lastParams = now;
      if (edgeEl) edgeEl.textContent = `${edgeCode} ▸ ${clock()} · ${sky.city ? `${sky.city} · ` : ''}${nameOf(P)}`;
    }
    if (now - lastBoil > 110) { boilIdx = (boilIdx + 1) % 3; lastBoil = now; }
    if (stepLetters(dt)) pushed = true;
    const sk = scene.frame({ ...P, entrance: !reduce }, reduce ? 9 : t, now / 1000, t > 3.2 ? boilIdx : 0,
      letters.map((L) => ({ x: L.x * dpr, y: L.y * dpr, a: L.a })));
    if (frameNo === 0) { tone(sk); root.classList.add('sky-on'); }
    frameNo += 1;
  };
  const tick = (now) => {
    raf = 0;
    if (failed || !visible) return;
    try {
      // after the entrance, every other frame unless a letter is swinging
      if ((now - t0) / 1000 < 3.5 || pushed || frameNo % 2 === 0) { pushed = false; draw(now); } else frameNo += 1;
    } catch (e) { fail(e); return; }
    raf = requestAnimationFrame(tick);
  };

  try { build(); } catch (e) { fail(e); return; }
  if (reduce) { try { draw(performance.now()); } catch (e) { fail(e); } return; }
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && !raf && !failed) { last = performance.now(); raf = requestAnimationFrame(tick); } }).observe(root);
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => {
    if (failed) return;
    fit();
    if (Math.abs(root.getBoundingClientRect().width - lastW) > 1) { try { build(); frameNo = 1; if (!raf && visible) raf = requestAnimationFrame(tick); } catch (e) { fail(e); } }
  }, 200); });
  raf = requestAnimationFrame(tick);
}
