// Home: one strip of film as the spine of the page.
// Every stop is a flat stretch facing you. A series gets exactly as many frames as it has pictures, plus one
// frame of unexposed leader at each end, so its length follows what is uploaded. The camera travels along the
// stretch frame by frame, then pulls back while the film bends away behind, runs back with one full twist (you
// see its back, mirrored and amber through the base) and comes forward again at the next stop.
import { THREE, Follow, smooth, clamp, PRINT_VS } from './kit.js';

// 35 mm film in millimetres: 35 wide, a frame every 38 (8 perforations of 4.75), picture 36 × 24,
// perforations 1.98 along × 2.79 across, 2.01 from the edge (ISO KS)
const MM = { width: 35, pitch: 38, imgW: 36, imgH: 24, perfPitch: 4.75, perfAlong: 1.98, perfAcross: 2.79, perfEdge: 2.01 };

// a picture keeps its own shape on the strip: every frame is the same 24 mm high across the film, and as long as
// the picture is wide (36 mm for 3:2, 16 mm for an upright 2:3), with 2 mm of film base between frames
const ASPECT = [0.5, 1.5];
const aspectOf = (sz) => (sz && sz[0] && sz[1] ? clamp(sz[0] / sz[1], ASPECT[0], ASPECT[1]) : 1.5);
const frameMM = (sz) => MM.imgH * aspectOf(sz) + 2;

/**
 * Every picture upright in its own cell of one canvas, the edge code printed under it. The cells are drawn as
 * the pictures arrive; `kMax` (pixels per millimetre of film) is what the screen can actually show, so a phone
 * gets a smaller atlas than a large desktop screen. After the pictures come the leader labels: the frame of
 * leader at each end of a roll, written on like a darkroom marks a roll (see `leaderLabel`).
 */
