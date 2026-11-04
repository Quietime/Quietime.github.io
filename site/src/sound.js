// Background music. Browsers only allow sound after the visitor interacts with the page, so the
// music fades in on the first click, tap or key press, and the header switch remembers the choice.
// With an uploaded file it plays that file in a loop; otherwise Tone.js plays a slow generative
// ambient piece: a soft pad, a few bell notes, and the faint hiss of a projector.

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

async function ambientPlayer(volume) {
  const Tone = await import('tone');
  await Tone.start();
  const out = new Tone.Volume(-60).toDestination();
  const reverb = new Tone.Reverb({ decay: 9, wet: 0.55 }).connect(out);
  const lowpass = new Tone.Filter(1400, 'lowpass').connect(reverb);
  const chorus = new Tone.Chorus(0.3, 3.5, 0.4).connect(lowpass).start();

  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsine', count: 3, spread: 18 },
    envelope: { attack: 4, decay: 2, sustain: 0.7, release: 7 },
  }).connect(chorus);
  pad.volume.value = -14;

  const bell = new Tone.FMSynth({
    harmonicity: 3.01, modulationIndex: 6,
    envelope: { attack: 0.005, decay: 2.4, sustain: 0, release: 3 },
    modulationEnvelope: { attack: 0.002, decay: 0.8, sustain: 0, release: 1 },
  }).connect(reverb);
  bell.volume.value = -24;

  const hiss = new Tone.Noise('pink');
  const hissFilter = new Tone.Filter(3200, 'bandpass').connect(out);
  hiss.connect(hissFilter);
  hiss.volume.value = -44;

  // D major pentatonic colours, voiced low and open
  const chords = [['D3', 'A3', 'E4', 'F#4'], ['B2', 'F#3', 'D4', 'A4'], ['G2', 'D3', 'B3', 'F#4'], ['A2', 'E3', 'C#4', 'E4']];
  const notes = ['F#5', 'A5', 'B5', 'D6', 'E5', 'A4'];
  let i = 0;
  const padLoop = new Tone.Loop((time) => { pad.triggerAttackRelease(chords[i++ % chords.length], 7.5, time); }, 8);
  const bellLoop = new Tone.Loop((time) => {
    if (Math.random() < 0.55) bell.triggerAttackRelease(notes[Math.floor(Math.random() * notes.length)], 2, time + Math.random() * 1.5);
  }, 3.2);

  Tone.getTransport().bpm.value = 60;
  const target = -30 + volume * 24; // 0.4 -> about -20 dB
  let started = false, pauseTimer = 0;
  return {
    async start() {
      await Tone.start();
      clearTimeout(pauseTimer);
      if (!started) { started = true; hiss.start(); padLoop.start(0); bellLoop.start(1.6); }
      Tone.getTransport().start();
      out.volume.cancelScheduledValues(Tone.now());
      out.volume.rampTo(target, 3);
    },
    stop() {
      out.volume.rampTo(-60, 1.2);
      pauseTimer = setTimeout(() => Tone.getTransport().pause(), 1300);
    },
  };
}

export default function sound(config) {
  const btn = document.querySelector('[data-sound]');
  if (!btn || !config?.on) return;
  let player = null, playing = false, busy = false;
  const want = () => store.get() !== 'off';

  const show = () => {
    btn.setAttribute('aria-pressed', String(playing));
    btn.classList.toggle('is-on', playing);
    btn.querySelector('.sound-t').textContent = playing ? '声音开' : '声音关';
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
      player ??= config.file ? filePlayer(config.file, config.volume) : await ambientPlayer(config.volume);
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

  // start on the first interaction, unless the visitor switched it off before
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
