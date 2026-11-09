// The title card's sky, drawn on one canvas behind the page text: rice paper, the sky seen through the QUIETIME
// letters as ink spreads into them, the sun or moon, stars and meteors, clouds, fog, rain or snow.
// Every model and its parameters are in docs/physics.md (section 9) and are checked by scripts/physics-check.mjs.
import {
  clamp, smooth, mix, rng, fbm, apparent, squash, sunlight, koschmieder, palette, WEATHER, TIMELAPSE,
  dropDiameter, dropSpeed, snowSpeed, lightCurve, starMagnitude,
} from './astro.js';

const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const RAD = Math.PI / 180;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return [c, c.getContext('2d')]; };

const fiber = (() => { const [c, g] = mk(512, 512); g.lineCap = 'round';
  for (let i = 0; i < 900; i++) { const x = Math.random() * 512, y = Math.random() * 512, a = Math.random() * Math.PI, l = 4 + Math.random() * 18;
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '120,110,95'},${0.05 + Math.random() * 0.1})`; g.lineWidth = 0.6 + Math.random() * 0.8;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (Math.random() - 0.5) * 4, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  return c; })();

/* the moon: Lommel–Seeliger reflectance on a sphere, the large maria where they really are, earthshine */
const MARIA = [[-0.28, -0.42, 0.30, 0.26], [0.18, -0.38, 0.17, 0.15], [0.33, -0.08, 0.22, 0.18], [0.70, -0.30, 0.12, 0.10],
  [0.62, 0.12, 0.15, 0.17], [0.40, 0.30, 0.10, 0.09], [-0.62, -0.05, 0.26, 0.42], [-0.18, 0.38, 0.17, 0.13], [0.0, -0.74, 0.42, 0.07], [-0.48, 0.42, 0.10, 0.09]];
const moonCache = new Map();
function moonDisc(R, inc, chi, frac) {
  const key = `${R}|${inc.toFixed(2)}|${chi.toFixed(2)}`;
  if (moonCache.has(key)) return moonCache.get(key);
  const S = Math.ceil(R * 2 + 2), [c, g] = mk(S, S), img = g.createImageData(S, S), D = img.data;
  const si = Math.sin(inc), L = [-Math.sin(chi) * si, -Math.cos(chi) * si, Math.cos(inc)], earth = 0.07 * (1 - frac) ** 1.5;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = (x + 0.5 - S / 2) / R, ny = (y + 0.5 - S / 2) / R, r2 = nx * nx + ny * ny;
    const cov = clamp((1 - Math.sqrt(r2)) * R + 0.5, 0, 1); if (!cov) continue;
    const nz = Math.sqrt(Math.max(0, 1 - r2)), mu0 = nx * L[0] + ny * L[1] + nz * L[2];
    const lit = mu0 > 0 ? (2 * mu0) / (mu0 + nz + 1e-4) : 0;
    let mare = 0;
    for (const [cx, cy, rx, ry] of MARIA) { const q = ((nx - cx) / rx) ** 2 + ((ny - cy) / ry) ** 2; mare = Math.max(mare, 1 - smooth(0.55, 1.15, q + (fbm(nx * 5, ny * 5, 77, 3) - 0.5) * 0.5)); }
    const A = 1 - 0.36 * mare + (fbm(nx * 9, ny * 9, 99, 3) - 0.5) * 0.08;
    const v = clamp(lit * A, 0, 1.1), e = earth * A * (1 - smooth(0, 0.08, mu0)), i = (y * S + x) * 4;
    D[i] = 236 * v + 120 * e; D[i + 1] = 232 * v + 132 * e; D[i + 2] = 220 * v + 156 * e; D[i + 3] = 255 * cov * clamp(v * 1.4 + e * 6, 0, 1);
  }
  g.putImageData(img, 0, 0);
  if (moonCache.size > 24) moonCache.clear();
  moonCache.set(key, c);
  return c;
}

/**
 * canvas: the card-sized canvas (device pixels). glyph: { x, base, fontPx, edges } in device pixels, where `edges` are
 * the x positions between letters (from measureText), so each letter can be drawn displaced on its own.
 */
export function makeSky(canvas, glyph, { seed = (Math.random() * 2 ** 32) >>> 0, animated = true } = {}) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height, R0 = rng(seed);
  const [base, bg] = mk(W, H), [cel, cg] = mk(W, H);
  const { fontPx } = glyph, text = 'QUIETIME', font = (px) => `400 ${px}px Anton, Impact, "Arial Narrow", sans-serif`;
  // the letters as a soft field at reduced resolution: alpha ≈ 0.5 on the letter edge
  const S = Math.min(1, 640 / W), mw = Math.round(W * S), mh = Math.round(H * S);
  const [, fgc] = mk(mw, mh);
  fgc.filter = `blur(${Math.max(1.2, fontPx * S * 0.016)}px)`; fgc.font = font(fontPx * S); fgc.fillText(text, glyph.x * S, glyph.base * S); fgc.filter = 'none';
  const fd = fgc.getImageData(0, 0, mw, mh).data, F = new Float32Array(mw * mh);
  for (let i = 0; i < F.length; i++) F[i] = fd[i * 4 + 3] / 255;
  const noises = [0, 1, 2].map((k) => { const n = new Float32Array(mw * mh), s = 11 + k * 7, sc = 6 / Math.max(mw, mh);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) n[y * mw + x] = fbm(x * sc, y * sc, s, 4); return n; });
  const [mc, mg] = mk(mw, mh), md = mg.createImageData(mw, mh), [rc, rg] = mk(mw, mh), rd = rg.createImageData(mw, mh);
  const top = glyph.base - fontPx * 0.78, bottom = glyph.base + fontPx * 0.02, horizon = bottom - (bottom - top) * 0.18;
  // the band of the card the letters (with their ink bleed and the room to be pushed about) occupy
  const by0 = Math.max(0, Math.floor(top - fontPx * 0.3)), BH = Math.min(H - by0, Math.ceil(bottom - top + fontPx * 0.55));
  const [layer, lg] = mk(W, BH);
  // sky mapping: azimuth across the width (facing south, east on the left), altitude compressed with tanh
  const xOf = (az) => W * (0.5 + az / 300), yOf = (h) => horizon - (horizon - top) * Math.tanh(h / 18), pxPerDeg = (horizon - top) / 18;
  const focal = H * 0.9, px1 = Math.max(1, W / 1100);

  const stars = Array.from({ length: 260 }, () => ({ x: R0() * W, y: R0() * horizon, m: starMagnitude(R0()), f1: 1.5 + R0() * 4, f2: 3 + R0() * 6, p1: R0() * 6.28, p2: R0() * 6.28 }));
  const CW = Math.max(64, Math.round(W / 14)), CH = Math.max(32, Math.round(H / 14)), [ccv, ccg] = mk(CW, CH), cimg = ccg.createImageData(CW, CH);
  const cseed = (R0() * 1e6) | 0, wseed = (R0() * 1e6) | 0, thCache = {};
  const cloudDensity = (u, v, drift, evo) => { const q = fbm(u * 0.7 + drift * 0.5, v * 0.7 + evo, wseed, 3); return fbm(u + 1.6 * q + drift, v + 0.8 * q + evo, cseed, 5); };
  function cloudTh(cover) {
    const k = cover.toFixed(2); if (thCache[k] != null) return thCache[k];
    const vals = []; for (let i = 0; i < 400; i++) vals.push(cloudDensity(R0() * 3, R0() * 2, 0, 0));
    vals.sort((a, b) => a - b); return (thCache[k] = vals[Math.floor((1 - cover) * (vals.length - 1))]);
  }
  const zOf = (r) => Math.cbrt(0.8 ** 3 + r * (12 ** 3 - 0.8 ** 3));
  let drops = [], splashes = [], flakes = [], meteors = [], nextMeteor = 2 + -Math.log(1 - R0()) * 9, lastT = 0, lastKind = '';
  const spawnDrop = (R, init) => { const D = dropDiameter(R0(), R); return { x: R0() * W * 1.2 - W * 0.1, y: init ? R0() * H : -R0() * 60, z: zOf(R0()), D, v: dropSpeed(D) }; };
  const spawnFlake = (init) => { const D = 2 + 6 * R0() ** 2; return { x: R0() * W, y: init ? R0() * H : -10, z: zOf(R0()), D, v: snowSpeed(D), A: 0.02 + 0.04 * R0(), f: 0.4 + 0.6 * R0(), p: R0() * 6.28 }; };
  const spawnMeteor = (t) => { const a = (15 + 45 * R0()) * RAD, dir = R0() < 0.5 ? -1 : 1, w = (18 + 22 * R0()) * pxPerDeg;
    return { t0: t, T: 0.35 + 0.75 * R0(), x: W * (0.12 + 0.76 * R0()), y: horizon * (0.05 + 0.55 * R0()), vx: dir * Math.cos(a) * w, vy: Math.sin(a) * w, peak: 0.6 + 0.4 * R0() }; };
  function drawMeteor(ctx, M, t) {
    const age = t - M.t0, s = clamp(age / M.T, 0, 1), tau = 0.28;
    ctx.save(); ctx.lineCap = 'round';
    for (let j = 0; j < 26; j++) {
      const sj = s - j * 0.035; if (sj <= 0) break;
      const back = (s - sj) * M.T + Math.max(0, age - M.T), I = lightCurve(sj) * M.peak * Math.exp(-back / tau) * (age > M.T ? Math.exp(-(age - M.T) / tau) : 1);
      if (I < 0.01) continue;
      const s1 = Math.max(0, sj - 0.035);
      ctx.strokeStyle = `rgba(232,241,236,${I})`; ctx.lineWidth = 0.6 + 2.2 * Math.sqrt(I);
      ctx.beginPath(); ctx.moveTo(M.x + M.vx * s1 * M.T, M.y + M.vy * s1 * M.T); ctx.lineTo(M.x + M.vx * sj * M.T, M.y + M.vy * sj * M.T); ctx.stroke();
    }
    ctx.restore();
    return age < M.T + 1.5;
  }
  function inkMask(t, boilIdx, rim, slow, rimK = 1) {
    const n = noises[boilIdx];
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const i = y * mw + x;
      // each column starts later the further right; the spread follows √t (capillary flow, Washburn)
      const p = clamp((t - (0.3 + 1.1 * (x / mw))) / (1.25 + slow), 0, 1), spread = Math.sqrt(p), th = 1.04 - 0.56 * spread;
      const v = F[i] + (n[i] - 0.5) * 0.34, a = smooth(th - 0.03, th + 0.015, v);
      md.data[i * 4 + 3] = a * 255;
      const ra = a > 0.02 ? Math.min(1, Math.exp(-(((v - th) / 0.03) ** 2)) * 0.5 * rimK * spread * smooth(0.35, 0.75, n[(i * 7) % n.length])) : 0;
      rd.data[i * 4] = rim[0]; rd.data[i * 4 + 1] = rim[1]; rd.data[i * 4 + 2] = rim[2]; rd.data[i * 4 + 3] = ra * 255;
    }
    mg.putImageData(md, 0, 0); rg.putImageData(rd, 0, 0);
  }
  let maskKey = '', lastFaint = -1, lastSkyKey = '', lastPaperKey = '', lastCloud = -1, fogKey = '', fogSprite = null;
  const [paperC, pg] = mk(W, H);
  // a soft horizontal band of mist, blurred once and then only scaled and moved
  const bandSprite = (col) => { const [c, sg] = mk(256, 64); const gr = sg.createRadialGradient(128, 32, 0, 128, 32, 128);
    gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.45, rgba(col, 0.6)); gr.addColorStop(1, rgba(col, 0));
    sg.setTransform(1, 0, 0, 0.25, 0, 24); sg.fillStyle = gr; sg.fillRect(0, -100, 256, 256); return c; };
  const randomCover = {};

  /**
   * P: { A (astro), rising, kind, w (weather numbers), entrance }. t: seconds since the entrance began; wt: wall-clock
   * seconds; offsets: per-letter { x, y, a } in device pixels / radians (the pointer push).
   */
  function frame(P, t, wt, boilIdx, offsets = []) {
    const A = P.A, Wx = { ...WEATHER[P.kind] }, sunApp = apparent(A.sun.alt);
    for (const [k, v] of Object.entries(P.w || {})) if (typeof v === 'number' && Number.isFinite(v)) Wx[k] = v;
    let sk = palette(A.sun.alt, P.rising);
    const nightK = smooth(-4, -16, A.sun.alt), dayK = smooth(-6, 6, A.sun.alt);
    if (P.kind === 'rain' || P.kind === 'cloud' || P.kind === 'snow') { const grey = mix(sk.mid, [128, 128, 132], 0.4); sk = { ...sk, top: mix(sk.top, grey, 0.35), mid: mix(sk.mid, grey, 0.3), hor: mix(sk.hor, grey, 0.25) }; }
    const dt = clamp(wt - lastT, 0, 0.1); lastT = wt;
    if (P.kind !== lastKind) { drops = []; flakes = []; splashes = []; lastKind = P.kind; }
    // a live reading's cloud cover, or one drawn at random (once per kind of weather) from the range that weather has
    const cover = typeof P.w?.cover === 'number' ? P.w.cover : (randomCover[P.kind] ??= WEATHER[P.kind].cover[0] + (WEATHER[P.kind].cover[1] - WEATHER[P.kind].cover[0]) * R0());

    /* base sky: redrawn only when its colours change (the palette moves with the sun, about once a second) */
    const skyKey = [sk.top, sk.mid, sk.hor].map((c) => c.map((v) => Math.round(v)).join()).join('|');
    if (skyKey !== lastSkyKey) {
    lastSkyKey = skyKey;
    const gr = bg.createLinearGradient(0, top - fontPx * 0.1, 0, bottom);
    gr.addColorStop(0, rgba(sk.top)); gr.addColorStop(0.62, rgba(sk.mid)); gr.addColorStop(1, rgba(sk.hor));
    bg.fillStyle = gr; bg.fillRect(0, 0, W, H);
    bg.save(); bg.filter = `blur(${fontPx * 0.05}px)`;
    for (let b = 0; b < 4; b++) { const y0 = top + (bottom - top) * (0.3 + b * 0.17), amp = fontPx * (0.03 + b * 0.012);
      bg.fillStyle = rgba(b % 2 ? sk.mid : sk.hor, 0.28 - b * 0.04); bg.beginPath(); bg.moveTo(0, y0);
      for (let x = 0; x <= W; x += W / 40) bg.lineTo(x, y0 + Math.sin(x * 0.004 + b * 1.7 + (seed % 7)) * amp + Math.sin(x * 0.013 + b + (seed % 5)) * amp * 0.4);
      bg.lineTo(W, y0 + fontPx * 0.12); bg.lineTo(0, y0 + fontPx * 0.12); bg.closePath(); bg.fill(); }
    bg.restore();
    }

    /* celestial: stars, moon, sun, meteors */
    cg.clearRect(0, 0, W, H); cg.save(); cg.beginPath(); cg.rect(0, 0, W, horizon); cg.clip();
    const moonUp = A.moon.alt > -0.5;
    if (nightK > 0.01) {
      const mlim = 6.2 - 2.3 * A.frac * (moonUp ? 1 : 0) - 4 * cover;
      for (const s of stars) {
        if (s.m > mlim) continue;
        const hDeg = 18 * Math.atanh(clamp((horizon - s.y) / (horizon - top), 0, 0.98)), z = (90 - hDeg) * RAD;
        const sig = Math.min(0.8, 0.1 * Math.pow(1 / Math.max(0.2, Math.cos(z)), 1.75));
        const tw = animated ? 1 + sig * (0.6 * Math.sin(s.f1 * wt + s.p1) + 0.4 * Math.sin(s.f2 * wt + s.p2)) : 1;
        const flux = 10 ** (-0.4 * (s.m - 1)), a = clamp(nightK * flux * tw * smooth(mlim, mlim - 1, s.m), 0, 1);
        if (a < 0.02) continue;
        cg.fillStyle = `rgba(232,230,222,${a})`; cg.beginPath(); cg.arc(s.x, s.y, (0.5 + 1.1 * Math.sqrt(clamp(flux, 0, 2.5))) * px1, 0, Math.PI * 2); cg.fill();
      }
    }
    if (moonUp) {
      const mx = xOf(A.moon.az), my = yOf(apparent(A.moon.alt)), Rm = Math.round(fontPx * 0.12);
      const vis = clamp(0.25 + 0.75 * nightK, 0, 1) * (1 - 0.7 * smooth(0.6, 1, cover)) * (P.entrance ? smooth(0.6, 2.4, t) : 1);
      if (vis > 0.01 && mx > -Rm && mx < W + Rm) {
        const humid = P.kind === 'fog' || P.kind === 'rain' ? 1 : 0.3, hr = Rm * (3 + 3 * humid);
        const halo = cg.createRadialGradient(mx, my, Rm * 0.9, mx, my, hr);
        [0, 0.15, 0.4, 1].forEach((k, i) => halo.addColorStop(k, `rgba(226,224,214,${[0.28, 0.12, 0.04, 0][i] * A.frac * vis * (0.6 + humid)})`));
        cg.fillStyle = halo; cg.fillRect(mx - hr, my - hr, hr * 2, hr * 2);
        cg.globalAlpha = vis; cg.drawImage(moonDisc(Rm, A.inc, A.chi, A.frac), mx - Rm - 1, my - Rm - 1); cg.globalAlpha = 1;
      }
    }
    const sunShown = sunApp + (P.entrance ? (P.rising ? -4 : 4) * (1 - smooth(0.5, 2.8, t)) : 0);
    if (sunShown > -1.2) {
      const sc = sunlight(A.sun.alt, Wx.beta), sx = xOf(A.sun.az), sy = yOf(sunShown), Rs = fontPx * 0.17, sq = squash(sunShown);
      const vis = (1 - 0.75 * smooth(0.5, 1, cover)) * (1 - 0.6 * smooth(8, 30, A.sun.alt));
      const halo = cg.createRadialGradient(sx, sy, Rs * 0.6, sx, sy, Rs * 3.6); halo.addColorStop(0, rgba(sc, 0.4 * vis)); halo.addColorStop(1, rgba(sc, 0));
      cg.fillStyle = halo; cg.fillRect(sx - Rs * 4, sy - Rs * 4, Rs * 8, Rs * 8);
      cg.fillStyle = rgba(sc, vis); cg.beginPath(); cg.ellipse(sx, sy, Rs, Rs * sq, 0, 0, Math.PI * 2); cg.fill();
    }
    const clearNight = nightK > 0.6 && (P.kind === 'clear' || (P.kind === 'cloud' && cover < 0.6));
    if (animated && clearNight) {
      if (wt >= nextMeteor) { meteors.push(spawnMeteor(wt)); nextMeteor = wt + -Math.log(1 - R0()) * 9; }   // Poisson, mean gap 9 s
      meteors = meteors.filter((M) => drawMeteor(cg, M, wt));
    }
    cg.restore();

    /* clouds, about ten times a second (they drift slowly); Beer–Lambert opacity, flatter towards the horizon, a
       silver lining near the sun */
    if (!animated || wt - lastCloud > 0.1 || lastCloud < 0) {
      lastCloud = wt;
      const lit = mix(mix([248, 247, 242], sunlight(Math.max(A.sun.alt, 0), Wx.beta), 0.5 * smooth(20, 0, A.sun.alt)), [60, 66, 80], nightK * 0.85);
      const shade = mix(mix(sk.mid, sk.rim, 0.35), [40, 44, 54], nightK * 0.6);
      const th = cloudTh(cover), drift = (wt * Wx.u * TIMELAPSE) / 3000, evo = wt * 0.015;
      const hy = horizon / H, sxp = xOf(A.sun.az) / W, syp = yOf(Math.max(sunApp, 0)) / H, stratus = 1.6 * smooth(0.7, 0.95, cover);
      for (let y = 0; y < CH; y++) {
        const v = y / CH, above = hy - v, stretch = 1 + 3 * Math.exp(-Math.max(0, above) * 8);
        for (let x = 0; x < CW; x++) {
          const u = x / CW, i = (y * CW + x) * 4;
          if (above <= 0) { cimg.data[i + 3] = 0; continue; }
          const rho = clamp((cloudDensity(u * 3, v * 3 * stretch, drift, evo) - th) / (1 - th), 0, 1), alpha = 1 - Math.exp(-(5 * rho + stratus));
          const col = mix(lit, shade, smooth(0.2, 1, 1 - Math.exp(-2.5 * rho)) * 0.85);
          const edge = 4 * alpha * (1 - alpha) * Math.exp(-((u - sxp) ** 2 + (v - syp) ** 2) * 18) * dayK;
          cimg.data[i] = clamp(col[0] + 90 * edge, 0, 255); cimg.data[i + 1] = clamp(col[1] + 80 * edge, 0, 255); cimg.data[i + 2] = clamp(col[2] + 60 * edge, 0, 255);
          cimg.data[i + 3] = alpha * 235 * smooth(0, 0.04, above);
        }
      }
      ccg.putImageData(cimg, 0, 0);
    }

    /* paper, with a faint wash of the sky, the celestial layer and the clouds on it; film gate weave */
    const jx = animated ? Math.sin(wt * 1.7) * 0.6 + Math.sin(wt * 7.3) * 0.25 : 0, jy = animated ? Math.sin(wt * 2.3) * 0.5 : 0;
    const paperKey = sk.paper.map((v) => Math.round(v)).join();
    if (paperKey !== lastPaperKey) {
      lastPaperKey = paperKey;
      pg.globalAlpha = 1; pg.fillStyle = rgba(sk.paper); pg.fillRect(0, 0, W, H);
      pg.globalAlpha = 0.55; for (let y = 0; y < H; y += W) pg.drawImage(fiber, 0, y, W, W); pg.globalAlpha = 1;
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.drawImage(paperC, 0, 0);
    g.setTransform(1, 0, 0, 1, jx, jy);
    g.globalAlpha = 0.1 * smooth(0.2, 1.6, t); g.drawImage(base, 0, 0);
    g.globalAlpha = (0.35 + 0.55 * nightK) * smooth(0.2, 1.2, t); g.drawImage(cel, 0, 0);
    g.imageSmoothingEnabled = true; g.globalAlpha = 0.3 * smooth(0.2, 1.2, t); g.drawImage(ccv, 0, 0, W, H); g.globalAlpha = 1;

    /* the letters: sky + celestial + clouds through the ink mask, then the wet rim; recomputed while ink spreads and
       at the line-boil rate afterwards */
    const key = t < 3.2 ? `t${t.toFixed(3)}` : `b${boilIdx}${sk.rim.join()}`;
    // when the sky in the letters is nearly as light as the paper (an overcast or snowy day), the ink is laid on more
    // strongly: a darker wet edge and a faint wash inside, so the name still reads
    const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
    const faint = smooth(0.16, 0.04, Math.abs(lum(mix(sk.mid, sk.hor, 0.5)) - lum(sk.paper)) - 0.25 * (P.kind === 'cloud' || P.kind === 'snow' ? 1 : 0) * dayK + 0.0);
    if (key !== maskKey || faint !== lastFaint) { inkMask(t, boilIdx, sk.rim, P.kind === 'fog' ? 0.6 : 0, 1 + 1.6 * faint); maskKey = key; lastFaint = faint; }
    // composed only over the band the letters occupy (band rows by0..by0 + BH of the card)
    lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, W, BH);
    lg.drawImage(base, 0, by0, W, BH, 0, 0, W, BH); lg.drawImage(cel, 0, by0, W, BH, 0, 0, W, BH);
    lg.drawImage(ccv, 0, (by0 / H) * CH, CW, (BH / H) * CH, 0, 0, W, BH);
    lg.globalCompositeOperation = 'destination-in'; lg.drawImage(mc, 0, by0 * S, mw, BH * S, 0, 0, W, BH);
    if (faint > 0.01) { lg.globalCompositeOperation = 'source-atop'; lg.fillStyle = rgba(sk.rim, 0.2 * faint); lg.fillRect(0, 0, W, BH); }
    lg.globalCompositeOperation = 'source-over'; lg.drawImage(rc, 0, by0 * S, mw, BH * S, 0, 0, W, BH);
    // each letter on its own, displaced by the pointer push
    const e = glyph.edges, pad = fontPx * 0.06;
    for (let k = 0; k < e.length - 1; k++) {
      const o = offsets[k] || { x: 0, y: 0, a: 0 }, y0 = top - pad * 3, y1 = bottom + pad * 2;
      const sx0 = k === 0 ? e[0] - pad : e[k], sx1 = k === e.length - 2 ? e[k + 1] + pad : e[k + 1];
      const cx = (e[k] + e[k + 1]) / 2, cy = (top + bottom) / 2;
      g.save(); g.translate(cx + o.x, cy + o.y); g.rotate(o.a); g.translate(-cx, -cy);
      g.beginPath(); g.rect(sx0, y0, sx1 - sx0, y1 - y0); g.clip();
      g.drawImage(layer, 0, by0); g.restore();
    }

    /* fog (Koschmieder over 40 m), rain, snow */
    let V = Wx.V || 20000; if (P.kind === 'clear' && P.rising && A.sun.alt > -6 && A.sun.alt < 5) V = Math.min(V, 1500);
    if (P.kind === 'fog' && P.entrance) V = Math.min(V, 180) + 420 * smooth(0.5, 3.2, t);
    const loss = 1 - koschmieder(40, V);
    if (loss > 0.02) {
      const fcol = mix(sk.paper, [255, 255, 255], 0.3), fk = fcol.map((v) => Math.round(v)).join();
      if (fk !== fogKey) { fogKey = fk; fogSprite = bandSprite(fcol); }
      for (let b = 0; b < 7; b++) {
        const y = top + (bottom - top) * (b / 6), wob = fbm(b * 3.7, wt * 0.05, wseed + b, 3);
        const x = ((wt * Math.max(0.5, Wx.u) * 0.012 * W * (1 + b * 0.2) + b * W * 0.37) % (W * 1.8)) - W * 0.4;
        const bw = W * (0.7 + 0.5 * wob), bh = fontPx * 0.5;
        g.globalAlpha = clamp(loss * (0.55 + 0.45 * wob), 0, 1);
        g.drawImage(fogSprite, x - bw / 2, y - bh / 2, bw, bh); g.drawImage(fogSprite, x - W * 0.75 - W * 0.4, y - bh * 0.4, W * 0.8, bh * 0.8);
      }
      g.globalAlpha = 1;
    }
    if (P.kind === 'rain') {
      const R = Wx.R || 6, target = Math.round(220 * clamp(R / 6, 0.4, 1.6)), exp = 1 / 60;
      while (drops.length < target) drops.push(spawnDrop(R, true));
      g.lineCap = 'round';
      for (const d of drops) {
        const k = focal / d.z;
        if (animated) { d.y += d.v * k * dt; d.x += Wx.u * k * dt; }
        const len = d.v * exp * k, ax = (Wx.u / d.v) * len, a = clamp((40 * d.D) / (d.v * exp * 1000), 0.14, 0.6) * Math.exp(-d.z / 25);
        g.strokeStyle = rgba(mix(sk.rim, [235, 238, 242], nightK * 0.5 + 0.1), a); g.lineWidth = Math.max(px1, (d.D / 1000) * k * 0.9);
        g.beginPath(); g.moveTo(d.x - ax, d.y - len); g.lineTo(d.x, d.y); g.stroke();
        if (animated && d.y > bottom && d.z < 3 && !d.hit) {
          d.hit = true;
          const n = 2 + ((R0() * 3) | 0); for (let j = 0; j < n; j++) splashes.push({ x: d.x, y: bottom, vx: (R0() - 0.5) * 1.4 * k, vy: -(0.6 + R0()) * k * 0.9, k, life: 0 });
        }
        if (d.y > H + 20 || d.x > W * 1.15) Object.assign(d, spawnDrop(R, false), { hit: false });
      }
      g.fillStyle = rgba(sk.rim, 0.35);
      splashes = splashes.filter((s) => { s.vy += 9.81 * s.k * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life += dt; if (s.y > bottom || s.life > 1) return false; g.fillRect(s.x, s.y, 1.4 * px1, 1.4 * px1); return true; });
    }
    if (P.kind === 'snow') {
      while (flakes.length < 160) flakes.push(spawnFlake(true));
      g.fillStyle = 'rgba(250,248,244,.92)';
      for (const f of flakes) {
        const k = focal / f.z;
        if (animated) { f.y += f.v * k * dt; f.x += Wx.u * 0.8 * k * dt; }
        const x = f.x + f.A * k * Math.sin(2 * Math.PI * f.f * wt + f.p), r = Math.max(0.7 * px1, (f.D / 1000) * k * 0.6);
        g.globalAlpha = Math.exp(-f.z / 16); g.beginPath(); g.arc(((x % W) + W) % W, f.y, r, 0, Math.PI * 2); g.fill();
        if (f.y > H + 10) Object.assign(f, spawnFlake(false));
      }
      g.globalAlpha = 1;
    }
    // the film grain is the page's own overlay (.grain), which lies over the card
    g.setTransform(1, 0, 0, 1, 0, 0);
    return sk;
  }
  return { frame, top, bottom };
}
