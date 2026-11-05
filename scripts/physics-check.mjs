// Numerical checks for the motion models. Run with: node scripts/physics-check.mjs
// Compares the simulations with the closed-form physics they are meant to follow.
import { springEase, Spring } from '../site/src/physics/spring.js';
import { Fluid } from '../site/src/physics/fluid.js';
import { Ribbon, RIBBON } from '../site/src/physics/ribbon.js';

const pct = (x) => `${(x * 100).toFixed(2)}%`;
const lines = [];
const log = (s) => { lines.push(s); console.log(s); };

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
}
{
  // energy E = ½v² + ½ω²(x-x*)² must never grow for a damped oscillator
  const s = new Spring({ freq: 1.5, zeta: 0.3, value: 0 }); s.target = 1;
  let prev = Infinity, grew = 0;
  for (let t = 0; t < 5; t += 1 / 60) { s.step(1 / 60); const E = 0.5 * s.v * s.v + 0.5 * s.w * s.w * (s.x - 1) ** 2; if (E > prev + 1e-9) grew++; prev = E; }
  log(`   energy increases over 300 frames: ${grew} (should be 0)`);
}

// 2. Fluid: projection removes divergence
log('2. Stable fluid, incompressibility');
{
  const f = new Fluid(96, 54);
  for (let k = 0; k < 40; k++) f.splat(Math.random(), Math.random(), (Math.random() - 0.5) * 4000, (Math.random() - 0.5) * 4000, 0.04, 0.5, 1 / 60);
  const before = f.divergenceRMS();
  f.step(1 / 60);
  for (let k = 0; k < 40; k++) f.splat(Math.random(), Math.random(), (Math.random() - 0.5) * 4000, (Math.random() - 0.5) * 4000, 0.04, 0.5, 1 / 60);
  const t0 = performance.now();
  f.step(1 / 60);
  const ms = performance.now() - t0;
  const after = f.divergenceRMS();
  log(`   RMS divergence of the stirred field ${before.toFixed(3)}, after projection ${after.toFixed(4)} (${pct(after / before)} left), ${ms.toFixed(1)} ms per step on this machine`);
  let kinetic = 0;
  for (let i = 0; i < f.u.length; i++) kinetic += f.u[i] ** 2 + f.v[i] ** 2;
  const k0 = kinetic;
  for (let s = 0; s < 120; s++) f.step(1 / 60);
  kinetic = 0; for (let i = 0; i < f.u.length; i++) kinetic += f.u[i] ** 2 + f.v[i] ** 2;
  log(`   kinetic energy after 2 s without forcing: ${pct(kinetic / k0)} of the start (decays, never blows up)`);
}

// 3. Film ribbon: inextensible, lags while pulled, settles after it stops
log('3. Film ribbon');
{
  const widths = [1300, 430, 760, 760, 760, 430, 520, 760, 760, 430, 760, 760, 760, 1100, 700, 700];
  const r = new Ribbon(widths);
  r.setView(1440, 900);
  const total = widths.reduce((a, b) => a + b, 0);
  r.reset(650);
  let read = 650, maxStretch = 0, maxLag = 0;
  const dt = 1 / 60;
  // accelerate to 1400 px/s, cruise, then stop dead
  for (let t = 0; t < 6; t += dt) {
    const speed = t < 1 ? 1400 * t : t < 4 ? 1400 : 0;
    read = Math.min(total - 400, read + speed * dt);
    r.step(dt, read);
    maxStretch = Math.max(maxStretch, r.stretch());
    if (t > 2 && t < 4) {
      // lag of the far node behind its rest position, against the direction of travel
      const T = r.target(r.s[r.n - 1] - read, r.time, [0, 0, 0]);
      maxLag = Math.max(maxLag, Math.hypot(r.x[3 * (r.n - 1)] - T[0], r.x[3 * (r.n - 1) + 1] - T[1], r.x[3 * (r.n - 1) + 2] - T[2]));
    }
  }
  // switch the slow current off so only the decay of the motion is measured
  RIBBON.drift = 0;
  let settle = 0;
  for (let t = 0; t < 10; t += dt) { r.step(dt, read); if (r.maxSpeed() > 2) settle = t; }
  RIBBON.drift = 0.22;
  log(`   largest stretch of any frame while moving: ${pct(maxStretch)} (film should not stretch)`);
  log(`   trailing of the free end at 1400 px/s: ${maxLag.toFixed(0)} px (drag and inertia)`);
  log(`   time to settle below 2 px/s after a sudden stop: ${settle.toFixed(2)} s`);
  // theory for the loosest node: the envelope decays as e^(-ζωt), so it falls from v₀ to 2 px/s in ln(v₀/2)/(ζω)
  log(`   theory for the free end, ln(1400/2)/(ζω): ${(Math.log(700) / (0.3 * 2 * Math.PI * 0.5)).toFixed(2)} s (nodes nearer the gate are stiffer and settle sooner)`);
}

export default lines;
