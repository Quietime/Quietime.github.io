// The sky over the title card: where the sun and moon are, what colour the light is, what the weather does.
// Pure functions only (no DOM), so scripts/physics-check.mjs can test every formula. See docs/physics.md, section 9.

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/* ── random, seeded per visit ── */
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(ix, iy, s) { let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(s, 982451653); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
/** Fractal value noise in [0, 1]. */
export function fbm(x, y, s, oct = 5) { let v = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { v += a * vnoise(x * f, y * f, s + o * 131); n += a; f *= 2.03; a *= 0.5; } return v / n; }

/* ── astronomy (the SunCalc algorithms) ── */
const RAD = Math.PI / 180, OBL = RAD * 23.4397;
const days = (ms) => ms / 86400000 - 0.5 + 2440588 - 2451545;
const raOf = (l, b) => Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l));
const decOf = (l, b) => Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l));
function sunEq(d) { const M = RAD * (357.5291 + 0.98560028 * d), C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)), L = M + C + RAD * 102.9372 + Math.PI; return { ra: raOf(L, 0), dec: decOf(L, 0) }; }
function moonEq(d) { const L = RAD * (218.316 + 13.176396 * d), M = RAD * (134.963 + 13.064993 * d), F = RAD * (93.272 + 13.22935 * d), l = L + RAD * 6.289 * Math.sin(M), b = RAD * 5.128 * Math.sin(F); return { ra: raOf(l, b), dec: decOf(l, b), dist: 385001 - 20905 * Math.cos(M) }; }
function horizontal(d, lat, lng, c) {
  const phi = RAD * lat, H = RAD * (280.16 + 360.9856235 * d) + RAD * lng - c.ra;
  return {
    alt: Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H)) / RAD,
    az: Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(c.dec) * Math.cos(phi)) / RAD, // from south, west positive
    q: Math.atan2(Math.sin(H), Math.tan(phi) * Math.cos(c.dec) - Math.sin(c.dec) * Math.cos(H)),        // parallactic angle
  };
}
/** Sun and moon at time ms (UTC) seen from lat/lng: altitudes and azimuths in degrees, the moon's phase. */
export function astro(ms, lat, lng) {
  const d = days(ms), s = sunEq(d), m = moonEq(d);
  const sun = horizontal(d, lat, lng, s), moon = horizontal(d, lat, lng, m);
  const elong = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
  const inc = Math.atan2(149598000 * Math.sin(elong), m.dist - 149598000 * Math.cos(elong));        // phase angle, 0 = full
  const limb = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
  return { sun, moon, inc, chi: limb - moon.q, frac: (1 + Math.cos(inc)) / 2, phase: 0.5 + 0.5 * inc * (limb < 0 ? -1 : 1) / Math.PI };
}

/* ── the atmosphere ── */
/** Refraction (Bennett), degrees, for an apparent-looking true altitude h in degrees. */
export const refraction = (h) => (h < -1.5 ? 0 : 1 / Math.tan((h + 7.31 / (h + 4.4)) * RAD) / 60);
export const apparent = (h) => h + refraction(h);
/** Vertical/horizontal diameter of the sun's disc, from the difference in refraction between its edges. */
export const squash = (h) => clamp((apparent(h + 0.265) - apparent(h - 0.265)) / 0.53, 0.6, 1);
/** Kasten–Young relative air mass at altitude h (degrees). */
export const airMass = (h) => { const hh = Math.max(h, -0.9); return 1 / (Math.sin(hh * RAD) + 0.50572 * Math.pow(hh + 6.07995, -1.6364)); };
/** Colour of direct sunlight (display RGB, brightest channel 255): Rayleigh 0.0088 λ^-4.05 plus aerosol β λ^-1.3. */
export function sunlight(h, beta) {
  const X = airMass(h), T = [0.68, 0.55, 0.45].map((l) => Math.exp(-(0.0088 * Math.pow(l, -4.05) + beta * Math.pow(l, -1.3)) * X));
  const m = Math.max(...T);
  return T.map((t) => 255 * Math.pow(t / m, 1 / 2.2));
}
/** Contrast left after looking through d metres of air with visibility V (Koschmieder). */
export const koschmieder = (d, V) => Math.exp((-3.912 * d) / V);

/* ── weather particles ── */
/** Marshall–Palmer slope Λ (per mm) for rain rate R (mm/h); a drop diameter (mm) from a uniform u in [0, 1). */
export const mpLambda = (R) => 4.1 * Math.pow(Math.max(R, 0.1), -0.21);
export const dropDiameter = (u, R) => clamp(-Math.log(1 - u) / mpLambda(R), 0.5, 6);
/** Terminal fall speed of a raindrop of diameter D mm, m/s (Atlas, Srivastava & Sekhon 1973). */
export const dropSpeed = (D) => 9.65 - 10.3 * Math.exp(-0.6 * D);
/** Terminal fall speed of a snow aggregate of diameter D mm, m/s (Locatelli & Hobbs 1974). */
export const snowSpeed = (D) => 0.8 * Math.pow(D, 0.16);
/**
 * A meteor's light curve (classical single-body ablation): I/Imax = 9/4 · x · (1 − x/3)², x = p/p_max, the air
 * pressure relative to where it is brightest. Along a path at constant speed through an exponential atmosphere x grows
 * exponentially: x = 3·e^(−k(1 − s)) for s in [0, 1], with k = 6.4 so it starts at x ≈ 0.005 (about 1% of peak) and
 * burns out at x = 3; the peak (x = 1) falls at s = 1 − ln3/k ≈ 0.83, late in the path, as real meteors do.
 */
