// The home page.
import { gsap, reduce, $, $$, scrubRise, sceneData, mountScene } from '../core.js';
import heroCard from '../hero.js';
import films from '../parts/player.js';

/*
 * Home: a title card, then one strip of film as the spine of the page (scene/spine.js).
 * The letters of the title fall in under gravity and bounce (hero.js); the scroll then carries the camera along
 * the film, stop by stop, one series to a stop.
 */
export default function home() {
  const data = sceneData();
  const card = $('[data-hero]');
  if (card) heroCard(card, { photo: data?.heroPhoto, reduce });
  if (!reduce) {
    gsap.fromTo('.h-row .h-en, .h-st, .h-edge', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.2, ease: 'springFirm', delay: 1.1, stagger: 0.1 });
    scrubRise($$('.h-sec'));
  }
  films();
  mountScene('spine', data);
}
