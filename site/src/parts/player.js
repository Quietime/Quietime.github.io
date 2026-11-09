// The Bilibili player, opened with Flip from the card that was clicked (home and films pages).
import { gsap, Flip, reduce, $, $$, U, lenis, live } from '../core.js';

/* ── Bilibili player, opened with Flip from the card ───────── */
export default function films() {
  const player = $('[data-player]');
  if (!player) return;
  const box = $('[data-player-box]', player);
  const frame = $('[data-player-frame]', player);
  const link = $('[data-player-link]', player);
  const title = $('[data-player-title]', player);
  let opener = null;
  const esc = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    frame.innerHTML = '';
    player.hidden = true;
    lenis?.start();
    document.removeEventListener('keydown', esc);
    opener?.focus({ preventScroll: true });
  }
  $$('.film-btn, .film-row').forEach((b) => b.addEventListener('click', () => {
    if (!b.dataset.bvid && !b.dataset.aid) { if (live) live.textContent = U.notReady || ''; return; }
    opener = b;
    const q = new URLSearchParams({ isOutside: 'true', p: b.dataset.p || '1', autoplay: '1', danmaku: '0', high_quality: '1' });
    if (b.dataset.bvid) q.set('bvid', b.dataset.bvid);
    if (b.dataset.aid) q.set('aid', b.dataset.aid);
    if (b.dataset.cid) q.set('cid', b.dataset.cid);
    link.href = b.dataset.bvid ? `https://www.bilibili.com/video/${encodeURIComponent(b.dataset.bvid)}` : `https://www.bilibili.com/video/av${encodeURIComponent(b.dataset.aid)}`;
    if (title) title.textContent = (b.getAttribute('aria-label') || '').replace(/^[^：]*：/, '');
    player.hidden = false;
    lenis?.stop();
    document.addEventListener('keydown', esc);
    const load = () => {
      frame.innerHTML = `<iframe src="https://player.bilibili.com/player.html?${q}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen scrolling="no" referrerpolicy="no-referrer-when-downgrade" title="Bilibili"></iframe>`;
    };
    if (reduce) { load(); } else {
      const state = Flip.getState(box);
      Flip.fit(box, $('.ph', b) || b, { scale: true });
      gsap.fromTo(player, { backgroundColor: 'rgba(14,14,16,0)' }, { backgroundColor: 'rgba(14,14,16,.95)', duration: 0.6 });
      Flip.to(state, { duration: 0.8, ease: 'springCrit', scale: true, onComplete: load });
    }
    $('[data-player-close]', player).focus();
  }));
  $('[data-player-close]', player).addEventListener('click', close);
  player.addEventListener('click', (e) => { if (e.target === player) close(); });
}
