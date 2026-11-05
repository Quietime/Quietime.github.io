// Home: one strip of film as the spine of the page.
// Every stop is a flat stretch facing you. A series gets exactly as many frames as it has pictures, plus one
// frame of unexposed leader at each end, so its length follows what is uploaded. The camera travels along the
// stretch frame by frame, then pulls back while the film bends away behind, runs back with one full twist (you
// see its back, mirrored and amber through the base) and comes forward again at the next stop.
import { THREE, Follow, smooth, clamp, PRINT_VS } from './kit.js';

// 35 mm film in millimetres: 35 wide, a frame every 38 (8 perforations of 4.75), picture 36 × 24,
// perforations 1.98 along × 2.79 across, 2.01 from the edge (ISO KS)
const MM = { width: 35, pitch: 38, imgW: 36, imgH: 24, perfPitch: 4.75, perfAlong: 1.98, perfAcross: 2.79, perfEdge: 2.01 };

/** All pictures laid out as frames of film on one canvas, in a grid of cols × rows. */
function filmAtlas(imgs, renderer, edgeCode) {
  const max = Math.min(8192, renderer.capabilities.maxTextureSize);
  const n = Math.max(1, imgs.length);
  let fw = 512;
  const fits = (w) => { const cols = Math.floor(max / w); const h = Math.round((MM.width * w) / MM.pitch); return Math.ceil(n / cols) * h <= max; };
  while (!fits(fw) && fw > 128) fw -= 32;
  const k = fw / MM.pitch, H = Math.round(MM.width * k), cols = Math.max(1, Math.min(n, Math.floor(max / fw))), rows = Math.ceil(n / cols);
  const c = document.createElement('canvas'); c.width = fw * cols; c.height = H * rows;
  const g = c.getContext('2d');
  g.fillStyle = '#2A211B'; g.fillRect(0, 0, c.width, c.height);
  const iw = MM.imgW * k, ih = MM.imgH * k;
  imgs.forEach((im, f) => {
    const ox = (f % cols) * fw, oy = Math.floor(f / cols) * H, iy = oy + (H - ih) / 2, x0 = ox + (fw - iw) / 2;
    g.fillStyle = '#120E0B'; g.fillRect(x0 - 2, iy - 2, iw + 4, ih + 4);
    if (im) {
      g.save(); g.beginPath(); g.rect(x0, iy, iw, ih); g.clip();
      if (im.height > im.width) { // a vertical picture lies on its side in the frame, as on a real negative
        g.translate(x0 + iw / 2, iy + ih / 2); g.rotate(-Math.PI / 2);
        const s = Math.max(ih / im.width, iw / im.height); g.drawImage(im, (-im.width * s) / 2, (-im.height * s) / 2, im.width * s, im.height * s);
      } else {
        const s = Math.max(iw / im.width, ih / im.height); g.drawImage(im, x0 + (iw - im.width * s) / 2, iy + (ih - im.height * s) / 2, im.width * s, im.height * s);
      }
      g.restore();
    }
    g.fillStyle = '#D99A5B'; g.font = `500 ${Math.round(1.25 * k)}px "Barlow Condensed", sans-serif`; g.textBaseline = 'middle';
    g.fillText(`${edgeCode}   ▸ ${f + 1}   ${f + 1}A`, ox + 1.2 * k, iy + ih + 0.9 * k);
  });
  g.globalCompositeOperation = 'destination-out';
  const pw = MM.perfAlong * k, ph = MM.perfAcross * k;
  for (let r = 0; r < rows; r++) {
    for (let x = (MM.perfPitch * k - pw) / 2; x < c.width; x += MM.perfPitch * k) {
      for (const y of [r * H + MM.perfEdge * k, r * H + H - MM.perfEdge * k - ph]) { g.beginPath(); g.roundRect(x, y, pw, ph, 0.5 * k); g.fill(); }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return { tex: t, cols, rows };
}

export function spineScene({ renderer, scene, camera, data, imgs, fog }) {
  const W = 1, PITCH = (W * MM.pitch) / MM.width, R = 0.8, D = 2.5;
  const stops = [
    { kind: 'head', n: 3, cap: data.capHead },
    ...data.series.map((se, si) => ({ kind: 'series', si, n: se.n, cap: se.cap })),
    { kind: 'end', n: 3, cap: data.capEnd },
  ];
  stops.forEach((st) => { st.S = Math.max(2.6, ((st.n + 2) * PITCH) / 2); });
  const STOPS = stops.length;
  const Sx = (k) => (k < 0 || k >= STOPS ? 3.5 : stops[k].S);

  // centre line: a flat stretch at every stop, left to right; then the film bends away behind (right), runs back
  // right to left behind the stretches with one full twist, and bends forward again (left) into the next stop
  const raw = [], twist = [], start = [];
  const push = (x, y, z, t) => { raw.push(new THREE.Vector3(x, y, z)); twist.push(t); };
  const st = 0.02;
  let s = 0;
  for (let k = -1; k <= STOPS; k++) {
    const y0 = -k * D, S0 = Sx(k), S1 = Sx(k + 1);
    start[k] = s;
    for (let x = -S0; x < S0; x += st, s += st) push(x, y0, 0, 0);
    if (k === STOPS) break;
    const Lt = Math.PI * R, Lb = S0 + S1, tot = 2 * Lt + Lb, sg = k % 2 ? 1 : -1;
    let acc = 0;
    const yAt = (a) => y0 - D * (0.5 - 0.5 * Math.cos((Math.PI * a) / tot)); // the drop starts and ends level
    for (let a = 0; a < Lt; a += st, acc += st, s += st) { const th = a / R; push(S0 + R * Math.sin(th), yAt(acc), -R * (1 - Math.cos(th)), 0); }
    for (let b = 0; b < Lb; b += st, acc += st, s += st) { const f = b / Lb; push(S0 - b, yAt(acc) + 0.22 * Math.sin(Math.PI * f), -2 * R - 0.6 * Math.sin(Math.PI * f), sg * 2 * Math.PI * smooth(0, 1, f)); }
    for (let a = 0; a < Lt; a += st, acc += st, s += st) { const th = a / R; push(-S1 - R * Math.sin(th), yAt(acc), -2 * R + R * (1 - Math.cos(th)), 0); }
  }
  // vertices at equal arc length, the width kept as upright as the path allows, plus the twist
  const len = [0]; for (let i = 1; i < raw.length; i++) len.push(len[i - 1] + raw[i].distanceTo(raw[i - 1]));
  const L = len[len.length - 1], SEG = 0.02, N = Math.floor(L / SEG) + 1;
  const pos = new Float32Array(N * 6), nor = new Float32Array(N * 6), uvs = new Float32Array(N * 4), idx = [];
  const up = new THREE.Vector3(0, 1, 0), T = new THREE.Vector3(), b = new THREE.Vector3(), nn = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Quaternion();
  let j = 0;
  for (let i = 0; i < N; i++) {
    const ss = i * SEG; while (j < raw.length - 2 && len[j + 1] < ss) j++;
    const f = clamp((ss - len[j]) / (len[j + 1] - len[j] || 1), 0, 1);
    p.copy(raw[j]).lerp(raw[j + 1], f); T.copy(raw[j + 1]).sub(raw[j]).normalize();
    b.copy(up).addScaledVector(T, -up.dot(T)).normalize();
    b.applyQuaternion(q.setFromAxisAngle(T, twist[j] + (twist[j + 1] - twist[j]) * f));
    nn.crossVectors(T, b).normalize();
    for (const [kk, sg] of [[0, -1], [1, 1]]) {
      const o = (2 * i + kk) * 3;
      pos[o] = p.x + (b.x * sg * W) / 2; pos[o + 1] = p.y + (b.y * sg * W) / 2; pos[o + 2] = p.z + (b.z * sg * W) / 2;
      nor[o] = nn.x; nor[o + 1] = nn.y; nor[o + 2] = nn.z;
      uvs[(2 * i + kk) * 2] = ss / PITCH; uvs[(2 * i + kk) * 2 + 1] = kk;
    }
    if (i < N - 1) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  // which picture sits in which frame: each series fills its own stretch in order, with a blank frame of leader
  // at each end; the bends between stops carry all the pictures in turn
  const NF = Math.ceil(L / PITCH) + 4, fm = new Uint16Array(NF);
  const nImg = Math.max(1, imgs.length);
  for (let f = 0; f < NF; f++) fm[f] = f % nImg;
  stops.forEach((stp, k) => {
    const f0 = Math.round((start[k] + stp.S - (stp.n * PITCH) / 2) / PITCH);
    if (stp.kind !== 'series') return;
    const se = data.series[stp.si];
    for (let i = 0; i < stp.n; i++) if (f0 + i < NF) fm[f0 + i] = se.from + (i % Math.max(1, se.n));
    for (const f of [f0 - 1, f0 + stp.n]) if (f >= 0 && f < NF) fm[f] = 65535;
  });
  const fmData = new Float32Array(NF * 4);
  for (let f = 0; f < NF; f++) fmData[4 * f] = fm[f];
  const fmap = new THREE.DataTexture(fmData, NF, 1, THREE.RGBAFormat, THREE.FloatType);
  fmap.magFilter = fmap.minFilter = THREE.NearestFilter; fmap.needsUpdate = true;

  const atlas = filmAtlas(imgs, renderer, data.edge);
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      map: { value: atlas.tex }, fmap: { value: fmap }, uNF: { value: NF }, uCols: { value: atlas.cols }, uRows: { value: atlas.rows },
      uLight: { value: new THREE.Vector3(-0.45, 0.75, 0.6).normalize() }, uFog: { value: fog }, uNear: { value: 6 }, uFar: { value: 16 },
    },
    vertexShader: PRINT_VS,
    fragmentShader: `
      uniform sampler2D map; uniform sampler2D fmap; uniform float uNF; uniform float uCols; uniform float uRows;
      uniform vec3 uLight; uniform vec3 uFog; uniform float uNear; uniform float uFar;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main() {
        float m = vUv.x, f = floor(m);
        float photo = floor(texture2D(fmap, vec2((mod(f, uNF) + 0.5) / uNF, 0.5)).r + 0.5);
        bool blank = photo > 65000.0;
        float pi = blank ? 0.0 : photo;
        float col = mod(pi, uCols), row = floor(pi / uCols);
        vec2 c = vec2((col + m - f) / uCols, 1.0 - (row + 1.0) / uRows + vUv.y / uRows);
        vec2 g = vec2(m / uCols, vUv.y / uRows);          // continuous coordinate, for the texture gradients
        vec4 t = textureGrad(map, c, dFdx(g), dFdy(g));
        if (t.a < 0.5) discard;                             // perforations
        if (blank) t.rgb = vec3(0.165, 0.13, 0.105);        // unexposed leader
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        vec3 V = normalize(cameraPosition - vW);
        vec3 cl = t.rgb * (0.62 + 0.38 * max(dot(n, uLight), 0.0));
        if (!gl_FrontFacing) cl *= vec3(0.86, 0.70, 0.52);  // seen through the amber film base
        cl += vec3(1.0, 0.72, 0.42) * pow(max(dot(n, normalize(uLight + V)), 0.0), 48.0) * 0.5;
        float d = clamp((distance(cameraPosition, vW) - uNear) / (uFar - uNear), 0.0, 1.0);
        gl_FragColor = vec4(mix(cl, uFog, d * 0.5), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  // the take: at each stop the camera travels along the stretch, then pulls back and drops to the next one.
  // A stop lasts as long as its stretch is wider than the view, so twenty pictures take longer than six
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const visW = clamp(camera.aspect * 2.9, 2.3, 4.8), d0 = visW / 2 / (tan * camera.aspect);
  const reach = stops.map((stp) => Math.max(0, (stp.n * PITCH) / 2 - visW * 0.42));
  const hold = reach.map((r) => 0.55 + ((2 * r) / visW) * 0.5);   // half a screen of scrolling per view width of film
  const segs = [];
  let tot = 0;
  stops.forEach((_, k) => {
    segs.push({ k, kind: 'hold', a: tot, b: tot + hold[k] }); tot += hold[k];
    if (k < STOPS - 1) { segs.push({ k, kind: 'move', a: tot, b: tot + 1 }); tot += 1; }
  });
  const station = new Follow(0.8, 1, 0), panS = new Follow(0.9, 1, -reach[0]);
  return {
    pages: tot + 0.4,
    update(dt, pr) {
      const t = pr * tot;
      let sg = segs[segs.length - 1];
      for (const x of segs) if (t <= x.b) { sg = x; break; }
      const f = clamp((t - sg.a) / (sg.b - sg.a || 1), 0, 1);
      let tSig, tPan;
      if (sg.kind === 'hold') { tSig = sg.k; tPan = -reach[sg.k] + 2 * reach[sg.k] * smooth(0, 1, f); } else { const e = smooth(0, 1, f); tSig = sg.k + e; tPan = reach[sg.k] + (-reach[sg.k + 1] - reach[sg.k]) * e; }
      const sig = station.step(tSig, dt), pan = panS.step(tPan, dt);
      const fr = sig - Math.floor(sig), bump = Math.sin(Math.PI * fr) ** 2, side = Math.floor(sig) % 2 ? 1 : -1;
      const dist = d0 * (1 + 1.1 * bump), yaw = 0.42 * bump * side;
      const ty = -sig * D - 0.25 * bump, tz = -0.8 * bump;
      camera.position.set(pan + dist * Math.sin(yaw), ty + 0.12 + 1.1 * bump, tz + dist * Math.cos(yaw));
      camera.lookAt(pan, ty, tz);
      mat.uniforms.uNear.value = d0 + 0.6; mat.uniforms.uFar.value = dist + 5;
      const near = Math.round(sig);
      return { cap: stops[clamp(near, 0, STOPS - 1)].cap, show: 1 - clamp(Math.abs(sig - near) * 3, 0, 1) };
    },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); fmap.dispose(); atlas.tex.dispose(); },
  };
}
