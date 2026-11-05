// Works and series pages: a darkroom, prints hanging to dry.
//
// The camera walks straight down the middle at eye level. Each row of prints comes at you face on; when it is
// about to reach you it breaks into grain and is gone, and you pass through where it hung.
// The prints are hung in different ways, and each swings the way its fixing allows:
//   two pegs or tape     swings only about the rope (θ), a plate hinged on its top edge
//   one peg              swings about the rope and sways in its own plane (φ) about the peg
//   one corner           hangs with its diagonal vertical, so its centre of mass is right below the peg
//   bulldog on a thread  a longer pendulum: the thread plus half the print
// For a rigid body pivoted at distance L from its centre of mass, with radius of gyration k about the centre,
//   ω² = g L / (k² + L²).
// Seen from the camera the rack carries the prints toward you at V = -v_cam. In the rack's frame a print feels its
// weight and an inertial force -m·a, so about its fixing
//   θ'' = L / (k² + L²) · (S·a cos θ - g sin θ) - 2ζω θ' + κ (V - v)|V - v| / L
// with quadratic air drag on the print moving through still air. Scrolling moves the scene far faster than a real
// rack could travel, so its acceleration is scaled by S = 0.03 and the drag kept small, which leaves the prints
// leaning back about 6° while you scroll; stop dead and they swing forward about 6° and ring down within ~4 s
// (measured in the browser). Air spilling round a print sheds small eddies that push it sideways a little.
// The ropes are hemp, each sagging under its own weight (a catenary, near enough a parabola over this span),
// each of its own thickness, tone, sag and number of stray fibres.
import { THREE, Follow, smooth, clamp, reduce, printMaterial, printSize, slateTexture, imageTexture, FONTS } from './kit.js';

