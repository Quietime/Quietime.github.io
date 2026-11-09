// Background music. It is off until the visitor switches it on in the header; the choice is remembered, and once on,
// it carries on from page to page (browsers allow sound only after an interaction, so on a new page it resumes at
// the first click, tap or key press).
// With an uploaded file it plays that file in a loop; otherwise Tone.js plays a slow generative
// ambient piece (ambient.js, loaded only then): a soft pad, a few bell notes, and the faint hiss of a projector.

const KEY = 'qt-sound';
const store = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (v) => { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } },
};

function filePlayer(src, volume) {
  const a = new Audio(src);
  a.loop = true; a.preload = 'auto'; a.volume = 0;
  let raf = 0;
  const fade = (to, ms) => {
    cancelAnimationFrame(raf);
    const from = a.volume, t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      a.volume = from + (to - from) * k;
      if (k < 1) raf = requestAnimationFrame(step); else if (to === 0) a.pause();
    };
    raf = requestAnimationFrame(step);
  };
  return {
    async start() { await a.play(); fade(volume, 2500); },
    stop() { fade(0, 900); },
  };
}

export default function sound(config, ui = {}) {
  const btn = document.querySelector('[data-sound]');
  if (!btn || !config?.on) return;
  let player = null, playing = false, busy = false;
  const want = () => store.get() === 'on';

  const show = () => {
    btn.setAttribute('aria-pressed', String(playing));
    btn.classList.toggle('is-on', playing);
    btn.querySelector('.sound-t').textContent = playing ? ui.soundOn || 'Sound on' : ui.soundOff || 'Sound off';
  };
  show();

  const session = {
    get: () => { try { return sessionStorage.getItem('qt-playing') === '1'; } catch { return false; } },
    set: (v) => { try { sessionStorage.setItem('qt-playing', v ? '1' : '0'); } catch { /* private mode */ } },
  };
  // a start attempt that gives up quietly when the browser still blocks sound
  const within = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('blocked')), ms))]);

  async function play() {
    if (playing || busy) return false;
    busy = true;
    try {
      player ??= config.file ? filePlayer(config.file, config.volume) : await (await import('./ambient.js')).default(config.volume);
      await within(player.start(), 1500);
      playing = true;
    } catch { playing = false; } finally { busy = false; show(); }
    session.set(playing);
    return playing;
  }
  function stop() { if (!playing) return; player?.stop(); playing = false; session.set(false); show(); }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (playing) { stop(); store.set('off'); } else { store.set('on'); play(); }
  });

  // resume on the first interaction, if the visitor switched it on before
  const events = ['pointerdown', 'keydown', 'touchend'];
  const first = (e) => {
    if (e.target instanceof Element && e.target.closest('[data-sound]')) return;
    events.forEach((t) => removeEventListener(t, first, true));
    if (want()) play();
  };
  if (!want()) return;
  events.forEach((t) => addEventListener(t, first, { capture: true, passive: true }));
  // coming from another page where the music was already playing: try to carry on right away
  if (session.get()) play().then((ok) => { if (ok) events.forEach((t) => removeEventListener(t, first, true)); });
}
