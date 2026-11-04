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

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin, Flip);

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
    .fromTo(leak, { '--flash': 0.9 }, { '--flash': 0, duration: 0.5, ease: 'power2.out' }, 0)
    .fromTo(blobs, { xPercent: 20 }, { xPercent: 110, duration: 0.7, ease: 'power2.inOut', stagger: 0.04 }, 0)
    .to(leak, { opacity: 0, duration: 0.35, ease: 'power1.out' }, 0.35);
}
function leakTo(href) {
  store.set('qt-leak', '1');
  if (reduce) { location.href = href; return; }
  gsap.timeline({ onComplete: () => { location.href = href; } })
    .set(leak, { opacity: 1, '--flash': 0 })
    .fromTo(blobs, { xPercent: -60, scale: 0.7 }, { xPercent: 20, scale: 1, duration: 0.4, ease: 'power3.in', stagger: 0.04 }, 0)
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

/* ── moon (layered SVG) ────────────────────────────────────── */
function moon(svg) {
  const bands = [...Array(9)].map((_, i) => $$(`.mb${i}`, svg));
  const lit = $('.moon-litc', svg);
  const hl = $('.moon-hl', svg);
  const tides = [];
  function tide(speed = 1) {
    if (reduce) return;
    bands.forEach((els, i) => {
      if (!i) return;
      const dir = i % 2 ? 1 : -1;
      tides.push(gsap.fromTo(els, { x: dir > 0 ? -300 : 0 }, { x: dir > 0 ? 0 : -300, duration: (54 + i * 11) / speed, ease: 'none', repeat: -1 }));
    });
    new IntersectionObserver(([en]) => tides.forEach((t) => (en.isIntersecting ? t.play() : t.pause()))).observe(svg);
  }
  return { svg, bands, lit, hl, tide };
}

/* ── headings rise character by character (SplitText) ─────── */
function splitReveal(scope, delay = 0) {
  const targets = $$('[data-split] .line > span', scope);
  if (reduce || !targets.length) return;
  const split = SplitText.create(targets, { type: 'chars', charsClass: 'ch', tag: 'span', aria: 'none' });
  gsap.from(split.chars, { yPercent: 115, duration: 1.25, ease: 'expo.out', stagger: 0.035, delay });
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
    b.textContent = ok ? '已复制' : label;
    b.classList.toggle('is-done', ok);
    if (live) live.textContent = ok ? `已复制 ${b.dataset.copy}` : '复制失败，请手动选择文字';
    setTimeout(() => { b.textContent = label; b.classList.remove('is-done'); }, 1600);
  });
});

/* ── header moon ───────────────────────────────────────────── */
{
  const m = moon($('.brand-moon'));
  const brand = $('.brand');
  if (!reduce) {
    brand.addEventListener('mouseenter', () => gsap.to(m.lit, { attr: { cx: 220, cy: 180 }, duration: 0.9, ease: 'power3.out' }));
    brand.addEventListener('mouseleave', () => gsap.to(m.lit, { attr: { cx: 128, cy: 96 }, duration: 0.9, ease: 'power3.out' }));
  }
}

/* ── footer moon waxes as the page ends ────────────────────── */
{
  const svg = $('.ftr-svg');
  // on home the travelling moon lands in this slot instead
  if (svg && !(page === 'home' && !reduce && $('[data-stage]'))) {
    const m = moon(svg);
    m.tide(1.4);
    if (!reduce) {
      gsap.timeline({ scrollTrigger: { trigger: '[data-ftr]', start: 'top bottom', end: 'bottom bottom', scrub: 1 } })
        .fromTo(m.lit, { attr: { cx: -40, cy: -60 } }, { attr: { cx: 128, cy: 96 }, ease: 'none' }, 0)
        .fromTo(m.hl, { opacity: 0 }, { opacity: 1, ease: 'power2.in' }, 0);
    }
  }
}

