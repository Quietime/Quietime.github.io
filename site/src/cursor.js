// Custom cursor: a dot that follows exactly and a ring that trails behind it.
// Elements can ask for a label with data-cursor="查看"; data-cursor="hide" hides it (the loupe takes over).
import gsap from 'gsap';

export default function cursor() {
  const root = document.documentElement;
  const wrap = document.createElement('div');
  wrap.className = 'cursor';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = '<div class="cur-ring"><span class="cur-label"></span></div><div class="cur-dot"></div>';
  document.body.append(wrap);
  root.classList.add('has-cursor');
  const ring = wrap.querySelector('.cur-ring');
  const dot = wrap.querySelector('.cur-dot');
  const label = wrap.querySelector('.cur-label');

  const dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3.out' });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3.out' });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });

  let mode = '';
  function setMode(next, text = '') {
    if (next === mode && label.textContent === text) return;
    mode = next;
    wrap.dataset.mode = next;
    label.textContent = text;
  }

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    wrap.classList.add('on');
    dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    const t = e.target instanceof Element ? e.target : null;
    const tagged = t?.closest('[data-cursor]');
    if (tagged) {
      const v = tagged.dataset.cursor;
      if (v === 'hide') setMode('hide');
      else setMode('label', v);
      return;
    }
    if (t?.closest('input, textarea, select, [contenteditable]')) setMode('text');
    else if (t?.closest('a, button, summary, label, [role="button"]')) setMode('link');
    else setMode('');
  }, { passive: true });
  addEventListener('pointerdown', () => wrap.classList.add('down'));
  addEventListener('pointerup', () => wrap.classList.remove('down'));
  document.addEventListener('pointerleave', () => wrap.classList.remove('on'));
  // leaving into an iframe (the Bilibili player) or out of the window
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) wrap.classList.remove('on'); });
  addEventListener('blur', () => wrap.classList.remove('on'));
}
