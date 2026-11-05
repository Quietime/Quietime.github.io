import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/noto-serif-sc/500.css';
import '@fontsource/noto-sans-sc/400.css';
import '@fontsource/questrial/400.css';
import '@fontsource/barlow-condensed/500.css';
import 'photoswipe/style.css';
import './styles.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { Flip } from 'gsap/Flip';
import Lenis from 'lenis';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import justifiedLayout from 'justified-layout';
import cursor from './cursor.js';
import { springEase } from './physics/spring.js';
import { Fluid } from './physics/fluid.js';
import { Ribbon } from './physics/ribbon.js';
import sound from './sound.js';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin, Flip);
// every eased motion is the step response of a damped spring (see physics/spring.js);
// exits use power2.in, the x = ½at² of a constant force
gsap.registerEase('spring', springEase(0.62));
gsap.registerEase('springFirm', springEase(0.85));
gsap.registerEase('springCrit', springEase(1));

const root = document.documentElement;
const page = root.dataset.page;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
  del: (k) => { try { sessionStorage.removeItem(k); } catch { /* private mode */ } },
};
const DIGITS = '0123456789';
// critically damped spring step response, used for the film-advance detent on the home strip
const DETENT = springEase(1);
let CFG = {};
try { CFG = JSON.parse($('#qt-config')?.textContent || '{}'); } catch { CFG = {}; }
const U = CFG.ui || {};
const F = U.f || {};

// type for the other languages loads only on their pages
if (CFG.lang === 'en') { import('@fontsource/newsreader/400.css'); import('@fontsource/newsreader/500.css'); }
if (CFG.lang === 'ja') { import('@fontsource/noto-serif-jp/400.css'); import('@fontsource/noto-serif-jp/500.css'); import('@fontsource/noto-sans-jp/400.css'); }

// a chosen language is remembered, so the first-visit language guess never overrides it
document.addEventListener('click', (e) => {
  const a = e.target.closest('.lang a[data-lang]');
  if (a) { try { localStorage.setItem('qt-lang', a.dataset.lang); } catch { /* private mode */ } }
}, true);

/* ── smooth scroll (Lenis) ─────────────────────────────────── */
let lenis = null;
if (!reduce) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollToEl = (el, offset = -90) => (lenis
  ? lenis.scrollTo(el, { offset, duration: 1.4 })
  : scrollTo({ top: el.getBoundingClientRect().top + scrollY + offset }));

/* ── film grain texture ────────────────────────────────────── */
(function grain() {
  const c = document.createElement('canvas');
  c.width = c.height = 180;
  const x = c.getContext('2d');
  const d = x.createImageData(180, 180);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  root.style.setProperty('--grain', `url(${c.toDataURL('image/png')})`);
})();

/* ── light-leak page transition ────────────────────────────── */
const leak = $('.leak');
const blobs = $$('.leak i');
function leakOut() {
  if (!root.classList.contains('leak-in')) return;
  store.del('qt-leak');
  if (reduce) { root.classList.remove('leak-in'); return; }
  gsap.set(leak, { opacity: 1 });
  gsap.timeline({ onComplete: () => { root.classList.remove('leak-in'); gsap.set(leak, { clearProps: 'all' }); } })
    .fromTo(leak, { '--flash': 0.9 }, { '--flash': 0, duration: 0.5, ease: 'springCrit' }, 0)
    .fromTo(blobs, { xPercent: 20 }, { xPercent: 110, duration: 0.7, ease: 'springCrit', stagger: 0.04 }, 0)
    .to(leak, { opacity: 0, duration: 0.35, ease: 'springCrit' }, 0.35);
}
function leakTo(href) {
  store.set('qt-leak', '1');
  if (reduce) { location.href = href; return; }
  gsap.timeline({ onComplete: () => { location.href = href; } })
    .set(leak, { opacity: 1, '--flash': 0 })
    .fromTo(blobs, { xPercent: -60, scale: 0.7 }, { xPercent: 20, scale: 1, duration: 0.4, ease: 'power2.in', stagger: 0.04 }, 0)
    .to(leak, { '--flash': 0.9, duration: 0.18, ease: 'power2.in' }, 0.26);
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-pswp-width')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  if (url.pathname === location.pathname && url.hash) return;
  if (!/(\.html|\/)$/.test(url.pathname)) return;
  e.preventDefault();
  leakTo(url.href);
});
addEventListener('pageshow', (e) => {
  if (e.persisted) { gsap.set(leak, { clearProps: 'all' }); root.classList.remove('leak-in'); store.del('qt-leak'); }
});

