// The generative ambient piece behind the sound switch (sound.js loads this module on the first play).
// Only the parts of Tone.js it uses are imported, by name, so the rest of the library stays out of the bundle.
import { start, now, getTransport, Volume, Reverb, Filter, Chorus, PolySynth, Synth, FMSynth, Noise, Loop } from 'tone';

const Tone = { start, now, getTransport, Volume, Reverb, Filter, Chorus, PolySynth, Synth, FMSynth, Noise, Loop };

export default async function ambientPlayer(volume) {
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
