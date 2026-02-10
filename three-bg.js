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

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(4.4, 4.0, 6.8);
  camera.lookAt(0, 0, 0);

  // Lighting (kept simple and neutral; background is transparent)
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 0.65);
  key.position.set(6, 7, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(getAccentColorNumber(), 0.25);
  rim.position.set(-7, -3, -6);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);

  // --- Rubik's cube (4x4) ---
  const N = 4;
  const cubieSize = 0.86;
  const gap = 0.06;
  const step = cubieSize + gap;
  const center = (N - 1) / 2;

  const COLORS = {
    U: 0xffffff,
    D: 0xfbbf24,
    F: 0x22c55e,
    B: 0x3b82f6,
    R: 0xef4444,
    L: 0xf97316,
    inner: 0x111827,
  };

  function makeMat(color, { roughness = 0.35, metalness = 0.04 } = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  function solvedFaceMaterials(xi, yi, zi) {
    // three.js BoxGeometry material order: +x, -x, +y, -y, +z, -z
    const mats = [
      makeMat(xi === N - 1 ? COLORS.R : COLORS.inner),
      makeMat(xi === 0 ? COLORS.L : COLORS.inner),
      makeMat(yi === N - 1 ? COLORS.U : COLORS.inner),
      makeMat(yi === 0 ? COLORS.D : COLORS.inner),
      makeMat(zi === N - 1 ? COLORS.F : COLORS.inner),
      makeMat(zi === 0 ? COLORS.B : COLORS.inner),
    ];
    return mats;
  }

  function indexToCoord(i) {
    return (i - center) * step;
  }

  function setMeshPositionFromIndices(cubie) {
    cubie.mesh.position.set(indexToCoord(cubie.xi), indexToCoord(cubie.yi), indexToCoord(cubie.zi));
  }

  const cubies = [];
  const box = new THREE.BoxGeometry(cubieSize, cubieSize, cubieSize);

  for (let xi = 0; xi < N; xi++) {
    for (let yi = 0; yi < N; yi++) {
      for (let zi = 0; zi < N; zi++) {
        const mesh = new THREE.Mesh(box, solvedFaceMaterials(xi, yi, zi));
        mesh.castShadow = false;
        mesh.receiveShadow = false;

        const cubie = { mesh, xi, yi, zi };
        setMeshPositionFromIndices(cubie);
        group.add(mesh);
        cubies.push(cubie);
      }
    }
  }

  function rotateIndices(cubie, axis, dir) {
    const x = cubie.xi;
    const y = cubie.yi;
    const z = cubie.zi;

    if (axis === 'x') {
      if (dir === 1) {
        cubie.yi = (N - 1) - z;
        cubie.zi = y;
      } else {
        cubie.yi = z;
        cubie.zi = (N - 1) - y;
      }
      cubie.xi = x;
    } else if (axis === 'y') {
      if (dir === 1) {
        cubie.xi = z;
        cubie.zi = (N - 1) - x;
      } else {
        cubie.xi = (N - 1) - z;
        cubie.zi = x;
      }
      cubie.yi = y;
    } else {
      // axis === 'z'
      if (dir === 1) {
        cubie.xi = (N - 1) - y;
        cubie.yi = x;
      } else {
        cubie.xi = y;
        cubie.yi = (N - 1) - x;
      }
      cubie.zi = z;
    }
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function randomInt(maxExclusive) {
    return Math.floor(Math.random() * maxExclusive);
  }

  function randomMove(last) {
    const axes = ['x', 'y', 'z'];
    let axis = axes[randomInt(axes.length)];
    let layer = randomInt(N);
    let dir = Math.random() < 0.5 ? -1 : 1;

    // Avoid repeating the exact same slice over and over.
    if (last && last.axis === axis && last.layer === layer) {
      axis = axes[(axes.indexOf(axis) + 1) % axes.length];
      layer = randomInt(N);
    }

    return { axis, layer, dir };
  }

  function inverseMove(move) {
    return { axis: move.axis, layer: move.layer, dir: -move.dir };
  }

  function makeScramble(length = 26) {
    const moves = [];
    let last = null;
    for (let i = 0; i < length; i++) {
      const m = randomMove(last);
      moves.push(m);
      last = m;
    }
    return moves;
  }

  let phase = 'scramble';
  let scramble = makeScramble();
  let queue = [...scramble];

  let current = null;
  let timeSinceLastMove = 0;
  const movePauseSeconds = 0.12;
  const moveDurationSeconds = 0.85;

  function selectLayer(axis, layerIndex) {
    return cubies.filter((c) => (axis === 'x' ? c.xi : axis === 'y' ? c.yi : c.zi) === layerIndex);
  }

  function startMove(move) {
    const axis = move.axis;
    const layerCubies = selectLayer(axis, move.layer);

    const pivot = new THREE.Group();
    group.add(pivot);

    // Reparent while keeping transforms
    for (const c of layerCubies) {
      pivot.attach(c.mesh);
    }

    current = {
      move,
      pivot,
      layerCubies,
      elapsed: 0,
    };
  }

  function finalizeMove() {
    if (!current) return;

    const { move, pivot, layerCubies } = current;

    // Reparent back to the main group and snap indices/positions.
    for (const c of layerCubies) {
      group.attach(c.mesh);
      rotateIndices(c, move.axis, move.dir);
      setMeshPositionFromIndices(c);
    }

    group.remove(pivot);
    current = null;
    timeSinceLastMove = 0;
  }

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

  function renderFrame() {
    const dt = clock.getDelta();

    if (current) {
      current.elapsed += dt;
      const t = Math.min(current.elapsed / moveDurationSeconds, 1);
      const eased = easeInOutCubic(t);
      const angle = current.move.dir * (Math.PI / 2) * eased;

      current.pivot.rotation.set(0, 0, 0);
      current.pivot.rotation[current.move.axis] = angle;

      if (t >= 1) {
        finalizeMove();
      }
    } else if (!reducedMotion) {
      timeSinceLastMove += dt;

      if (timeSinceLastMove >= movePauseSeconds) {
        if (queue.length === 0) {
          if (phase === 'scramble') {
            phase = 'solve';
            queue = scramble.slice().reverse().map(inverseMove);
          } else {
            // Solved: scramble again.
            phase = 'scramble';
            scramble = makeScramble();
            queue = [...scramble];
          }
        }

        const next = queue.shift();
        if (next) startMove(next);
      }
    }

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