/* ── header ────────────────────────────────────────────────── */
const hdr = $('[data-hdr]');
let lastY = 0;
ScrollTrigger.create({
  start: 0, end: 'max',
  onUpdate: (self) => {
    const y = self.scroll();
    hdr.classList.toggle('is-solid', y > 40);
    if (!root.classList.contains('pswp-open')) hdr.classList.toggle('is-hidden', y > 160 && y > lastY);
    lastY = y;
  },
});

/* ── photographs develop as they come into view ───────────── */
const devIO = new IntersectionObserver((entries) => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    const img = en.target;
    devIO.unobserve(img);
    const done = () => img.classList.add('is-in');
    if (img.complete && img.naturalWidth) requestAnimationFrame(done);
    else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
  }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
$$('img.dev').forEach((img) => devIO.observe(img));

/* ── headings rise character by character (SplitText) ─────── */
function splitReveal(scope, delay = 0) {
  const targets = $$('[data-split] .line > span', scope);
  if (reduce || !targets.length) return;
  // characters for Chinese and Japanese, whole words for English; the whole line takes under a second
  const byWord = CFG.lang === 'en';
  const split = SplitText.create(targets, { type: byWord ? 'words' : 'chars', wordsClass: 'ch', charsClass: 'ch', tag: 'span', aria: 'none' });
  const parts = byWord ? split.words : split.chars;
  gsap.from(parts, { yPercent: 115, duration: 1.2, ease: 'springFirm', stagger: { amount: Math.min(0.9, parts.length * 0.035) }, delay });
}

/* ── copy buttons ──────────────────────────────────────────── */
const live = $('[data-live]');
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.append(t); t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove();
    return ok;
  }
}
$$('[data-copy]').forEach((b) => {
  const label = b.textContent;
  b.addEventListener('click', async () => {
    const ok = await copyText(b.dataset.copy);
    b.textContent = ok ? U.copied || 'Copied' : label;
    b.classList.toggle('is-done', ok);
    if (live) live.textContent = ok ? `${U.copied || 'Copied'} ${b.dataset.copy}` : U.copyFail || '';
    setTimeout(() => { b.textContent = label; b.classList.remove('is-done'); }, 1600);
  });
});

/* ── Bilibili player, opened with Flip from the card ───────── */
function films() {
  const player = $('[data-player]');
  if (!player) return;
  const box = $('[data-player-box]', player);
  const frame = $('[data-player-frame]', player);
  const link = $('[data-player-link]', player);
  const title = $('[data-player-title]', player);
  let opener = null;
  const esc = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    frame.innerHTML = '';
    player.hidden = true;
    lenis?.start();
    document.removeEventListener('keydown', esc);
    opener?.focus({ preventScroll: true });
  }
  $$('.film-btn, .film-row').forEach((b) => b.addEventListener('click', () => {
    if (!b.dataset.bvid && !b.dataset.aid) { if (live) live.textContent = U.notReady || ''; return; }
    opener = b;
    const q = new URLSearchParams({ isOutside: 'true', p: b.dataset.p || '1', autoplay: '1', danmaku: '0', high_quality: '1' });
    if (b.dataset.bvid) q.set('bvid', b.dataset.bvid);
    if (b.dataset.aid) q.set('aid', b.dataset.aid);
    if (b.dataset.cid) q.set('cid', b.dataset.cid);
    link.href = b.dataset.bvid ? `https://www.bilibili.com/video/${encodeURIComponent(b.dataset.bvid)}` : `https://www.bilibili.com/video/av${encodeURIComponent(b.dataset.aid)}`;
    if (title) title.textContent = (b.getAttribute('aria-label') || '').replace(/^[^：]*：/, '');
    player.hidden = false;
    lenis?.stop();
    document.addEventListener('keydown', esc);
    const load = () => {
      frame.innerHTML = `<iframe src="https://player.bilibili.com/player.html?${q}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen scrolling="no" referrerpolicy="no-referrer-when-downgrade" title="Bilibili"></iframe>`;
    };
    if (reduce) { load(); } else {
      const state = Flip.getState(box);
      Flip.fit(box, $('.ph', b) || b, { scale: true });
      gsap.fromTo(player, { backgroundColor: 'rgba(14,11,9,0)' }, { backgroundColor: 'rgba(14,11,9,.95)', duration: 0.6 });
      Flip.to(state, { duration: 0.8, ease: 'springCrit', scale: true, onComplete: load });
    }
    $('[data-player-close]', player).focus();
  }));
  $('[data-player-close]', player).addEventListener('click', close);
  player.addEventListener('click', (e) => { if (e.target === player) close(); });
}

