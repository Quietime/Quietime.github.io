// WebGL hover reveal for the home series list (three.js).
// The cover image follows the pointer on a plane that bends and splits its red channel
// with the pointer's speed, like a print pulled through developer.
import {
  WebGLRenderer, Scene, OrthographicCamera, PlaneGeometry, ShaderMaterial, Mesh, TextureLoader, Vector2,
} from 'three';
import gsap from 'gsap';

const vertexShader = /* glsl */ `
uniform vec2 uOffset;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  float PI = 3.14159265;
  p.x += sin(uv.y * PI) * uOffset.x;
  p.y += sin(uv.x * PI) * uOffset.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const fragmentShader = /* glsl */ `
uniform sampler2D uTex;
uniform float uAlpha;
uniform vec2 uOffset;
varying vec2 vUv;
void main() {
  float r = texture2D(uTex, vUv + uOffset * 0.35).r;
  vec2 gb = texture2D(uTex, vUv).gb;
  gl_FragColor = vec4(r, gb, uAlpha);
}`;

export default function webglReveal(list) {
  const links = [...list.querySelectorAll('a[data-cover]')];
  let renderer;
  try {
    renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    return false;
  }
  const canvas = renderer.domElement;
  canvas.className = 'gl-reveal';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;
  const uniforms = { uTex: { value: null }, uAlpha: { value: 0 }, uOffset: { value: new Vector2() } };
  const mesh = new Mesh(new PlaneGeometry(1, 1, 24, 24), new ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true }));
  scene.add(mesh);

  const loader = new TextureLoader();
  const tex = links.map((a) => loader.load(a.dataset.cover));
  const ratio = links.map((a) => {
    const [w, h] = (a.dataset.ar || '3/2').split('/').map(Number);
    return w / h || 1.5;
  });

  let W = 0, H = 0;
  const size = () => {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H);
    Object.assign(camera, { left: -W / 2, right: W / 2, top: H / 2, bottom: -H / 2 });
    camera.updateProjectionMatrix();
  };
  size();
  addEventListener('resize', size);

  const target = { x: 0, y: 0 };
  const pos = { x: 0, y: 0 };
  let active = false;
  let pw = Math.min(W * 0.24, 330);

  list.addEventListener('pointermove', (e) => { target.x = e.clientX; target.y = e.clientY; });
  links.forEach((a, i) => a.addEventListener('pointerenter', (e) => {
    uniforms.uTex.value = tex[i];
    pw = Math.min(W * 0.24, 330);
    mesh.scale.set(pw, pw / ratio[i], 1);
    if (!active) { pos.x = target.x = e.clientX; pos.y = target.y = e.clientY; }
    active = true;
    gsap.to(uniforms.uAlpha, { value: 1, duration: 0.5, ease: 'power2.out', overwrite: true });
  }));
  list.addEventListener('pointerleave', () => {
    active = false;
    gsap.to(uniforms.uAlpha, { value: 0, duration: 0.45, ease: 'power2.out', overwrite: true });
  });

  gsap.ticker.add(() => {
    if (uniforms.uAlpha.value < 0.002 && !active) return;
    pos.x += (target.x - pos.x) * 0.1;
    pos.y += (target.y - pos.y) * 0.1;
    const vx = Math.max(-1, Math.min(1, (target.x - pos.x) / 220));
    const vy = Math.max(-1, Math.min(1, (target.y - pos.y) / 220));
    uniforms.uOffset.value.set(-vx * 0.12, vy * 0.12);
    mesh.position.set(pos.x - W / 2 + pw / 2 + 32, H / 2 - pos.y, 0);
    renderer.render(scene, camera);
  });
  return true;
}
