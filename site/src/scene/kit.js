// Shared pieces for the two WebGL scenes (home: the film spine, works and series: the darkroom).
import * as THREE from 'three';

export { THREE };
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

/** A damped spring driven towards a moving target:  x'' = -ω² (x - x*) - 2ζω x', fixed 1/240 s sub-steps. */
export class Follow {
  constructor(f, z, x = 0) { this.w = 2 * Math.PI * f; this.z = z; this.x = x; this.v = 0; }
  step(target, dt) {
    if (reduce) { this.x = target; this.v = 0; return this.x; }
    const n = Math.max(1, Math.round(dt / (1 / 240))), h = dt / n;
    for (let i = 0; i < n; i++) { this.v += (-this.w * this.w * (this.x - target) - 2 * this.z * this.w * this.v) * h; this.x += this.v * h; }
    return this.x;
  }
}

export function makeRenderer(canvas) {
  // MSAA for geometry edges; prints add alpha-to-coverage on top for their own edges
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // the shaders work in display values
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

/** A CSS colour token (#rrggbb or rgb(r, g, b)) as display values. */
export function cssColor(name, el = document.body) {
  const s = getComputedStyle(el).getPropertyValue(name).trim();
  let r = 0, g = 0, b = 0;
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (m) [r, g, b] = [m[1], m[2], m[3]].map(Number);
  else if (s.startsWith('#')) { const h = s.slice(1); [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.LinearSRGBColorSpace);
}

export function loadImages(urls) {
  return Promise.all(urls.map((src) => new Promise((ok) => {
    const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src;
  })));
}

export function imageTexture(img, renderer) {
  const t = new THREE.Texture(img);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

/* A photographic print: a white border round the picture on the front, paper on the back.
   Anti-aliasing: the outer edge and the edge between border and picture are each smoothed over one screen
   pixel, measured with fwidth(); the outer edge writes its coverage as alpha, which alpha-to-coverage turns
   into MSAA samples, so the edge is smooth without sorting transparent objects. */
export const PRINT_VS = `
  varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const PRINT_FS = `
  uniform sampler2D map; uniform vec2 uInset; uniform vec3 uLight; uniform vec3 uLightCol; uniform float uAmb;
  uniform vec3 uFog; uniform float uNear; uniform float uFar; uniform vec3 uPaper; uniform vec3 uBack;
  uniform float uMirror; uniform float uDim; uniform float uFloor; uniform float uFade;
  varying vec2 vUv; varying vec3 vN; varying vec3 vW;
  void main() {
    // a print about to reach the camera breaks into grain: 2 × 2 px cells drop out in a fixed random order
    if (uFade < 0.999) {
      vec2 cell = floor(gl_FragCoord.xy / 2.0);
      if (fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453) > uFade) discard;
    }
    bool front = uMirror > 0.5 ? !gl_FrontFacing : gl_FrontFacing;
    vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
    // distance to the outer edge and to the picture, in uv, and the size of one pixel in uv
    vec2 fw = max(fwidth(vUv), vec2(1e-5));
    vec2 eo = min(vUv, 1.0 - vUv) / fw;
    float outer = clamp(min(eo.x, eo.y) + 0.5, 0.0, 1.0);
    vec2 q = (vUv - uInset) / (1.0 - 2.0 * uInset);
    vec2 ei = (min(vUv - uInset, 1.0 - uInset - vUv)) / fw;
    float inner = uInset.x > 0.0 ? clamp(min(ei.x, ei.y) + 0.5, 0.0, 1.0) : 1.0;
    vec3 img = texture2D(map, clamp(q, 0.0, 1.0)).rgb;
    vec3 face = mix(uPaper, img, inner);
    // the back is paper, with the picture showing faintly through it, mirrored
    vec3 col = front ? face : mix(uBack, face, 0.09 * inner);
    vec3 V = normalize(cameraPosition - vW);
    col *= (uAmb + (1.0 - uAmb) * max(dot(n, uLight), 0.0)) * uLightCol;
    col += uLightCol * pow(max(dot(n, normalize(uLight + V)), 0.0), 40.0) * 0.16;
    float d = clamp((distance(cameraPosition, vW) - uNear) / (uFar - uNear), 0.0, 1.0);
    col = mix(col, uFog, d);
    if (uDim < 0.999) col = mix(col * uDim, uFog, clamp((uFloor - vW.y) / 1.5, 0.0, 1.0));
    gl_FragColor = vec4(col, outer);
  }`;

export function printMaterial(tex, inset, o = {}) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide, vertexShader: PRINT_VS, fragmentShader: PRINT_FS,
    alphaToCoverage: true, transparent: false,
    uniforms: {
      map: { value: tex }, uInset: { value: inset },
      uLight: { value: (o.light || new THREE.Vector3(-0.3, 0.8, 0.5)).clone().normalize() }, uLightCol: { value: o.lightCol || new THREE.Vector3(1, 1, 1) },
      uAmb: { value: o.amb ?? 0.72 }, uFog: { value: o.fog || new THREE.Color() }, uNear: { value: o.near ?? 100 }, uFar: { value: o.far ?? 200 },
      uPaper: { value: new THREE.Color().setRGB(0.965, 0.945, 0.91, THREE.LinearSRGBColorSpace) },
      uBack: { value: new THREE.Color().setRGB(0.93, 0.905, 0.86, THREE.LinearSRGBColorSpace) },
      uMirror: { value: 0 }, uDim: { value: 1 }, uFloor: { value: 0 }, uFade: { value: 1 },
    },
  });
}

/** Size of a print with its long side `long`, from the picture's pixel size. */
export function printSize(w, h, long) {
  const r = w && h ? w / h : 1.5;
  return r >= 1 ? [long, long / r] : [long * r, long];
}

/** A card of text drawn on a canvas, used as a slate: [edge code, title, subtitle, small line]. */
export function slateTexture(lines, renderer, fonts) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 600;
  const g = c.getContext('2d');
  g.fillStyle = '#F3ECE0'; g.fillRect(0, 0, c.width, c.height);
  const fit = (text, font, size, max) => { let s = size; g.font = font.replace('{s}', s); while (g.measureText(text).width > max && s > 20) { s -= 4; g.font = font.replace('{s}', s); } };
  g.fillStyle = '#A85E1C'; g.font = `500 54px ${fonts.edge}`; g.fillText(lines[0] || '', 80, 150);
  g.fillStyle = '#33281F'; fit(lines[1] || '', `400 {s}px ${fonts.display}`, 150, 860); g.fillText(lines[1] || '', 72, 336);
  g.fillStyle = '#6B5A49'; fit(lines[2] || '', `400 {s}px ${fonts.serif}`, 46, 860); g.fillText(lines[2] || '', 80, 440);
  g.font = `500 40px ${fonts.edge}`; g.fillText(lines[3] || '', 80, 530);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

export const FONTS = {
  edge: '"Barlow Condensed", "Arial Narrow", sans-serif',
  display: '"Smiley Sans Oblique", "Noto Sans SC", sans-serif',
  serif: '"Newsreader", "Noto Serif SC", serif',
};