/* ═════════════════ pages ═════════════════ */

/* Scroll-linked rise: the element moves with the scroll position, forwards and backwards. */
function scrubRise(els, { y = 56, from = 0.12, start = 'top 98%', end = 'top 62%' } = {}) {
  if (reduce) return;
  els.forEach((el) => gsap.fromTo(el, { y, opacity: from }, {
    y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: el, start, end, scrub: true },
  }));
}

/*
 * Home: one strip of film floating in developer, simulated rather than animated.
 * Wide screens: the strip is a chain of frames in 3D (physics/ribbon.js). Scrolling pulls it through
 * the gate at the centre of the view; the parts outside the gate sway, trail, sag and twist under
 * springs, drag, gravity and the flow of the liquid. The liquid (physics/fluid.js) is stirred by the
 * moving film and by the pointer, and pushes back on the film: a two-way coupling.
 * Phones: the strip stands upright and scrolls; each frame tilts under inertia when the scroll speeds
 * up or slows down, and swings with the flow, as a chain of coupled damped oscillators.
 */
function home() {
  const pre = $('[data-pre]');
  const roll = $('[data-roll]');
  const track = $('[data-roll-track]');
  const cells = $$('[data-cell]', track);
  const count = $('[data-roll-count]');
  const rc = $('[data-rc]');
  const leader = () => splitReveal(roll, 0.1);

  // phones: the statement stands one phrase to a line, so the type is sized to fit the widest phrase
  const statement = $('.leader-statement', roll);
  const fitPhrases = () => {
    if (!statement) return;
    statement.style.fontSize = '';
    statement.classList.remove('nw-wrap');
    const nws = $$('.nw', statement);
    if (!nws.length || !matchMedia('(max-width: 600px)').matches) return;
    const room = statement.clientWidth;
    const widest = Math.max(...nws.map((n) => n.scrollWidth));
    if (widest <= room) return;
    const fs = (parseFloat(getComputedStyle(statement).fontSize) * room) / widest;
    if (fs >= 17) statement.style.fontSize = `${Math.floor(fs * 10) / 10}px`;
    else statement.classList.add('nw-wrap');
  };
  fitPhrases();
  document.fonts?.ready.then(fitPhrases);
  addEventListener('resize', fitPhrases);

  // opening: the camera's frame counter runs S, 0, 1, then the shutter curtain lifts
  if (pre && !root.classList.contains('pre-seen') && !reduce) {
    const n = $('[data-pre-n]', pre);
    const bits = $$('.pre-win, .pre-word', pre);
    const tl = gsap.timeline({ onComplete: () => { pre.remove(); store.set('qt-pre', '1'); } });
    tl.fromTo(bits, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.8, ease: 'springFirm', stagger: 0.1 }, 0.1);
    ['0', '1'].forEach((v) => {
      tl.to(n, { yPercent: -110, opacity: 0, duration: 0.2, ease: 'power2.in' }, '+=0.32')
        .call(() => { n.textContent = v; })
        .fromTo(n, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'spring' });
    });
    tl.to(pre, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.9, ease: 'springCrit' }, '+=0.3')
      .add(leader, '-=0.5');
    pre.addEventListener('click', () => tl.progress(0.92));
  } else {
    pre?.remove();
    leader();
  }

  films();
  if (reduce || !track) return;

  // the developer: a fluid painted as faint ink under the strip
  const canvas = $('[data-fluid]');
  const ink = matchMedia('(prefers-color-scheme: dark)').matches ? [217, 154, 91] : [51, 40, 31];
  let fluid = null, fctx = null, fimg = null;
  const makeFluid = (nx, ny) => {
    fluid = new Fluid(nx, ny);
    canvas.width = nx; canvas.height = ny;
    fctx = canvas.getContext('2d');
    fimg = fctx.createImageData(nx, ny);
  };
  let px = -1, py = -1, pt = 0;
  addEventListener('pointermove', (e) => {
    if (!fluid) return;
    const now = performance.now();
    if (px >= 0 && now - pt < 100) {
      const dt = Math.max(4, now - pt) / 1000;
      const s = fluid.nx / innerWidth;
      // the pointer hands the liquid half its velocity: Δu = ½ v
      fluid.splat(e.clientX / innerWidth, e.clientY / innerHeight, 0.5 * ((e.clientX - px) / dt) * s, 0.5 * ((e.clientY - py) / dt) * s, 0.022, 0.07, 1);
    }
    px = e.clientX; py = e.clientY; pt = now;
  }, { passive: true });

  const mm = gsap.matchMedia();

  mm.add('(min-width: 861px)', () => {
    root.classList.add('roll-3d');
    makeFluid(96, 54);
    const run = $('[data-roll-run]');
    const TILT_X = (9 * Math.PI) / 180, TILT_Z = (-2.2 * Math.PI) / 180, PERSP = 1500;
    let W = innerWidth, Hh = innerHeight, sh = 0, ww = [], C = [], ribbon = null, read = 0, lens = '';
    const last = cells.length - 1;

    // a frame whose words do not fit its height is set a little smaller (CSS zoom on its contents)
    function fitFrames() {
      $$('.cell:not(.cell-photo) > .frame', track).forEach((f) => {
        f.style.setProperty('--fit', '1');
        const cs = getComputedStyle(f);
        const room = f.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        let top = Infinity, bottom = -Infinity;
        for (const k of f.children) { top = Math.min(top, k.offsetTop); bottom = Math.max(bottom, k.offsetTop + k.offsetHeight); }
        const need = bottom - top;
        if (need > room + 1) f.style.setProperty('--fit', Math.max(0.55, room / need).toFixed(3));
      });
    }

    function build() {
      W = innerWidth; Hh = innerHeight;
      sh = Math.round(Math.min(Hh * 0.66, 620));
      track.style.setProperty('--sh', `${sh}px`);
      $$('.cell-photo', track).forEach((c) => {
        const [a, b] = (c.style.getPropertyValue('--ar') || '3/2').split('/').map(Number);
        c.style.width = `${Math.round((sh - 102) * (a / b) + 14)}px`;
      });
      fitFrames();
      ww = cells.map((c) => c.offsetWidth);
      // neighbouring frames overlap by 3 px so the film reads as one continuous strip at every bend
      ribbon = new Ribbon(ww.map((w) => w - 3));
      ribbon.setView(W, Hh);
      C = cells.map((_, i) => ribbon.s[i] + ribbon.L[i] / 2);
      ribbon.flow = (x, y, z) => {
        const [X, Y] = project(x, y, z);
        const [u, v] = fluid.sample(X / W, Y / Hh);
        const k = W / fluid.nx; // cells/s → px/s
        return [u * k, v * k];
      };
      // the sticky stage stays in view for exactly the length of the strip
      run.style.height = `${Math.round(span() + roll.offsetHeight)}px`;
      // every frame carries the whole camera in its own transform: perspective from 50% 42% of the stage
      // (the track sits at 50% 52%), then the tilt of the scene. There is no shared preserve-3d context,
      // so no browser has to sort or clip one; the frames are painted far to near by z-index instead
      const o = (0.1 * Hh).toFixed(1);
      lens = `translate(0px, ${-o}px) perspective(${PERSP}px) translate(0px, ${o}px) rotateX(9deg) rotateZ(-2.2deg)`;
    }
    // the same camera every frame carries in its transform: rotateZ, then rotateX, then perspective from 50% 42%
    function project(x, y, z) {
      const x1 = x * Math.cos(TILT_Z) - y * Math.sin(TILT_Z);
      const y1 = x * Math.sin(TILT_Z) + y * Math.cos(TILT_Z);
      const y2 = y1 * Math.cos(TILT_X) - z * Math.sin(TILT_X);
      const z2 = y1 * Math.sin(TILT_X) + z * Math.cos(TILT_X);
      const k = PERSP / (PERSP - z2);
      return [W * 0.5 + x1 * k, Hh * 0.42 + (Hh * 0.1 + y2) * k];
    }
    const span = () => C[C.length - 1] - C[0];
    build();
    read = C[0];

    // the stage is position: sticky inside a run as long as the strip, so nothing is re-parented or
    // switched from fixed to static when the strip ends: it simply scrolls away with the page
    const st = ScrollTrigger.create({
      trigger: run, start: 'top top', end: () => `+=${Math.round(span())}`, invalidateOnRefresh: true,
      onUpdate: (self) => { read = C[0] + self.progress * span(); },
      onRefresh: (self) => { read = C[0] + self.progress * span(); },
      onToggle: (self) => count?.classList.toggle('off', !self.isActive),
    });
    const onRefreshInit = () => build();
    ScrollTrigger.addEventListener('refreshInit', onRefreshInit);
    const yOf = (i) => st.start + ((C[i] - C[0]) / span()) * (st.end - st.start);

    // tabbing into a frame brings it to the gate
    const onFocus = (e) => {
      roll.scrollLeft = 0; roll.scrollTop = 0;
      const i = cells.indexOf(e.target.closest('[data-cell]'));
      if (i < 0) return;
      if (lenis) lenis.scrollTo(yOf(i), { duration: 1.34, easing: DETENT }); else scrollTo(0, yOf(i));
    };
    track.addEventListener('focusin', onFocus);

    // film advance detent: when the scroll comes to rest between two frames, the nearer one is drawn
    // into the gate by a critically damped spring (f = 1.1 Hz, settles to 0.1 % in 9.23 / ω = 1.34 s)
    let still = 0;
    const detent = (dt) => {
      if (!lenis || lenis.isScrolling || !st.isActive) { still = 0; return; }
      still += dt;
      if (still < 0.14) return;
      still = -Infinity; // once per pause
      let best = 0, gap = Infinity;
      for (let i = 0; i < C.length; i++) { const d = Math.abs(C[i] - read); if (d < gap) { gap = d; best = i; } }
      const y = yOf(best);
      if (Math.abs(y - scrollY) > 1.5) lenis.scrollTo(y, { duration: 1.34, easing: DETENT });
    };

    let current = -1, lastRead = read;
    const faded = new Array(cells.length).fill(false), depth = new Array(cells.length).fill(-1);
    const tick = (time, deltaMs) => {
      const dt = Math.min(deltaMs / 1000, 1 / 20);
      if (!dt) return;
      detent(dt);
      const speed = Math.abs(read - lastRead) / dt;
      lastRead = read;
      // scrolling stirs the slow current; when it stops the current dies away on its own (ribbon.js)
      ribbon.current = Math.max(ribbon.current, Math.min(1, speed / 600));
      if (ribbon.current < 0.05) ribbon.current = 0;
      // asleep: nothing moves, nothing is stirred, no ink left to show; also when the stage is out of view
      const offstage = scrollY > st.end + Hh;
      const awake = !ribbon.ready || speed > 0 || ribbon.current > 0 || ribbon.maxSpeed() > 0.5 || fluid.active();
      if (offstage || !awake) return;
      ribbon.step(dt, read);

      // the moving film pushes the liquid: momentum in proportion to the relative velocity, plus a trace of dye
      const s = fluid.nx / W;
      for (let i = 0; i < ribbon.n; i++) {
        const o = 3 * i;
        const [X, Y] = project(ribbon.x[o], ribbon.x[o + 1], ribbon.x[o + 2]);
        if (X < -40 || X > W + 40 || Y < -40 || Y > Hh + 40) continue;
        const [fu, fv] = fluid.sample(X / W, Y / Hh);
        const rx = ribbon.v[o] * s - fu, ry = ribbon.v[o + 1] * s - fv;
        const sp = Math.hypot(rx, ry);
        if (sp < 0.4) continue;
        fluid.splat(X / W, Y / Hh, rx * 0.35, ry * 0.35, 0.03, Math.min(0.08, sp * 0.002), 1);
      }
      fluid.step(dt);
      fluid.draw(fctx, fimg, ink, 230);

      // place every frame from the simulation; frames far down the strip are out of view anyway
      // (the strip runs off along its tangent), so they are only faded, never removed from the page
      const near = [];
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        const far = Math.abs(C[i] - read) > 2.6 * W;
        if (far !== faded[i]) { faded[i] = far; c.classList.toggle('is-far', far); }
        if (far) continue;
        const q = ribbon.pose(i);
        c.style.transform = `${lens} translate3d(${q.cx.toFixed(2)}px, ${q.cy.toFixed(2)}px, ${q.cz.toFixed(2)}px) rotateY(${q.yaw.toFixed(4)}rad) rotateZ(${q.pitch.toFixed(4)}rad) rotateX(${q.roll.toFixed(4)}rad) translate(${(-ww[i] / 2).toFixed(1)}px, ${(-sh / 2).toFixed(1)}px)`;
        // depth of the frame centre after the tilt, toward the viewer positive
        const y1 = q.cx * Math.sin(TILT_Z) + q.cy * Math.cos(TILT_Z);
        near.push([y1 * Math.sin(TILT_X) + q.cz * Math.cos(TILT_X), i]);
      }
      near.sort((a, b) => a[0] - b[0]);
      near.forEach(([, i], k) => { if (depth[i] !== k) { depth[i] = k; cells[i].style.zIndex = String(k + 1); } });

      // the frame counter reads the frame nearest the gate; the tail is the end of the roll
      let best = 0, gap = Infinity;
      for (let i = 0; i < C.length; i++) { const d = Math.abs(C[i] - read); if (d < gap) { gap = d; best = i; } }
      if (best !== current && rc) {
        current = best;
        const end = best === last;
        count.classList.toggle('is-end', end);
        gsap.to(rc, { duration: 0.4, scrambleText: { text: end ? 'END' : String(best + 1), chars: end ? 'upperCase' : DIGITS, speed: 0.6 }, overwrite: true });
      }
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      ScrollTrigger.removeEventListener('refreshInit', onRefreshInit);
      track.removeEventListener('focusin', onFocus);
      root.classList.remove('roll-3d');
      run.style.height = '';
      cells.forEach((c) => { c.style.transform = ''; c.style.width = ''; c.style.zIndex = ''; c.classList.remove('is-far'); });
      $$('.frame', track).forEach((f) => f.style.removeProperty('--fit'));
      fluid = null;
    };
  });

  mm.add('(max-width: 860px)', () => {
    makeFluid(42, 76);
    const n = cells.length;
    const tilt = new Float64Array(n), tiltV = new Float64Array(n);
    const swing = new Float64Array(n), swingV = new Float64Array(n);
    // each frame: θ'' = -ω²θ - 2ζωθ' + k(θ₋ + θ₊ - 2θ) + forcing; coupling lets a disturbance travel along the strip
    const w = 2 * Math.PI * 1.2, z = 0.32, kc = 40;
    let lastY = scrollY, lastV = 0;
    const settled = () => {
      for (let i = 0; i < n; i++) if (Math.abs(tilt[i]) > 1e-4 || Math.abs(tiltV[i]) > 1e-3 || Math.abs(swing[i]) > 1e-4 || Math.abs(swingV[i]) > 1e-3) return false;
      return true;
    };
    const tick = (time, deltaMs) => {
      const dt = Math.min(deltaMs / 1000, 1 / 20);
      if (!dt) return;
      const vel = (scrollY - lastY) / dt;
      const acc = (vel - lastV) / dt;
      lastY = scrollY; lastV = vel;
      // asleep while the page is still, the strip has stopped swinging and the ink is gone
      if (vel === 0 && acc === 0 && !fluid.active() && settled()) return;
      const s = fluid.nx / innerWidth;
      // the strip moving up through the liquid drags it along both edges
      if (Math.abs(vel) > 30) {
        for (const ex of [0.06, 0.94]) fluid.splat(ex, 0.3 + Math.random() * 0.5, 0, -vel * s * 0.12, 0.08, Math.min(0.04, Math.abs(vel) * 0.00003), 1);
      }
      fluid.step(dt);
      fluid.draw(fctx, fimg, ink, 230);
      const H = 1 / 240, steps = Math.max(1, Math.round(dt / H)), h = dt / steps;
      const top = [];
      for (let i = 0; i < n; i++) top.push(cells[i].getBoundingClientRect());
      for (let k = 0; k < steps; k++) {
        for (let i = 0; i < n; i++) {
          const r = top[i];
          const seen = r.bottom > -100 && r.top < innerHeight + 100;
          const flowX = seen ? fluid.sample(0.5, Math.min(0.98, Math.max(0.02, (r.top + r.height / 2) / innerHeight)))[0] : 0;
          const lap = (i > 0 ? tilt[i - 1] : tilt[i]) + (i < n - 1 ? tilt[i + 1] : tilt[i]) - 2 * tilt[i];
          const a = -w * w * tilt[i] - 2 * z * w * tiltV[i] + kc * lap - acc * 0.000045;
          tiltV[i] += a * h; tilt[i] += tiltV[i] * h;
          const b = -w * w * swing[i] - 2 * z * w * swingV[i] + flowX * 0.06;
          swingV[i] += b * h; swing[i] += swingV[i] * h;
        }
      }
      for (let i = 0; i < n; i++) {
        const r = top[i];
        if (r.bottom < -100 || r.top > innerHeight + 100) continue;
        const tx = Math.max(-0.35, Math.min(0.35, tilt[i])), sy = Math.max(-0.2, Math.min(0.2, swing[i]));
        cells[i].style.transform = `perspective(900px) rotateX(${tx.toFixed(4)}rad) rotateY(${sy.toFixed(4)}rad)`;
      }
    };
    gsap.ticker.add(tick);
    return () => { gsap.ticker.remove(tick); cells.forEach((c) => { c.style.transform = ''; }); fluid = null; };
  });
}

