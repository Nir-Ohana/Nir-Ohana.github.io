import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { getAccentColorNumber, getCanvas, getReducedMotion, supportsWebGL } from './bg-utils.js';

function buildMobiusSurfaceGeometry({
  radius = 2.35,
  halfWidth = 0.65,
  uSegments = 140,
  vSegments = 18,
} = {}) {
  // Parametric Möbius strip:
  // x = (R + v cos(u/2)) cos(u)
  // y = (R + v cos(u/2)) sin(u)
  // z = v sin(u/2)
  const uCount = uSegments + 1;
  const vCount = vSegments + 1;

  const positions = new Float32Array(uCount * vCount * 3);
  let p = 0;

  for (let iu = 0; iu < uCount; iu++) {
    const u = (iu / uSegments) * Math.PI * 2;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    const cu2 = Math.cos(u * 0.5);
    const su2 = Math.sin(u * 0.5);

    for (let iv = 0; iv < vCount; iv++) {
      const v = ((iv / vSegments) * 2 - 1) * halfWidth;
      const r = radius + v * cu2;

      positions[p++] = r * cu;
      positions[p++] = r * su;
      positions[p++] = v * su2;
    }
  }

  const indices = [];
  indices.length = uSegments * vSegments * 6;
  let k = 0;

  for (let iu = 0; iu < uSegments; iu++) {
    for (let iv = 0; iv < vSegments; iv++) {
      const a = iu * vCount + iv;
      const b = (iu + 1) * vCount + iv;
      const c = (iu + 1) * vCount + (iv + 1);
      const d = iu * vCount + (iv + 1);

      indices[k++] = a;
      indices[k++] = b;
      indices[k++] = d;

      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = d;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export function initMobiusBackground(options = {}) {
  const canvas = getCanvas('bg-canvas');
  if (!canvas) return;
  if (!supportsWebGL()) return;

  const reducedMotion = getReducedMotion();
  const animate = Boolean(options.animate ?? true) && !reducedMotion;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const accent = getAccentColorNumber();
  const lineMaterial = new THREE.LineBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });

  const surface = buildMobiusSurfaceGeometry({
    radius: 2.35,
    halfWidth: 0.65,
    uSegments: 140,
    vSegments: 18,
  });

  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(surface), lineMaterial);
  scene.add(wire);

  // Subtle secondary outline for depth, without introducing new colors.
  const innerMaterial = new THREE.LineBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.09,
    depthWrite: false,
  });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(surface, 18), innerMaterial);
  scene.add(edges);

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    // Keep DPR conservative for performance.
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  resize();
  function renderOnce() {
    renderer.render(scene, camera);
  }

  function onResize() {
    resize();
    if (!animate) renderOnce();
  }

  window.addEventListener('resize', onResize, { passive: true });

  let rafId = 0;
  const clock = new THREE.Clock();

  function renderFrame() {
    const dt = clock.getDelta();

    wire.rotation.x += dt * 0.12;
    wire.rotation.y += dt * 0.16;
    edges.rotation.copy(wire.rotation);

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(renderFrame);
  }

  function onVisibilityChange() {
    if (!animate) return;

    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!rafId) {
      clock.start();
      rafId = requestAnimationFrame(renderFrame);
    }
  }

  renderOnce();
  if (animate) rafId = requestAnimationFrame(renderFrame);

  document.addEventListener('visibilitychange', onVisibilityChange, { passive: true });

  return function cleanup() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;

    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('resize', onResize);

    surface?.dispose?.();
    wire.geometry?.dispose?.();
    edges.geometry?.dispose?.();
    lineMaterial?.dispose?.();
    innerMaterial?.dispose?.();
    renderer?.dispose?.();
  };
}
