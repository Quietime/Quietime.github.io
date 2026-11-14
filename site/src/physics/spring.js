// Damped harmonic oscillator, the model behind every eased motion on the site.
//
//   x'' = -ω² (x - x*) - 2 ζ ω x'
//
// ω = 2πf is the natural angular frequency, ζ the damping ratio:
//   ζ < 1 under-damped (a small overshoot, then settles), ζ = 1 critically damped (fastest without overshoot).

const LN1000 = Math.log(1000);

/**
 * Analytic step response of the oscillator, normalised so it reaches 99.9 % at t = 1.
 * Used as a GSAP ease, so a tween of duration T behaves like a spring that settles in T seconds.
 *   under-damped:      x(t) = 1 - e^(-ζωt) [cos(ω_d t) + ζ/√(1-ζ²) sin(ω_d t)],  ω_d = ω√(1-ζ²)
 *   critically damped: x(t) = 1 - e^(-ωt) (1 + ωt)
 */
export function springEase(zeta = 0.7) {
  if (zeta >= 1) {
    const w = 9.23; // e^(-w)(1+w) = 0.001
    return (t) => (t >= 1 ? 1 : 1 - Math.exp(-w * t) * (1 + w * t));
  }
  const w = LN1000 / zeta; // envelope e^(-ζωt) = 0.001 at t = 1
  const wd = w * Math.sqrt(1 - zeta * zeta);
  const k = zeta / Math.sqrt(1 - zeta * zeta);
  return (t) => (t >= 1 ? 1 : 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + k * Math.sin(wd * t)));
}

/** Integration sub-step: every simulation on the site advances in steps no longer than this. */
export const STEP = 1 / 240;
/**
 * Seconds since the last frame, for a simulation. Low frame rates are integrated in full (more sub-steps), so a slow
 * device never sees motion in slow motion; only a real stall (a background tab, a breakpoint) longer than MAX_FRAME
 * is skipped rather than replayed.
 */
export const MAX_FRAME = 0.25;
export const frameTime = (now, last) => Math.min(MAX_FRAME, Math.max(0, (now - last) / 1000));
/** n sub-steps of at most STEP covering dt. */
export const substeps = (dt) => Math.max(1, Math.ceil(dt / STEP));

/** A spring integrated in real time (semi-implicit Euler with sub-steps of at most 1/240 s). */
export class Spring {
  constructor({ freq = 2, zeta = 0.7, value = 0 } = {}) {
    this.w = 2 * Math.PI * freq;
    this.z = zeta;
    this.x = value;
    Object.defineProperty(this, 'y', { get: () => this.x, set: (v) => { this.x = v; } });
    this.v = 0;
    this.target = value;
  }
  step(dt) {
    const n = substeps(dt);
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = -this.w * this.w * (this.x - this.target) - 2 * this.z * this.w * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
    return this.x;
  }
  /** Jump to the target (reduced motion). */
  snap() { this.x = this.target; this.v = 0; return this.x; }
  /** True once the spring sits at its target and has stopped moving (to within `eps`), so a loop can sleep. */
  atRest(eps = 0.01) { return Math.abs(this.x - this.target) < eps && Math.abs(this.v) < eps; }
}
