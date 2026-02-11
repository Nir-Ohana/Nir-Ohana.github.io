import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

import { getAccentColorNumber, getReducedMotion, supportsWebGL } from './bg-utils.js';

const prefersReducedMotion = getReducedMotion();

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function createList(tailLen, cycleLen) {
  const total = tailLen + cycleLen;
  const entry = tailLen;
  const next = new Array(total);

  for (let i = 0; i < total - 1; i++) next[i] = i + 1;
  next[total - 1] = entry;

  return { total, entry, next };
}

function buildLayout({ total, entry, next }, width, height) {
  const positions = new Array(total);
  const cx = Math.round(width * 0.62);
  const cy = Math.round(height * 0.52);
  const cycleLen = total - entry;

  const radius = Math.max(90, Math.min(150, Math.floor(Math.min(width, height) * 0.26)));

  // Cycle nodes around a circle.
  for (let k = 0; k < cycleLen; k++) {
    const idx = entry + k;
    const angle = -Math.PI / 2 + (k / cycleLen) * Math.PI * 2;
    positions[idx] = {
      x: Math.round(cx + radius * Math.cos(angle)),
      y: Math.round(cy + radius * Math.sin(angle)),
    };
  }

  // Tail nodes on a line to the left, ending at the entry.
  const entryPos = positions[entry];
  const startX = 70;
  const endX = Math.max(startX + 40, entryPos.x - radius - 40);
  const tailY = cy;

  for (let i = 0; i < entry; i++) {
    const t = entry <= 1 ? 0 : i / (entry - 1);
    positions[i] = {
      x: Math.round(startX + t * (endX - startX)),
      y: tailY,
    };
  }

  // Make sure arrows are drawable even for very small tail.
  if (entry === 0) {
    // no tail; ensure head is entry
  } else {
    positions[entry - 1].x = Math.min(positions[entry - 1].x, positions[entry].x - 46);
  }

  return { positions, next };
}

function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  const trimmed = String(value || '').trim();
  return trimmed || fallback;
}

function parseHexColorToNumber(hex, fallback) {
  if (!hex) return fallback;
  const normalized = String(hex).trim().replace('#', '');
  const isValid = /^[0-9a-fA-F]{6}$/.test(normalized);
  return isValid ? Number.parseInt(normalized, 16) : fallback;
}

function makeTextSprite(text, colorHex, fontSize = 32) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const padding = Math.ceil(fontSize * 0.6);
  const size = fontSize + padding;

  canvas.width = size;
  canvas.height = size;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(0 0 0 / 0)';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = colorHex;
  ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text), size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(20, 20, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function initThree(canvas) {
  if (!supportsWebGL()) return null;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });

  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  camera.position.set(0, 0, 200);
  camera.lookAt(0, 0, 0);

  // Shared materials
  const accentNum = getAccentColorNumber(0x1d4ed8);
  const borderNum = parseHexColorToNumber(cssVar('--border', '#e5e7eb'), 0xe5e7eb);
  const fgNum = parseHexColorToNumber(cssVar('--fg', '#111827'), 0x111827);
  const mutedNum = parseHexColorToNumber(cssVar('--muted', '#4b5563'), 0x4b5563);

  const lineMaterial = new THREE.LineBasicMaterial({ color: fgNum, transparent: true, opacity: 0.28 });
  const nodeMaterial = new THREE.MeshBasicMaterial({ color: borderNum, wireframe: true, transparent: true, opacity: 0.9 });
  const nodeHighlightT = new THREE.MeshBasicMaterial({ color: fgNum, wireframe: true, transparent: true, opacity: 0.95 });
  const nodeHighlightH = new THREE.MeshBasicMaterial({ color: accentNum, wireframe: true, transparent: true, opacity: 0.95 });

  const labelColor = cssVar('--muted', '#4b5563');
  const pointerColorH = cssVar('--accent', '#1d4ed8');
  const pointerColorT = cssVar('--fg', '#111827');

  return {
    renderer,
    scene,
    camera,
    materials: { lineMaterial, nodeMaterial, nodeHighlightT, nodeHighlightH },
    colors: { labelColor, pointerColorH, pointerColorT, mutedNum, fgNum, accentNum },
    objects: {
      edgeLines: null,
      nodes: [],
      nodeLabels: [],
      entrySprite: null,
      tortoiseSprite: null,
      hareSprite: null,
    },
  };
}