/* ── Bilibili player, opened with Flip from the card ───────── */
function films() {
  const player = $('[data-player]');
  if (!player) return;
  const box = $('[data-player-box]', player);
  const frame = $('[data-player-frame]', player);
  const link = $('[data-player-link]', player);
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
    if (!b.dataset.bvid) { if (live) live.textContent = '这部影片还在整理中。'; return; }
    opener = b;
    const id = encodeURIComponent(b.dataset.bvid);
    link.href = `https://www.bilibili.com/video/${id}`;
    player.hidden = false;
    lenis?.stop();
    document.addEventListener('keydown', esc);
    const load = () => {
      frame.innerHTML = `<iframe src="https://player.bilibili.com/player.html?bvid=${id}&page=1&autoplay=1&danmaku=0&high_quality=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="B站视频播放器"></iframe>`;
    };
    if (reduce) { load(); } else {
      const state = Flip.getState(box);
      Flip.fit(box, $('.ph', b) || b, { scale: true });
      gsap.fromTo(player, { backgroundColor: 'rgba(14,11,9,0)' }, { backgroundColor: 'rgba(14,11,9,.95)', duration: 0.6 });
      Flip.to(state, { duration: 0.8, ease: 'expo.inOut', scale: true, onComplete: load });
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
 * Home is one continuous take. The moon is the subject the camera follows through one night:
 * crescent in the hero, full moon over the series index, waning as the film strip pans,
 * setting in the projection room, a new crescent rising again, and finally landing in the
 * footer as the logo. Every move is tied to the scroll position, so scrolling back plays it in reverse.
 */
function home() {
  const hero = $('[data-hero]');
  const slot = $('[data-hero-moon]');
  const heroSvg = $('.hero-svg', slot);
  const pre = $('[data-pre]');
  const stage = $('[data-stage]');
  const stageMoon = stage && $('.stage-moon', stage);
  const inner = stage && $('.stage-inner', stage);
  const take = Boolean(!reduce && stage && heroSvg);
  const M = moon(heroSvg);
  const darkPref = matchMedia('(prefers-color-scheme: dark)').matches;

  if (take) {
    inner.append(heroSvg);
    root.classList.add('one-take', 'js-scrub');
  }

  // layout used by the camera path, measured on every refresh
  const L = {};
  const footSlot = $('.ftr-moon');
  const ftr = $('[data-ftr]');
  const vp = $('[data-strip-vp]');
  function measure() {
    if (!take) return;
    L.W = innerWidth; L.H = innerHeight; L.m = Math.min(L.W, L.H);
    L.gut = Math.max(20, L.W * 0.05);
    const r = slot.getBoundingClientRect();
    L.B = r.width || L.m * 0.6;
    L.hx = r.left; L.hy = r.top + scrollY;
    stageMoon.style.width = stageMoon.style.height = `${L.B}px`;
    const fs = footSlot.getBoundingClientRect();
    const fr = ftr.getBoundingClientRect();
    L.fx = fs.left; L.fw = fs.width || L.B * 0.5; L.fo = fs.top - fr.top; L.fh = fr.height;
    L.vpH = vp ? vp.getBoundingClientRect().height : 0;
  }
  const wide = () => L.W > 860;
  const S = {
    hero: () => ({ x: L.hx, y: L.hy, s: 1 }),
    sky: () => { const s = (L.m * (wide() ? 0.2 : 0.26)) / L.B; return { x: L.W - L.gut - s * L.B, y: L.H * 0.12, s }; },
    strip: () => { const s = S.sky().s; return { x: L.gut, y: wide() ? Math.max(64, (L.H - L.vpH) / 2 - s * L.B - 18) : L.H * 0.1, s }; },
    set: () => { const s = (L.m * (wide() ? 0.42 : 0.34)) / L.B; return { x: -s * L.B * 0.35, y: L.H * (wide() ? 0.78 : 0.88), s }; },
    rise: () => { const s = (L.m * 0.24) / L.B; return { x: L.W - L.gut - s * L.B, y: L.H * 0.08, s }; },
    land: () => ({ x: L.fx, y: L.H - L.fh + L.fo, s: L.fw / L.B }),
  };
  const PH = {
    cres: { cx: 128, cy: 96 }, full: { cx: 300, cy: 300 }, wane: { cx: 470, cy: 500 },
    dark: { cx: 600, cy: 650 }, wax: { cx: -60, cy: -80 },
  };
  const pos = (k) => ({ x: () => S[k]().x, y: () => S[k]().y, scale: () => S[k]().s });
  function leg(from, to, st, ph, hl) {
    const tl = gsap.timeline({ scrollTrigger: { ...st, scrub: 1, invalidateOnRefresh: true } });
    tl.fromTo(stageMoon, pos(from), { ...pos(to), ease: 'power1.inOut', immediateRender: false }, 0);
    if (ph) tl.fromTo(M.lit, { attr: PH[ph[0]] }, { attr: PH[ph[1]], ease: 'none', immediateRender: false }, 0);
    if (hl) tl.fromTo(M.hl, { opacity: hl[0] }, { opacity: hl[1], ease: 'none', immediateRender: false }, 0);
    return tl;
  }

  // opening: the moon assembled in the preloader flies into the hero instead of leaving
  const intro = () => {
    splitReveal(hero, 0.05);
    if (!reduce) gsap.fromTo('.hero-en', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', delay: 0.9 });
    M.tide(1);
  };
  if (pre && !root.classList.contains('pre-seen') && !reduce) {
    const p = moon($('.pre-svg', pre));
    const words = $$('.pre-word span', pre);
    gsap.set(p.bands.flat(), { y: 640 });
    gsap.set(p.lit, { attr: { cx: -470, cy: -260 } });
    gsap.set(p.hl, { opacity: 0, scale: 0.3, svgOrigin: '186 120' });
    gsap.set(words, { yPercent: 120 });
    const tl = gsap.timeline({ onComplete: () => { pre.remove(); stage?.classList.remove('is-flying'); store.set('qt-pre', '1'); } });
    p.bands.forEach((els, i) => tl.to(els, { y: 0, duration: 1.5, ease: 'expo.out' }, 0.1 + i * 0.08));
    tl.to(p.lit, { attr: { cx: 128, cy: 96 }, duration: 1.3, ease: 'power3.inOut' }, 0.75)
      .to(p.hl, { opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(2)' }, 1.75)
      .to(words, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.08 }, 1.3);
    if (take) {
      tl.add(() => {
        const a = $('.pre-moon', pre).getBoundingClientRect();
        const b = stageMoon.getBoundingClientRect();
        stage.classList.add('is-flying');
        gsap.set(inner, { x: a.left - b.left, y: a.top - b.top, scale: a.width / b.width });
        gsap.set($('.pre-moon', pre), { opacity: 0 });
      }, 2.7)
        .to(inner, { x: 0, y: 0, scale: 1, duration: 1.7, ease: 'expo.inOut' }, 2.72)
        .to(words, { yPercent: -120, duration: 0.6, ease: 'power2.in' }, 2.6)
        .to(pre, { backgroundColor: 'rgba(27,22,18,0)', duration: 1.2, ease: 'power2.inOut' }, 2.9)
        .add(intro, 3.3);
    } else {
      tl.to(pre, { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, 2.7).add(intro, 3.05);
    }
    pre.addEventListener('click', () => tl.progress(0.97));
  } else {
    pre?.remove();
    intro();
    if (take) gsap.fromTo(inner, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.6, ease: 'expo.out' });
  }

  // series index: WebGL cover follows the pointer (three.js), plain image as fallback
  const list = $('[data-series-list]');
  const rv = $('[data-reveal]');
  if (list && fine && !reduce) {
    import('./webgl-reveal.js')
      .then(({ default: webglReveal }) => { if (!webglReveal(list)) domReveal(list, rv); })
      .catch(() => domReveal(list, rv));
  }

  films();
  if (reduce) return;

  if (take) {
    ScrollTrigger.addEventListener('refreshInit', measure);
    measure();
    gsap.set(stageMoon, { x: S.hero().x, y: S.hero().y, scale: 1 });
  }

  // ── 1. hero: the light falls over the moon, which rises into the sky
  gsap.to('.hero-text', { yPercent: -30, opacity: 0, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  if (take) leg('hero', 'sky', { trigger: hero, start: 'top top', end: 'bottom top' }, ['cres', 'full'], [1, 0]);

  // ── 2. series index rises with the scroll
  scrubRise($$('.index .sec-head, .series-list li'));
  scrubRise($$('.strip-sec .sec-head'));

  // ── 3. film strip: a horizontal pan; the moon crosses the sky with it, frames have depth
  const strip = $('[data-strip]');
  const track = $('[data-strip-track]');
  const mm = gsap.matchMedia();
  mm.add('(min-width: 861px)', () => {
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    root.classList.add('strip-pan');
    const pan = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: vp, start: 'center center', end: () => `+=${dist()}`, pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 },
    });
    $$('.sf .ph img', track).forEach((img) => {
      gsap.set(img, { scale: 1.16 });
      gsap.fromTo(img, { xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: img.closest('.sf'), containerAnimation: pan, start: 'left right', end: 'right left', scrub: true } });
    });
    if (take) leg('sky', 'strip', { trigger: vp, start: 'center center', end: () => `+=${dist()}` }, ['full', 'wane']);
    return () => root.classList.remove('strip-pan');
  });
  mm.add('(max-width: 860px)', () => {
    if (take) leg('sky', 'strip', { trigger: strip, start: 'top bottom', end: 'bottom top' }, ['full', 'wane']);
  });

  // ── 4. the paper darkens into the projection room, the screen dollies in, the moon sets
  if (!darkPref) {
    const paper = { '--bg': '#EFE6D8', '--fg': '#33281F', '--fg-2': '#6B5A49', '--accent': '#8F4E17', '--link': '#2F5C61', '--surface': '#E5D9C7' };
    const room = { '--bg': '#1B1612', '--fg': '#EFE6D8', '--fg-2': '#A8977F', '--accent': '#D99A5B', '--link': '#7FA9A8', '--surface': '#2A221C' };
    gsap.timeline({ scrollTrigger: { trigger: '[data-room]', start: 'top 85%', end: 'top 25%', scrub: true } })
      .fromTo(root, paper, { ...room, ease: 'none', immediateRender: false }, 0)
      .fromTo('.grain', { opacity: 0.05 }, { opacity: 0.07, ease: 'none', immediateRender: false }, 0);
    gsap.timeline({ scrollTrigger: { trigger: '.about-teaser', start: 'top 95%', end: 'top 45%', scrub: true } })
      .fromTo(root, room, { ...paper, ease: 'none', immediateRender: false }, 0)
      .fromTo('.grain', { opacity: 0.07 }, { opacity: 0.05, ease: 'none', immediateRender: false }, 0);
  }
  scrubRise($$('.room-sec .sec-head'));
  const screenBtn = $('.screen .film-btn');
  if (screenBtn) {
    gsap.fromTo(screenBtn, { scale: 0.86, clipPath: 'inset(7% 9% 7% 9%)' }, {
      scale: 1, clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
      scrollTrigger: { trigger: '.screen', start: 'top bottom', end: 'center 55%', scrub: true },
    });
  }
  scrubRise($$('.screen-cap, .film-rows li, .room-sec .more-wrap'), { start: 'top 100%', end: 'top 70%' });
  if (take) leg('strip', 'set', { trigger: '[data-room]', start: 'top bottom', end: 'center center' }, ['wane', 'dark']);

  // ── 5. back on paper a new crescent rises, then lands in the footer as the logo
  scrubRise($$('.big-quote, .about-teaser .more-wrap'));
  if (take && !darkPref) {
    gsap.timeline({ scrollTrigger: { trigger: ftr, start: 'top 98%', end: 'top 55%', scrub: true } })
      .fromTo(root, { '--bg': '#EFE6D8' }, { '--bg': '#1B1612', ease: 'none', immediateRender: false }, 0)
      .fromTo('.grain', { opacity: 0.05 }, { opacity: 0.07, ease: 'none', immediateRender: false }, 0);
  }
  if (take) {
    leg('set', 'rise', { trigger: '.about-teaser', start: 'top bottom', end: 'center center' }, ['dark', 'wax']);
    leg('rise', 'land', { trigger: ftr, start: 'top bottom', end: 'bottom bottom' }, ['wax', 'cres'], [0, 1]);
  }
  ScrollTrigger.sort();
}

function domReveal(list, rv) {
  if (!rv) return;
  const img = $('img', rv);
  const xTo = gsap.quickTo(rv, 'x', { duration: 0.7, ease: 'power3.out' });
  const yTo = gsap.quickTo(rv, 'y', { duration: 0.7, ease: 'power3.out' });
  list.addEventListener('pointermove', (e) => { xTo(e.clientX + 28); yTo(e.clientY - rv.offsetHeight / 2); });
  $$('a', list).forEach((a) => a.addEventListener('pointerenter', () => {
    if (img.getAttribute('src') !== a.dataset.cover) img.src = a.dataset.cover;
    rv.style.setProperty('--ar', a.dataset.ar);
    gsap.to(rv, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' });
  }));
  list.addEventListener('pointerleave', () => gsap.to(rv, { opacity: 0, scale: 0.92, duration: 0.4, ease: 'power2.out' }));
}

function series() {
  splitReveal($('.s-head'), 0.1);
  if (!reduce) {
    gsap.fromTo(['.s-en', '.s-meta'], { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', delay: 0.5, stagger: 0.1 });
    const st = $('[data-words]');
    if (st) {
      SplitText.create(st, {
        type: 'lines', mask: 'lines', autoSplit: true, tag: 'span', aria: 'none', linesClass: 'sline',
        onSplit: (self) => gsap.from(self.lines, { yPercent: 100, duration: 1.1, ease: 'expo.out', stagger: 0.09, scrollTrigger: { trigger: st, start: 'top 85%', once: true } }),
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

  // lightbox (PhotoSwipe)
  const edgeCode = ($('[data-edge]')?.firstChild?.textContent || '').trim();
  const lightbox = new PhotoSwipeLightbox({
    gallery: '[data-gallery]',
    children: 'a.fr-open',
    pswpModule: () => import('photoswipe'),
    bgOpacity: 0.97,
    showHideAnimationType: reduce ? 'none' : 'zoom',
    padding: { top: 70, bottom: 120, left: 24, right: 24 },
    wheelToZoom: false,
    zoom: false,
    initialZoomLevel: (z) => Math.min(z.panAreaSize.x / z.elementSize.x, z.panAreaSize.y / z.elementSize.y),
    secondaryZoomLevel: 1.6,
    maxZoomLevel: 3,
    arrowPrevSVG: '<span class="pswp-t">上一格</span>',
    arrowNextSVG: '<span class="pswp-t">下一格</span>',
    closeSVG: '<span class="pswp-t">关闭</span>',
    closeTitle: '关闭', arrowPrevTitle: '上一格', arrowNextTitle: '下一格',
    errorMsg: '这张照片暂时无法加载。',
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
          el.innerHTML = `<span class="edge">${edgeCode}<i>▸ ${n}</i><i>${n}A</i></span><span class="pc-cap">${a.dataset.cap || ''}</span><span class="pc-exif">${a.dataset.exif || ''}</span>`;
        };
        pswp.on('change', render);
        render();
      },
    });
  });
  lightbox.on('beforeOpen', () => { lenis?.stop(); root.classList.add('pswp-open'); });
  lightbox.on('afterInit', () => {
    const el = lightbox.pswp?.element;
    if (el) { el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '照片查看'); }
  });
  lightbox.on('destroy', () => { lenis?.start(); root.classList.remove('pswp-open'); });
  lightbox.init();

  if (location.hash) {
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(() => scrollToEl(el), 500);
  }
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
    if (!reduce) gsap.fromTo($$('.ws, .sheet', shown), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out', stagger: 0.06 });
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
  const svg = $('.ab-svg');
  if (!svg) return;
  const m = moon(svg);
  m.tide(0.9);
  if (!reduce) {
    gsap.timeline({ scrollTrigger: { trigger: '[data-about-moon]', start: 'top 85%', end: 'center 40%', scrub: 1 } })
      .fromTo(m.lit, { attr: { cx: -300, cy: -200 } }, { attr: { cx: 128, cy: 96 }, ease: 'none' }, 0)
      .fromTo(m.hl, { opacity: 0 }, { opacity: 1, ease: 'power2.in' }, 0);
  }
}

function filmsPage() {
  splitReveal(document, 0.05);
  films();
}

function notFound() {
  const svg = $('.nf-svg');
  if (!svg) return;
  const m = moon(svg);
  gsap.set(m.lit, { attr: { cx: -470, cy: -260 } });
  gsap.set(m.hl, { opacity: 0 });
  if (!reduce) gsap.to(m.lit, { attr: { cx: -150, cy: -120 }, duration: 4, ease: 'power2.inOut', delay: 0.4 });
  m.tide(1);
}

({ home, series, works, films: filmsPage, about, nf: notFound }[page] || (() => {}))();
leakOut();
addEventListener('load', () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());
