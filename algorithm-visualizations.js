import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { getReducedMotion, supportsWebGL } from './bg-utils.js';

/* ───── Shared constants ─────────────────────────────────────────── */

const FONT_SANS = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

const COLOR_NODE = 0xd1d5db;
const COLOR_EDGE = 0x6b7280;
const COLOR_TORTOISE = 0x16a34a;
const COLOR_HARE = 0xdc2626;
const COLOR_MEET = 0x1d4ed8;
const COLOR_LABEL = '#4b5563';

function numberToCssHex(value) {
  return `#${value.toString(16).padStart(6, '0')}`;
}

/** Pre-resolved CSS color strings — avoids repeated numberToCssHex calls. */
const CSS = Object.freeze({
  node: numberToCssHex(COLOR_NODE),
  edge: numberToCssHex(COLOR_EDGE),
  tortoise: numberToCssHex(COLOR_TORTOISE),
  hare: numberToCssHex(COLOR_HARE),
  meet: numberToCssHex(COLOR_MEET),
  label: COLOR_LABEL,
});

/* ───── Shared helpers ───────────────────────────────────────────── */

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutCubic(t) {
  const k = clamp01(t);
  return 1 - Math.pow(1 - k, 3);
}

function easeInOutCubic(t) {
  const k = clamp01(t);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function getRandomIntInclusive(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/** Resize a 2D canvas backing store to match its CSS size (clamped DPR). */
function resize2dCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width === width && canvas.height === height) {
    return { width: rect.width, height: rect.height, changed: false };
  }
  canvas.width = width;
  canvas.height = height;
  return { width: rect.width, height: rect.height, changed: true };
}

/** Reset the canvas transform for the current DPR and clear the frame. */
function clearCanvas(ctx, width, height) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
}

/* ───── Autoplay engine ──────────────────────────────────────────── */

function createVisualizationAutoplaySkill({
  enabled,
  stepInterval,
  donePause,
  isBusy,
  isDone,
  onStep,
  onReset,
}) {
  if (!enabled) return { stop() {} };

  let prev = 0;
  let acc = 0;
  let pauseUntil = 0;
  let stopped = false;

  function loop(ts) {
    if (stopped) return;
    requestAnimationFrame(loop);

    if (prev === 0) { prev = ts; return; }

    const dt = Math.min(200, ts - prev);
    prev = ts;

    if (ts < pauseUntil) return;
    if (isBusy && isBusy()) return;

    acc += dt;
    if (acc < stepInterval) return;
    acc -= stepInterval;

    if (isDone && isDone()) {
      if (onReset) onReset();
      pauseUntil = ts + donePause;
      return;
    }

    if (onStep) onStep();

    if (isDone && isDone()) {
      pauseUntil = ts + donePause;
    }
  }

  requestAnimationFrame(loop);
  return { stop() { stopped = true; } };
}

/* ───── Snapshot-based visualization framework (DRY) ─────────────── *
 *                                                                     *
 * Handles: DOM lookup, canvas resize, Prev/Next/Reset wiring,        *
 * animated step transitions, ResizeObserver, and autoplay.            *
 *                                                                     *
 * Each visualization only needs to provide:                           *
 *   buildSnapshots()  — returns the step array                        *
 *   draw(ctx, state)  — renders one frame                             *
 * ──────────────────────────────────────────────────────────────────── */

