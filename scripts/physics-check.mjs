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
  // once the eddies are faint the confinement fades out, so the flow should die away as e^(-velDecay t)
  const peak = () => { let m = 0; for (let i = 0; i < f.u.length; i++) m = Math.max(m, Math.abs(f.u[i]), Math.abs(f.v[i])); return m; };
  let t = 2, sleep = -1, a = 0, ta = 0;
  for (; t < 60; t += 1 / 60) {
    f.step(1 / 60);
    if (!a && peak() < 0.5) { a = peak(); ta = t; }
    if (!f.active()) { sleep = t; break; }
  }
  const rate = Math.log(a / peak()) / (t - ta);
  log(`   late decay rate ${rate.toFixed(2)}/s against the set damping ${f.velDecay}/s; the liquid can sleep after ${sleep.toFixed(1)} s`);
}

// 3. Film ribbon: inextensible, stiff against folding, lags while pulled, settles after it stops
log('3. Film ribbon');
{
  const widths = [1123, 430, 760, 760, 760, 430, 520, 760, 760, 430, 760, 760, 760, 1060, 634, 634];
  const r = new Ribbon(widths.map((w) => w - 3));
  r.setView(1440, 900);
  const total = widths.reduce((a, b) => a + b, 0);
  r.reset(650);
  let read = 650, maxStretch = 0, maxLag = 0, maxFold = 0;
  const dt = 1 / 60;
  // accelerate to 1400 px/s, cruise, then stop dead; scrolling keeps the slow current at full strength
  for (let t = 0; t < 4; t += dt) {
    const speed = t < 1 ? 1400 * t : 1400;
    read = Math.min(total - 400, read + speed * dt);
    r.current = 1;
    r.step(dt, read);
    maxStretch = Math.max(maxStretch, r.stretch());
    maxFold = Math.max(maxFold, r.maxFold());
    if (t > 2) {
      // lag of the far node behind its rest position, against the direction of travel
      const T = r.target(r.s[r.n - 1] - read, r.phase, [0, 0, 0]);
      maxLag = Math.max(maxLag, Math.hypot(r.x[3 * (r.n - 1)] - T[0], r.x[3 * (r.n - 1) + 1] - T[1], r.x[3 * (r.n - 1) + 2] - T[2]));
    }
  }
  // after the stop the current dies away by itself (e^(-t/calm)); the page sleeps once it is below 5 %
  // and no node moves faster than 0.5 px/s
  let slow = 0, sleep = -1;
  for (let t = 0; t < 40; t += dt) {
    if (r.current < 0.05) r.current = 0;
    r.step(dt, read);
    maxFold = Math.max(maxFold, r.maxFold());
    if (r.maxSpeed() > 2) slow = t;
    if (sleep < 0 && r.current === 0 && r.maxSpeed() < 0.5) sleep = t;
  }
  log(`   largest stretch of any frame while moving: ${pct(maxStretch)} (film should not stretch)`);
  log(`   largest fold between neighbouring frames: ${(maxFold * 180 / Math.PI).toFixed(1)}° (limit ${(RIBBON.maxBend * 180 / Math.PI).toFixed(0)}°)`);
  log(`   trailing of the free end at 1400 px/s: ${maxLag.toFixed(0)} px (drag and inertia)`);
  log(`   after a sudden stop: below 2 px/s in ${slow.toFixed(2)} s, asleep after ${sleep.toFixed(2)} s`);
  log(`   theory: the current falls to 5 % in calm · ln 20 = ${(RIBBON.calm * Math.log(20)).toFixed(2)} s, then the loosest node rings down as e^(-ζωt)`);

  // the far ends run off along the tangent of the arc and never come back into view
  const proj = (W, Hh, x, y, z) => {
    const tz = (-2.2 * Math.PI) / 180, tx = (9 * Math.PI) / 180;
    const x1 = x * Math.cos(tz) - y * Math.sin(tz), y1 = x * Math.sin(tz) + y * Math.cos(tz);
    const z2 = y1 * Math.sin(tx) + z * Math.cos(tx);
    return W * 0.5 + x1 * (1500 / (1500 - z2));
  };
  const bad = [];
  for (const [W, Hh] of [[900, 700], [1440, 900], [2560, 1440]]) {
    const q = new Ribbon([100]); q.setView(W, Hh);
    const T = [0, 0, 0];
    for (let u = 2.6 * W; u < 40 * W; u += 0.05 * W) {
      for (const sgn of [-1, 1]) {
        q.target(sgn * u, 0, T);
        // nearest edge of a frame up to 1180 px wide, seen from the front
        const X = proj(W, Hh, T[0] - sgn * 590, T[1], T[2]);
        if (X > -10 && X < W + 10) { bad.push(`${W}px u=${(sgn * u / W).toFixed(1)}W`); break; }
      }
    }
  }
  log(`   frames more than 2.6 screen widths from the gate that are still in view: ${bad.length ? bad.slice(0, 4).join(', ') : 'none'}`);
}

export default lines;
