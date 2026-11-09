// Custom cursor, driven by springs (physics/spring.js).
//   The dot is stiff and critically damped (f = 16 Hz, ζ = 1), so it follows exactly.
//   The ring has mass: it trails on a softer spring (f = 3.4 Hz, ζ = 0.6) and, like a soft body that keeps its
//   area, stretches along its velocity by 1 + s and narrows across it by 1 / (1 + s), s on its own spring.
//   Over a link the autofocus brackets spring out to the element's edges (f = 5 Hz, ζ = 0.75) and turn amber once
//   they have settled, as a camera confirms focus. A click is a shutter press: a kick to the ring's scale.
// Elements can ask for a label with data-cursor="查看"; data-cursor="hide" hides it (the loupe takes over).
// A canvas with the class is-hot (a print under the pointer in the darkroom) shows its data-hot label.
import { Spring, frameTime } from './physics/spring.js';

const S = (freq, zeta, value = 0) => new Spring({ freq, zeta, value });

export default function cursor() {
  const root = document.documentElement;
  const wrap = document.createElement('div');
  wrap.className = 'cursor';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = '<div class="cur-af"><i></i><i></i><i></i><i></i></div><div class="cur-ring"></div><div class="cur-dot"></div><div class="cur-label"></div>';
  document.body.append(wrap);
  root.classList.add('has-cursor');
  const dot = wrap.querySelector('.cur-dot'), ring = wrap.querySelector('.cur-ring'), af = wrap.querySelector('.cur-af'), label = wrap.querySelector('.cur-label');

  const dx = S(16, 1), dy = S(16, 1), rx = S(3.4, 0.6), ry = S(3.4, 0.6);
  const st = S(4, 0.5), sc = S(6, 0.35, 1);
  const fx = S(5, 0.75), fy = S(5, 0.75), fw = S(5, 0.75, 22), fh = S(5, 0.75, 22);
  let mx = -100, my = -100, target = null, started = false, mode = '';

  const setMode = (next, text = '') => {
    if (next === mode && label.textContent === text) return;
    mode = next; wrap.dataset.mode = next; label.textContent = text;
  };

  // the loop sleeps once every spring has settled; moving, clicking or scrolling (which moves the target) wakes it
  let raf = 0, last = 0;
  const springs = [dx, dy, rx, ry, st, sc, fx, fy, fw, fh];
  const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    wake();
    if (!started) { for (const s of [dx, rx, fx]) s.x = mx; for (const s of [dy, ry, fy]) s.x = my; started = true; }
    wrap.classList.add('on');
    const t = e.target instanceof Element ? e.target : null;
    target = null;
    const tagged = t?.closest('[data-cursor]');
    if (tagged) {
      const v = tagged.dataset.cursor;
      if (v === 'hide') { setMode('hide'); return; }
      target = tagged; setMode('label', v); return;
    }
    const hot = t?.closest('.is-hot[data-hot]');
    if (hot) { setMode('label', hot.dataset.hot); return; }
    if (t?.closest('input, textarea, select, [contenteditable]')) { setMode('text'); return; }
    const link = t?.closest('a, button, summary, label, [role="button"]');
    if (link) { target = link; setMode('link'); return; }
    setMode('');
  }, { passive: true });

  addEventListener('pointerdown', () => { sc.v -= 9; wake(); });
  addEventListener('scroll', wake, { passive: true });
  document.addEventListener('pointerleave', () => wrap.classList.remove('on'));
  // leaving into an iframe (the Bilibili player) or out of the window
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) wrap.classList.remove('on'); });
  addEventListener('blur', () => wrap.classList.remove('on'));

  function tick(now) {
    const dt = frameTime(now, last); last = now;
    if (started) {
      for (const [s, v] of [[dx, mx], [dy, my], [rx, mx], [ry, my]]) s.target = v;
      const x0 = dx.step(dt), y0 = dy.step(dt);
      dot.style.transform = `translate(${x0.toFixed(1)}px, ${y0.toFixed(1)}px)`;
      label.style.transform = `translate(${x0.toFixed(1)}px, ${y0.toFixed(1)}px)`;
      const x = rx.step(dt), y = ry.step(dt);
      st.target = Math.min(0.4, Math.hypot(rx.v, ry.v) / 3200); sc.target = 1;
      const s = st.step(dt), k = sc.step(dt), ang = Math.atan2(ry.v, rx.v);
      ring.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${ang.toFixed(3)}rad) scale(${((1 + s) * k).toFixed(3)}, ${(k / (1 + s)).toFixed(3)})`;
      let tx = mx - 11, ty = my - 11, tw = 22, th = 22;
      const box = target && target.getBoundingClientRect();
      if (box && box.width < innerWidth * 0.6 && box.height < innerHeight * 0.6) { tx = box.left - 7; ty = box.top - 6; tw = box.width + 14; th = box.height + 12; }
      fx.target = tx; fy.target = ty; fw.target = tw; fh.target = th;
      const ax = fx.step(dt), ay = fy.step(dt), aw = fw.step(dt), ah = fh.step(dt);
      af.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px)`;
      af.style.width = `${aw.toFixed(1)}px`; af.style.height = `${ah.toFixed(1)}px`;
      const locked = !!box && tw !== 22;
      wrap.classList.toggle('lock', locked);
      wrap.classList.toggle('sharp', locked && Math.abs(ax - tx) + Math.abs(aw - tw) < 1.5);
    }
    raf = !started || springs.every((x) => x.atRest(0.05)) ? 0 : requestAnimationFrame(tick);
  }
}
