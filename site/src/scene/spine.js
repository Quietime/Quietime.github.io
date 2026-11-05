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
const aspectOf = (im) => (im && im.width && im.height ? clamp(im.width / im.height, ASPECT[0], ASPECT[1]) : 1.5);
const frameMM = (im) => MM.imgH * aspectOf(im) + 2;

/** Every picture upright in its own cell of one canvas, the edge code printed under it. */
function filmAtlas(imgs, renderer, edgeCode) {
  const max = Math.min(8192, renderer.capabilities.maxTextureSize);
  const n = Math.max(1, imgs.length);
  const cellW = MM.imgH * ASPECT[1], cellH = MM.imgH + 1.8; // millimetres
  let k = 14;
  const fits = (kk) => { const cols = Math.floor(max / Math.ceil(cellW * kk)); return cols > 0 && Math.ceil(n / cols) * Math.ceil(cellH * kk) <= max; };
  while (!fits(k) && k > 3) k -= 0.5;
  const CW = Math.ceil(cellW * k), CH = Math.ceil(cellH * k);
  const cols = Math.max(1, Math.min(n, Math.floor(max / CW))), rows = Math.ceil(n / cols);
  const c = document.createElement('canvas'); c.width = CW * cols; c.height = CH * rows;
  const g = c.getContext('2d');
  g.fillStyle = '#2A211B'; g.fillRect(0, 0, c.width, c.height);
  const ih = MM.imgH * k;
  imgs.forEach((im, f) => {
    const ox = (f % cols) * CW, oy = Math.floor(f / cols) * CH, iw = MM.imgH * aspectOf(im) * k;
    if (im) {
      g.save(); g.beginPath(); g.rect(ox, oy, iw, ih); g.clip();
      const sc = Math.max(iw / im.width, ih / im.height);
      g.drawImage(im, ox + (iw - im.width * sc) / 2, oy + (ih - im.height * sc) / 2, im.width * sc, im.height * sc);
      g.restore();
    }
    g.fillStyle = '#D99A5B'; g.font = `500 ${Math.round(1.25 * k)}px "Barlow Condensed", sans-serif`; g.textBaseline = 'middle';
    g.fillText(`${f + 1}A ▸ ${edgeCode}`, ox + 0.2 * k, oy + ih + 0.9 * k);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return { tex: t, cols, rows, k, CW, CH, AW: c.width, AH: c.height };
}

export function spineScene({ renderer, scene, camera, data, imgs, fog }) {
  const W = 1, PITCH = (W * MM.pitch) / MM.width, R = 0.8, D = 2.5;
  const stops = [
    { kind: 'head', n: 3, cap: data.capHead },
    ...data.series.map((se, si) => ({ kind: 'series', si, n: se.n, cap: se.cap })),
    { kind: 'end', n: 3, cap: data.capEnd },
  ];
  // a stretch is as long as its pictures laid end to end, plus one frame of leader at each end
  const MMW = MM.width / W; // millimetres per world unit
  stops.forEach((st) => {
    const se = st.kind === 'series' ? data.series[st.si] : null;
    st.frames = se ? Array.from({ length: st.n }, (_, i) => se.from + (i % Math.max(1, se.n))) : [];
    st.len = st.frames.reduce((a, pi) => a + frameMM(imgs[pi]), 0) / MMW; // world units, without leader
    st.S = Math.max(2.6, st.len / 2 + PITCH);
  });
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
      uvs[(2 * i + kk) * 2] = ss; uvs[(2 * i + kk) * 2 + 1] = kk;
    }
    if (i < N - 1) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  // which picture sits where along the film, looked up by the millimetre: each series fills its own stretch in
  // order, with a frame of blank leader at each end; the bends between stops carry all the pictures in turn
  const nImg = Math.max(1, imgs.length);
  const Lmm = L * MMW, frames = [];
  let cur = 0, cyc = 0;
  const put = (photo, len) => { frames.push([photo, cur, len, photo === 65535 ? 0 : len - 2]); cur += len; };
  const fillTo = (end) => {
    for (;;) { const pi = cyc % nImg, fl = frameMM(imgs[pi]); if (cur + fl > end) break; put(pi, fl); cyc += 1; }
    if (end > cur) put(65535, end - cur);
  };
  stops.forEach((stp, k) => {
    if (stp.kind !== 'series') return;
    const c0 = (start[k] + stp.S) * MMW, a0 = c0 - (stp.len * MMW) / 2;
    fillTo(a0 - MM.pitch);
    put(65535, Math.max(0, a0 - cur));
    for (const pi of stp.frames) put(pi, frameMM(imgs[pi]));
    put(65535, MM.pitch);
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

  const atlas = filmAtlas(imgs, renderer, data.edge);
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    alphaToCoverage: true,
    uniforms: {
      map: { value: atlas.tex }, fmap: { value: fmap }, uFW: { value: FW }, uFH: { value: FH },
      uCols: { value: atlas.cols }, uK: { value: atlas.k }, uCell: { value: new THREE.Vector2(atlas.CW, atlas.CH) }, uAtlas: { value: new THREE.Vector2(atlas.AW, atlas.AH) },
      uLight: { value: new THREE.Vector3(-0.45, 0.75, 0.6).normalize() }, uFog: { value: fog }, uNear: { value: 6 }, uFar: { value: 16 },
    },
    vertexShader: PRINT_VS,
    fragmentShader: `
      uniform sampler2D map; uniform sampler2D fmap; uniform float uFW; uniform float uFH;
      uniform float uCols; uniform float uK; uniform vec2 uCell; uniform vec2 uAtlas;
      uniform vec3 uLight; uniform vec3 uFog; uniform float uNear; uniform float uFar;
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
        gl_FragColor = vec4(mix(cl, uFog, d * 0.5), alpha);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  // the take: at each stop the camera travels along the stretch, then pulls back and drops to the next one.
  // A stop lasts as long as its stretch is wider than the view, so twenty pictures take longer than six
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const visW = clamp(camera.aspect * 2.9, 2.3, 4.8), d0 = visW / 2 / (tan * camera.aspect);
  const reach = stops.map((stp) => Math.max(0, stp.len / 2 - visW * 0.42));
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
