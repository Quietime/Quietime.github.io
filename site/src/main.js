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
const scrollToEl = (el, offset = -90) => (lenis ? lenis.scrollTo(el, { offset, duration: 1.4 }) : el.scrollIntoView());

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
  const split = SplitText.create(targets, { type: 'chars', charsClass: 'ch' });
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
  if (svg) {
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

function home() {
  const hero = $('[data-hero]');
  const heroMoon = moon($('.hero-svg'));
  const pre = $('[data-pre]');

  const intro = () => {
    splitReveal(hero, 0.05);
    if (!reduce) {
      gsap.fromTo('.hero-en', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', delay: 0.9 });
      gsap.fromTo('[data-hero-moon]', { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 1.8, ease: 'expo.out' });
    }
    heroMoon.tide(1);
  };

  if (pre && !root.classList.contains('pre-seen') && !reduce) {
    const p = moon($('.pre-svg', pre));
    const words = $$('.pre-word span', pre);
    gsap.set(p.bands.flat(), { y: 640 });
    gsap.set(p.lit, { attr: { cx: -470, cy: -260 } });
    gsap.set(p.hl, { opacity: 0, scale: 0.3, svgOrigin: '186 120' });
    gsap.set(words, { yPercent: 120 });
    const tl = gsap.timeline({ onComplete: () => { pre.remove(); store.set('qt-pre', '1'); } });
    p.bands.forEach((els, i) => tl.to(els, { y: 0, duration: 1.5, ease: 'expo.out' }, 0.1 + i * 0.08));
    tl.to(p.lit, { attr: { cx: 128, cy: 96 }, duration: 1.3, ease: 'power3.inOut' }, 0.75)
      .to(p.hl, { opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(2)' }, 1.75)
      .to(words, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.08 }, 1.3)
      .to(pre, { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, 2.7)
      .add(intro, 3.05);
    pre.addEventListener('click', () => tl.progress(0.93));
  } else {
    pre?.remove();
    intro();
  }

  // scrolling lets the light fall over the whole moon
  if (!reduce) {
    gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 1 } })
      .to(heroMoon.lit, { attr: { cx: 300, cy: 300 }, ease: 'none' }, 0)
      .to(heroMoon.hl, { opacity: 0, ease: 'none' }, 0)
      .to('[data-hero-moon]', { yPercent: -14, rotate: 8, ease: 'none' }, 0)
      .to('.hero-text', { yPercent: -30, opacity: 0, ease: 'none' }, 0);
  }

  // series index: WebGL cover follows the pointer (three.js), plain image as fallback
  const list = $('[data-series-list]');
  const rv = $('[data-reveal]');
  if (list && fine && !reduce) {
    import('./webgl-reveal.js')
      .then(({ default: webglReveal }) => { if (!webglReveal(list)) domReveal(list, rv); })
      .catch(() => domReveal(list, rv));
  }

  // film strip: vertical scroll drives the strip sideways
  const strip = $('[data-strip]');
  const track = $('[data-strip-track]');
  if (strip && track && !reduce) {
    gsap.matchMedia().add('(min-width: 861px)', () => {
      const dist = () => Math.max(0, track.scrollWidth - innerWidth);
      gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: $('[data-strip-vp]'), start: 'center center', end: () => `+=${dist()}`, pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 },
      });
    });
  }

  // print paper turns into the projection room
  ScrollTrigger.create({
    trigger: '[data-room]', start: 'top 55%', end: 'bottom 45%',
    onToggle: (self) => root.classList.toggle('in-room', self.isActive),
  });
  films();
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
        type: 'lines', mask: 'lines', autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, { yPercent: 100, duration: 1.1, ease: 'expo.out', stagger: 0.09, scrollTrigger: { trigger: st, start: 'top 85%', once: true } }),
      });
    }
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
  lightbox.on('destroy', () => { lenis?.start(); root.classList.remove('pswp-open'); });
  lightbox.init();

  if (location.hash) {
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(() => scrollToEl(el), 500);
  }
}

function works() {
  splitReveal(document, 0.05);
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
