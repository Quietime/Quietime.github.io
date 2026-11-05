// Incompressible 2D fluid on a coarse grid: Jos Stam, "Stable Fluids" (SIGGRAPH 1999).
//
//   ∂u/∂t = -(u·∇)u - ∇p/ρ + ν∇²u + f        (momentum)
//   ∇·u = 0                                   (incompressible)
//   ∂d/∂t = -(u·∇)d                           (dye carried by the flow)
//
// Each step: add forces → vorticity confinement → semi-Lagrangian advection of velocity →
// pressure projection (Jacobi iterations on ∇²p = ∇·u, then u -= ∇p) → advect dye → dissipate.
// Velocities are in grid cells per second. Walls are solid (zero normal velocity).

export class Fluid {
  constructor(nx, ny, { iterations = 30, sor = 1.75, vorticity = 1.6, velDecay = 0.6, dyeDecay = 0.4 } = {}) {
    this.nx = nx; this.ny = ny;
    const n = nx * ny;
    this.u = new Float32Array(n); this.v = new Float32Array(n);
    this.u0 = new Float32Array(n); this.v0 = new Float32Array(n);
    this.p = new Float32Array(n); this.div = new Float32Array(n); this.curl = new Float32Array(n);
    this.d = new Float32Array(n); this.d0 = new Float32Array(n);
    this.iterations = iterations;
    this.sor = sor;           // over-relaxation factor for Gauss-Seidel
    this.eps = vorticity;     // vorticity confinement strength
    this.velDecay = velDecay; // per second, exponential: u *= e^(-velDecay dt)
    this.dyeDecay = dyeDecay;
  }

