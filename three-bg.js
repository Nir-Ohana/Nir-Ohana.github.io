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

const canvas = document.getElementById('bg-canvas');
if (!canvas) {
  // If the canvas is removed, just do nothing.
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
  camera.position.set(0, 0, 8);

  const group = new THREE.Group();
  scene.add(group);

  const accent = getAccentColorNumber();

  // Particle field
  const particleCount = 900;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;

    // Random points in a loose sphere shell
    const radius = 2.2 + Math.random() * 2.2;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = radius * Math.cos(phi);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: accent,
    size: 0.032,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  material.blending = THREE.AdditiveBlending;

  const points = new THREE.Points(geometry, material);
  group.add(points);

  // Soft wireframe knot to add structure (kept subtle)
  const knotGeo = new THREE.TorusKnotGeometry(1.15, 0.32, 180, 20);
  const knotMat = new THREE.MeshBasicMaterial({
    color: accent,
    wireframe: true,
    transparent: true,
    opacity: 0.06,
  });
  const knot = new THREE.Mesh(knotGeo, knotMat);
  group.add(knot);

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  let rafId = 0;
  const clock = new THREE.Clock();

  const baseOpacity = material.opacity;
  const baseSize = material.size;

  function renderFrame() {
    const t = clock.getElapsedTime();

    // Slow orbit-like camera drift (subtle but noticeable)
    camera.position.x = Math.cos(t * 0.07) * 0.35;
    camera.position.y = Math.sin(t * 0.09) * 0.22;
    camera.lookAt(0, 0, 0);

    // Background motion
    group.rotation.y = t * 0.14;
    group.rotation.x = Math.sin(t * 0.35) * 0.08;
    points.rotation.z = t * 0.03;
    knot.rotation.z = t * 0.18;
    knot.rotation.y = t * 0.08;

    // “Shimmer” without heavy per-particle updates
    material.opacity = baseOpacity + (Math.sin(t * 1.3) * 0.06);
    material.size = baseSize + (Math.sin(t * 0.9) * 0.004);

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(renderFrame);
  }

  // Render once for reduced motion, otherwise animate.
  renderer.render(scene, camera);
  if (!reducedMotion) {
    rafId = requestAnimationFrame(renderFrame);
  }

  // Clean up if the page gets hidden (saves battery on laptops)
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
