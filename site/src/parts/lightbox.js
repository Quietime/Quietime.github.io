// The photo viewer (PhotoSwipe) with the film-strip caption, for the series pages and the gallery.
import { root, reduce, $, U, lenis } from '../core.js';
import PhotoSwipeLightbox from 'photoswipe/lightbox';

export default function photoLightbox(gallery, children) {
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
