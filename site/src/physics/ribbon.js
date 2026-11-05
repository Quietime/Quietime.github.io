// The film strip as a physical body: a chain of nodes joined by inextensible segments (one per frame).
//
// Each node follows its place on a curved path through space with a damped spring, feels the drag of
// the fluid it moves through, a little gravity, and a torsional spring for twist:
//
//   a = -ω(u)² (x - x*) - 2 ζ(u) ω(u) (v - v*)      spring towards the path point x*, moving at v*
//       - β |v - w| (v - w)                          quadratic drag, w = local fluid velocity
//       + g(u) ĝ                                     gravity, felt only away from the gate
//   θ'' = -ω_t² θ - 2 ζ_t ω_t θ' + κ ∂(v_y - w_y)/∂s  twist driven by shear of the cross flow
//
// u is the node's distance along the strip from the reading head (the "gate" at the centre of the view).
// Near the gate the film is held flat and stiff (like film in a projector gate, so it can be read);
// away from it the springs soften and damping drops, so it sways, sags and twists.
// Length is kept with position-based constraints (Müller et al. 2007): the film cannot stretch.
// Integration: semi-implicit Euler with fixed 1/240 s sub-steps.

const TAU = Math.PI * 2;
const H = 1 / 240;

export const RIBBON = {
  fGate: 1.7, fFree: 0.5,        // natural frequency of the path springs, Hz
  zGate: 0.95, zFree: 0.3,       // damping ratio
  beta: 0.0007,                  // drag coefficient ρ C_d A / 2m, 1/px
  gravity: 240,                  // px/s², away from the gate
  fTwist: 0.9, zTwist: 0.28, kTwist: 0.0009, maxTwist: 0.42,
  iterations: 10,                // length constraint passes per sub-step
  drift: 0.22,                   // slow current that keeps the free ends moving, rad/s
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;

export class Ribbon {
  constructor(lengths) {
    this.L = lengths.slice();
    this.n = lengths.length + 1;
    this.s = [0];
    for (const l of lengths) this.s.push(this.s[this.s.length - 1] + l);
    this.x = new Float64Array(this.n * 3);
    this.v = new Float64Array(this.n * 3);
    this.tw = new Float64Array(this.n);
    this.twv = new Float64Array(this.n);
    this.time = 0;
    this.read = 0;
    this.ready = false;
    this.flow = null;
    this.setView(1440, 900);
  }

  setView(W, Hh) {
    this.W = W; this.Hh = Hh;
    this.R = 2.4 * W;               // radius of the arc the strip lies along
    this.gate = 0.16 * W;           // half-width held flat at the gate
    this.spread = 0.45 * W;         // distance over which it becomes free
    this.Ay = 0.075 * Hh;           // vertical meander amplitude
    this.Az = Math.min(170, 0.1 * W); // depth meander amplitude
  }

  looseness(u) { return smooth((Math.abs(u) - this.gate) / this.spread); }

  // where the node at arc offset u would rest: an arc that recedes on both sides, with slow meanders
  target(u, t, out) {
    const g = this.looseness(u);
    const th = u / this.R;
    out[0] = this.R * Math.sin(th);
    out[1] = this.Ay * g * Math.sin(u / (0.9 * this.W) + 0.7);
    out[2] = -this.R * (1 - Math.cos(th)) + this.Az * g * Math.sin(u / (0.62 * this.W) - RIBBON.drift * t);
    return out;
  }

  reset(read) {
    const T = [0, 0, 0];
    for (let i = 0; i < this.n; i++) {
      this.target(this.s[i] - read, this.time, T);
      this.x[3 * i] = T[0]; this.x[3 * i + 1] = T[1]; this.x[3 * i + 2] = T[2];
      this.v[3 * i] = this.v[3 * i + 1] = this.v[3 * i + 2] = 0;
      this.tw[i] = this.twv[i] = 0;
    }
    this.read = read;
    this.ready = true;
  }

  /** Advance by dt seconds while the reading head moves to `read` (px along the strip). */
  step(dt, read) {
    if (!this.ready || Math.abs(read - this.read) > 3 * this.W) { this.reset(read); return; }
    dt = Math.min(dt, 1 / 20);
    const steps = Math.max(1, Math.round(dt / H));
    const h = dt / steps;
    const P = RIBBON;
    const T = [0, 0, 0], T0 = [0, 0, 0];
    const old = new Float64Array(this.x);
    const r0 = this.read;
    const vry = new Float64Array(this.n);
    for (let k = 1; k <= steps; k++) {
      const rPrev = r0 + ((read - r0) * (k - 1)) / steps;
      const rNow = r0 + ((read - r0) * k) / steps;
      const t = this.time + k * h;
      old.set(this.x);
      for (let i = 0; i < this.n; i++) {
        const u = this.s[i] - rNow;
        const g = this.looseness(u);
        const w = TAU * lerp(P.fGate, P.fFree, g);
        const z = lerp(P.zGate, P.zFree, g);
        this.target(u, t, T);
        this.target(this.s[i] - rPrev, t - h, T0);
        const o = 3 * i;
        const flow = this.flow ? this.flow(this.x[o], this.x[o + 1], this.x[o + 2]) : null;
        const wx = flow ? flow[0] : 0, wy = flow ? flow[1] : 0;
        const rx = this.v[o] - wx, ry = this.v[o + 1] - wy, rz = this.v[o + 2];
        const rm = Math.hypot(rx, ry, rz);
        vry[i] = ry;
        for (let c = 0; c < 3; c++) {
          const vt = (T[c] - T0[c]) / h;
          let a = -w * w * (this.x[o + c] - T[c]) - 2 * z * w * (this.v[o + c] - vt);
          a -= P.beta * rm * (c === 0 ? rx : c === 1 ? ry : rz);
          if (c === 1) a += P.gravity * g;
          this.v[o + c] += a * h;
          this.x[o + c] += this.v[o + c] * h;
        }
      }
      // inextensible film: project each segment back to its length
      for (let it = 0; it < P.iterations; it++) {
        for (let i = 0; i < this.n - 1; i++) {
          const a = 3 * i, b = a + 3;
          const dx = this.x[b] - this.x[a], dy = this.x[b + 1] - this.x[a + 1], dz = this.x[b + 2] - this.x[a + 2];
          const len = Math.hypot(dx, dy, dz) || 1;
          const c = (0.5 * (len - this.L[i])) / len;
          this.x[a] += c * dx; this.x[a + 1] += c * dy; this.x[a + 2] += c * dz;
          this.x[b] -= c * dx; this.x[b + 1] -= c * dy; this.x[b + 2] -= c * dz;
        }
      }
      for (let j = 0; j < this.x.length; j++) this.v[j] = (this.x[j] - old[j]) / h;
      // twist about the strip's own axis, driven by the shear of the cross flow
      const wt = TAU * P.fTwist;
      for (let i = 0; i < this.n; i++) {
        const g = this.looseness(this.s[i] - rNow);
        const shear = i > 0 && i < this.n - 1 ? (vry[i + 1] - vry[i - 1]) : 0;
        const wti = wt * lerp(4, 1, g);
        const a = -wti * wti * this.tw[i] - 2 * P.zTwist * wti * this.twv[i] + P.kTwist * shear * g * 60;
        this.twv[i] += a * h;
        this.tw[i] = Math.max(-P.maxTwist, Math.min(P.maxTwist, this.tw[i] + this.twv[i] * h));
      }
    }
    this.read = read;
    this.time += dt;
  }

  /** Centre, yaw, pitch and twist of frame i (between node i and i + 1). */
  pose(i) {
    const a = 3 * i, b = a + 3, x = this.x;
    const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2];
    const len = Math.hypot(dx, dy, dz) || 1;
    return {
      cx: (x[a] + x[b]) / 2, cy: (x[a + 1] + x[b + 1]) / 2, cz: (x[a + 2] + x[b + 2]) / 2,
      yaw: Math.atan2(-dz, dx), pitch: Math.asin(Math.max(-1, Math.min(1, dy / len))),
      roll: (this.tw[i] + this.tw[i + 1]) / 2, len,
    };
  }

  /** Largest relative stretch of any segment, used by the checks. */
  stretch() {
    let m = 0;
    for (let i = 0; i < this.n - 1; i++) m = Math.max(m, Math.abs(this.pose(i).len - this.L[i]) / this.L[i]);
    return m;
  }

  maxSpeed() {
    let m = 0;
    for (let i = 0; i < this.n; i++) m = Math.max(m, Math.hypot(this.v[3 * i], this.v[3 * i + 1], this.v[3 * i + 2]));
    return m;
  }
}
