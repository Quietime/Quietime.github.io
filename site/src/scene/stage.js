// Puts a scene on the page: a fixed canvas behind the content, a run element whose height is the length of the
// take, and a caption in the lower left. Progress through the run drives the scene; the hero above it is a leader
// that lifts away to reveal the canvas.
import { THREE, makeRenderer, cssColor, loadImages } from './kit.js';
import { spineScene } from './spine.js';
import { darkroomScene } from './darkroom.js';

const SCENES = { spine: spineScene, darkroom: darkroomScene };

export async function mountStage({ kind, data, run, cap, onPick }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'stage';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
  const imgs = await loadImages(data.images);
  const capK = cap?.querySelector('[data-cap-k]'), capT = cap?.querySelector('[data-cap-t]'), capS = cap?.querySelector('[data-cap-s]');

  let cur = null, lastW = 0, lastNarrow = null;
  const build = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.fov = 30; camera.updateProjectionMatrix();
    cur?.dispose();
    cur = SCENES[kind]({ renderer, scene, camera, data, imgs, fog: cssColor('--bg'), onPick, host: run });
    run.style.height = `${Math.round(cur.pages * 100)}svh`;
    lastW = innerWidth; lastNarrow = camera.aspect < 0.8;
  };
  build();
  document.documentElement.classList.add('gl');

  // a phone's toolbar changes the height while scrolling; rebuild only when the width or the layout changes
  let t = 0;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const narrow = innerWidth / innerHeight < 0.8;
      if (innerWidth !== lastW || narrow !== lastNarrow) build();
      else { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
    }, 180);
  });

  const progress = () => {
    const r = run.getBoundingClientRect();
    const span = r.height - innerHeight;
    return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
  };
  let last = performance.now(), key = '';
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const r = run.getBoundingClientRect();
    // past the end of the run the page covers the canvas: stop drawing
    const live = r.bottom > 0 && r.top < innerHeight * 1.5;
    canvas.style.visibility = live ? '' : 'hidden';
    if (live) {
      const out = cur.update(dt, progress());
      if (cap && out.cap) {
        const k = out.cap.join('|');
        if (k !== key) { key = k; capK.textContent = out.cap[0] || ''; capT.textContent = out.cap[1] || ''; capS.textContent = out.cap[2] || ''; }
        const onStage = r.top < innerHeight * 0.3 && r.bottom > innerHeight * 0.7;
        cap.style.opacity = onStage ? out.show.toFixed(3) : '0';
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