  /** Add a Gaussian splat of force (fx, fy in cells/s²) and dye at normalised position (x, y ∈ [0,1]). */
  splat(x, y, fx, fy, radius, dye, dt) {
    const { nx, ny } = this;
    const cx = x * nx, cy = y * ny, r = Math.max(1, radius * nx), r2 = r * r;
    const i0 = Math.max(1, Math.floor(cx - 2 * r)), i1 = Math.min(nx - 2, Math.ceil(cx + 2 * r));
    const j0 = Math.max(1, Math.floor(cy - 2 * r)), j1 = Math.min(ny - 2, Math.ceil(cy + 2 * r));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = i + 0.5 - cx, dy = j + 0.5 - cy;
        const w = Math.exp(-(dx * dx + dy * dy) / r2);
        if (w < 0.01) continue;
        const k = i + j * nx;
        this.u[k] += fx * w * dt;
        this.v[k] += fy * w * dt;
        this.d[k] = Math.min(1, this.d[k] + dye * w);
      }
    }
  }

  /** Bilinear sample of a field at continuous grid coordinates (cell centres at i + 0.5). */
  lerpField(f, x, y) {
    const { nx, ny } = this;
    x = Math.min(Math.max(x - 0.5, 0), nx - 1.001);
    y = Math.min(Math.max(y - 0.5, 0), ny - 1.001);
    const i = x | 0, j = y | 0, s = x - i, t = y - j, k = i + j * nx;
    return (f[k] * (1 - s) + f[k + 1] * s) * (1 - t) + (f[k + nx] * (1 - s) + f[k + nx + 1] * s) * t;
  }

  /** Flow velocity at a normalised position, in cells per second. */
  sample(x, y) {
    const gx = x * this.nx, gy = y * this.ny;
    return [this.lerpField(this.u, gx, gy), this.lerpField(this.v, gx, gy)];
  }

  walls(u, v) {
    const { nx, ny } = this;
    for (let i = 0; i < nx; i++) { v[i] = 0; v[i + (ny - 1) * nx] = 0; u[i] = u[i + nx]; u[i + (ny - 1) * nx] = u[i + (ny - 2) * nx]; }
    for (let j = 0; j < ny; j++) { u[j * nx] = 0; u[nx - 1 + j * nx] = 0; v[j * nx] = v[1 + j * nx]; v[nx - 1 + j * nx] = v[nx - 2 + j * nx]; }
  }

  step(dt) {
    const { nx, ny, u, v, u0, v0, p, div, curl, d, d0 } = this;

    // vorticity confinement: f = ε h (N × ω), N = ∇|ω| / |∇|ω||, puts back the small swirls numerical diffusion removes
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = i + j * nx;
      curl[k] = 0.5 * ((v[k + 1] - v[k - 1]) - (u[k + nx] - u[k - nx]));
    }
    for (let j = 2; j < ny - 2; j++) for (let i = 2; i < nx - 2; i++) {
      const k = i + j * nx;
      const gx = 0.5 * (Math.abs(curl[k + 1]) - Math.abs(curl[k - 1]));
      const gy = 0.5 * (Math.abs(curl[k + nx]) - Math.abs(curl[k - nx]));
      const len = Math.hypot(gx, gy) + 1e-5;
      u[k] += this.eps * (gy / len) * curl[k] * dt;
      v[k] -= this.eps * (gx / len) * curl[k] * dt;
    }

    // semi-Lagrangian advection of velocity: trace each cell back along the flow
    u0.set(u); v0.set(v);
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = i + j * nx;
      const x = i + 0.5 - dt * u0[k], y = j + 0.5 - dt * v0[k];
      u[k] = this.lerpField(u0, x, y);
      v[k] = this.lerpField(v0, x, y);
    }
    this.walls(u, v);

    // projection: solve ∇²p = ∇·u by successive over-relaxation (Gauss-Seidel, ω = 1.75),
    // starting from last frame's pressure, then subtract the gradient so ∇·u = 0
    this.divergence();
    const w = this.sor;
    for (let it = 0; it < this.iterations; it++) {
      for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
        const k = i + j * nx;
        p[k] += w * ((p[k - 1] + p[k + 1] + p[k - nx] + p[k + nx] - div[k]) * 0.25 - p[k]);
      }
      for (let i = 0; i < nx; i++) { p[i] = p[i + nx]; p[i + (ny - 1) * nx] = p[i + (ny - 2) * nx]; }
      for (let j = 0; j < ny; j++) { p[j * nx] = p[1 + j * nx]; p[nx - 1 + j * nx] = p[nx - 2 + j * nx]; }
    }
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = i + j * nx;
      u[k] -= 0.5 * (p[k + 1] - p[k - 1]);
      v[k] -= 0.5 * (p[k + nx] - p[k - nx]);
    }
    this.walls(u, v);

    // dye follows the flow
    d0.set(d);
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = i + j * nx;
      d[k] = this.lerpField(d0, i + 0.5 - dt * u[k], j + 0.5 - dt * v[k]);
    }

    // exponential decay, independent of frame rate
    const kv = Math.exp(-this.velDecay * dt), kd = Math.exp(-this.dyeDecay * dt);
    for (let k = 0; k < u.length; k++) { u[k] *= kv; v[k] *= kv; d[k] *= kd; }
  }

  divergence() {
    const { nx, ny, u, v, div } = this;
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = i + j * nx;
      div[k] = 0.5 * (u[k + 1] - u[k - 1] + v[k + nx] - v[k - nx]);
    }
  }

  /** Root-mean-square divergence, used to check the projection. */
  divergenceRMS() {
    const { nx, ny, u, v } = this;
    let s = 0, n = 0;
    for (let j = 2; j < ny - 2; j++) for (let i = 2; i < nx - 2; i++) {
      const k = i + j * nx;
      const dv = 0.5 * (u[k + 1] - u[k - 1] + v[k + nx] - v[k - nx]);
      s += dv * dv; n++;
    }
    return Math.sqrt(s / n);
  }

  /**
   * Paint the dye as faint ink on a small canvas (scaled up smoothly by CSS). Where the liquid turns,
   * the magnitude of the vorticity |ω| shades it a little too, so eddies show even where there is no dye.
   */
  draw(ctx, img, [r, g, b], strength, swirl = 7) {
    const { d, curl } = this;
    const px = img.data;
    for (let k = 0, o = 0; k < d.length; k++, o += 4) {
      px[o] = r; px[o + 1] = g; px[o + 2] = b;
      px[o + 3] = Math.min(150, d[k] * strength + Math.abs(curl[k]) * swirl);
    }
    ctx.putImageData(img, 0, 0);
  }
}
