// What every page shares: smooth scroll, the light-leak transition, the header, photographs developing into view,
// headings rising, copy buttons, the phone menu and the WebGL stage. Pages import what they need from here.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { Flip } from 'gsap/Flip';
import Lenis from 'lenis';
import { springEase } from './physics/spring.js';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin, Flip);
// every eased motion is the step response of a damped spring (see physics/spring.js);
// exits use power2.in, the x = ½at² of a constant force
gsap.registerEase('spring', springEase(0.62));
gsap.registerEase('springFirm', springEase(0.85));
gsap.registerEase('springCrit', springEase(1));

export { gsap, ScrollTrigger, SplitText, Flip };

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
let CFG = {};
try { CFG = JSON.parse($('#qt-config')?.textContent || '{}'); } catch { CFG = {}; }
const U = CFG.ui || {};
const F = U.f || {};

// CJK type arrives as its own stylesheet after the first paint (fonts/cjk.js); each language adds its own face
const fontsReady = Promise.all([
  import('./fonts/cjk.js'),
  CFG.lang === 'en' ? import('./fonts/en.js') : null,
]).catch(() => {});

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

/* Scroll-linked rise: the element moves with the scroll position, forwards and backwards. */
function scrubRise(els, { y = 56, from = 0.12, start = 'top 98%', end = 'top 62%' } = {}) {
  if (reduce) return;
  els.forEach((el) => gsap.fromTo(el, { y, opacity: from }, {
    y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: el, start, end, scrub: true },
  }));
}

/*
 * The WebGL scenes. A scene is mounted only when the page carries its data, motion is allowed and WebGL works;
 * otherwise the plain HTML under the run stays visible (html.no-gl).
 */
const sceneData = () => { try { return JSON.parse($('#qt-scene')?.textContent || 'null'); } catch { return null; } };
async function mountScene(kind, data, onPick) {
  const run = $('[data-run]');
  if (!data || !run || reduce) { root.classList.add('no-gl'); return; }
  const kit = await import('./scene/kit.js');
  if (!kit.webglOK()) { root.classList.add('no-gl'); return; }
  // anything that goes wrong with the scene (a driver error, a lost context that does not come back) falls back to
  // the plain HTML under the run, never to an empty page
  const fallBack = (e) => {
    if (e) console.error(e);
    root.classList.remove('gl'); root.classList.add('no-gl');
    run.style.height = ''; delete run.dataset.hot;
    document.querySelector('canvas.stage')?.remove();
    ScrollTrigger.refresh();
  };
  try {
    const [{ mountStage }] = await Promise.all([import('./scene/stage.js'), fontsReady]);
    await mountStage({ kind, data, run, cap: $('[data-cap]'), onPick, onFail: fallBack });
    run.dataset.hot = U.view || '';
    const skip = $('[data-run-skip]'), after = $('#after-run');
    if (skip && after) {
      // shown while the scene crosses the middle of the screen
      new IntersectionObserver(([en]) => skip.classList.toggle('is-on', en.isIntersecting), { rootMargin: '-50% 0px -50% 0px' }).observe(run);
      skip.addEventListener('click', () => { scrollToEl(after, 0); after.focus({ preventScroll: true }); });
    }
    ScrollTrigger.refresh();
  } catch (e) { fallBack(e); }
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

export { root, page, reduce, fine, $, $$, store, DIGITS, CFG, U, F, fontsReady, lenis, scrollToEl, leakOut, leakTo, devIO, splitReveal, live, copyText, scrubRise, sceneData, mountScene, menu };