export const METEOR_K = 6.4;
export const lightCurve = (s) => { const x = 3 * Math.exp(-METEOR_K * (1 - s)); return clamp(2.25 * x * (1 - x / 3) ** 2, 0, 1); };
/** Star magnitude with N(<m) ∝ 10^(0.6 m), from a uniform u, up to mMax. */
export const starMagnitude = (u, mMax = 6.5) => Math.log10(u * (10 ** (0.6 * mMax) - 1) + 1) / 0.6;

/* ── palettes by sun altitude (art direction; the sun's own colour comes from sunlight()) ── */
const K = (o) => ({ top: hex(o.top), mid: hex(o.mid), hor: hex(o.hor), paper: hex(o.paper), rim: hex(o.rim), text: hex(o.text) });
const night = K({ top: '#121824', mid: '#1C2433', hor: '#2C3444', paper: '#16171A', rim: '#08090B', text: '#DAD5CA' });
const day = K({ top: '#79A3D0', mid: '#AFC7E0', hor: '#E2E7E8', paper: '#ECE9E2', rim: '#2C3741', text: '#1F1E1C' });
const MORNING = [[-18, night], [-8, K({ top: '#253656', mid: '#4C5F86', hor: '#9298B2', paper: '#D9DAE0', rim: '#252B3B', text: '#232733' })],
  [-2, K({ top: '#3A4770', mid: '#A9677E', hor: '#E8A06E', paper: '#E6DFD8', rim: '#38292A', text: '#2A2220' })],
  [5, K({ top: '#7C9DC4', mid: '#E6B88C', hor: '#F2D6A0', paper: '#EBE6DE', rim: '#47332A', text: '#2B231F' })], [16, day]];
const EVENING = [[-18, night], [-8, K({ top: '#222A4A', mid: '#4E4C77', hor: '#9B8FA8', paper: '#DBD9E0', rim: '#272438', text: '#25222F' })],
  [-2, K({ top: '#2D3357', mid: '#9C5070', hor: '#E2794F', paper: '#E7DCD6', rim: '#3B2426', text: '#2B1F1F' })],
  [5, K({ top: '#8C9DBF', mid: '#E8A472', hor: '#F4C07C', paper: '#ECE4DA', rim: '#4B3022', text: '#2C221C' })], [16, day]];
export function palette(alt, rising) {
  const ks = rising ? MORNING : EVENING;
  if (alt <= ks[0][0]) return { ...ks[0][1] };
  for (let i = 1; i < ks.length; i++) if (alt <= ks[i][0]) {
    const [a0, k0] = ks[i - 1], [a1, k1] = ks[i], t = smooth(0, 1, (alt - a0) / (a1 - a0)), o = {};
    for (const k of Object.keys(k0)) o[k] = mix(k0[k], k1[k], t);
    return o;
  }
  return { ...ks[ks.length - 1][1] };
}
/** The time of day as a key: night, blueAm, bluePm, dawn, dusk, rise, set, day. */
export const phaseKey = (alt, rising) => (alt < -12 ? 'night' : alt < -4 ? (rising ? 'blueAm' : 'bluePm') : alt < 2 ? (rising ? 'dawn' : 'dusk') : alt < 10 ? (rising ? 'rise' : 'set') : 'day');
export const moonKey = (p) => (p < 0.03 || p > 0.97 ? 'new' : p < 0.22 ? 'waxCres' : p < 0.28 ? 'first' : p < 0.47 ? 'waxGib' : p < 0.53 ? 'full' : p < 0.72 ? 'wanGib' : p < 0.78 ? 'last' : 'wanCres');

/** What each kind of weather means physically, used when no live reading is at hand. */
export const WEATHER = {
  clear: { R: 0, u: 3, cover: [0.04, 0.22], V: 20000, beta: 0.06 },
  cloud: { R: 0, u: 6, cover: [0.55, 0.75], V: 15000, beta: 0.09 },
  fog: { R: 0, u: 1, cover: [0.2, 0.4], V: 220, beta: 0.35 },
  rain: { R: 6, u: 5, cover: [0.85, 0.95], V: 4000, beta: 0.15 },
  snow: { R: 1.5, u: 2.5, cover: [0.8, 0.92], V: 2500, beta: 0.12 },
};
/** Clouds drift as in a 60× time-lapse: one second on screen is one minute of real wind. */
export const TIMELAPSE = 60;
