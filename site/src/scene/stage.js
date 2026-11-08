// Puts a scene on the page: a fixed canvas behind the content, a run element whose height is the length of the
// take, and a caption in the lower left. Progress through the run drives the scene; the hero above it is a leader
// that lifts away to reveal the canvas.
// The scene draws only while its run is on or near the screen; past it the loop stops until the run comes back.
import { THREE, makeRenderer, cssColor, streamImages, canvasFonts, FONTS } from './kit.js';
import { spineScene } from './spine.js';
import { darkroomScene } from './darkroom.js';

const SCENES = { spine: spineScene, darkroom: darkroomScene };

// the words a scene paints onto canvases, so their faces can be loaded before the canvases are drawn
function canvasText(kind, data) {
  if (kind === 'spine') return [[`500 40px ${FONTS.edge}`, `0123456789A▸ ${data.edge || ''}`]];
  const slates = [data.slates?.head, data.slates?.end, ...(data.series || []).map((s) => s.slate)].filter(Boolean);
  const at = (k) => slates.map((l) => l[k] || '').join('');
  return [[`500 54px ${FONTS.edge}`, `${at(0)}${at(3)}`], [`400 150px ${FONTS.display}`, at(1)], [`400 46px ${FONTS.serif}`, at(2)]];
}

export async function mountStage({ kind, data, run, cap, onPick }) {
  // the spine paints every picture into one atlas, and starts with whatever has arrived; the darkroom streams
  // the pictures for the rows ahead of the camera itself
  const imgs = kind === 'spine' ? streamImages(data.images) : data.images;
  await canvasFonts(canvasText(kind, data));

  const canvas = document.createElement('canvas');
  canvas.className = 'stage';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
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
      if (!running) draw(performance.now());
    }, 180);
  });

  const progress = (r) => {
    const span = r.height - innerHeight;
    return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
  };
  let last = performance.now(), key = '', raf = 0, running = false;
  const draw = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const r = run.getBoundingClientRect();
    // past the end of the run the page covers the canvas: stop drawing
    const live = r.bottom > 0 && r.top < innerHeight * 1.5;
    canvas.style.visibility = live ? '' : 'hidden';
    if (!live) { if (cap) cap.style.opacity = '0'; return; }
    const out = cur.update(dt, progress(r));
    if (cap && out.cap) {
      const k = out.cap.join('|');
      if (k !== key) { key = k; capK.textContent = out.cap[0] || ''; capT.textContent = out.cap[1] || ''; capS.textContent = out.cap[2] || ''; }
      const onStage = r.top < innerHeight * 0.3 && r.bottom > innerHeight * 0.7;
      cap.style.opacity = onStage ? out.show.toFixed(3) : '0';
    }
    renderer.render(scene, camera);
  };
  const frame = (now) => { draw(now); if (running) raf = requestAnimationFrame(frame); };
  const setRunning = (on) => {
    if (on === running) return;
    running = on;
    cancelAnimationFrame(raf);
    if (on) { last = performance.now(); raf = requestAnimationFrame(frame); } else {
      canvas.style.visibility = 'hidden';
      if (cap) cap.style.opacity = '0';
    }
  };
  // the same reach as `live` above, with a screen of margin so the scene is already moving when it appears
  new IntersectionObserver(([en]) => setRunning(en.isIntersecting), { rootMargin: '100% 0px 100% 0px' }).observe(run);
  draw(performance.now());
}