function updateRendererSize(three, canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  three.renderer.setSize(width, height, false);

  three.camera.left = -width / 2;
  three.camera.right = width / 2;
  three.camera.top = height / 2;
  three.camera.bottom = -height / 2;
  three.camera.updateProjectionMatrix();

  return { width, height };
}

function toSceneXY(x, y, width, height) {
  return { x: x - width / 2, y: -(y - height / 2) };
}

function clearSceneObjects(three) {
  const { scene, objects } = three;

  if (objects.edgeLines) {
    scene.remove(objects.edgeLines);
    objects.edgeLines.geometry.dispose();
    objects.edgeLines = null;
  }

  for (const mesh of objects.nodes) {
    scene.remove(mesh);
    mesh.geometry.dispose();
  }
  objects.nodes = [];

  for (const sprite of objects.nodeLabels) {
    scene.remove(sprite);
    sprite.material.map.dispose();
    sprite.material.dispose();
  }
  objects.nodeLabels = [];

  for (const key of ['entrySprite', 'tortoiseSprite', 'hareSprite']) {
    const sprite = objects[key];
    if (!sprite) continue;
    scene.remove(sprite);
    sprite.material.map.dispose();
    sprite.material.dispose();
    objects[key] = null;
  }
}

function buildThreeGraph(three, list, layout, width, height) {
  clearSceneObjects(three);

  const { scene, materials, colors, objects } = three;
  const nodeGeom = new THREE.IcosahedronGeometry(10, 1);

  // Nodes + labels
  for (let i = 0; i < list.total; i++) {
    const pos = layout.positions[i];
    const p = toSceneXY(pos.x, pos.y, width, height);

    const node = new THREE.Mesh(nodeGeom, materials.nodeMaterial);
    node.position.set(p.x, p.y, 0);
    node.userData.index = i;
    objects.nodes.push(node);
    scene.add(node);

    const label = makeTextSprite(String(i), colors.labelColor, 30);
    label.position.set(p.x, p.y, 1);
    label.scale.set(18, 18, 1);
    objects.nodeLabels.push(label);
    scene.add(label);
  }

  // Edges as line segments (no arrowheads)
  const positions = new Float32Array(list.total * 2 * 3);
  for (let i = 0; i < list.total; i++) {
    const from = layout.positions[i];
    const to = layout.positions[list.next[i]];
    const a = toSceneXY(from.x, from.y, width, height);
    const b = toSceneXY(to.x, to.y, width, height);

    const base = i * 6;
    positions[base + 0] = a.x;
    positions[base + 1] = a.y;
    positions[base + 2] = -2;
    positions[base + 3] = b.x;
    positions[base + 4] = b.y;
    positions[base + 5] = -2;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const edgeLines = new THREE.LineSegments(geom, materials.lineMaterial);
  objects.edgeLines = edgeLines;
  scene.add(edgeLines);

  // Entry + pointers
  objects.entrySprite = makeTextSprite('E', colors.pointerColorH, 34);
  objects.entrySprite.scale.set(22, 22, 1);
  objects.entrySprite.renderOrder = 11;
  scene.add(objects.entrySprite);

  objects.tortoiseSprite = makeTextSprite('T', colors.pointerColorT, 34);
  objects.tortoiseSprite.scale.set(22, 22, 1);
  objects.tortoiseSprite.renderOrder = 11;
  scene.add(objects.tortoiseSprite);

  objects.hareSprite = makeTextSprite('H', colors.pointerColorH, 34);
  objects.hareSprite.scale.set(22, 22, 1);
  objects.hareSprite.renderOrder = 11;
  scene.add(objects.hareSprite);

  nodeGeom.dispose();
}

function updateThreePointers(three, state, width, height) {
  const { list, layout, tortoise, hare, entry } = state;
  const { objects, materials } = three;

  if (!list || !layout) return;

  // Reset all node materials
  for (const mesh of objects.nodes) mesh.material = materials.nodeMaterial;

  // Highlight nodes under pointers
  if (objects.nodes[tortoise]) objects.nodes[tortoise].material = materials.nodeHighlightT;
  if (objects.nodes[hare]) objects.nodes[hare].material = materials.nodeHighlightH;

  const entryPos = toSceneXY(layout.positions[entry].x, layout.positions[entry].y, width, height);
  objects.entrySprite.position.set(entryPos.x, entryPos.y + 24, 2);

  const tPos = toSceneXY(layout.positions[tortoise].x, layout.positions[tortoise].y, width, height);
  objects.tortoiseSprite.position.set(tPos.x, tPos.y - 28, 2);

  const hPos = toSceneXY(layout.positions[hare].x, layout.positions[hare].y, width, height);
  objects.hareSprite.position.set(hPos.x, hPos.y - 52, 2);
}

function init() {
  const tailEl = document.getElementById('tailLen');
  const cycleEl = document.getElementById('cycleLen');
  const speedEl = document.getElementById('speed');
  const canvas = document.getElementById('vizCanvas');
  const statusEl = document.getElementById('status');

  const btnBuild = document.getElementById('btnBuild');
  const btnStep = document.getElementById('btnStep');
  const btnPlay = document.getElementById('btnPlay');
  const btnReset = document.getElementById('btnReset');

  if (!tailEl || !cycleEl || !speedEl || !canvas || !statusEl) return;
  if (!btnBuild || !btnStep || !btnPlay || !btnReset) return;

  if (!supportsWebGL()) {
    statusEl.textContent = 'WebGL is not available in this browser.';
    statusEl.classList.add('is-error');
    return;
  }

  const three = initThree(canvas);
  if (!three) {
    statusEl.textContent = 'Could not initialize Three.js.';
    statusEl.classList.add('is-error');
    return;
  }

  let { width, height } = updateRendererSize(three, canvas);

  const ro = new ResizeObserver(() => {
    ({ width, height } = updateRendererSize(three, canvas));
    if (state.list && state.layout) {
      state = { ...state, width, height, layout: buildLayout(state.list, width, height) };
      buildThreeGraph(three, state.list, state.layout, width, height);
      updateThreePointers(three, state, width, height);
      three.renderer.render(three.scene, three.camera);
    } else {
      three.renderer.render(three.scene, three.camera);
    }
  });
  ro.observe(canvas);

  let state = {
    width,
    height,
    list: null,
    layout: null,
    tortoise: 0,
    hare: 0,
    phase: 'phase1',
    meet: null,
    entry: 0,
    foundEntry: null,
    steps: 0,
    playing: false,
    lastTick: 0,
    acc: 0,
  };

  function setStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('is-error', Boolean(isError));
  }

  function build() {
    const tailLen = clampNumber(tailEl.value, 0, 30, 6);
    const cycleLen = clampNumber(cycleEl.value, 1, 30, 9);

    const list = createList(tailLen, cycleLen);
    const layout = buildLayout(list, width, height);

    state = {
      ...state,
      list,
      layout,
      tortoise: 0,
      hare: 0,
      phase: 'phase1',
      meet: null,
      entry: list.entry,
      foundEntry: null,
      steps: 0,
      playing: false,
      lastTick: 0,
      acc: 0,
    };

    btnPlay.textContent = 'Play';

    setStatus('Built a linked list with a tail + cycle. Use Step or Play.');
    buildThreeGraph(three, list, layout, width, height);
    updateThreePointers(three, state, width, height);
    three.renderer.render(three.scene, three.camera);
  }

  function resetPointersOnly() {
    if (!state.list) return;
    state = {
      ...state,
      tortoise: 0,
      hare: 0,
      phase: 'phase1',
      meet: null,
      foundEntry: null,
      steps: 0,
    };
    setStatus('Reset pointers.');
    updateThreePointers(three, state, width, height);
    three.renderer.render(three.scene, three.camera);
  }

  function stepOnce() {
    if (!state.list) {
      setStatus('Build a list first.', true);
      return;
    }

    const { next } = state.list;

    if (state.phase === 'done') {
      setStatus(`Done. Cycle entry is node ${state.foundEntry}.`);
      return;
    }

    if (state.phase === 'phase1') {
      const newT = next[state.tortoise];
      const newH = next[next[state.hare]];
      const steps = state.steps + 1;

      state = { ...state, tortoise: newT, hare: newH, steps };

      if (newT === newH) {
        // Phase 2: keep tortoise at the meeting point; reset hare to head.
        // (Resetting either pointer is correct; this avoids the tortoise "jumping" back.)
        state = { ...state, phase: 'phase2', meet: newT, tortoise: newT, hare: 0 };
        setStatus(`Phase 1: met at node ${newT}. Phase 2: reset hare to head; move both 1× to find entry.`);
      } else {
        setStatus(`Phase 1: step ${steps}.`);
      }

      updateThreePointers(three, state, width, height);
      three.renderer.render(three.scene, three.camera);
      return;
    }

    if (state.phase === 'phase2') {
      const newT = next[state.tortoise];
      const newH = next[state.hare];
      const steps = state.steps + 1;

      state = { ...state, tortoise: newT, hare: newH, steps };

      if (newT === newH) {
        state = { ...state, phase: 'done', foundEntry: newT };
        setStatus(`Done. Cycle entry is node ${newT}.`);
      } else {
        setStatus(`Phase 2: step ${steps}.`);
      }

      updateThreePointers(three, state, width, height);
      three.renderer.render(three.scene, three.camera);
    }
  }

  function getSpeed() {
    const speed = clampNumber(speedEl.value, 1, 10, 2);
    return speed;
  }

  function tick(ts) {
    if (!state.playing) return;

    if (state.lastTick === 0) state.lastTick = ts;
    const dt = Math.min(250, ts - state.lastTick);
    state.lastTick = ts;

    const stepInterval = 1000 / getSpeed();
    state.acc += dt;

    while (state.acc >= stepInterval) {
      state.acc -= stepInterval;
      stepOnce();

      if (state.phase === 'done') {
        state.playing = false;
        btnPlay.textContent = 'Play';
        break;
      }
    }

    if (state.playing) requestAnimationFrame(tick);
  }

  function togglePlay() {
    if (prefersReducedMotion) {
      setStatus('Reduced motion is enabled. Use Step instead of Play.');
      return;
    }

    if (!state.list) {
      setStatus('Build a list first.', true);
      return;
    }

    state.playing = !state.playing;
    btnPlay.textContent = state.playing ? 'Pause' : 'Play';

    if (state.playing) {
      state.lastTick = 0;
      state.acc = 0;
      requestAnimationFrame(tick);
    }
  }

  btnBuild.addEventListener('click', build);
  btnStep.addEventListener('click', () => {
    if (state.playing) togglePlay();
    stepOnce();
  });
  btnPlay.addEventListener('click', togglePlay);
  btnReset.addEventListener('click', () => {
    if (state.playing) togglePlay();
    resetPointersOnly();
  });

  if (prefersReducedMotion) {
    btnPlay.disabled = true;
    setStatus('Reduced motion is enabled. Play is disabled; use Step.');
  } else {
    setStatus('Build a list to begin.');
  }

  build();
}

init();
