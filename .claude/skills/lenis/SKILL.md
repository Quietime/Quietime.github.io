---
name: lenis
description: Lenis smooth scroll (darkroom.engineering) — setup, the recommended CSS, syncing with GSAP ScrollTrigger and a WebGL loop, stop()/start() for modals and menus, scrollTo and anchors, nested scroll (data-lenis-prevent), reduced motion, iframes, Safari and iOS limits. Use when adding, configuring or debugging smooth scrolling, when scroll-linked animation stutters or lags behind the scroll, when a page scrolls behind an open dialog, or when the user mentions Lenis.
license: MIT
---

# Lenis

Lenis wraps the browser's native scroll and smooths it, so `position: sticky`, anchors, find-in-page and
accessibility keep working. The full official README (settings, properties, methods, events) is in
`references/README.md`; the official stylesheet is `references/lenis.css`. Read them before using an option you
are not sure about. Docs and showcase: https://lenis.darkroom.engineering

## In this project

`site/src/main.js` creates one instance and drives it from the GSAP ticker:

```js
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';          // required: stopped state, iframes, nested scroll

lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));   // seconds -> ms
gsap.ticker.lagSmoothing(0);
```

- It is not created at all under `prefers-reduced-motion: reduce` (`lenis` stays `null`), so every call is
  written `lenis?.stop()`. Programmatic scrolling falls back to `window.scrollTo` (see `scrollToEl`).
- The menu, the PhotoSwipe viewer and the Bilibili player call `lenis.stop()` when they open and
  `lenis.start()` when they close.
- The WebGL stage (`site/src/scene/stage.js`) reads the scroll position from `getBoundingClientRect()` of the
  run element on its own requestAnimationFrame, which already sees the smoothed position.

## Rules

1. **Always load the recommended CSS** (`import 'lenis/dist/lenis.css'`). Without it `stop()` cannot block
   native touch scrolling (`.lenis-stopped { overflow: clip }`), wheel events are lost over iframes while
   scrolling, and `data-lenis-prevent` areas leak scroll to the page.
2. **One loop.** Either `autoRaf: true` or call `lenis.raf(timeMs)` yourself every frame, never both. With GSAP,
   use the ticker as above and `gsap.ticker.lagSmoothing(0)`.
3. **ScrollTrigger:** `lenis.on('scroll', ScrollTrigger.update)`. Call `ScrollTrigger.refresh()` after layout
   changes (fonts loaded, images sized, a WebGL run element resized).
4. **Dialogs and menus:** `lenis.stop()` on open, `lenis.start()` on close. Scrollable content inside an overlay
   that should scroll natively gets `data-lenis-prevent` (or `prevent: (node) => ...`, or
   `allowNestedScroll: true`, which costs a DOM walk per event).
5. **Anchors:** Lenis does not smooth `#hash` links unless `anchors: true` (or a ScrollToOptions object, e.g.
   `{ offset: -90 }`). For a hash present on load, call `lenis.scrollTo(el, { offset })` once layout is ready.
6. **Reduced motion:** Lenis honours `prefers-reduced-motion` by default (`respectReducedMotion: true`). This
   project skips Lenis entirely in that case; keep it that way.
7. **Touch:** leave `syncTouch` off unless you need scroll-synced inertia on touch; it can be unstable on
   iOS < 16. Native touch scrolling plus `ScrollTrigger.update` is the reliable default.
8. **Iframes** do not forward wheel events, so smooth scroll stops over them; the CSS turns off their pointer
   events only while a smooth scroll is in progress.
9. **Limits:** capped at 60 fps on Safari (30 in Low Power Mode); no CSS scroll-snap (use `lenis/snap`).

## Troubleshooting

- Scroll-linked animation lags or jitters: check that only one RAF drives Lenis and that lag smoothing is off.
- Page scrolls behind an open dialog on a phone: the CSS is missing, or `stop()` was not called.
- `ScrollTrigger` positions are off after load: call `ScrollTrigger.refresh()` on `load` and
  `document.fonts.ready`.
- Something will not scroll at all: test with Lenis disabled to make sure the page itself is scrollable.

Source: README and lenis.css from https://github.com/darkroomengineering/lenis (MIT, see LICENSE). This SKILL.md
was written for this project from that README; Lenis does not publish an official agent skill.