function ropeTexture(renderer) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#7F6447'; g.fillRect(0, 0, 128, 32);
  for (let k = -8; k < 24; k++) { // three strands laid in a right-hand twist
    const x = k * 8;
    g.strokeStyle = k % 3 === 0 ? '#A3855F' : k % 3 === 1 ? '#8C6F4E' : '#6E553C'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 24, 0); g.stroke();
    g.strokeStyle = 'rgba(40,28,18,.55)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x + 3, 32); g.lineTo(x + 27, 0); g.stroke();
  }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${200 + Math.random() * 40},${170 + Math.random() * 30},${120 + Math.random() * 30},${Math.random() * 0.35})`; g.fillRect(Math.random() * 128, Math.random() * 32, 1, 1); }
  const sh = g.createLinearGradient(0, 0, 0, 32); sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(0.35, 'rgba(255,230,190,.08)'); sh.addColorStop(1, 'rgba(0,0,0,.55)');
  g.fillStyle = sh; g.fillRect(0, 0, 128, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

/**
 * data: { slates: { head: [4 lines], end: [4 lines] }, caps: { head: [k, t, s], end: [...] },
 *         series: [{ slate: [4 lines], cap: [k, t, s], frames: [{ w, h }] }] }
 * imgs: the picture URLs in the same order as the frames, series after series (loaded as the camera nears them).
 * onPick(seriesIndex, frameIndex) is called when a print is clicked.
 */
export function darkroomScene({ renderer, scene, camera, data, imgs, fog, onPick, host }) {
  scene.fog = new THREE.Fog(fog, 2.5, 16);
  camera.fov = 42; camera.updateProjectionMatrix();
  const light = { light: new THREE.Vector3(0.15, 0.85, 0.75), lightCol: new THREE.Vector3(1.0, 0.8, 0.58), amb: 0.45, fog, near: 2.5, far: 16 };
  const group = new THREE.Group(); scene.add(group);
  const items = [], rows = [], disposables = [], caps = [], pickable = [];
  const narrow = camera.aspect < 0.8;
  const LINE = 1.85, EYE = 1.18, FLOOR = -0.2, SIDE = 1.66, ROW = 2.7, HALF = narrow ? 1.6 : 3.4;
  let z = -1.6, rnd = 7;
  const rand = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
  const ropeTex = ropeTexture(renderer); disposables.push(ropeTex);
  ropeTex.repeat.set((2 * HALF) / 0.075, 1);
  const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
  const wood = lin(0.55, 0.42, 0.29), steel = lin(0.09, 0.085, 0.08), tapeCol = lin(0.86, 0.8, 0.66), threadCol = lin(0.72, 0.66, 0.56);

  const rope = (zz) => {
    const sag = 0.05 + 0.08 * rand(), r = 0.008 + 0.007 * rand(), tone = 0.78 + 0.35 * rand(), wob = 0.006 * rand();
    const yAt = (x) => LINE - sag * (1 - (x / HALF) ** 2);
    const pts = [];
    for (let i = 0; i <= 80; i++) { const x = -HALF + (2 * HALF * i) / 80; pts.push(new THREE.Vector3(x, yAt(x) + wob * Math.sin(x * 9.1 + zz), zz + wob * Math.cos(x * 7.3))); }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, r, 6, false);
    const mat = new THREE.MeshBasicMaterial({ map: ropeTex, transparent: true, color: lin(tone, tone * 0.97, tone * 0.92) });
    group.add(new THREE.Mesh(tube, mat)); disposables.push(tube, mat);
    // stray fibres: short hairs standing off the surface, and a few long loose ones with a kink
    const nf = Math.round((60 + 220 * rand() ** 1.5) * (HALF / 3.4)), seg = [], col = [];
    for (let i = 0; i < nf; i++) {
      const x = -HALF + 2 * HALF * rand(), phi = rand() * Math.PI * 2;
      const nx = 0.25 * (rand() - 0.5), ny = Math.sin(phi), nz = Math.cos(phi);
      const y0 = yAt(x) + r * ny, z0 = zz + r * nz;
      const long = rand() < 0.06, l = long ? 0.04 + 0.05 * rand() : 0.008 + 0.022 * rand();
      const droop = long ? -0.5 * rand() : 0;
      const x1 = x + nx * l, y1 = y0 + (ny + droop) * l, z1 = z0 + nz * l;
      seg.push(x, y0, z0, x1, y1, z1);
      if (long) seg.push(x1, y1, z1, x1 + (rand() - 0.5) * l * 0.8, y1 - l * (0.3 + 0.5 * rand()), z1 + (rand() - 0.5) * l * 0.6);
      const c = 0.55 + 0.3 * rand();
      for (let k = 0; k < (long ? 4 : 2); k++) col.push(c * tone, c * 0.82 * tone, c * 0.6 * tone);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const fm = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75 });
    group.add(new THREE.LineSegments(fg, fm)); disposables.push(fg, fm);
    const row = { z: zz, yAt, r, mats: [mat, fm], items: [] };
    rows.push(row);
    return row;
  };

  const box = (w, h, d, color, opacity = 1) => {
    const g = new THREE.BoxGeometry(w, h, d), m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
    disposables.push(g, m); return new THREE.Mesh(g, m);
  };
  const STYLES = ['pins', 'peg', 'corner', 'thread', 'tape'];
  const hang = (tex, w, h, b, x, row, style, pick) => {
    const W2 = w + 2 * b, H2 = h + 2 * b;
    const g = new THREE.PlaneGeometry(W2, H2);
    const thread = style === 'thread' ? 0.16 + 0.14 * rand() : 0;
    if (style === 'corner') g.translate(W2 / 2, -H2 / 2, 0); else g.translate(0, -H2 / 2 - thread, 0); // fixing point at the origin
    const inset = new THREE.Vector2(b / W2, b / H2);
    const mat = printMaterial(tex, inset, light);
    const y = row.yAt(x) - row.r * 0.5;
    const pivot = new THREE.Group(); pivot.position.set(x, y, row.z); group.add(pivot);
    const m = new THREE.Mesh(g, mat); pivot.add(m); disposables.push(g, mat);
    if (pick) { m.userData.pick = pick; pickable.push(m); }
    // its reflection in the wet floor: mirrored about y = FLOOR, dimmed, fading with depth below the floor
    const rmat = printMaterial(tex, inset, light);
    rmat.uniforms.uMirror.value = 1; rmat.uniforms.uDim.value = 0.34; rmat.uniforms.uFloor.value = FLOOR;
    const rp = new THREE.Group(); rp.position.set(x, 2 * FLOOR - y, row.z); rp.scale.y = -1; group.add(rp);
    rp.add(new THREE.Mesh(g, rmat)); disposables.push(rmat);
    const bits = [];
    if (style === 'pins') for (const dx of [-0.32, 0.32]) { const c = box(0.045, 0.1, 0.03, wood); c.position.set(dx * W2, -0.01, 0.005); bits.push(c); }
    if (style === 'peg') { const c = box(0.045, 0.1, 0.03, wood); c.position.set(0, -0.01, 0.005); bits.push(c); }
    if (style === 'corner') { const c = box(0.045, 0.1, 0.03, wood); c.position.set(0.012, -0.012, 0.005); c.rotation.z = 0.5; bits.push(c); }
    if (style === 'thread') {
      const tg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.03, -thread + 0.01, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.03, -thread + 0.01, 0)]);
      const tm = new THREE.LineBasicMaterial({ color: threadCol, transparent: true }); disposables.push(tg, tm);
      bits.push(new THREE.Line(tg, tm));
      const c = box(0.09, 0.05, 0.03, steel); c.position.set(0, -thread - 0.012, 0.006); bits.push(c);
    }
    if (style === 'tape') { const c = box(0.13, 0.11, 0.002, tapeCol, 0.82); c.position.set(0.02 * (rand() - 0.5), -0.025, 0.004); c.rotation.z = 0.12 * (rand() - 0.5); bits.push(c); }
    bits.forEach((bt) => m.add(bt));
    // rigid-body pendulum constants
    const g9 = 9.8;
    let L, k2, phi0 = 0, sway = true;
    if (style === 'corner') { L = Math.hypot(W2, H2) / 2; k2 = (W2 * W2 + H2 * H2) / 12; phi0 = -Math.atan(W2 / H2); }
    else { L = thread + H2 / 2; k2 = (H2 * H2) / 12; sway = style === 'peg' || style === 'thread'; }
    const wTh = Math.sqrt((g9 * L) / (k2 + L * L));
    const wPh = Math.sqrt((g9 * L) / ((W2 * W2 + H2 * H2) / 12 + L * L));
    const it = { pivot, rp, m, mats: [mat, rmat], bits, x, z: row.z, L, k2, wTh, wPh, phi0, sway, th: 0, thv: 0, ph: phi0, phv: 0, f: 0.7 + 0.8 * rand(), p: rand() * 6.28 };
    pivot.rotation.z = phi0; rp.rotation.z = -phi0;   // the in-plane angle flips sign in the reflection
    items.push(it); row.items.push(it);
  };

  const slate = (lines, cap, row) => {
    const t = slateTexture(lines, renderer, FONTS); disposables.push(t);
    hang(t, 1.2, 0.7, 0, 0, row, 'pins', null);
    caps.push({ z: row.z, cap });
  };
  // pictures are loaded only for the prints a few rows ahead of the camera, and let go once it has passed them,
  // so a roll of a hundred prints never holds more than a dozen textures (a phone keeps its memory)
  const blank = new THREE.DataTexture(new Uint8Array([60, 52, 44, 255]), 1, 1, THREE.RGBAFormat); blank.needsUpdate = true;
  disposables.push(blank);
  let order = 0, img = 0;
  const print = (si, fi, slot, row) => {
    const fr = data.series[si].frames[fi], url = imgs[img++];
    if (!url) return;
    const [w, h] = printSize(fr.w, fr.h, slot === 0 ? 1.2 : 1.25);
    let style = STYLES[(order++ * 3 + Math.floor(rand() * 5)) % STYLES.length];
    if (h > w && style === 'thread') style = 'peg';       // a tall print on a thread would reach the floor
    hang(blank, w, h, 0.06, slot * SIDE + 0.08 * (rand() - 0.5), row, style, { si, fi });
    const it = items[items.length - 1];
    it.url = url; it.tex = null; it.loading = false;
  };
  const AHEAD = 5 * ROW;
  const stream = (zc) => {
    for (const it of items) {
      if (!it.url) continue;
      const d = zc - it.z;                     // distance ahead of the camera
      const want = d > 0.6 && d < AHEAD;
      if (want && !it.tex && !it.loading) {
        it.loading = true;
        const im = new Image(); im.decoding = 'async';
        im.onload = () => {
          it.loading = false;
          if (it.gone) return;
          it.tex = imageTexture(im, renderer);
          it.mats.forEach((m) => { m.uniforms.map.value = it.tex; });
        };
        im.onerror = () => { it.loading = false; };
        im.src = it.url;
      } else if (!want && it.tex && (d < 0.2 || d > AHEAD + ROW)) {
        it.mats.forEach((m) => { m.uniforms.map.value = blank; });
        it.tex.dispose(); it.tex = null;
      }
    }
  };

  const z0 = z;
  slate(data.slates.head, data.caps.head, rope(z)); z -= ROW;
  data.series.forEach((se, si) => {
    const ids = se.frames.map((_, fi) => fi);
    if (narrow) {
      slate(se.slate, se.cap, rope(z)); z -= ROW;
      for (const fi of ids) { print(si, fi, 0, rope(z)); z -= ROW; }
      return;
    }
    // first row: a print, the slate of the roll in the middle, a print; then rows of three
    let row = rope(z);
    if (ids.length) print(si, ids.shift(), -1, row);
    slate(se.slate, se.cap, row);
    if (ids.length) print(si, ids.shift(), 1, row);
    z -= ROW;
    while (ids.length) {
      const part = ids.splice(0, 3), slots = part.length === 3 ? [-1, 0, 1] : part.length === 2 ? [-0.55, 0.55] : [0];
      row = rope(z);
      part.forEach((fi, k) => print(si, fi, slots[k], row));
      z -= ROW;
    }
  });
  z -= ROW * 0.4;
  slate(data.slates.end, data.caps.end, rope(z));
  const zEnd = z + 2.6, zStart = z0 + 3.4;

  const cam = new Follow(0.9, 1, zStart);
  const zeta = 0.12, kappa = 0.008, S = 0.03, g = 9.8;
  let lastZ = zStart, lastV = 0, clock = 0;

  // clicking a print opens it. The canvas sits under the page, so the pointer is read on the run element that
  // covers it (host), and a ray from the camera finds the print under it
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const over = (e) => host && e.target instanceof Element && (e.target === host || host.contains(e.target));
  const hit = (e) => {
    if (!over(e)) return null;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(pickable.filter((m) => m.parent.visible), false)[0];
    return h ? h.object.userData.pick : null;
  };
  const onClick = (e) => { const p = hit(e); if (p && onPick) onPick(p.si, p.fi); };
  const onMove = (e) => { host?.classList.toggle('is-hot', !!hit(e)); };
  addEventListener('click', onClick);
  addEventListener('pointermove', onMove, { passive: true });

  // rough page length: the walk takes about one screen of scrolling per row
  const pages = Math.max(3, (zStart - zEnd) / ROW) * (narrow ? 0.4 : 0.62) + 1;
  return {
    pages,
    update(dt, pr) {
      clock += dt;
      const zc = cam.step(zStart + pr * (zEnd - zStart), dt);
      stream(zc);
      const vc = (zc - lastZ) / Math.max(dt, 1e-3); lastZ = zc;
      const V = -vc, acc = clamp((V - lastV) / Math.max(dt, 1e-3), -60, 60); lastV = V;
      // a row breaks into grain as it reaches you: fully there 2.3 units ahead, gone at 0.9
      for (const row of rows) {
        const fade = smooth(0.9, 2.3, zc - row.z);
        row.mats[0].opacity = fade; row.mats[1].opacity = 0.75 * fade;
        row.mats[0].visible = row.mats[1].visible = fade > 0.01;
        for (const it of row.items) {
          it.mats.forEach((mm) => { mm.uniforms.uFade.value = fade; });
          it.bits.forEach((bt) => { bt.visible = fade > 0.5; });
          it.pivot.visible = it.rp.visible = fade > 0.01;
        }
      }
      const n = Math.max(1, Math.round(dt / (1 / 240))), h = dt / n;
      for (const it of items) {
        if (!reduce && it.pivot.visible) {
          const K = it.L / (it.k2 + it.L * it.L);
          for (let s = 0; s < n; s++) {
            const rel = V - it.thv * it.L * Math.cos(it.th);
            const drag = (kappa * rel * Math.abs(rel)) / it.L;
            it.thv += (K * (S * acc * Math.cos(it.th) - g * Math.sin(it.th)) - 2 * zeta * it.wTh * it.thv + drag) * h;
            it.th = clamp(it.th + it.thv * h, -0.5, 0.5);
            if (it.sway || it.phi0) {
              const eddy = 0.45 * drag * Math.sin(2 * Math.PI * it.f * clock + it.p);
              it.phv += (-it.wPh * it.wPh * Math.sin(it.ph - it.phi0) - 2 * zeta * it.wPh * it.phv + eddy) * h;
              it.ph = clamp(it.ph + it.phv * h, it.phi0 - 0.4, it.phi0 + 0.4);
            }
          }
        }
        it.pivot.rotation.x = it.th; it.pivot.rotation.z = it.ph;
        it.rp.rotation.x = -it.th; it.rp.rotation.z = -it.ph;
      }
      camera.position.set(0, EYE, zc);
      camera.lookAt(0, EYE - 0.03, zc - 5);
      let cur = caps[0], best = Infinity;
      for (const k of caps) { const d = Math.abs(k.z - (zc - 2.8)); if (d < best) { best = d; cur = k; } }
      return { cap: cur.cap, show: 1 - clamp((best - 1.2) / 1.2, 0, 1) };
    },
    dispose() {
      removeEventListener('click', onClick);
      removeEventListener('pointermove', onMove);
      host?.classList.remove('is-hot');
      for (const it of items) { it.gone = true; it.tex?.dispose(); }
      scene.remove(group); scene.fog = null; disposables.forEach((d) => d.dispose());
    },
  };
}
