import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

function hexToThreeColorNumber(hex) {
  if (!hex) return 0x1d4ed8;
  const normalized = hex.trim().replace('#', '');
  const isValid = /^[0-9a-fA-F]{6}$/.test(normalized);
  return isValid ? Number.parseInt(normalized, 16) : 0x1d4ed8;
}

function getAccentColorNumber() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--accent');
  return hexToThreeColorNumber(value);
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

function mandelbrotHeight(cx, cy, maxIter) {
  // Escape-time algorithm; returns a smooth-ish height.
  let x = 0;
  let y = 0;
  let x2 = 0;
  let y2 = 0;
  let iter = 0;

  // Early exit: cardioid/bulb tests to keep it fast.
  const q = (cx - 0.25) * (cx - 0.25) + cy * cy;
  if (q * (q + (cx - 0.25)) <= 0.25 * cy * cy) return 0;
  if ((cx + 1) * (cx + 1) + cy * cy <= 0.0625) return 0;

  while (x2 + y2 <= 4 && iter < maxIter) {
    y = 2 * x * y + cy;
    x = x2 - y2 + cx;
    x2 = x * x;
    y2 = y * y;
    iter++;
  }

  if (iter >= maxIter) return 0;

  // Smooth iteration count
  const zn = Math.sqrt(x2 + y2);
  const nu = Math.log2(Math.log2(zn));
  const smooth = iter + 1 - nu;

  // Normalize to [0,1]
  return Math.min(1, Math.max(0, smooth / maxIter));
}

const canvas = document.getElementById('bg-canvas');
if (!canvas) {
  // No canvas on this page.
} else if (!supportsWebGL()) {
  // Graceful no-op when WebGL isn't available.
} else {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 2.2, 7.5);
  camera.lookAt(0, 0, 0);

  const group = new THREE.Group();
  scene.add(group);

  // Wireframe Mandelbrot surface
  const accent = getAccentColorNumber();
  const material = new THREE.MeshBasicMaterial({
    color: accent,
    wireframe: true,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });

  // Grid resolution tuned to stay light for background usage.
  const segX = 160;
  const segY = 100;
  const width = 9;
  const height = 5.6;
  const geometry = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geometry.attributes.position;

  const maxIter = 60;
  // Map plane coords to complex plane region.
  // Region: x in [-2.4, 1.2], y in [-1.35, 1.35]
  const xMin = -2.4;
  const xMax = 1.2;
  const yMin = -1.35;
  const yMax = 1.35;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    const u = (x + width / 2) / width;
    const v = (y + height / 2) / height;

    const cx = xMin + u * (xMax - xMin);
    const cy = yMin + v * (yMax - yMin);

    const h = mandelbrotHeight(cx, cy, maxIter);
    // Height scale is subtle so it reads as wireframe, not a big 3D object.
    pos.setZ(i, h * 1.6);
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2.75;
  group.add(mesh);

  // A second, slightly offset mesh adds density (still subtle).
  const mesh2 = new THREE.Mesh(geometry.clone(), material.clone());
  mesh2.material.opacity = 0.08;
  mesh2.scale.set(1.01, 1.01, 1);
  mesh2.position.y = -0.04;
  mesh2.rotation.copy(mesh.rotation);
  group.add(mesh2);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  let rafId = 0;
  const clock = new THREE.Clock();

  function renderFrame() {
    const t = clock.getElapsedTime();
    // Slow drift; stays readable behind text.
    group.rotation.y = t * 0.05;
    group.rotation.z = Math.sin(t * 0.2) * 0.03;
    camera.position.x = Math.cos(t * 0.08) * 0.35;
    camera.position.y = 2.2 + Math.sin(t * 0.09) * 0.15;
    camera.lookAt(0, 0.4, 0);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(renderFrame);
  }

  renderer.render(scene, camera);
  if (!reducedMotion) rafId = requestAnimationFrame(renderFrame);

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (!reducedMotion && !rafId) {
        clock.start();
        rafId = requestAnimationFrame(renderFrame);
      }
    },
    { passive: true }
  );
}
