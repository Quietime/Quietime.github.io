// The home page.
import { gsap, reduce, $, $$, CFG, scrubRise, sceneData, mountScene } from '../core.js';
import heroCard from '../hero.js';
import films from '../parts/player.js';

/*
 * Home: a title card, then one strip of film as the spine of the page (scene/spine.js).
 * The title card shows the sky over the studio at this moment, the letters filling with ink (hero.js, sky/); the
 * seal is pressed once the ink has spread. The scroll then carries the camera along the film, one series to a stop.
 */
export default function home() {
  const data = sceneData();
  const card = $('[data-hero]');
  const sky = CFG.sky || {};
  if (card) heroCard(card, { reduce, sky, words: sky.words || {}, edgeCode: sky.edgeCode });
  if (!reduce) {
    gsap.fromTo('.h-edge', { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'springCrit', delay: 0.2 });
    // the seal is pressed: it lands a little large and settles, then the name and the lines appear
    gsap.fromTo('[data-hero-seal]', { opacity: 0, scale: 1.18 }, { opacity: 1, scale: 1, duration: 0.55, ease: 'springFirm', delay: 2.3 });
    gsap.fromTo('.h-zh, .h-row .h-en, .h-st', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1.1, ease: 'springFirm', delay: 2.45, stagger: 0.1 });
    scrubRise($$('.h-sec'));
  }
  films();
  mountScene('spine', data);
}