function createSnapshotVisualization({
  canvasId, statusId, prevId, nextId, resetId,
  buildSnapshots, draw, animationMs = 700, rebuildSnapshotsOnReset = false,
}) {
  const canvas = document.getElementById(canvasId);
  const statusEl = document.getElementById(statusId);
  const prevBtn = document.getElementById(prevId);
  const nextBtn = document.getElementById(nextId);
  const resetBtn = document.getElementById(resetId);

  if (!canvas || !statusEl || !prevBtn || !nextBtn || !resetBtn) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    statusEl.textContent = 'Canvas 2D is not available.';
    statusEl.classList.add('is-error');
    return;
  }

  const reduceMotion = getReducedMotion();
  let snapshots = buildSnapshots();
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    statusEl.textContent = 'No snapshots to display.';
    statusEl.classList.add('is-error');
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    resetBtn.disabled = true;
    return;
  }
  const state = { stepIndex: 0, width: 0, height: 0, animation: null };

  function resetToStart(shouldRebuild) {
    if (shouldRebuild) {
      const rebuilt = buildSnapshots();
      if (!Array.isArray(rebuilt) || rebuilt.length === 0) return;
      snapshots = rebuilt;
    }
    state.stepIndex = 0;
    state.animation = null;
    render();
  }

  function render() {
    const { width, height } = resize2dCanvas(canvas);
    state.width = width;
    state.height = height;
    clearCanvas(ctx, width, height);

    const snapshot = snapshots[state.stepIndex];
    const toSnapshot = state.animation ? snapshots[state.animation.toIndex] : snapshot;
    const progress = state.animation ? easeInOutCubic(state.animation.progress) : 1;

    draw(ctx, {
      width, height, snapshot, toSnapshot, progress,
      isAnimating: state.animation !== null,
      stepIndex: state.stepIndex, snapshots,
    });

    statusEl.textContent = (state.animation ? toSnapshot : snapshot).text;
    prevBtn.disabled = state.stepIndex <= 0 || state.animation !== null;
    nextBtn.disabled = state.stepIndex >= snapshots.length - 1 || state.animation !== null;
  }

  function runStepAnimation(targetIndex) {
    if (state.animation || targetIndex <= state.stepIndex || reduceMotion) {
      state.stepIndex = targetIndex;
      render();
      return;
    }

    state.animation = { toIndex: targetIndex, startTs: performance.now(), progress: 0 };

    function tick(ts) {
      if (!state.animation) return;
      state.animation.progress = clamp01((ts - state.animation.startTs) / animationMs);
      if (state.animation.progress >= 1) {
        state.stepIndex = state.animation.toIndex;
        state.animation = null;
      }
      render();
      if (state.animation) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  prevBtn.addEventListener('click', () => {
    if (state.stepIndex <= 0 || state.animation) return;
    state.stepIndex -= 1;
    render();
  });

  nextBtn.addEventListener('click', () => {
    if (state.stepIndex >= snapshots.length - 1 || state.animation) return;
    runStepAnimation(state.stepIndex + 1);
  });

  resetBtn.addEventListener('click', () => {
    resetToStart(rebuildSnapshotsOnReset);
  });

  new ResizeObserver(() => render()).observe(canvas);
  render();

  createVisualizationAutoplaySkill({
    enabled: !reduceMotion,
    stepInterval: 1000,
    donePause: 1800,
    isBusy: () => state.animation !== null,
    isDone: () => state.stepIndex >= snapshots.length - 1,
    onStep: () => {
      if (state.stepIndex >= snapshots.length - 1 || state.animation) return;
      runStepAnimation(state.stepIndex + 1);
    },
    onReset: () => {
      resetToStart(rebuildSnapshotsOnReset);
    },
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Floyd's cycle detection (WebGL / Three.js)
   ═══════════════════════════════════════════════════════════════════ */

const TAIL_LEN = 5;
const CYCLE_LEN = 8;
const STEP_INTERVAL = 800;
const PAUSE_AFTER_DONE = 2400;
const NODE_RADIUS = 8;
const POINTER_RADIUS = 3.2;
const POINTER_OFFSET = NODE_RADIUS + POINTER_RADIUS + 2;

function createList(tailLen, cycleLen) {
  const total = tailLen + cycleLen;
  const entry = tailLen;
  const next = new Array(total);
  for (let i = 0; i < total - 1; i++) next[i] = i + 1;
  next[total - 1] = entry;
  return { total, entry, next };
}

function buildLayout(list, spread) {
  const { total, entry } = list;
  const cycleLen = total - entry;
  const positions = new Array(total);

  const ringR = (cycleLen * spread) / (2 * Math.PI);
  const cycleX = entry * spread + ringR;
  const cycleY = 0;
  for (let k = 0; k < cycleLen; k++) {
    const angle = Math.PI + (k / cycleLen) * Math.PI * 2;
    positions[entry + k] = new THREE.Vector3(
      cycleX + ringR * Math.cos(angle),
      cycleY + ringR * Math.sin(angle),
      0,
    );
  }

  const entryPos = positions[entry];
  for (let i = 0; i < entry; i++) {
    positions[i] = new THREE.Vector3(i * spread, entryPos.y, 0);
  }

  return positions;
}

function makeTextSprite(text, color, fontSize = 48) {
  const canvas = document.createElement('canvas');
  const size = fontSize * 1.4;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.font = `700 ${fontSize}px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text), size / 2, size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 10;
  return sprite;
}

function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 1, 2000);
  camera.position.set(0, -120, 200);
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 0, 0);

  return { renderer, scene, camera };
}

function resizeWebGL({ renderer, camera }, canvas) {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function getGraphBounds(positions) {
  const box = new THREE.Box3();
  for (const p of positions) box.expandByPoint(p);
  box.expandByVector(new THREE.Vector3(NODE_RADIUS + 16, POINTER_OFFSET + 14, NODE_RADIUS + 20));
  return box;
}

function fitCameraToBox(camera, box) {
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const fitHeight = (size.y * 0.5) / Math.tan(vFov / 2);
  const fitWidth = (size.x * 0.5) / Math.tan(hFov / 2);
  const distance = Math.max(fitHeight, fitWidth) * 1.2 + size.z * 0.7 + 12;

  const viewDir = new THREE.Vector3(0, -0.56, 1).normalize();
  camera.position.copy(center).addScaledVector(viewDir, distance);
  camera.near = Math.max(0.1, distance / 200);
  camera.far = Math.max(2000, distance * 12 + size.length());
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

function buildGraph(scene, list, positions) {
  const group = new THREE.Group();

  const nodeGeom = new THREE.IcosahedronGeometry(NODE_RADIUS, 1);
  const nodeMat = new THREE.MeshBasicMaterial({ color: COLOR_NODE, wireframe: true });
  const tortoiseNodeMat = new THREE.MeshBasicMaterial({ color: COLOR_TORTOISE, wireframe: true });
  const hareNodeMat = new THREE.MeshBasicMaterial({ color: COLOR_HARE, wireframe: true });
  const overlapNodeMat = new THREE.MeshBasicMaterial({ color: COLOR_MEET, wireframe: true });

  const nodes = [];

  for (let i = 0; i < list.total; i++) {
    const p = positions[i];
    const mesh = new THREE.Mesh(nodeGeom, nodeMat);
    mesh.position.copy(p);
    group.add(mesh);
    nodes.push(mesh);

    const label = makeTextSprite(String(i), COLOR_LABEL, 36);
    label.position.set(p.x, p.y, NODE_RADIUS + 6);
    label.scale.set(10, 10, 1);
    group.add(label);
  }

  const edgeVerts = new Float32Array(list.total * 6);
  for (let i = 0; i < list.total; i++) {
    const a = positions[i];
    const b = positions[list.next[i]];
    const base = i * 6;
    edgeVerts[base] = a.x;
    edgeVerts[base + 1] = a.y;
    edgeVerts[base + 2] = a.z;
    edgeVerts[base + 3] = b.x;
    edgeVerts[base + 4] = b.y;
    edgeVerts[base + 5] = b.z;
  }
  const edgeGeom = new THREE.BufferGeometry();
  edgeGeom.setAttribute('position', new THREE.BufferAttribute(edgeVerts, 3));
  const edgeMat = new THREE.LineBasicMaterial({ color: COLOR_EDGE, transparent: true, opacity: 0.35 });
  group.add(new THREE.LineSegments(edgeGeom, edgeMat));

  const ptrGeom = new THREE.IcosahedronGeometry(POINTER_RADIUS, 2);
  const tortoiseMesh = new THREE.Mesh(ptrGeom, new THREE.MeshBasicMaterial({ color: COLOR_TORTOISE, wireframe: true }));
  const hareMesh = new THREE.Mesh(ptrGeom, new THREE.MeshBasicMaterial({ color: COLOR_HARE, wireframe: true }));
  tortoiseMesh.renderOrder = 5;
  hareMesh.renderOrder = 5;
  group.add(tortoiseMesh, hareMesh);

  const tLabel = makeTextSprite('T', '#16a34a', 42);
  tLabel.scale.set(11, 11, 1);
  group.add(tLabel);

  const hLabel = makeTextSprite('H', '#dc2626', 42);
  hLabel.scale.set(11, 11, 1);
  group.add(hLabel);

  scene.add(group);

  return {
    group, nodes, tortoiseMesh, hareMesh, tLabel, hLabel,
    materials: { nodeMat, tortoiseNodeMat, hareNodeMat, overlapNodeMat },
  };
}

function colorActiveNodes(graph, tIdx, hIdx) {
  const { nodes, materials } = graph;
  for (const node of nodes) node.material = materials.nodeMat;

  if (tIdx === hIdx) {
    nodes[tIdx].material = materials.overlapNodeMat;
    return;
  }
  nodes[tIdx].material = materials.tortoiseNodeMat;
  nodes[hIdx].material = materials.hareNodeMat;
}

function positionPointers(graph, positions, tIdx, hIdx) {
  const tPos = positions[tIdx];
  const hPos = positions[hIdx];
  graph.tortoiseMesh.position.set(tPos.x, tPos.y - POINTER_OFFSET, tPos.z);
  graph.hareMesh.position.set(hPos.x, hPos.y + POINTER_OFFSET, hPos.z);
  graph.tLabel.position.set(tPos.x, tPos.y - POINTER_OFFSET - 8, tPos.z + 4);
  graph.hLabel.position.set(hPos.x, hPos.y + POINTER_OFFSET + 8, hPos.z + 4);
}

function initFloydVisualization() {
  const canvas = document.getElementById('vizCanvas');
  const statusEl = document.getElementById('status');
  if (!canvas || !statusEl) return;

  if (!supportsWebGL()) {
    statusEl.textContent = 'WebGL is not available.';
    statusEl.classList.add('is-error');
    return;
  }

  const three = initScene(canvas);
  const list = createList(TAIL_LEN, CYCLE_LEN);
  const positions = buildLayout(list, 28);

  const centerBox = new THREE.Box3();
  for (const p of positions) centerBox.expandByPoint(p);
  const center = new THREE.Vector3();
  centerBox.getCenter(center);
  for (const p of positions) p.sub(center);

  const graphBounds = getGraphBounds(positions);
  resizeWebGL(three, canvas);
  fitCameraToBox(three.camera, graphBounds);

  const graph = buildGraph(three.scene, list, positions);

  let state = { tortoise: 0, hare: 0, done: false };

  function renderFloyd(text) {
    positionPointers(graph, positions, state.tortoise, state.hare);
    colorActiveNodes(graph, state.tortoise, state.hare);
    if (text) statusEl.textContent = text;
    three.renderer.render(three.scene, three.camera);
  }

  renderFloyd('T:0  H:0');

  new ResizeObserver(() => {
    resizeWebGL(three, canvas);
    fitCameraToBox(three.camera, graphBounds);
    three.renderer.render(three.scene, three.camera);
  }).observe(canvas);

  if (getReducedMotion()) {
    statusEl.textContent = 'Reduced motion enabled — animation paused.';
    return;
  }

  createVisualizationAutoplaySkill({
    enabled: true,
    stepInterval: STEP_INTERVAL,
    donePause: PAUSE_AFTER_DONE,
    isDone: () => state.done,
    onStep: () => {
      const { next } = list;
      state.tortoise = next[state.tortoise];
      state.hare = next[next[state.hare]];
      if (state.tortoise === state.hare) {
        state.done = true;
        renderFloyd(`Cycle detected! Both met at node ${state.tortoise}.`);
      } else {
        renderFloyd(`T:${state.tortoise}  H:${state.hare}`);
      }
    },
    onReset: () => {
      state = { tortoise: 0, hare: 0, done: false };
      renderFloyd('Restarting… T:0  H:0');
    },
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Binary tree traversals (Canvas 2D)
   ═══════════════════════════════════════════════════════════════════ */

const TREE_NODES = [
  { value: 4, left: 2, right: 6, x: 0.5, y: 0.16 },
  { value: 2, left: 1, right: 3, x: 0.3, y: 0.42 },
  { value: 6, left: 5, right: 7, x: 0.7, y: 0.42 },
  { value: 1, left: null, right: null, x: 0.18, y: 0.72 },
  { value: 3, left: null, right: null, x: 0.42, y: 0.72 },
  { value: 5, left: null, right: null, x: 0.58, y: 0.72 },
  { value: 7, left: null, right: null, x: 0.82, y: 0.72 },
];

function computeTraversalOrder(nodeMap, nodeValue, order, result) {
  if (nodeValue == null) return;
  const node = nodeMap.get(nodeValue);
  if (!node) return;
  if (order === 'preorder') result.push(node.value);
  computeTraversalOrder(nodeMap, node.left, order, result);
  if (order === 'inorder') result.push(node.value);
  computeTraversalOrder(nodeMap, node.right, order, result);
  if (order === 'postorder') result.push(node.value);
}

function getTraversalOrders(treeNodes, rootValue) {
  const nodeMap = new Map(treeNodes.map((n) => [n.value, n]));
  const orders = { inorder: [], preorder: [], postorder: [] };
  for (const key of Object.keys(orders)) {
    computeTraversalOrder(nodeMap, rootValue, key, orders[key]);
  }
  return orders;
}

function initTreeTraversalVisualization() {
  const canvas = document.getElementById('treeCanvas');
  const statusEl = document.getElementById('treeStatus');
  const orderSelect = document.getElementById('treeOrder');
  const prevBtn = document.getElementById('treePrev');
  const nextBtn = document.getElementById('treeNext');
  const resetBtn = document.getElementById('treeReset');

  if (!canvas || !statusEl || !orderSelect || !prevBtn || !nextBtn || !resetBtn) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    statusEl.textContent = 'Canvas 2D is not available.';
    statusEl.classList.add('is-error');
    return;
  }

  const nodeMap = new Map(TREE_NODES.map((n) => [n.value, n]));
  const rootValue = 4;
  const orders = getTraversalOrders(TREE_NODES, rootValue);
  const reduceMotion = getReducedMotion();

  const state = { order: 'inorder', stepIndex: 0, width: 0, height: 0 };

  function seq() { return orders[state.order] || []; }

  function setStatus() {
    const s = seq();
    if (state.stepIndex >= s.length) {
      statusEl.textContent = `${capitalize(state.order)} complete. Order: ${s.join(' → ')}`;
    } else if (state.stepIndex === 0) {
      statusEl.textContent = `${capitalize(state.order)} traversal. Start at root (${rootValue}). Step 0/${s.length}.`;
    } else {
      statusEl.textContent = `Step ${state.stepIndex}/${s.length}. Last: ${s[state.stepIndex - 1]}. Next: ${s[state.stepIndex]}.`;
    }
  }

  function drawTree() {
    const { width, height } = state;
    if (width <= 0 || height <= 0) return;
    clearCanvas(ctx, width, height);

    const s = seq();
    const visited = new Set(s.slice(0, state.stepIndex));
    const current = state.stepIndex === 0
      ? rootValue
      : state.stepIndex < s.length ? s[state.stepIndex] : null;

    ctx.strokeStyle = CSS.edge;
    ctx.lineWidth = 2;
    for (const node of TREE_NODES) {
      for (const childVal of [node.left, node.right]) {
        const child = childVal != null ? nodeMap.get(childVal) : null;
        if (!child) continue;
        ctx.beginPath();
        ctx.moveTo(node.x * width, node.y * height);
        ctx.lineTo(child.x * width, child.y * height);
        ctx.stroke();
      }
    }

    const radius = Math.max(16, Math.min(24, Math.round(Math.min(width, height) * 0.05)));

    for (const node of TREE_NODES) {
      const x = node.x * width;
      const y = node.y * height;
      let stroke = CSS.node;
      let lw = 2;
      if (visited.has(node.value)) { stroke = CSS.tortoise; lw = 3; }
      if (node.value === current) { stroke = CSS.meet; lw = 4; }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();

      ctx.fillStyle = CSS.label;
      ctx.font = `700 18px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(node.value), x, y);
    }
  }

  function render() {
    const { width, height } = resize2dCanvas(canvas);
    state.width = width;
    state.height = height;
    drawTree();
    setStatus();
    prevBtn.disabled = state.stepIndex <= 0;
    nextBtn.disabled = state.stepIndex >= seq().length;
  }

  orderSelect.addEventListener('change', () => {
    state.order = orderSelect.value;
    state.stepIndex = 0;
    render();
  });

  prevBtn.addEventListener('click', () => {
    if (state.stepIndex > 0) { state.stepIndex -= 1; render(); }
  });

  nextBtn.addEventListener('click', () => {
    if (state.stepIndex < seq().length) { state.stepIndex += 1; render(); }
  });

  resetBtn.addEventListener('click', () => { state.stepIndex = 0; render(); });

  new ResizeObserver(() => render()).observe(canvas);
  render();

  createVisualizationAutoplaySkill({
    enabled: !reduceMotion,
    stepInterval: 1000,
    donePause: 1800,
    isDone: () => state.stepIndex >= seq().length,
    onStep: () => { if (state.stepIndex < seq().length) { state.stepIndex += 1; render(); } },
    onReset: () => { state.stepIndex = 0; render(); },
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Hash table construction (Canvas 2D)
   ═══════════════════════════════════════════════════════════════════ */

function initHashTableVisualization() {
  const canvas = document.getElementById('hashCanvas');
  const statusEl = document.getElementById('hashStatus');
  const generateBtn = document.getElementById('hashGenerate');
  const nextBtn = document.getElementById('hashNext');
  const resetBtn = document.getElementById('hashReset');

  if (!canvas || !statusEl || !generateBtn || !nextBtn || !resetBtn) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    statusEl.textContent = 'Canvas 2D is not available.';
    statusEl.classList.add('is-error');
    return;
  }

  const BUCKETS = 10;
  const SAMPLE = 12;
  const ANIM_MS = 650;
  const reduceMotion = getReducedMotion();

  const state = { numbers: [], stepIndex: 0, width: 0, height: 0, animation: null };

  function createNumbers() {
    return Array.from({ length: SAMPLE }, () => getRandomIntInclusive(0, 100));
  }

  function getBuckets() {
    const b = Array.from({ length: BUCKETS }, () => []);
    for (let i = 0; i < state.stepIndex; i++) {
      const v = state.numbers[i];
      b[v % BUCKETS].push(v);
    }
    return b;
  }

  function setStatus() {
    if (!state.numbers.length) { statusEl.textContent = 'Generate numbers to start.'; return; }
    if (state.animation) {
      const v = state.animation.value;
      statusEl.textContent = `Dropping ${v} into bucket ${v % BUCKETS} (hash: ${v} % ${BUCKETS}).`;
      return;
    }
    if (state.stepIndex >= state.numbers.length) {
      statusEl.textContent = `Done. Inserted ${state.numbers.length}/${state.numbers.length} values into ${BUCKETS} buckets.`;
      return;
    }
    const c = state.numbers[state.stepIndex];
    statusEl.textContent = `Step ${state.stepIndex}/${state.numbers.length}: next ${c} → bucket ${c % BUCKETS} (hash: ${c} % ${BUCKETS}).`;
  }

  /* Layout helpers */

  function getInputLayout(width) {
    const left = 18;
    const right = width - 18;
    const gap = 8;
    const slotW = Math.max(38, Math.floor((right - left - gap * (SAMPLE - 1)) / SAMPLE));
    const radius = Math.max(14, Math.min(20, Math.floor(slotW * 0.38)));
    return { top: 18, left, gap, slotW, radius, rowCenterY: 52 };
  }

  function getInputBallCenter(idx, width) {
    const l = getInputLayout(width);
    return { x: l.left + idx * (l.slotW + l.gap) + l.slotW / 2, y: l.rowCenterY, radius: l.radius };
  }

  function getBucketLayout(startY, width, height) {
    const mx = 18;
    const cols = 5;
    const gapX = 10;
    const gapY = 10;
    const bw = Math.floor((width - mx * 2 - gapX * (cols - 1)) / cols);
    const bh = Math.floor((Math.max(220, height - startY - 18) - gapY) / 2);
    const boxes = [];
    for (let i = 0; i < BUCKETS; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      boxes.push({ x: mx + c * (bw + gapX), y: startY + r * (bh + gapY), w: bw, h: bh });
    }
    return { boxes };
  }

  function getBucketBallSlot(layout, bi, si) {
    const box = layout.boxes[bi];
    const r = Math.max(9, Math.min(13, Math.floor(box.w * 0.12)));
    const cap = Math.max(1, Math.floor((box.w - 20) / (r * 2 + 6)));
    return {
      x: box.x + 14 + r + (si % cap) * (r * 2 + 6),
      y: box.y + 34 + r + Math.floor(si / cap) * (r * 2 + 6),
      radius: r,
    };
  }

  function drawBall(x, y, r, stroke, value, lw = 2) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();

    ctx.fillStyle = CSS.label;
    ctx.font = `700 12px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), x, y);
  }

  /* Draw */

  function drawNumberStrip(width) {
    const l = getInputLayout(width);

    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Input numbers (0-100)', l.left, l.top);

    for (let i = 0; i < state.numbers.length; i++) {
      if (state.animation && i === state.stepIndex) continue;
      const { x, y, radius } = getInputBallCenter(i, width);
      let stroke = CSS.node;
      let lw = 2;
      if (i < state.stepIndex) { stroke = CSS.tortoise; lw = 2.5; }
      if (i === state.stepIndex && state.stepIndex < state.numbers.length) { stroke = CSS.meet; lw = 3; }
      drawBall(x, y, radius, stroke, state.numbers[i], lw);
    }

    return l.rowCenterY + l.radius + 20;
  }

  function drawBuckets(startY, width, height) {
    const buckets = getBuckets();
    const layout = getBucketLayout(startY, width, height);

    for (let i = 0; i < BUCKETS; i++) {
      const box = layout.boxes[i];

      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.w, box.h, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = CSS.edge;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.fillStyle = CSS.label;
      ctx.font = `700 13px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Bucket ${i}`, box.x + box.w / 2, box.y + 16);

      for (let j = 0; j < buckets[i].length; j++) {
        const pos = getBucketBallSlot(layout, i, j);
        if (pos.y + pos.radius > box.y + box.h - 10) break;
        drawBall(pos.x, pos.y, pos.radius, CSS.tortoise, buckets[i][j]);
      }
    }

    return layout;
  }

  function draw() {
    const { width, height } = state;
    if (width <= 0 || height <= 0) return;
    clearCanvas(ctx, width, height);

    const bsy = drawNumberStrip(width);
    const bl = drawBuckets(bsy, width, height);

    if (state.animation) {
      const e = easeOutCubic(Math.min(1, state.animation.progress));
      const x = lerp(state.animation.fromX, state.animation.toX, e);
      const y = lerp(state.animation.fromY, state.animation.toY, e);
      const slot = getBucketBallSlot(bl, state.animation.bucket, state.animation.slotIndex);
      drawBall(x, y, slot.radius, CSS.meet, state.animation.value, 3);
    }
  }

  function render() {
    const { width, height } = resize2dCanvas(canvas);
    state.width = width;
    state.height = height;
    draw();
    setStatus();
    nextBtn.disabled = state.stepIndex >= state.numbers.length || state.animation !== null;
    generateBtn.disabled = state.animation !== null;
    resetBtn.disabled = state.stepIndex <= 0;
  }

  function regenerate() {
    state.numbers = createNumbers();
    state.stepIndex = 0;
    state.animation = null;
    render();
  }

  function startInsertAnimation() {
    if (state.animation || state.stepIndex >= state.numbers.length) return;

    const { width, height } = resize2dCanvas(canvas);
    state.width = width;
    state.height = height;

    const value = state.numbers[state.stepIndex];
    const bucket = value % BUCKETS;
    const slotIndex = getBuckets()[bucket].length;
    const from = getInputBallCenter(state.stepIndex, width);
    const bl = getBucketLayout(from.y + from.radius + 20, width, height);
    const target = getBucketBallSlot(bl, bucket, slotIndex);

    state.animation = {
      value, bucket, slotIndex,
      fromX: from.x, fromY: from.y,
      toX: target.x, toY: target.y,
      startTs: performance.now(), progress: 0,
    };

    function tick(ts) {
      if (!state.animation) return;
      state.animation.progress = (ts - state.animation.startTs) / ANIM_MS;
      if (state.animation.progress >= 1) {
        state.animation = null;
        state.stepIndex += 1;
        render();
        return;
      }
      render();
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  generateBtn.addEventListener('click', regenerate);

  nextBtn.addEventListener('click', () => {
    if (state.stepIndex >= state.numbers.length || state.animation) return;
    if (reduceMotion) { state.stepIndex += 1; render(); return; }
    startInsertAnimation();
  });

  resetBtn.addEventListener('click', () => {
    state.animation = null;
    state.stepIndex = 0;
    render();
  });

  new ResizeObserver(() => render()).observe(canvas);
  regenerate();

  createVisualizationAutoplaySkill({
    enabled: !reduceMotion,
    stepInterval: 900,
    donePause: 1800,
    isBusy: () => state.animation !== null,
    isDone: () => state.stepIndex >= state.numbers.length,
    onStep: () => {
      if (state.stepIndex >= state.numbers.length || state.animation) return;
      startInsertAnimation();
    },
    onReset: regenerate,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Fibonacci — dynamic programming (snapshot framework)
   ═══════════════════════════════════════════════════════════════════ */

function initFibonacciVisualization() {
  const n = 10;

  function buildSnapshots() {
    const dp = Array(n + 1).fill(null);
    dp[0] = 0;
    dp[1] = 1;
    const snaps = [{
      dp: [...dp], current: null, calc: null,
      text: 'Base cases: F(0)=0, F(1)=1. Ready to compute from i=2.',
    }];

    for (let i = 2; i <= n; i++) {
      dp[i] = dp[i - 1] + dp[i - 2];
      snaps.push({
        dp: [...dp], current: i,
        calc: { i, li: i - 1, ri: i - 2, lv: dp[i - 1], rv: dp[i - 2], res: dp[i] },
        text: `i=${i}: F(${i}) = F(${i - 1}) + F(${i - 2}) = ${dp[i - 1]} + ${dp[i - 2]} = ${dp[i]}`,
      });
    }

    snaps.push({ dp: [...dp], current: null, calc: null, text: `Done. F(${n}) = ${dp[n]}.` });
    return snaps;
  }

  function cellLayout(w, h) {
    const gap = 8;
    const cw = Math.max(40, Math.floor((w - 32 - n * gap) / (n + 1)));
    const ch = Math.max(56, Math.min(76, Math.floor(h * 0.36)));
    const total = cw * (n + 1) + gap * n;
    const sx = Math.max(12, Math.floor((w - total) / 2));
    const y = Math.max(78, Math.floor((h - ch) / 2));
    return { gap, cw, ch, sx, y };
  }

  function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
    const L = cellLayout(width, height);
    const calc = isAnimating ? toSnapshot.calc : snapshot.calc;
    const active = isAnimating ? toSnapshot : snapshot;

    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`n = ${n}`, 16, 20);

    if (calc) {
      const eq = `F(${calc.i}) = F(${calc.li}) + F(${calc.ri}) = ${calc.lv} + ${calc.rv}`;
      ctx.fillText((progress > 0.68 || !isAnimating) ? `${eq} = ${calc.res}` : eq, 16, 42);
    }

    for (let i = 0; i <= n; i++) {
      const x = L.sx + i * (L.cw + L.gap);

      let val = snapshot.dp[i];
      if (!isAnimating) val = toSnapshot.dp[i];
      else if (calc && i !== calc.i && i <= calc.li) val = toSnapshot.dp[i];
      else if (calc && i === calc.i && progress > 0.75) val = toSnapshot.dp[i];

      let stroke = CSS.node;
      let lw = 2;
      if (val != null) stroke = CSS.tortoise;
      if (active.current === i) { stroke = CSS.meet; lw = 3; }

      ctx.beginPath();
      ctx.roundRect(x, L.y, L.cw, L.ch, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();

      ctx.fillStyle = CSS.label;
      ctx.font = `600 11px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`i=${i}`, x + L.cw / 2, L.y + 14);

      ctx.font = `700 17px ${FONT_MONO}`;
      ctx.fillText(val == null ? '-' : String(val), x + L.cw / 2, L.y + L.ch / 2 + 8);
    }

    /* Animated operand balls */
    if (isAnimating && calc) {
      const center = (idx) => ({
        x: L.sx + idx * (L.cw + L.gap) + L.cw / 2,
        y: L.y + L.ch / 2,
      });
      const lp = center(calc.li);
      const rp = center(calc.ri);
      const tp = center(calc.i);
      const t = easeOutCubic(progress);
      ctx.globalAlpha = progress < 0.85 ? 1 : 1 - (progress - 0.85) / 0.15;

      for (const [src, val, offY] of [[lp, calc.lv, -18], [rp, calc.rv, 18]]) {
        const bx = lerp(src.x, tp.x, t);
        const by = lerp(src.y, tp.y + offY, t);
        ctx.beginPath();
        ctx.arc(bx, by, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = CSS.meet;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = CSS.label;
        ctx.font = `700 12px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(val), bx, by + 1);
      }

      ctx.globalAlpha = 1;
    }
  }

  createSnapshotVisualization({
    canvasId: 'fibCanvas', statusId: 'fibStatus',
    prevId: 'fibPrev', nextId: 'fibNext', resetId: 'fibReset',
    buildSnapshots, draw, animationMs: 700,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Merge two sorted lists (snapshot framework)
   ═══════════════════════════════════════════════════════════════════ */

function initMergeListsVisualization() {
  const list1 = [1, 2, 4];
  const list2 = [1, 3, 4];
  const totalLen = list1.length + list2.length;

  function buildSnapshots() {
    const snaps = [];
    let p1 = 0;
    let p2 = 0;
    const merged = [];

    snaps.push({
      p1, p2, merged: [], pick: null,
      text: 'Start merge. Compare list1[p1] and list2[p2], take the smaller value.',
    });

    while (p1 < list1.length && p2 < list2.length) {
      const takeLeft = list1[p1] <= list2[p2];
      const value = takeLeft ? list1[p1] : list2[p2];
      const si = takeLeft ? p1 : p2;
      merged.push(value);
      if (takeLeft) p1 += 1; else p2 += 1;

      snaps.push({
        p1, p2, merged: [...merged],
        pick: { from: takeLeft ? 'list1' : 'list2', si, mi: merged.length - 1, value },
        text: takeLeft ? `Take ${value} from list1 (stable on ties).` : `Take ${value} from list2.`,
      });
    }

    while (p1 < list1.length) {
      merged.push(list1[p1]);
      snaps.push({
        p1: p1 + 1, p2, merged: [...merged],
        pick: { from: 'list1', si: p1, mi: merged.length - 1, value: list1[p1] },
        text: `List2 exhausted. Append ${list1[p1]} from list1.`,
      });
      p1 += 1;
    }

    while (p2 < list2.length) {
      merged.push(list2[p2]);
      snaps.push({
        p1, p2: p2 + 1, merged: [...merged],
        pick: { from: 'list2', si: p2, mi: merged.length - 1, value: list2[p2] },
        text: `List1 exhausted. Append ${list2[p2]} from list2.`,
      });
      p2 += 1;
    }

    snaps.push({
      p1, p2, merged: [...merged], pick: null,
      text: `Done. Merged list: ${merged.join(' → ')}.`,
    });
    return snaps;
  }

  /* Row layout helpers */

  function rowLayout(width, slots) {
    const mx = 42;
    const gap = 12;
    const r = Math.max(16, Math.min(24, Math.floor((width - mx * 2 - gap * (slots - 1)) / (slots * 2.4))));
    const tw = slots * r * 2 + (slots - 1) * gap;
    return { r, gap, sx: Math.max(24, Math.floor((width - tw) / 2)) };
  }

  function nodeCenter(width, rowY, slots, idx) {
    const l = rowLayout(width, slots);
    return { x: l.sx + l.r + idx * (l.r * 2 + l.gap), y: rowY + l.r, r: l.r };
  }

  function drawRow(ctx, width, label, values, y, opts) {
    const { pointerIndex = null, consumed = 0, totalSlots = values.length, mergedLen = 0 } = opts;
    const l = rowLayout(width, totalSlots);

    ctx.fillStyle = CSS.label;
    ctx.font = `700 12px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 14, y + l.r);

    /* Arrows between nodes */
    for (let i = 0; i < totalSlots - 1; i++) {
      const a = nodeCenter(width, y, totalSlots, i);
      const b = nodeCenter(width, y, totalSlots, i + 1);
      ctx.strokeStyle = CSS.edge;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(a.x + a.r, a.y);
      ctx.lineTo(b.x - b.r, b.y);
      ctx.stroke();

      ctx.fillStyle = CSS.edge;
      ctx.font = `700 10px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▶', (a.x + b.x) / 2, a.y - 1);
    }

    /* Nodes */
    for (let i = 0; i < totalSlots; i++) {
      const c = nodeCenter(width, y, totalSlots, i);
      const hasVal = i < values.length;
      let stroke = CSS.node;
      let lw = 2;
      if (i < consumed || (label === 'merged' && i < mergedLen)) stroke = CSS.tortoise;
      if (pointerIndex != null && i === pointerIndex) { stroke = CSS.meet; lw = 3; }

      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();

      if (hasVal) {
        ctx.fillStyle = CSS.label;
        ctx.font = `700 16px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(values[i]), c.x, c.y + 1);
      }

      if (pointerIndex != null && i === pointerIndex) {
        ctx.fillStyle = CSS.meet;
        ctx.font = `700 13px ${FONT_SANS}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↑', c.x, y - 14);
      }
    }
  }

  function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
    const rowGap = Math.max(24, Math.floor((height - 3 * 52 - 32) / 3));
    const y1 = 22;
    const y2 = y1 + 52 + rowGap;
    const y3 = y2 + 52 + rowGap;

    drawRow(ctx, width, 'list1', list1, y1, {
      pointerIndex: snapshot.p1 < list1.length ? snapshot.p1 : null,
      consumed: snapshot.p1,
    });
    drawRow(ctx, width, 'list2', list2, y2, {
      pointerIndex: snapshot.p2 < list2.length ? snapshot.p2 : null,
      consumed: snapshot.p2,
    });
    drawRow(ctx, width, 'merged', snapshot.merged, y3, {
      pointerIndex: snapshot.merged.length > 0 ? snapshot.merged.length - 1 : null,
      totalSlots: totalLen,
      mergedLen: snapshot.merged.length,
    });

    /* Animated ball drop */
    if (isAnimating && toSnapshot.pick) {
      const pk = toSnapshot.pick;
      const srcY = pk.from === 'list1' ? y1 : y2;
      const srcSlots = pk.from === 'list1' ? list1.length : list2.length;
      const src = nodeCenter(width, srcY, srcSlots, pk.si);
      const tgt = nodeCenter(width, y3, totalLen, pk.mi);
      const p = easeInOutCubic(progress);
      const bx = lerp(src.x, tgt.x, p);
      const by = lerp(src.y, tgt.y, p) + Math.sin(p * Math.PI) * 34;

      ctx.beginPath();
      ctx.arc(bx, by, src.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = CSS.meet;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = CSS.label;
      ctx.font = `700 16px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(pk.value), bx, by + 1);
    }
  }

  createSnapshotVisualization({
    canvasId: 'mergeListsCanvas', statusId: 'mergeListsStatus',
    prevId: 'mergeListsPrev', nextId: 'mergeListsNext', resetId: 'mergeListsReset',
    buildSnapshots, draw, animationMs: 700,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Merge sorted array — from the back (snapshot framework)
   ═══════════════════════════════════════════════════════════════════ */

function initMergeArrayVisualization() {
  const nums1Init = [1, 2, 3, 0, 0, 0];
  const m = 3;
  const nums2 = [2, 5, 6];
  const arrN = 3;

  function buildSnapshots() {
    const snaps = [];
    const arr = [...nums1Init];
    let i = m - 1;
    let j = arrN - 1;
    let k = m + arrN - 1;

    snaps.push({
      arr: [...arr], i, j, k, wi: null,
      text: 'Start from the back. Compare nums1[i] and nums2[j], write larger into nums1[k].',
    });

    while (i >= 0 && j >= 0) {
      const takeI = arr[i] > nums2[j];
      const v = takeI ? arr[i] : nums2[j];
      arr[k] = v;
      const src = takeI ? `nums1[${i}]` : `nums2[${j}]`;
      snaps.push({
        arr: [...arr], i: i - (takeI ? 1 : 0), j: j - (takeI ? 0 : 1), k: k - 1, wi: k,
        text: `Write ${v} from ${src} into nums1[${k}].`,
      });
      if (takeI) i--; else j--;
      k--;
    }

    while (j >= 0) {
      arr[k] = nums2[j];
      snaps.push({
        arr: [...arr], i, j: j - 1, k: k - 1, wi: k,
        text: `Copy ${nums2[j]} from nums2[${j}] into nums1[${k}].`,
      });
      j--;
      k--;
    }

    snaps.push({
      arr: [...arr], i, j, k, wi: null,
      text: `Done. nums1 = [${arr.join(', ')}].`,
    });
    return snaps;
  }

  function drawArrayRow(ctx, width, label, values, y, opts) {
    const { pointer = null, highlight = null, activeLen = values.length } = opts;
    const mx = 24;
    const gap = 10;
    const slots = values.length;
    const cw = Math.max(42, Math.floor((width - mx * 2 - gap * (slots - 1)) / slots));
    const ch = 48;
    const sx = Math.max(14, Math.floor((width - (cw * slots + gap * (slots - 1))) / 2));

    ctx.fillStyle = CSS.label;
    ctx.font = `700 12px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 12, y + ch / 2);

    for (let idx = 0; idx < slots; idx++) {
      const x = sx + idx * (cw + gap);
      let stroke = idx < activeLen ? CSS.tortoise : CSS.node;
      let lw = 2;
      if (highlight != null && idx === highlight) { stroke = CSS.meet; lw = 3; }
      if (pointer != null && idx === pointer) { stroke = CSS.meet; lw = 3; }

      ctx.beginPath();
      ctx.roundRect(x, y, cw, ch, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();

      ctx.fillStyle = CSS.label;
      ctx.font = `700 16px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(values[idx]), x + cw / 2, y + ch / 2 + 1);

      if (pointer != null && idx === pointer) {
        ctx.fillStyle = CSS.meet;
        ctx.font = `700 12px ${FONT_SANS}`;
        ctx.fillText('↑', x + cw / 2, y - 10);
      }
    }
  }

  function draw(ctx, { width, height, snapshot }) {
    const y1 = 38;
    const y2 = y1 + 90;

    drawArrayRow(ctx, width, 'nums1', snapshot.arr, y1, {
      pointer: snapshot.k >= 0 ? snapshot.k : null,
      highlight: snapshot.wi,
      activeLen: snapshot.k + 1,
    });
    drawArrayRow(ctx, width, 'nums2', nums2, y2, {
      pointer: snapshot.j >= 0 ? snapshot.j : null,
      activeLen: nums2.length,
    });

    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `i = ${Math.max(snapshot.i, -1)}, j = ${Math.max(snapshot.j, -1)}, k = ${Math.max(snapshot.k, -1)}`,
      16, height - 16,
    );
  }

  createSnapshotVisualization({
    canvasId: 'mergeArrayCanvas', statusId: 'mergeArrayStatus',
    prevId: 'mergeArrayPrev', nextId: 'mergeArrayNext', resetId: 'mergeArrayReset',
    buildSnapshots, draw, animationMs: 600,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Square root — binary search (snapshot framework)
   ═══════════════════════════════════════════════════════════════════ */

function initSqrtBinarySearchVisualization() {
  const x = 26;
  const hiInit = Math.floor(x / 2) + 1;

  function buildSnapshots() {
    const snaps = [];
    let lo = 0;
    let hi = hiInit;
    let ans = 0;

    snaps.push({ lo, hi, mid: null, ans, text: `Search in [${lo}, ${hi}] for floor sqrt of ${x}.` });

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const sq = mid * mid;

      snaps.push({ lo, hi, mid, ans, text: `Check mid=${mid}: ${mid}² = ${sq}.` });

      if (sq === x) {
        ans = mid;
        snaps.push({ lo, hi, mid, ans, text: `Exact match at mid=${mid}. Answer is ${mid}.` });
        break;
      }

      if (sq < x) {
        ans = mid;
        lo = mid + 1;
        snaps.push({ lo, hi, mid, ans, text: `${sq} < ${x}. Move lo to ${lo}; best so far is ${ans}.` });
      } else {
        hi = mid - 1;
        snaps.push({ lo, hi, mid, ans, text: `${sq} > ${x}. Move hi to ${hi}.` });
      }
    }

    const last = snaps[snaps.length - 1];
    if (!last.text.includes('Exact match')) {
      snaps.push({ lo, hi, mid: null, ans, text: `Done. ⌊√${x}⌋ = ${ans}.` });
    }
    return snaps;
  }

  function drawMarker(ctx, label, color, value, sx, cw, gap, y, ch, offY, alpha) {
    if (value == null || value < 0 || value > hiInit) return;
    const cx = sx + value * (cw + gap) + cw / 2;
    const cy = y + ch / 2;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - ch / 2 - 3);
    ctx.lineTo(cx, cy + offY + 8);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy + offY, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = `700 11px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + offY + 1);
    ctx.globalAlpha = 1;
  }

  function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
    const vLo = isAnimating ? lerp(snapshot.lo, toSnapshot.lo, progress) : snapshot.lo;
    const vHi = isAnimating ? lerp(snapshot.hi, toSnapshot.hi, progress) : snapshot.hi;

    let vMid = isAnimating ? toSnapshot.mid : snapshot.mid;
    let midAlpha = 1;
    if (isAnimating) {
      if (snapshot.mid == null && toSnapshot.mid != null) { vMid = toSnapshot.mid; midAlpha = progress; }
      else if (snapshot.mid != null && toSnapshot.mid == null) { vMid = snapshot.mid; midAlpha = 1 - progress; }
      else if (snapshot.mid != null && toSnapshot.mid != null) { vMid = lerp(snapshot.mid, toSnapshot.mid, progress); }
    }

    const slots = hiInit + 1;
    const mx = 24;
    const gap = 8;
    const cw = Math.max(24, Math.floor((width - mx * 2 - gap * (slots - 1)) / slots));
    const ch = 44;
    const rw = cw * slots + gap * (slots - 1);
    const sx = Math.max(14, Math.floor((width - rw) / 2));
    const y = Math.max(72, Math.floor(height * 0.38));

    const ansVal = isAnimating ? Math.round(lerp(snapshot.ans, toSnapshot.ans, progress)) : snapshot.ans;

    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`x = ${x}`, 16, 20);
    ctx.fillText(`best = ${ansVal}`, 16, 40);

    for (let v = 0; v <= hiInit; v++) {
      const xp = sx + v * (cw + gap);
      let stroke = CSS.node;
      let lw = 2;

      if (v >= Math.ceil(vLo) && v <= Math.floor(vHi)) stroke = CSS.edge;
      if (Math.abs(v - vLo) < 0.5) { stroke = CSS.tortoise; lw = 3; }
      if (Math.abs(v - vHi) < 0.5) { stroke = CSS.hare; lw = 3; }
      if (vMid != null && Math.abs(v - vMid) < 0.5) { stroke = CSS.meet; lw = 4; }

      ctx.beginPath();
      ctx.roundRect(xp, y, cw, ch, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();

      ctx.fillStyle = CSS.label;
      ctx.font = `700 13px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(v), xp + cw / 2, y + ch / 2 + 1);
    }

    drawMarker(ctx, 'lo', CSS.tortoise, vLo, sx, cw, gap, y, ch, -28, 1);
    drawMarker(ctx, 'hi', CSS.hare, vHi, sx, cw, gap, y, ch, -52, 1);
    drawMarker(ctx, 'mid', CSS.meet, vMid, sx, cw, gap, y, ch, 56, midAlpha);
  }

  createSnapshotVisualization({
    canvasId: 'sqrtCanvas', statusId: 'sqrtStatus',
    prevId: 'sqrtPrev', nextId: 'sqrtNext', resetId: 'sqrtReset',
    buildSnapshots, draw, animationMs: 620,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Majority element — Boyer-Moore voting (snapshot framework)
   ═══════════════════════════════════════════════════════════════════ */

function initMajorityElementVisualization() {
  function shuffle(values) {
    const arr = [...values];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = getRandomIntInclusive(0, i);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function createRandomMajorityInput() {
    const length = getRandomIntInclusive(9, 13);
    const majorityValue = getRandomIntInclusive(1, 9);
    const minMajority = Math.floor(length / 2) + 1;
    const majorityCount = minMajority;
    const arr = [];

    for (let i = 0; i < majorityCount; i++) arr.push(majorityValue);
    while (arr.length < length) {
      let candidate = getRandomIntInclusive(0, 9);
      if (candidate === majorityValue) candidate = (candidate + 1) % 10;
      arr.push(candidate);
    }

    return shuffle(arr);
  }

  function buildSnapshots() {
    const nums = createRandomMajorityInput();
    const snapshots = [];
    let candidate = null;
    let count = 0;

    snapshots.push({
      nums,
      idx: null,
      processed: 0,
      candidate,
      count,
      text: `New run: nums = [${nums.join(', ')}]. Start with candidate = -, count = 0.`,
    });

    for (let i = 0; i < nums.length; i++) {
      const num = nums[i];
      const previousCount = count;
      if (count === 0) candidate = num;
      count += num === candidate ? 1 : -1;

      snapshots.push({
        nums,
        idx: i,
        processed: i + 1,
        candidate,
        count,
        current: num,
        picked: previousCount === 0,
        text: previousCount === 0
          ? `i=${i}, num=${num}: count was 0, pick candidate=${candidate}, then count -> ${count}.`
          : `i=${i}, num=${num}: ${num === candidate ? 'match' : 'mismatch'} with candidate=${candidate}, count -> ${count}.`,
      });
    }

    snapshots.push({
      nums,
      idx: null,
      processed: nums.length,
      candidate,
      count,
      text: `Done. Majority element is ${candidate}. Next reset/autoplay cycle randomizes a new list.`,
    });

    return snapshots;
  }

  function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
    const active = isAnimating ? toSnapshot : snapshot;
    const nums = active.nums;
    const slots = nums.length;
    const mx = 24;
    const gap = 10;
    const cw = Math.max(34, Math.floor((width - mx * 2 - gap * (slots - 1)) / slots));
    const ch = 56;
    const rw = cw * slots + gap * (slots - 1);
    const sx = Math.max(12, Math.floor((width - rw) / 2));
    const y = Math.max(96, Math.floor(height * 0.38));

    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`candidate = ${active.candidate == null ? '-' : active.candidate}`, 16, 22);
    ctx.fillText(`count = ${active.count}`, 16, 42);
    ctx.fillText(`processed = ${active.processed}/${nums.length}`, 16, 62);

    for (let i = 0; i < slots; i++) {
      const x = sx + i * (cw + gap);
      let stroke = CSS.node;
      let lw = 2;
      if (i < active.processed) {
        stroke = CSS.tortoise;
      }
      if (active.idx != null && i === active.idx) {
        stroke = CSS.meet;
        lw = 3;
      }

      ctx.beginPath();
      ctx.roundRect(x, y, cw, ch, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();

      ctx.fillStyle = CSS.label;
      ctx.font = `700 16px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(nums[i]), x + cw / 2, y + ch / 2 + 2);

      ctx.font = `600 10px ${FONT_SANS}`;
      ctx.fillText(String(i), x + cw / 2, y + ch + 12);
    }

    let markerIndex = active.idx;
    if (isAnimating && snapshot.idx != null && toSnapshot.idx != null) {
      markerIndex = lerp(snapshot.idx, toSnapshot.idx, easeOutCubic(progress));
    }
    if (markerIndex != null) {
      const cx = sx + markerIndex * (cw + gap) + cw / 2;
      const cy = y - 18;
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = CSS.meet;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = CSS.meet;
      ctx.font = `700 11px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('i', cx, cy + 1);
    }
  }

  createSnapshotVisualization({
    canvasId: 'majorityCanvas', statusId: 'majorityStatus',
    prevId: 'majorityPrev', nextId: 'majorityNext', resetId: 'majorityReset',
    buildSnapshots,
    draw,
    animationMs: 560,
    rebuildSnapshotsOnReset: true,
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Excel column title → number (base-26, shift-left logic)
   ═══════════════════════════════════════════════════════════════════ */

function initExcelTitleNumberVisualization() {
  function randomTitle() {
    const len = getRandomIntInclusive(2, 5);
    let out = '';
    for (let i = 0; i < len; i++) {
      out += String.fromCharCode(65 + getRandomIntInclusive(0, 25));
    }
    return out;
  }

  function charValue(ch) {
    return ch.charCodeAt(0) - 64;
  }

  function buildSnapshots() {
    const title = randomTitle();
    const chars = title.split('');
    const snaps = [];
    let result = 0;

    snaps.push({
      title,
      chars,
      idx: null,
      result,
      prevResult: null,
      value: null,
      text: `New run: columnTitle="${title}". Start with result = 0.`,
    });

    for (let i = 0; i < chars.length; i++) {
      const value = charValue(chars[i]);
      const prevResult = result;
      result = prevResult * 26 + value;
      snaps.push({
        title,
        chars,
        idx: i,
        result,
        prevResult,
        value,
        text: `i=${i}, char='${chars[i]}' (${value}): result = ${prevResult} * 26 + ${value} = ${result}.`,
      });
    }

    snaps.push({
      title,
      chars,
      idx: null,
      result,
      prevResult: null,
      value: null,
      text: `Done. "${title}" → ${result}. Next reset/autoplay cycle randomizes a new title.`,
    });

    return snaps;
  }

  function drawValueBox(ctx, x, y, w, h, text, stroke, lineWidth = 2, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.fillStyle = CSS.label;
    ctx.font = `700 16px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text), x + w / 2, y + h / 2 + 1);
    ctx.globalAlpha = 1;
  }

  function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
    const active = isAnimating ? toSnapshot : snapshot;
    const chars = active.chars;

    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`columnTitle = "${active.title}"`, 16, 20);

    const shownResult = isAnimating && toSnapshot.prevResult != null && progress < 0.86
      ? toSnapshot.prevResult
      : active.result;
    ctx.fillText(`result = ${shownResult}`, 16, 40);

    const slots = chars.length;
    const gap = 10;
    const cw = Math.max(42, Math.min(58, Math.floor((width - 80 - gap * (slots - 1)) / Math.max(1, slots))));
    const ch = 46;
    const total = cw * slots + gap * (slots - 1);
    const sx = Math.max(20, Math.floor((width - total) / 2));
    const sy = 62;

    for (let i = 0; i < slots; i++) {
      const x = sx + i * (cw + gap);
      let stroke = CSS.node;
      let lw = 2;
      if (active.idx != null && i < active.idx) stroke = CSS.tortoise;
      if (active.idx != null && i === active.idx) {
        stroke = CSS.meet;
        lw = 3;
      }

      ctx.beginPath();
      ctx.roundRect(x, sy, cw, ch, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();

      ctx.fillStyle = CSS.label;
      ctx.font = `700 16px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(chars[i], x + cw / 2, sy + ch / 2 + 1);
    }

    const boxW = Math.max(88, Math.min(130, Math.floor(width * 0.18)));
    const boxH = 50;
    const y = Math.max(138, Math.floor(height * 0.48));
    const xPrev = Math.floor(width * 0.16);
    const xShift = Math.floor(width * 0.42);
    const xFinal = Math.floor(width * 0.70);
    const current = active.idx != null ? active.idx : null;

    if (isAnimating && toSnapshot.idx != null && toSnapshot.prevResult != null) {
      const p = easeInOutCubic(progress);
      const phaseOne = Math.min(1, p * 2);
      const phaseTwo = Math.max(0, Math.min(1, (p - 0.5) * 2));

      drawValueBox(ctx, xPrev, y, boxW, boxH, toSnapshot.prevResult, CSS.node, 2, 1 - phaseOne * 0.35);

      const moveX = lerp(xPrev, xShift, phaseOne);
      drawValueBox(ctx, moveX, y, boxW, boxH, toSnapshot.prevResult, CSS.tortoise, 3);

      ctx.fillStyle = CSS.label;
      ctx.font = `700 14px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('× 26 (shift left)', xShift + boxW + 82, y + boxH / 2);

      drawValueBox(ctx, xFinal, y, boxW, boxH, toSnapshot.result, CSS.meet, 3, phaseTwo);

      if (current != null) {
        const valStartX = sx + current * (cw + gap) + cw / 2;
        const valStartY = sy + ch + 24;
        const valEndX = xFinal - 24;
        const valEndY = y + boxH / 2;
        const bx = lerp(valStartX, valEndX, phaseTwo);
        const by = lerp(valStartY, valEndY, phaseTwo);

        ctx.globalAlpha = phaseTwo;
        ctx.beginPath();
        ctx.arc(bx, by, 13, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = CSS.hare;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = CSS.hare;
        ctx.font = `700 12px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(toSnapshot.value), bx, by + 1);
        ctx.globalAlpha = 1;
      }
    } else if (active.idx != null && active.prevResult != null) {
      drawValueBox(ctx, xPrev, y, boxW, boxH, active.prevResult, CSS.node);
      ctx.fillStyle = CSS.label;
      ctx.font = `700 14px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('× 26 (shift left)', xShift + boxW / 2, y + boxH / 2);
      drawValueBox(ctx, xFinal, y, boxW, boxH, active.result, CSS.meet, 3);

      const plusX = xFinal - 24;
      const plusY = y + boxH / 2;
      ctx.beginPath();
      ctx.arc(plusX, plusY, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = CSS.hare;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = CSS.hare;
      ctx.font = `700 12px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(active.value), plusX, plusY + 1);
    } else {
      drawValueBox(ctx, xFinal, y, boxW, boxH, active.result, CSS.meet, 3);
    }
  }

  createSnapshotVisualization({
    canvasId: 'excelColCanvas', statusId: 'excelColStatus',
    prevId: 'excelColPrev', nextId: 'excelColNext', resetId: 'excelColReset',
    buildSnapshots,
    draw,
    animationMs: 760,
    rebuildSnapshotsOnReset: true,
  });
}

/* ───── Bootstrap ────────────────────────────────────────────────── */

function init() {
  initFloydVisualization();
  initTreeTraversalVisualization();
  initHashTableVisualization();
  initFibonacciVisualization();
  initMergeListsVisualization();
  initMergeArrayVisualization();
  initSqrtBinarySearchVisualization();
  initMajorityElementVisualization();
  initExcelTitleNumberVisualization();
}

init();
