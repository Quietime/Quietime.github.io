// Numerical checks for the motion models. Run with: node scripts/physics-check.mjs
// Compares the simulations with the closed-form physics they are meant to follow.
import { springEase, Spring } from '../site/src/physics/spring.js';

const pct = (x) => `${(x * 100).toFixed(2)}%`;
const deg = (x) => `${((x * 180) / Math.PI).toFixed(1)}°`;
const lines = [];
const log = (s) => { lines.push(s); console.log(s); };
// a check that fails the run (and the deploy) when a model drifts from its theory
const failures = [];
const expect = (ok, what) => { if (!ok) { failures.push(what); log(`   ✗ ${what}`); } };
const near = (a, b, rel) => Math.abs(a - b) <= rel * Math.abs(b);

// 1. Spring: overshoot of a step response equals e^(-ζπ/√(1-ζ²))
log('1. Damped spring, step response');
for (const zeta of [0.3, 0.62, 0.8]) {
  const theory = Math.exp((-zeta * Math.PI) / Math.sqrt(1 - zeta * zeta));
  const s = new Spring({ freq: 2, zeta, value: 0 }); s.target = 1;
  let peak = 0;
  for (let t = 0; t < 4; t += 1 / 120) peak = Math.max(peak, s.step(1 / 120));
  const e = springEase(zeta); let peakE = 0;
  for (let t = 0; t <= 1; t += 0.0005) peakE = Math.max(peakE, e(t));
  log(`   ζ=${zeta}: theory ${pct(theory)}, integrated ${pct(peak - 1)}, ease curve ${pct(peakE - 1)}`);
  expect(Math.abs(peak - 1 - theory) < 0.01 && Math.abs(peakE - 1 - theory) < 0.01, `spring overshoot at ζ=${zeta} off by more than 1 point`);
}
{
  // energy E = ½v² + ½ω²(x-x*)² must never grow for a damped oscillator
  const s = new Spring({ freq: 1.5, zeta: 0.3, value: 0 }); s.target = 1;
  let prev = Infinity, grew = 0;
  for (let t = 0; t < 5; t += 1 / 60) { s.step(1 / 60); const E = 0.5 * s.v * s.v + 0.5 * s.w * s.w * (s.x - 1) ** 2; if (E > prev + 1e-9) grew++; prev = E; }
  log(`   energy increases over 300 frames: ${grew} (should be 0)`);
  expect(grew === 0, 'damped spring gained energy');
}

// 2. Darkroom prints: rigid-body pendulums, ω² = g L / (k² + L²)
log('2. Darkroom prints, physical pendulums');
const g = 9.8;
const swing = (L, k2, { V = () => 0, S = 0.03, kappa = 0.008, zeta = 0.12, T = 12 } = {}) => {
  const w0 = Math.sqrt((g * L) / (k2 + L * L)), K = L / (k2 + L * L), h = 1 / 240;
  let th = 0.02, thv = 0, lastV = V(0), t = 0, crossings = [], prevTh = th;
  const trace = [];
  for (; t < T; t += h) {
    const v = V(t), a = (v - lastV) / h; lastV = v;
    const rel = v - thv * L * Math.cos(th);
    thv += (K * (S * a * Math.cos(th) - g * Math.sin(th)) - 2 * zeta * w0 * thv + (kappa * rel * Math.abs(rel)) / L) * h;
    th += thv * h;
    if (prevTh > 0 && th <= 0) crossings.push(t);
    prevTh = th; trace.push([t, th]);
  }
  return { w0, crossings, trace };
};
for (const [name, W2, H2, thread, corner] of [['two pegs, 1.37 × 0.95', 1.37, 0.95, 0, false], ['bulldog on a 0.25 thread', 1.37, 0.95, 0.25, false], ['one corner', 1.37, 0.95, 0, true]]) {
  const L = corner ? Math.hypot(W2, H2) / 2 : thread + H2 / 2;
  const k2 = corner ? (W2 * W2 + H2 * H2) / 12 : (H2 * H2) / 12;
  const { w0, crossings } = swing(L, k2, { zeta: 0.0 });
  const period = (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1);
  log(`   ${name}: theory ${(w0 / 2 / Math.PI).toFixed(3)} Hz, simulated ${(1 / period).toFixed(3)} Hz`);
  expect(near(1 / period, w0 / 2 / Math.PI, 0.01), `${name}: pendulum frequency off by more than 1%`);
}
{
  // the rack moves toward the camera at 4 units/s (the camera follows the scroll on a critically damped 0.9 Hz
  // spring), then the scroll stops dead
  const f = 2 * Math.PI * 0.9;
  let x = 0, v = 0, target = 0;
  const speeds = [];
  for (let t = 0; t < 12; t += 1 / 240) { target += (t < 1.5 ? 4 : 0) / 240; v += (-f * f * (x - target) - 2 * f * v) / 240; x += v / 240; speeds.push(v); }
  const V = (t) => speeds[Math.min(speeds.length - 1, Math.round(t * 240))];
  const { trace } = swing(0.475, 0.95 * 0.95 / 12, { V });
  const lean = trace.filter(([t]) => t > 1.2 && t < 1.5).map(([, th]) => th).pop();
  let peak = 0, settle = 0;
  for (const [t, th] of trace) if (t > 1.5) { peak = Math.max(peak, Math.abs(th)); if (Math.abs(th) > (0.5 * Math.PI) / 180) settle = t - 1.5; }
  log(`   scroll at 4 units/s then stop: lean ${deg(lean)} while moving, largest swing after the stop ${deg(peak)}, below 0.5° after ${settle.toFixed(1)} s`);
  expect(peak < (10 * Math.PI) / 180 && settle < 6, 'prints swing too far or ring too long after a stop');
}

// 3. Title card: a letter dropped from rest bounces with restitution 0.32; each bounce reaches e² of the last height
log('3. Title card letters, restitution');
{
  const G = 3920, E = 0.32, h = 1 / 240;
  let y = -600, vy = 0, peaks = [], top = 0, rising = false;
  for (let t = 0; t < 3; t += h) {
    vy += G * h; y += vy * h;
    if (y >= 0) { y = 0; vy = -E * vy; rising = true; top = 0; if (Math.abs(vy) < 60) break; }
    if (rising) { top = Math.min(top, y); if (vy > 0) { peaks.push(-top); rising = false; } }
  }
  log(`   drop 600 px: bounce heights ${peaks.map((p) => p.toFixed(1)).join(', ')} px; theory 600·e² = ${(600 * E * E).toFixed(1)}, then ×${(E * E).toFixed(3)} each`);
  expect(peaks.length > 0 && near(peaks[0], 600 * E * E, 0.05), 'first bounce height off by more than 5%');
}

if (failures.length) { console.error(`\nphysics: ${failures.length} check(s) failed`); process.exitCode = 1; } else log('physics: all checks pass');

export default lines;