function series() {
  splitReveal($('.s-head'), 0.1);
  if (!reduce) {
    gsap.fromTo(['.s-en', '.s-meta'], { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1.2, ease: 'springFirm', delay: 0.5, stagger: 0.1 });
    const st = $('[data-words]');
    if (st) {
      SplitText.create(st, {
        type: 'lines', mask: 'lines', autoSplit: true, tag: 'span', aria: 'none', linesClass: 'sline',
        onSplit: (self) => gsap.from(self.lines, { yPercent: 100, duration: 1.1, ease: 'springFirm', stagger: 0.09, scrollTrigger: { trigger: st, start: 'top 85%', once: true } }),
      });
    }
  }

  // continuous camera: the title drifts up, each photograph settles as it reaches the centre
  if (!reduce) {
    gsap.to('.s-title', { yPercent: -28, ease: 'none', scrollTrigger: { trigger: '.s-head', start: 'top 15%', end: 'bottom top', scrub: true } });
    $$('.fr').forEach((fr) => {
      gsap.fromTo($('.ph img', fr), { scale: 1.14 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: fr, start: 'top bottom', end: 'center 55%', scrub: true } });
      gsap.fromTo($('figcaption', fr), { y: 36 }, { y: 0, ease: 'none', scrollTrigger: { trigger: fr, start: 'top bottom', end: 'center 55%', scrub: true } });
    });
    scrubRise($$('.s-next'), { y: 80 });
  }

  // frame counter, digits re-read with ScrambleText
  const counter = $('[data-counter]');
  const cur = $('[data-cur]');
  ScrollTrigger.create({ trigger: '.frames', start: 'top 70%', end: 'bottom 40%', onToggle: (s) => counter.classList.toggle('on', s.isActive) });
  $$('.fr').forEach((fr) => {
    ScrollTrigger.create({
      trigger: fr, start: 'top 55%', end: 'bottom 45%',
      onToggle: (s) => {
        if (!s.isActive || cur.textContent === fr.dataset.frame) return;
        if (reduce) cur.textContent = fr.dataset.frame;
        else gsap.to(cur, { duration: 0.45, scrambleText: { text: fr.dataset.frame, chars: DIGITS, speed: 0.6 }, overwrite: true });
      },
    });
  });

  photoLightbox('[data-gallery]', 'a.fr-open');

  const rail = $('.rail');
  if (rail && !reduce) ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => rail.style.setProperty('--rail', `${-self.scroll() * 0.6}px`) });

  if (location.hash) {
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(() => scrollToEl(el), 500);
  }
}