function filmAtlas(sizes, stream, renderer, edgeCode, kMax, labels = []) {
  const max = Math.min(8192, renderer.capabilities.maxTextureSize);
  const n = Math.max(1, sizes.length + labels.length);
  const cellW = MM.imgH * ASPECT[1], cellH = MM.imgH + 1.8; // millimetres
  let k = kMax;
  const fits = (kk) => { const cols = Math.floor(max / Math.ceil(cellW * kk)); return cols > 0 && Math.ceil(n / cols) * Math.ceil(cellH * kk) <= max; };
  while (!fits(k) && k > 3) k -= 0.5;
  const CW = Math.ceil(cellW * k), CH = Math.ceil(cellH * k);
  const cols = Math.max(1, Math.min(n, Math.floor(max / CW))), rows = Math.ceil(n / cols);
  const c = document.createElement('canvas'); c.width = CW * cols; c.height = CH * rows;
  const g = c.getContext('2d');
  g.fillStyle = '#2A211B'; g.fillRect(0, 0, c.width, c.height);
  const ih = MM.imgH * k;
  g.fillStyle = '#D99A5B'; g.font = `500 ${Math.round(1.25 * k)}px "Barlow Condensed", sans-serif`; g.textBaseline = 'middle';
  sizes.forEach((_, f) => g.fillText(`${f + 1}A ▸ ${edgeCode}`, (f % cols) * CW + 0.2 * k, Math.floor(f / cols) * CH + ih + 0.9 * k));
  labels.forEach((lb, j) => {
    const f = sizes.length + j, ox = (f % cols) * CW, oy = Math.floor(f / cols) * CH;
    leaderLabel(g, ox, oy, MM.imgH * ASPECT[1] * k, ih, k, lb);
    g.fillStyle = '#D99A5B'; g.font = `500 ${Math.round(1.25 * k)}px "Barlow Condensed", sans-serif`; g.textBaseline = 'middle';
    g.fillText(`${lb.roll} ▸ ${edgeCode}`, ox + 0.2 * k, oy + ih + 0.9 * k);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  let dirty = false, lastUp = 0;
  const draw = (f, im) => {
    if (!im || f >= sizes.length) return;
    const ox = (f % cols) * CW, oy = Math.floor(f / cols) * CH, iw = MM.imgH * aspectOf(sizes[f]) * k;
    g.save(); g.beginPath(); g.rect(ox, oy, iw, ih); g.clip();
    const sc = Math.max(iw / im.width, ih / im.height);
    g.drawImage(im, ox + (iw - im.width * sc) / 2, oy + (ih - im.height * sc) / 2, im.width * sc, im.height * sc);
    g.restore();
    dirty = true;
  };
  stream.list.forEach((im, f) => draw(f, im));
  const off = stream.onLoad(draw);
  t.needsUpdate = true; dirty = false;
  return {
    tex: t, cols, rows, k, CW, CH, AW: c.width, AH: c.height,
    // a re-upload of the whole atlas at most four times a second while pictures are still coming in
    flush(now) { if (dirty && (now - lastUp > 250 || !stream.pending)) { t.needsUpdate = true; dirty = false; lastUp = now; } },
    dispose() { off(); t.dispose(); },
  };
}

/**
 * The frame of leader at the head of a roll carries the roll's number and name, as if written on the film in the
 * darkroom; the frame at the tail says the roll ends. Both are a little light-struck, the warm fog a strip of film
 * takes at its ends, so they read as leader and not as a picture that failed to load.
 */
function leaderLabel(g, ox, oy, iw, ih, k, lb) {
  g.save(); g.beginPath(); g.rect(ox, oy, iw, ih); g.clip();
  g.fillStyle = '#2A211B'; g.fillRect(ox, oy, iw, ih);
  const fog = g.createLinearGradient(lb.tail ? ox + iw : ox, 0, lb.tail ? ox : ox + iw, 0);
  fog.addColorStop(0, 'rgba(214, 132, 80, 0.34)'); fog.addColorStop(0.4, 'rgba(160, 90, 52, 0.12)'); fog.addColorStop(1, 'rgba(42, 33, 27, 0)');
  g.fillStyle = fog; g.fillRect(ox, oy, iw, ih);
  const fit = (text, font, px, w) => { let z = px; g.font = font(z); while (z > 6 && g.measureText(text).width > w) { z -= 1; g.font = font(z); } return z; };
  const pad = 2.6 * k, w = iw - 2 * pad;
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#D99A5B';
  fit(lb.roll, (z) => `500 ${z}px "Barlow Condensed", sans-serif`, Math.round(2.6 * k), w);
  g.fillText(lb.roll, ox + pad, oy + 5.4 * k);
  if (lb.tail) {
    g.fillStyle = 'rgba(231, 226, 215, 0.62)';
    fit('END', (z) => `500 ${z}px "Barlow Condensed", sans-serif`, Math.round(3.4 * k), w);
    g.fillText('END', ox + pad, oy + ih - 3.2 * k);
  } else {
    // the name on one line if it fits at a readable size, otherwise on two, broken between words
    g.fillStyle = '#E7E2D7';
    const font = (zz) => `500 ${zz}px "Noto Serif SC", serif`;
    let lines = [lb.title], z = fit(lb.title, font, Math.round(5.4 * k), w);
    const words = lb.title.split(' ');
    if (z < 3.6 * k && words.length > 1) {
      let best = null;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
        g.font = font(100); const wid = Math.max(g.measureText(a).width, g.measureText(b).width);
        if (!best || wid < best.wid) best = { a, b, wid };
      }
      lines = [best.a, best.b];
      z = Math.min(fit(best.a, font, Math.round(4.4 * k), w), fit(best.b, font, Math.round(4.4 * k), w));
      g.font = font(z);
    }
    lines.forEach((ln, i) => g.fillText(ln, ox + pad, oy + 8.6 * k + z * (i + 1) * 1.18));
    if (lb.sub) {
      g.fillStyle = '#A39D93';
      fit(lb.sub, (zz) => `400 ${zz}px "Noto Serif SC", serif`, Math.round(2.4 * k), w);
      g.fillText(lb.sub, ox + pad, oy + ih - 3.2 * k);
    }
  }
  g.restore();
}

// a fixed pseudo-random number in [0, 1) for stop k and slot i, the same on every visit
const hash = (k, i) => { const x = Math.sin((k + 3) * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); };

export function spineScene({ renderer, scene, camera, data, imgs, fog }) {
  const sizes = data.sizes || [];
  const W = 1, PITCH = (W * MM.pitch) / MM.width, R = 0.8, D = 2.5;
  const stops = [
    { kind: 'head', n: 3, cap: data.capHead },
    // a phone's view holds less film, so each roll stops for five frames instead of eight
    ...data.series.map((se, si) => ({ kind: 'series', si, n: camera.aspect < 0.8 ? Math.min(se.n, 5) : se.n, cap: se.cap })),
    { kind: 'end', n: 3, cap: data.capEnd },
  ];
  // a stretch is as long as its pictures laid end to end, plus one frame of leader at each end
  const MMW = MM.width / W; // millimetres per world unit
  stops.forEach((st) => {
    const se = st.kind === 'series' ? data.series[st.si] : null;
    st.frames = se ? Array.from({ length: st.n }, (_, i) => se.from + (i % Math.max(1, se.n))) : [];
    st.len = st.frames.reduce((a, pi) => a + frameMM(sizes[pi]), 0) / MMW; // world units, without leader
    st.S = Math.max(2.6, st.len / 2 + PITCH * (st.kind === 'series' ? 1.7 : 1)); // room for the leader labels on the flat
  });
  const STOPS = stops.length;
  const Sx = (k) => (k < 0 || k >= STOPS ? 3.5 : stops[k].S);
  // the rolls are read back and forth, like a field being ploughed: roll 1 left to right, roll 2 right to left, and so
  // on. Each stretch is placed so that it ends where the next one starts reading (right ends lined up after a roll
  // read rightwards, left ends after one read leftwards), so going from one roll to the next is a drop straight down,
  // never a sweep back across the screen
  const readDir = (k) => ((((k % 2) + 2) % 2) === 1 ? 1 : -1);
  const cx = { [-1]: 0 };
  for (let k = -1; k < STOPS; k++) cx[k + 1] = cx[k] + readDir(k) * (Sx(k) - Sx(k + 1));

  // centre line: a flat stretch at every stop, the film running left to right; then it bends away behind (right),
  // runs back right to left behind the stretches with whole twists, and bends forward again (left) into the next stop
  const raw = [], twist = [], start = [], ends = [];
  const push = (x, y, z, t) => { raw.push(new THREE.Vector3(x, y, z)); twist.push(t); };
  const st = 0.02;
  // a stretch lies loose, the way a strip of film does on a light table: it rises and falls gently in depth along
  // its length and sags a little between its ends. Each stop has its own wavelength and phase (fixed, from its
  // index), the waves die out towards the bends so the bends still start level, and the amplitude stays small
  // enough that a picture never looks bent (over one frame the arc rises less than 2 % of its width)
  const loose = (k, x, S0) => {
    const env = smooth(0, 1.6, S0 - Math.abs(x));
    const lam = 5.5 + 1.7 * ((k * 0.618 + 0.3) % 1), ph = k * 2.39;
    return [0.045 * Math.sin((2 * Math.PI * x) / (lam * 1.7) + ph * 0.7) * env, 0.12 * Math.sin((2 * Math.PI * x) / lam + ph) * env];
  };
  for (let k = -1; k <= STOPS; k++) {
    const y0 = -k * D, S0 = Sx(k), S1 = Sx(k + 1), c0 = cx[k];
    start[k] = raw.length;
    for (let x = -S0; x < S0; x += st) { const [dy, dz] = loose(k, x, S0); push(c0 + x, y0 + dy, dz, 0); }
    ends[k] = raw.length - 1;
    if (k === STOPS) break;
    // each run behind has its own character, fixed by its index: one twist or two, either way round, deeper or
    // shallower, rising or sagging, the twist bunched early or late. Whole turns only, so the film always comes back
    // face forward; the deepest point stays in front of the plane the shadows fall on
    const xr = c0 + S0, xl = cx[k + 1] - S1;   // where the film leaves this stretch and where it joins the next
    const Lt = Math.PI * R, Lb = xr - xl, tot = 2 * Lt + Lb;
    const turns = hash(k, 0) < 0.3 ? 2 : 1, dir = hash(k, 1) < 0.5 ? -1 : 1, deep = 0.3 + 0.35 * hash(k, 2), rise = -0.08 + 0.38 * hash(k, 3);
    const tw0 = 0.12 * hash(k, 4), tw1 = 0.84 + 0.16 * hash(k, 5);
    let acc = 0;
    const yAt = (a) => y0 - D * (0.5 - 0.5 * Math.cos((Math.PI * a) / tot)); // the drop starts and ends level
    for (let a = 0; a < Lt; a += st, acc += st) { const th = a / R; push(xr + R * Math.sin(th), yAt(acc), -R * (1 - Math.cos(th)), 0); }
    for (let b = 0; b < Lb; b += st, acc += st) { const f = b / Lb; push(xr - b, yAt(acc) + rise * Math.sin(Math.PI * f), -2 * R - deep * Math.sin(Math.PI * f), dir * turns * 2 * Math.PI * smooth(tw0, tw1, f)); }
    for (let a = 0; a < Lt; a += st, acc += st) { const th = a / R; push(xl - R * Math.sin(th), yAt(acc), -2 * R + R * (1 - Math.cos(th)), 0); }
  }
  // vertices at equal arc length, the width kept as upright as the path allows, plus the twist. Five vertices across
  // the width: film curls a little across, its edges towards the emulsion (CUP world units, about 1 mm on 35 mm)
  const len = [0]; for (let i = 1; i < raw.length; i++) len.push(len[i - 1] + raw[i].distanceTo(raw[i - 1]));
  const L = len[len.length - 1], SEG = 0.02, N = Math.floor(L / SEG) + 1, M = 5, CUP = 0.028;
  // where each flat stretch begins and ends, measured along the film (the drops between stops are longer than
  // their plan, so this has to be the true length, or every later roll would sit off the middle of its stretch)
  const arcA = [], arcB = [];
  for (let k = -1; k <= STOPS; k++) { arcA[k] = len[start[k]]; arcB[k] = len[ends[k]]; }
  const pos = new Float32Array(N * M * 3), nor = new Float32Array(N * M * 3), uvs = new Float32Array(N * M * 2), idx = [];
  // the shadow is cast from the centre line, so each vertex also carries the centre, the across and along directions
  const cen = new Float32Array(N * M * 3), acr = new Float32Array(N * M * 3), tng = new Float32Array(N * M * 3);
  const nv = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), T = new THREE.Vector3(), b = new THREE.Vector3(), nn = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Quaternion();
  let j = 0;
  for (let i = 0; i < N; i++) {
    const ss = i * SEG; while (j < raw.length - 2 && len[j + 1] < ss) j++;
    const f = clamp((ss - len[j]) / (len[j + 1] - len[j] || 1), 0, 1);
    p.copy(raw[j]).lerp(raw[j + 1], f); T.copy(raw[j + 1]).sub(raw[j]).normalize();
    b.copy(up).addScaledVector(T, -up.dot(T)).normalize();
    b.applyQuaternion(q.setFromAxisAngle(T, twist[j] + (twist[j + 1] - twist[j]) * f));
    nn.crossVectors(T, b).normalize();
    for (let kk = 0; kk < M; kk++) {
      const z = -1 + (2 * kk) / (M - 1), o = (M * i + kk) * 3, c = CUP * z * z;
      pos[o] = p.x + (b.x * z * W) / 2 + nn.x * c; pos[o + 1] = p.y + (b.y * z * W) / 2 + nn.y * c; pos[o + 2] = p.z + (b.z * z * W) / 2 + nn.z * c;
      nv.copy(nn).multiplyScalar(W / 2).addScaledVector(b, 2 * CUP * z).normalize();
      nor[o] = nv.x; nor[o + 1] = nv.y; nor[o + 2] = nv.z;
      cen[o] = p.x; cen[o + 1] = p.y; cen[o + 2] = p.z;
      acr[o] = b.x; acr[o + 1] = b.y; acr[o + 2] = b.z;
      tng[o] = T.x; tng[o + 1] = T.y; tng[o + 2] = T.z;
      uvs[(M * i + kk) * 2] = ss; uvs[(M * i + kk) * 2 + 1] = kk / (M - 1);
    }
    if (i < N - 1) for (let kk = 0; kk < M - 1; kk++) { const a = M * i + kk; idx.push(a, a + M, a + 1, a + 1, a + M, a + M + 1); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('center', new THREE.BufferAttribute(cen, 3)); geo.setAttribute('across', new THREE.BufferAttribute(acr, 3)); geo.setAttribute('tang', new THREE.BufferAttribute(tng, 3));

  // which picture sits where along the film, looked up by the millimetre: each series fills its own stretch in
  // order, with a frame of blank leader at each end; the bends between stops carry all the pictures in turn
  const nImg = Math.max(1, sizes.length);
  // the leader labels sit in the atlas after the pictures: a head and a tail for every roll
  const labels = [];
  stops.forEach((stp) => {
    if (stp.kind !== 'series') return;
    const cap = stp.cap || [];
    stp.head = sizes.length + labels.length; labels.push({ roll: cap[0] || '', title: cap[1] || '', sub: String(cap[2] || '').split(' · ')[0] });
    stp.tail = sizes.length + labels.length; labels.push({ roll: cap[0] || '', tail: true });
  });
  const Lmm = L * MMW, frames = [];
  let cur = 0, cyc = 0;
  const put = (photo, len) => { frames.push([photo, cur, len, photo === 65535 ? 0 : len - 2]); cur += len; };
  const fillTo = (end) => {
    for (;;) { const pi = cyc % nImg, fl = frameMM(sizes[pi]); if (cur + fl > end) break; put(pi, fl); cyc += 1; }
    if (end > cur) put(65535, end - cur);
  };
  stops.forEach((stp, k) => {
    if (stp.kind !== 'series') return;
    const c0 = ((arcA[k] + arcB[k]) / 2) * MMW, a0 = c0 - (stp.len * MMW) / 2;
    // pictures run on the bends; the flat of a roll starts with plain leader, then its label
    // a roll read right to left lies the other way round on the film: tail label, last frame … first frame, head label
    const rtl = readDir(k) < 0, first = rtl ? stp.tail : stp.head, last = rtl ? stp.head : stp.tail;
    fillTo(Math.min(arcA[k] * MMW, a0 - MM.pitch));
    const gap = a0 - cur;
    if (gap >= MM.pitch - 0.5) { if (gap > MM.pitch) put(65535, gap - MM.pitch); put(first, MM.pitch); } else if (gap > 0) put(65535, gap);
    for (const pi of rtl ? [...stp.frames].reverse() : stp.frames) put(pi, frameMM(sizes[pi]));
    put(last, MM.pitch);
    // plain leader after the tail label, up to where the film bends away
    const flatEnd = arcB[k] * MMW;
    if (flatEnd > cur) put(65535, flatEnd - cur);
  });
  fillTo(Lmm + 4);
  const FW = 4096, NB = Math.ceil(Lmm) + 8, FH = Math.ceil(NB / FW);
  const fmData = new Float32Array(FW * FH * 4).fill(0);
  for (let i = 0; i < FW * FH; i++) fmData[4 * i] = 65535;
  for (const [photo, a, len, iw] of frames) {
    for (let bin = Math.max(0, Math.floor(a)); bin < Math.min(NB, Math.ceil(a + len)); bin++) {
      if (bin + 0.5 < a || bin + 0.5 >= a + len) continue;
      fmData.set([photo, a, len, iw], 4 * bin);
    }
  }
  const fmap = new THREE.DataTexture(fmData, FW, FH, THREE.RGBAFormat, THREE.FloatType);
  fmap.magFilter = fmap.minFilter = THREE.NearestFilter; fmap.needsUpdate = true;

  // the take: how wide a view of the film the camera holds, and so how many pixels a millimetre of film covers
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const visW = clamp(camera.aspect * 2.9, 2.3, 4.8), d0 = visW / 2 / (tan * camera.aspect);
  const pxPerMM = renderer.getDrawingBufferSize(new THREE.Vector2()).x / (visW * MMW);
  const atlas = filmAtlas(sizes, imgs, renderer, data.edge, clamp(Math.ceil(pxPerMM * 1.1), 8, 14), labels);
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    alphaToCoverage: true,
    uniforms: {
      map: { value: atlas.tex }, fmap: { value: fmap }, uFW: { value: FW }, uFH: { value: FH },
      uCols: { value: atlas.cols }, uK: { value: atlas.k }, uCell: { value: new THREE.Vector2(atlas.CW, atlas.CH) }, uAtlas: { value: new THREE.Vector2(atlas.AW, atlas.AH) },
      uLight: { value: new THREE.Vector3(-0.45, 0.75, 0.6).normalize() }, uFog: { value: fog }, uNear: { value: 6 }, uFar: { value: 16 },
      uFocus: { value: new THREE.Vector3() }, uFocusAmt: { value: 0 }, uSigma: { value: 1 },
    },
    vertexShader: PRINT_VS,
    fragmentShader: `
      uniform sampler2D map; uniform sampler2D fmap; uniform float uFW; uniform float uFH;
      uniform float uCols; uniform float uK; uniform vec2 uCell; uniform vec2 uAtlas;
      uniform vec3 uLight; uniform vec3 uFog; uniform float uNear; uniform float uFar;
      uniform vec3 uFocus; uniform float uFocusAmt; uniform float uSigma;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      const vec3 BASE = vec3(0.165, 0.13, 0.105), RIM = vec3(0.07, 0.055, 0.043);
      void main() {
        float mm = vUv.x * ${MM.width.toFixed(1)};             // along the film
        float ym = (1.0 - vUv.y) * ${MM.width.toFixed(1)};     // across it, from the top edge
        // perforations every 4.75 mm, 1.98 along x 2.79 across, 2.01 from each edge, corners rounded 0.5
        vec2 q = vec2(mod(mm, ${MM.perfPitch}) - ${(MM.perfPitch / 2).toFixed(3)}, min(abs(ym - ${(MM.perfEdge + MM.perfAcross / 2).toFixed(3)}), abs(ym - ${(MM.width - MM.perfEdge - MM.perfAcross / 2).toFixed(3)})));
        vec2 dq = abs(q) - vec2(${(MM.perfAlong / 2).toFixed(3)}, ${(MM.perfAcross / 2).toFixed(3)}) + 0.5;
        float sd = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0) - 0.5;
        float aa = max(fwidth(sd), 1e-4);
        float alpha = smoothstep(-aa, aa, sd);
        if (alpha < 0.01) discard;
        float bin = floor(mm);
        vec4 fr = texture2D(fmap, vec2((mod(bin, uFW) + 0.5) / uFW, (floor(bin / uFW) + 0.5) / uFH));
        vec3 col = BASE;
        if (fr.r < 65000.0) {
          float pi = floor(fr.r + 0.5), lx = mm - fr.g, iw = fr.a, ix = lx - (fr.b - iw) * 0.5, iy = ym - ${((MM.width - MM.imgH) / 2).toFixed(2)};
          vec2 cell = vec2(mod(pi, uCols), floor(pi / uCols)) * uCell;
          vec2 g = vec2(mm, -ym) * uK / uAtlas;               // continuous coordinate, for the texture gradients
          float e = max(fwidth(ix), fwidth(iy));
          if (ix > -0.15 && ix < iw + 0.15 && iy > -0.15 && iy < 24.15) col = RIM;
          if (ix > -e && ix < iw + e && iy > -e && iy < 24.0 + e) {
            vec2 px = cell + vec2(clamp(ix, 0.0, iw), clamp(iy, 0.0, 24.0)) * uK;
            vec3 img = textureGrad(map, vec2(px.x / uAtlas.x, 1.0 - px.y / uAtlas.y), dFdx(g), dFdy(g)).rgb;
            // the picture's own edge, anti-aliased against the rim
            float cov = smoothstep(-e, e, ix) * smoothstep(-e, e, iw - ix) * smoothstep(-e, e, iy) * smoothstep(-e, e, 24.0 - iy);
            col = mix(col, img, cov);
          } else if (iy > 24.2 && iy < 25.7 && ix > 0.0 && lx < fr.b && ix < uCell.x / uK) {
            vec2 px = cell + vec2(ix, iy) * uK;
            col = textureGrad(map, vec2(px.x / uAtlas.x, 1.0 - px.y / uAtlas.y), dFdx(g), dFdy(g)).rgb;
          }
        }
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        vec3 V = normalize(cameraPosition - vW);
        vec3 cl = col * (0.62 + 0.38 * max(dot(n, uLight), 0.0));
        if (!gl_FrontFacing) cl *= vec3(0.86, 0.70, 0.52);  // seen through the amber film base
        cl += vec3(1.0, 0.72, 0.42) * pow(max(dot(n, normalize(uLight + V)), 0.0), 48.0) * 0.5;
        float d = clamp((distance(cameraPosition, vW) - uNear) / (uFar - uNear), 0.0, 1.0);
        // at a stop, the stretch is lit like a loupe over a light table: the frame in the middle a little brighter,
        // the frames towards the sides a little darker; the runs behind are left as they are
        float onStretch = (1.0 - smoothstep(0.6, 1.2, abs(vW.y - uFocus.y))) * (1.0 - smoothstep(0.4, 0.9, abs(vW.z - uFocus.z)));
        float dx = vW.x - uFocus.x;
        cl *= mix(1.0, 0.8 + 0.26 * exp(-dx * dx / (uSigma * uSigma)), uFocusAmt * onStretch);
        gl_FragColor = vec4(mix(cl, uFog, d * 0.5), alpha);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  // a soft shadow on the page behind: the film is projected along the light onto a plane just behind its deepest
  // point, and the shadow widens and fades with the distance it falls, sharp where the film runs near the page,
  // faint and broad under the stretch in front (a penumbra grows with distance, here linearly)
  const SH = { L: new THREE.Vector3(-0.15, 0.25, 1).normalize(), zp: -2.35 };
  const shadowMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uL: { value: SH.L }, uZp: { value: SH.zp }, uW: { value: W }, uCol: { value: new THREE.Color(0x2a1f17) } },
    vertexShader: `
      attribute vec3 center; attribute vec3 across; attribute vec3 tang;
      uniform vec3 uL; uniform float uZp; uniform float uW;
      varying float vZ; varying float vCore; varying float vStr;
      void main() {
        float zeta = uv.y * 2.0 - 1.0;
        float tt = max(0.0, (center.z - uZp) / uL.z);
        vec2 c = center.xy - uL.xy * tt;
        vec2 t2 = tang.xy - uL.xy * (tang.z / uL.z); float tl = length(t2); t2 = tl > 1e-4 ? t2 / tl : vec2(1.0, 0.0);
        vec2 perp = vec2(-t2.y, t2.x);
        vec2 ac = across.xy - uL.xy * (across.z / uL.z);
        float hw = abs(dot(ac, perp)) * uW * 0.5, blur = 0.05 + 0.32 * tt;
        vZ = zeta; vCore = hw / (hw + blur); vStr = 0.5 / (1.0 + 0.9 * tt);
        gl_Position = projectionMatrix * viewMatrix * vec4(c + perp * zeta * (hw + blur), uZp, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uCol; varying float vZ; varying float vCore; varying float vStr;
      void main() { gl_FragColor = vec4(uCol, vStr * (1.0 - smoothstep(vCore * 0.3, 1.0, abs(vZ)))); }`,
  });
  const shadow = new THREE.Mesh(geo, shadowMat);
  shadow.renderOrder = -1; shadow.frustumCulled = false;
  scene.add(shadow);

  // the take: at each stop the camera travels along the stretch, then pulls back and drops to the next one.
  // A stop lasts as long as its stretch is wider than the view, so twenty pictures take longer than six
  // the travel starts with the head label in view and ends once the tail label is in: from -reachA to +reachB
  const ext = (stp, e) => Math.max(0, stp.len / 2 + (stp.kind === 'series' ? PITCH * e : 0) - visW * 0.42);
  const reachA = stops.map((stp) => ext(stp, camera.aspect < 0.8 ? 1.5 : 1.25)), reachB = stops.map((stp) => ext(stp, 0.9));
  // On a phone a screen of scrolling is a short thumb flick, so the take moves faster there: the drop between two
  // rolls takes 0.65 of a screen instead of a whole one, and each roll is held a little shorter.
  const phone = camera.aspect < 0.8;
  const MOVE = phone ? 0.75 : 1, HOLD0 = phone ? 0.4 : 0.55;
  const hold = reachA.map((r, k) => (stops[k].kind === 'head' ? HOLD0 * 0.45 : HOLD0) + ((r + reachB[k]) / visW) * 0.5);   // half a screen of scrolling per view width of film
  const segs = [];
  let tot = 0;
  stops.forEach((_, k) => {
    segs.push({ k, kind: 'hold', a: tot, b: tot + hold[k] }); tot += hold[k];
    if (k < STOPS - 1) { segs.push({ k, kind: 'move', a: tot, b: tot + MOVE }); tot += MOVE; }
  });
  const panAt = (k, e) => cx[k] + readDir(k) * (-reachA[k] + (reachA[k] + reachB[k]) * e);  // e: 0 head … 1 tail
  const station = new Follow(0.8, 1, 0), panS = new Follow(0.9, 1, panAt(0, 0));
  // at a stop the camera stands a little to one side and above the film, always the same side, and the horizon
  // stays level. Going from one roll to the next it only drops and draws back a little: no turning, no tilting and
  // no drift of its own, since a camera that rotates while the reader scrolls is what makes people feel sick
  const YAW = phone ? 0.08 : 0.12, TILT = 0.09;
  // how far the view looks below the film (a share of the visible height), and the loupe's width (about one frame)
  const LIFT = phone ? 0 : 0.085 * (visW / camera.aspect);
  mat.uniforms.uSigma.value = phone ? 0.75 : 1.15;
  // where each roll begins on the scroll, for the roll marks of the progress rail
  const marks = segs.filter((sg) => sg.kind === 'hold' && stops[sg.k].kind === 'series')
    .map((sg) => ({ label: stops[sg.k].cap?.[1] || '', at: sg.a / tot }));
  return {
    pages: tot + 0.4,
    marks,
    update(dt, pr) {
      atlas.flush(performance.now());
      const t = pr * tot;
      let sg = segs[segs.length - 1];
      for (const x of segs) if (t <= x.b) { sg = x; break; }
      const f = clamp((t - sg.a) / (sg.b - sg.a || 1), 0, 1);
      let tSig, tPan;
      // the sideways travel finishes early in a drop and the camera rests a moment at the head of a roll, so the
      // spring that follows it has caught up and the roll's label is in view before the pan sets off along the frames
      if (sg.kind === 'hold') { tSig = sg.k; tPan = panAt(sg.k, smooth(0.12, 1, f)); } else { const e = smooth(0, 1, f); tSig = sg.k + e; tPan = panAt(sg.k, 1) + (panAt(sg.k + 1, 0) - panAt(sg.k, 1)) * smooth(0, 0.75, f); }
      const sig = station.step(tSig, dt), pan = panS.step(tPan, dt);
      const fr = sig - Math.floor(sig), bump = Math.sin(Math.PI * fr) ** 2;
      const dist = d0 * (1 + 0.55 * bump);
      const ty = -sig * D - 0.25 * bump, tz = -0.5 * bump;
      camera.position.set(pan + dist * Math.sin(YAW), ty + 0.12 + 0.5 * bump + dist * TILT, tz + dist * Math.cos(YAW));
      camera.up.set(0, 1, 0);
      // the roll's caption sits in the lower left; aim a little below the film so the stretch rides above it
      camera.lookAt(pan, ty - LIFT * (1 - bump), tz);
      mat.uniforms.uNear.value = d0 + 0.6; mat.uniforms.uFar.value = dist + 5;
      mat.uniforms.uFocus.value.set(pan, ty, tz); mat.uniforms.uFocusAmt.value = (1 - bump) ** 2;
      const near = Math.round(sig);
      return { cap: stops[clamp(near, 0, STOPS - 1)].cap, show: 1 - clamp(Math.abs(sig - near) * 3, 0, 1) };
    },
    dispose() { scene.remove(mesh, shadow); geo.dispose(); mat.dispose(); shadowMat.dispose(); fmap.dispose(); atlas.dispose(); camera.up.set(0, 1, 0); },
  };
}
