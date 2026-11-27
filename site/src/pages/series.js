// The series page.
import { gsap, ScrollTrigger, SplitText, reduce, $, $$, DIGITS, scrollToEl, splitReveal, scrubRise, sceneData, mountScene, lenis } from '../core.js';
import photoLightbox from '../parts/lightbox.js';

export default function series() {
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

  const lb = photoLightbox('[data-gallery]', 'a.fr-open');
  $('[data-flip]')?.addEventListener('click', () => lb.loadAndOpen(0, { gallery: $('[data-gallery]') }));
  // a link to one frame (#f12, from a shared link or a print clicked in the works page's darkroom). Without the
  // darkroom the browser has already jumped to it, but layout may have moved it since: go there again, at once
  const toFrame = () => {
    const m = location.hash.match(/^#f(\d+)$/), el = m && document.getElementById(`f${m[1]}`);
    if (!el) return;
    // with the darkroom on, every print hangs in the scene and the list of frames is hidden: show that frame in the
    // viewer instead, so the link opens on the very picture it names
    if (!el.offsetParent) { lb.loadAndOpen(Number(m[1]) - 1, { gallery: $('[data-gallery]') }); return; }
    ScrollTrigger.refresh();
    const y = el.getBoundingClientRect().top + scrollY - Math.max(0, (innerHeight - el.offsetHeight) / 2);
    if (lenis) lenis.scrollTo(Math.max(0, y), { immediate: true, force: true }); else scrollTo(0, Math.max(0, y));
  };
  mountScene('darkroom', sceneData(), (si, fi, box) => lb.openFrom(fi, box, { gallery: $('[data-gallery]') }))
    .then(() => requestAnimationFrame(toFrame));
  addEventListener('hashchange', toFrame);

  const rail = $('.rail');
  if (rail && !reduce) ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => rail.style.setProperty('--rail', `${-self.scroll() * 0.6}px`) });

  if (location.hash) {
    const el = document.getElementById(location.hash.slice(1));
    if (el) setTimeout(() => scrollToEl(el), 500);
  }
}