function photoLightbox(gallery, children) {
  const edgeCode = ($('[data-edge]')?.firstChild?.textContent || 'QUIETIME 400').trim();
  const lightbox = new PhotoSwipeLightbox({
    gallery,
    children,
    pswpModule: () => import('photoswipe'),
    bgOpacity: 0.97,
    showHideAnimationType: reduce ? 'none' : 'zoom',
    padding: { top: 70, bottom: 120, left: 24, right: 24 },
    wheelToZoom: false,
    zoom: false,
    initialZoomLevel: (z) => Math.min(z.panAreaSize.x / z.elementSize.x, z.panAreaSize.y / z.elementSize.y),
    secondaryZoomLevel: 1.6,
    maxZoomLevel: 3,
    arrowPrevSVG: `<span class="pswp-t">${U.pswp?.prev || 'Previous'}</span>`,
    arrowNextSVG: `<span class="pswp-t">${U.pswp?.next || 'Next'}</span>`,
    closeSVG: `<span class="pswp-t">${U.pswp?.close || 'Close'}</span>`,
    closeTitle: U.pswp?.close, arrowPrevTitle: U.pswp?.prev, arrowNextTitle: U.pswp?.next,
    errorMsg: U.pswp?.error,
    indexIndicatorSep: ' / ',
  });
  lightbox.on('uiRegister', () => {
    lightbox.pswp.ui.registerElement({
      name: 'film-caption', order: 9, isButton: false, appendTo: 'root',
      onInit: (el, pswp) => {
        const render = () => {
          const a = pswp.currSlide?.data?.element;
          if (!a) return;
          const n = a.dataset.n || pswp.currIndex + 1;
          const series = a.dataset.sname ? `<span class="pc-s">${a.dataset.sname}</span>` : '';
          el.innerHTML = `<span class="edge">${edgeCode}<i>▸ ${n}</i><i>${n}A</i></span>${series}<span class="pc-cap">${a.dataset.cap || ''}</span><span class="pc-exif">${a.dataset.exif || ''}</span>`;
        };
        pswp.on('change', render);
        render();
      },
    });
  });
  lightbox.on('beforeOpen', () => { lenis?.stop(); root.classList.add('pswp-open'); });
  lightbox.on('afterInit', () => {
    const el = lightbox.pswp?.element;
    if (el) { el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', U.pswp?.label || 'Photo viewer'); }
  });
  lightbox.on('destroy', () => { lenis?.start(); root.classList.remove('pswp-open'); });
  lightbox.init();
  return lightbox;
}

function works() {
  splitReveal(document, 0.05);
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

function about() {
  splitReveal(document, 0.05);
  if (!reduce) scrubRise($$('.ab-text p, .ab-services dl > div'), { y: 40 });
}

function filmsPage() {
  splitReveal(document, 0.05);
  films();
}

/* ── gallery: justified rows (flickr/justified-layout), filters animated with Flip ── */
function gallery() {
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

/* ── contact: floating labels, inline checks, a sending state ── */
function contact() {
  splitReveal(document, 0.05);
  const form = $('[data-form]');
  if (form) {
    const btn = $('[data-send]', form);
    const note = $('[data-note]', form);
    const msg = (el, text) => {
      const m = el.closest('.fld')?.querySelector('[data-msg]');
      if (m) m.textContent = text;
      el.setAttribute('aria-invalid', String(Boolean(text)));
    };
    const reachOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^[a-zA-Z][-_a-zA-Z0-9]{5,19}$/.test(v) || /^1\d{10}$/.test(v);
    const check = (el) => {
      const v = el.value.trim();
      if (el.required && !v) { msg(el, F.required); return false; }
      if (el.name === 'reach' && v && !reachOk(v)) { msg(el, F.badReach); return false; }
      msg(el, '');
      return true;
    };
    $$('input[required], textarea[required]', form).forEach((el) => {
      el.addEventListener('blur', () => check(el));
      el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') check(el); });
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fields = $$('input[required], textarea[required]', form);
      const ok = fields.map(check).every(Boolean);
      if (!ok) { fields.find((f) => f.getAttribute('aria-invalid') === 'true')?.focus(); return; }
      const d = Object.fromEntries(new FormData(form));
      const B = F.body || {};
      const sep = CFG.lang === 'en' ? ': ' : '：';
      const body = [[B.name, d.name], [B.reach, d.reach], [B.kind, d.kind], [B.date, d.date || B.none], [B.budget, d.budget || B.none]]
        .map(([k, v]) => `${k}${sep}${v || ''}`).join('\n') + `\n\n${d.message}`;
      const subject = `${F.subject}${sep}${d.kind || ''}`;
      btn.classList.add('is-busy'); btn.disabled = true; note.textContent = F.sending;
      try {
        if (CFG.formEndpoint) {
          const r = await fetch(CFG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ...d, subject, message: body }) });
          if (!r.ok) throw new Error(String(r.status));
          note.textContent = F.sent;
          form.reset();
        } else {
          await copyText(body);
          location.href = `mailto:${CFG.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          note.textContent = F.mailed;
        }
        btn.classList.add('is-done');
      } catch {
        note.textContent = F.failed;
      } finally {
        btn.classList.remove('is-busy'); btn.disabled = false;
        setTimeout(() => btn.classList.remove('is-done'), 2400);
      }
    });
  }
  // FAQ opens and closes smoothly
  $$('.ct-faq details').forEach((d) => {
    const sum = $('summary', d), body = $('.faq-a', d);
    sum.addEventListener('click', (e) => {
      if (reduce) return;
      e.preventDefault();
      if (d.open) {
        gsap.to(body, { height: 0, opacity: 0, duration: 0.45, ease: 'springCrit', onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'all' }); } });
      } else {
        d.open = true;
        gsap.fromTo(body, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.55, ease: 'springFirm' });
      }
    });
  });
  if (!reduce) scrubRise($$('.ct-process li, .ct-faq details'), { y: 40 });
}

/* ── phone menu ── */
function menu() {
  const btn = $('[data-menu-btn]');
  const panel = $('[data-menu]');
  if (!btn || !panel) return;
  const links = $$('a', panel);
  const set = (open) => {
    btn.setAttribute('aria-expanded', String(open));
    root.classList.toggle('menu-open', open);
    if (open) {
      panel.hidden = false;
      lenis?.stop();
      if (!reduce) {
        gsap.fromTo(panel, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'springCrit' });
        gsap.fromTo(links, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: 'springFirm', stagger: 0.05, delay: 0.25 });
      }
      links[0]?.focus({ preventScroll: true });
    } else {
      lenis?.start();
      const end = () => { panel.hidden = true; };
      if (reduce) end(); else gsap.to(panel, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.5, ease: 'springCrit', onComplete: end });
    }
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('menu-open')) { set(false); btn.focus(); } });
}

function notFound() {
  splitReveal(document, 0.05);
}

menu();
if (fine) cursor();
sound(CFG.music, U);
({ home, series, works, films: filmsPage, about, gallery, contact, nf: notFound }[page] || (() => {}))();
leakOut();
addEventListener('load', () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());
