import '@fontsource/barlow-condensed/500.css';
import '@fontsource/anton/400.css';
import 'lenis/dist/lenis.css';
import 'photoswipe/style.css';
import './styles.css';

import { ScrollTrigger, page, fine, CFG, U, menu } from './core.js';
import cursor from './cursor.js';
import sound from './sound.js';

// each page's own code loads only on that page
const PAGES = {
  home: () => import('./pages/home.js'),
  series: () => import('./pages/series.js'),
  works: () => import('./pages/works.js'),
  films: () => import('./pages/films.js'),
  about: () => import('./pages/about.js'),
  gallery: () => import('./pages/gallery.js'),
  contact: () => import('./pages/contact.js'),
  nf: () => import('./pages/nf.js'),
};

menu();
if (fine) cursor();
sound(CFG.music, U);
(async () => {
  try {
    const mod = await PAGES[page]?.();
    await mod?.default();
  } catch (e) {
    // a page that fails to start still shows its plain HTML
    console.error(e);
  }
})();
addEventListener('load', () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());
