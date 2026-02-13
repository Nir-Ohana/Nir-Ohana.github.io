import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { getReducedMotion, supportsWebGL } from './bg-utils.js';

const TAIL_LEN = 5;
const CYCLE_LEN = 8;
const STEP_INTERVAL = 800;
const PAUSE_AFTER_DONE = 2400;
const NODE_RADIUS = 8;
const POINTER_RADIUS = 3.2;
const POINTER_OFFSET = NODE_RADIUS + POINTER_RADIUS + 2;

const COLOR_NODE = 0xd1d5db;
const COLOR_EDGE = 0x6b7280;
const COLOR_TORTOISE = 0x16a34a;
const COLOR_HARE = 0xdc2626;
const COLOR_MEET = 0x1d4ed8;
const COLOR_LABEL = '#4b5563';

function numberToCssHex(value) {
  return `#${value.toString(16).padStart(6, '0')}`;
}

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

  const ringR = cycleLen * spread / (2 * Math.PI);
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
    const x = i * spread;
    positions[i] = new THREE.Vector3(x, entryPos.y, 0);
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
  ctx.font = `700 ${fontSize}px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace`;
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

function resize({ renderer, camera }, canvas) {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function createVisualizationAutoplaySkill({
  enabled,
  stepInterval,
  donePause,
  isBusy,
  isDone,
  onStep,
  onReset,
}) {
  if (!enabled) {
    return { stop() {} };
  }

  let prev = 0;
  let acc = 0;
  let pauseUntil = 0;
  let stopped = false;

  function loop(ts) {
    if (stopped) return;
    requestAnimationFrame(loop);

    if (prev === 0) {
      prev = ts;
      return;
    }

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

  return {
    stop() {
      stopped = true;
    },
  };
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
  const tortoiseMat = new THREE.MeshBasicMaterial({ color: COLOR_TORTOISE, wireframe: true });
  const hareMat = new THREE.MeshBasicMaterial({ color: COLOR_HARE, wireframe: true });

  const tortoiseMesh = new THREE.Mesh(ptrGeom, tortoiseMat);
  const hareMesh = new THREE.Mesh(ptrGeom, hareMat);
  tortoiseMesh.renderOrder = 5;
  hareMesh.renderOrder = 5;
  group.add(tortoiseMesh);
  group.add(hareMesh);

  const tLabel = makeTextSprite('T', '#16a34a', 42);
  tLabel.scale.set(11, 11, 1);
  group.add(tLabel);

  const hLabel = makeTextSprite('H', '#dc2626', 42);
  hLabel.scale.set(11, 11, 1);
  group.add(hLabel);

  scene.add(group);

  return {
    group,
    nodes,
    tortoiseMesh,
    hareMesh,
    tLabel,
    hLabel,
    materials: { nodeMat, tortoiseNodeMat, hareNodeMat, overlapNodeMat },
  };
}

function colorActiveNodes(graph, tIdx, hIdx) {
  const { nodes, materials } = graph;
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].material = materials.nodeMat;
  }

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

function createFloydState() {
  return { tortoise: 0, hare: 0, done: false };
}

function floydStep(s, list) {
  const { next } = list;

  s.tortoise = next[s.tortoise];
  s.hare = next[next[s.hare]];

  if (s.tortoise === s.hare) {
    s.done = true;
    return `Cycle detected! Both met at node ${s.tortoise}.`;
  }
  return `T:${s.tortoise}  H:${s.hare}`;
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
  const spread = 28;
  const positions = buildLayout(list, spread);

  const centerBox = new THREE.Box3();
  for (const p of positions) centerBox.expandByPoint(p);
  const center = new THREE.Vector3();
  centerBox.getCenter(center);
  for (const p of positions) p.sub(center);

  const graphBounds = getGraphBounds(positions);

  resize(three, canvas);
  fitCameraToBox(three.camera, graphBounds);

  const graph = buildGraph(three.scene, list, positions);

  let floyd = createFloydState();
  function renderFloyd(text) {
    positionPointers(graph, positions, floyd.tortoise, floyd.hare);
    colorActiveNodes(graph, floyd.tortoise, floyd.hare);
    if (text) statusEl.textContent = text;
    three.renderer.render(three.scene, three.camera);
  }

  renderFloyd('T:0  H:0');

  const ro = new ResizeObserver(() => {
    resize(three, canvas);
    fitCameraToBox(three.camera, graphBounds);
    three.renderer.render(three.scene, three.camera);
  });
  ro.observe(canvas);

  const reduceMotion = getReducedMotion();
  if (reduceMotion) {
    statusEl.textContent = 'Reduced motion enabled — animation paused.';
    return;
  }

  createVisualizationAutoplaySkill({
    enabled: true,
    stepInterval: STEP_INTERVAL,
    donePause: PAUSE_AFTER_DONE,
    isDone: () => floyd.done,
    onStep: () => {
      const msg = floydStep(floyd, list);
      renderFloyd(msg);
    },
    onReset: () => {
      floyd = createFloydState();
      renderFloyd('Restarting… T:0  H:0');
    },
  });
}

function buildTreeLayout() {
  return [
    { value: 4, left: 2, right: 6, x: 0.5, y: 0.16 },
    { value: 2, left: 1, right: 3, x: 0.3, y: 0.42 },
    { value: 6, left: 5, right: 7, x: 0.7, y: 0.42 },
    { value: 1, left: null, right: null, x: 0.18, y: 0.72 },
    { value: 3, left: null, right: null, x: 0.42, y: 0.72 },
    { value: 5, left: null, right: null, x: 0.58, y: 0.72 },
    { value: 7, left: null, right: null, x: 0.82, y: 0.72 },
  ];
}

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
  const nodeMap = new Map(treeNodes.map((node) => [node.value, node]));
  const orders = {
    inorder: [],
    preorder: [],
    postorder: [],
  };

  computeTraversalOrder(nodeMap, rootValue, 'inorder', orders.inorder);
  computeTraversalOrder(nodeMap, rootValue, 'preorder', orders.preorder);
  computeTraversalOrder(nodeMap, rootValue, 'postorder', orders.postorder);
  return orders;
}

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

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function easeOutCubic(t) {
  const k = clamp01(t);
  return 1 - Math.pow(1 - k, 3);
}

function easeInOutCubic(t) {
  const k = clamp01(t);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
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

  const treeNodes = buildTreeLayout();
  const nodeMap = new Map(treeNodes.map((node) => [node.value, node]));
  const rootValue = 4;
  const orders = getTraversalOrders(treeNodes, rootValue);

  const state = {
    order: 'inorder',
    stepIndex: 0,
    width: 0,
    height: 0,
  };
  const reduceMotion = getReducedMotion();

  const edgeColor = numberToCssHex(COLOR_EDGE);
  const labelColor = COLOR_LABEL;
  const visitedColor = numberToCssHex(COLOR_TORTOISE);
  const currentColor = numberToCssHex(COLOR_MEET);
  const defaultNodeColor = numberToCssHex(COLOR_NODE);

  function getSequence() {
    return orders[state.order] || [];
  }

  function setStatus() {
    const sequence = getSequence();
    const visited = sequence.slice(0, state.stepIndex);
    if (state.stepIndex >= sequence.length) {
      statusEl.textContent = `${capitalize(state.order)} complete. Order: ${sequence.join(' → ')}`;
      return;
    }

    if (state.stepIndex === 0) {
      statusEl.textContent = `${capitalize(state.order)} traversal. Start at root (${rootValue}). Step 0/${sequence.length}.`;
      return;
    }

    const lastVisited = visited[visited.length - 1];
    const nextNode = sequence[state.stepIndex];
    statusEl.textContent = `Step ${state.stepIndex}/${sequence.length}. Last: ${lastVisited}. Next: ${nextNode}.`;
  }

  function drawTree() {
    const { width, height } = state;
    if (width <= 0 || height <= 0) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const sequence = getSequence();
    const visited = new Set(sequence.slice(0, state.stepIndex));
    let current = null;
    if (state.stepIndex === 0) {
      current = rootValue;
    } else if (state.stepIndex < sequence.length) {
      current = sequence[state.stepIndex];
    }

    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 2;
    for (const node of treeNodes) {
      if (node.left != null) {
        const child = nodeMap.get(node.left);
        if (child) {
          ctx.beginPath();
          ctx.moveTo(node.x * width, node.y * height);
          ctx.lineTo(child.x * width, child.y * height);
          ctx.stroke();
        }
      }
      if (node.right != null) {
        const child = nodeMap.get(node.right);
        if (child) {
          ctx.beginPath();
          ctx.moveTo(node.x * width, node.y * height);
          ctx.lineTo(child.x * width, child.y * height);
          ctx.stroke();
        }
      }
    }

    const radius = Math.max(16, Math.min(24, Math.round(Math.min(width, height) * 0.05)));

    for (const node of treeNodes) {
      const x = node.x * width;
      const y = node.y * height;
      let stroke = defaultNodeColor;
      let lineWidth = 2;

      if (visited.has(node.value)) {
        stroke = visitedColor;
        lineWidth = 3;
      }
      if (node.value === current) {
        stroke = currentColor;
        lineWidth = 4;
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      ctx.fillStyle = labelColor;
      ctx.font = '700 18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
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

    const sequence = getSequence();
    prevBtn.disabled = state.stepIndex <= 0;
    nextBtn.disabled = state.stepIndex >= sequence.length;
  }

  orderSelect.addEventListener('change', () => {
    state.order = orderSelect.value;
    state.stepIndex = 0;
    render();
  });

  prevBtn.addEventListener('click', () => {
    if (state.stepIndex <= 0) return;
    state.stepIndex -= 1;
    render();
  });

  nextBtn.addEventListener('click', () => {
    const sequence = getSequence();
    if (state.stepIndex >= sequence.length) return;
    state.stepIndex += 1;
    render();
  });

  resetBtn.addEventListener('click', () => {
    state.stepIndex = 0;
    render();
  });

  const ro = new ResizeObserver(() => {
    render();
  });
  ro.observe(canvas);

  render();

  createVisualizationAutoplaySkill({
    enabled: !reduceMotion,
    stepInterval: 1000,
    donePause: 1800,
    isDone: () => state.stepIndex >= getSequence().length,
    onStep: () => {
      const sequence = getSequence();
      if (state.stepIndex >= sequence.length) return;
      state.stepIndex += 1;
      render();
    },
    onReset: () => {
      state.stepIndex = 0;
      render();
    },
  });
}

function getRandomIntInclusive(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

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

  const BUCKETS_COUNT = 10;
  const SAMPLE_SIZE = 12;
  const HASH_ANIMATION_MS = 650;
  const reduceMotion = getReducedMotion();

  const colorEdge = numberToCssHex(COLOR_EDGE);
  const colorLabel = COLOR_LABEL;
  const colorCurrent = numberToCssHex(COLOR_MEET);
  const colorInserted = numberToCssHex(COLOR_TORTOISE);
  const colorPending = numberToCssHex(COLOR_NODE);

  const state = {
    numbers: [],
    stepIndex: 0,
    width: 0,
    height: 0,
    animation: null,
  };

  function createNumbers() {
    const nums = [];
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      nums.push(getRandomIntInclusive(0, 100));
    }
    return nums;
  }

  function getBuckets() {
    const buckets = Array.from({ length: BUCKETS_COUNT }, () => []);
    for (let i = 0; i < state.stepIndex; i++) {
      const value = state.numbers[i];
      const bucket = value % BUCKETS_COUNT;
      buckets[bucket].push(value);
    }
    return buckets;
  }

  function setStatus() {
    if (state.numbers.length === 0) {
      statusEl.textContent = 'Generate numbers to start.';
      return;
    }

    if (state.animation) {
      const value = state.animation.value;
      const bucket = value % BUCKETS_COUNT;
      statusEl.textContent = `Dropping ${value} into bucket ${bucket} (hash: ${value} % ${BUCKETS_COUNT}).`;
      return;
    }

    if (state.stepIndex >= state.numbers.length) {
      statusEl.textContent = `Done. Inserted ${state.numbers.length}/${state.numbers.length} values into ${BUCKETS_COUNT} buckets.`;
      return;
    }

    const current = state.numbers[state.stepIndex];
    const bucket = current % BUCKETS_COUNT;
    statusEl.textContent = `Step ${state.stepIndex}/${state.numbers.length}: next ${current} → bucket ${bucket} (hash: ${current} % ${BUCKETS_COUNT}).`;
  }

  function getInputLayout(width) {
    const top = 18;
    const left = 18;
    const right = width - 18;
    const gap = 8;
    const slotW = Math.max(38, Math.floor((right - left - gap * (SAMPLE_SIZE - 1)) / SAMPLE_SIZE));
    const radius = Math.max(14, Math.min(20, Math.floor(slotW * 0.38)));
    const rowCenterY = top + 34;
    return { top, left, gap, slotW, radius, rowCenterY };
  }

  function getInputBallCenter(index, width) {
    const layout = getInputLayout(width);
    const x = layout.left + index * (layout.slotW + layout.gap) + layout.slotW / 2;
    const y = layout.rowCenterY;
    return { x, y, radius: layout.radius };
  }

  function getBucketLayout(startY, width, height) {
    const marginX = 18;
    const cols = 5;
    const rows = 2;
    const gapX = 10;
    const gapY = 10;
    const bucketW = Math.floor((width - marginX * 2 - gapX * (cols - 1)) / cols);
    const availableH = Math.max(220, height - startY - 18);
    const bucketH = Math.floor((availableH - gapY) / rows);
    const boxes = [];

    for (let i = 0; i < BUCKETS_COUNT; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = marginX + col * (bucketW + gapX);
      const y = startY + row * (bucketH + gapY);
      boxes.push({ x, y, w: bucketW, h: bucketH });
    }

    return { boxes };
  }

  function getBucketBallSlot(bucketLayout, bucketIndex, slotIndex) {
    const box = bucketLayout.boxes[bucketIndex];
    const radius = Math.max(9, Math.min(13, Math.floor(box.w * 0.12)));
    const rowCapacity = Math.max(1, Math.floor((box.w - 20) / (radius * 2 + 6)));
    const row = Math.floor(slotIndex / rowCapacity);
    const col = slotIndex % rowCapacity;
    const x = box.x + 14 + radius + col * (radius * 2 + 6);
    const y = box.y + 34 + radius + row * (radius * 2 + 6);
    return { x, y, radius };
  }

  function drawBall(x, y, radius, stroke, value, lineWidth = 2) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    ctx.fillStyle = colorLabel;
    ctx.font = '700 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), x, y);
  }

  function drawNumberStrip(width) {
    const layout = getInputLayout(width);

    ctx.fillStyle = colorLabel;
    ctx.font = '600 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Input numbers (0-100)', layout.left, layout.top);

    for (let i = 0; i < state.numbers.length; i++) {
      if (state.animation && i === state.stepIndex) continue;

      const { x, y, radius } = getInputBallCenter(i, width);
      let stroke = colorPending;
      let lineWidth = 2;
      if (i < state.stepIndex) {
        stroke = colorInserted;
        lineWidth = 2.5;
      }
      if (i === state.stepIndex && state.stepIndex < state.numbers.length) {
        stroke = colorCurrent;
        lineWidth = 3;
      }

      drawBall(x, y, radius, stroke, state.numbers[i], lineWidth);
    }

    return layout.rowCenterY + layout.radius + 20;
  }

  function drawBuckets(startY, width, height) {
    const buckets = getBuckets();
    const layout = getBucketLayout(startY, width, height);

    for (let i = 0; i < BUCKETS_COUNT; i++) {
      const box = layout.boxes[i];
      const x = box.x;
      const y = box.y;
      const bucketW = box.w;
      const bucketH = box.h;

      ctx.beginPath();
      ctx.roundRect(x, y, bucketW, bucketH, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = colorEdge;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.fillStyle = colorLabel;
      ctx.font = '700 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Bucket ${i}`, x + bucketW / 2, y + 16);

      const values = buckets[i];
      for (let j = 0; j < values.length; j++) {
        const pos = getBucketBallSlot(layout, i, j);
        if (pos.y + pos.radius > y + bucketH - 10) break;
        drawBall(pos.x, pos.y, pos.radius, colorInserted, values[j], 2);
      }
    }

    return layout;
  }

  function draw() {
    const { width, height } = state;
    if (width <= 0 || height <= 0) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const bucketsStartY = drawNumberStrip(width);
    const bucketLayout = drawBuckets(bucketsStartY, width, height);

    if (state.animation) {
      const progress = Math.min(1, state.animation.progress);
      const eased = 1 - Math.pow(1 - progress, 3);
      const x = state.animation.fromX + (state.animation.toX - state.animation.fromX) * eased;
      const y = state.animation.fromY + (state.animation.toY - state.animation.fromY) * eased;
      const slot = getBucketBallSlot(bucketLayout, state.animation.bucket, state.animation.slotIndex);
      drawBall(x, y, slot.radius, colorCurrent, state.animation.value, 3);
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
    const bucket = value % BUCKETS_COUNT;
    const currentBuckets = getBuckets();
    const slotIndex = currentBuckets[bucket].length;

    const from = getInputBallCenter(state.stepIndex, width);
    const bucketLayout = getBucketLayout(from.y + from.radius + 20, width, height);
    const target = getBucketBallSlot(bucketLayout, bucket, slotIndex);

    state.animation = {
      value,
      bucket,
      slotIndex,
      fromX: from.x,
      fromY: from.y,
      toX: target.x,
      toY: target.y,
      startTs: performance.now(),
      progress: 0,
    };

    function tick(ts) {
      if (!state.animation) return;
      const elapsed = ts - state.animation.startTs;
      state.animation.progress = elapsed / HASH_ANIMATION_MS;
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

  generateBtn.addEventListener('click', () => {
    regenerate();
  });

  nextBtn.addEventListener('click', () => {
    if (state.stepIndex >= state.numbers.length || state.animation) return;
    if (reduceMotion) {
      state.stepIndex += 1;
      render();
      return;
    }
    startInsertAnimation();
  });

  resetBtn.addEventListener('click', () => {
    state.animation = null;
    state.stepIndex = 0;
    render();
  });

  const ro = new ResizeObserver(() => {
    render();
  });
  ro.observe(canvas);

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
    onReset: () => {
      regenerate();
    },
  });
}

function initFibonacciVisualization() {
  const canvas = document.getElementById('fibCanvas');
  const statusEl = document.getElementById('fibStatus');
  const prevBtn = document.getElementById('fibPrev');
  const nextBtn = document.getElementById('fibNext');
  const resetBtn = document.getElementById('fibReset');

  if (!canvas || !statusEl || !prevBtn || !nextBtn || !resetBtn) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    statusEl.textContent = 'Canvas 2D is not available.';
    statusEl.classList.add('is-error');
    return;
  }

  const reduceMotion = getReducedMotion();
  const n = 10;
  const colorEdge = numberToCssHex(COLOR_EDGE);
  const colorLabel = COLOR_LABEL;
  const colorCurrent = numberToCssHex(COLOR_MEET);
  const colorComputed = numberToCssHex(COLOR_TORTOISE);
  const colorPending = numberToCssHex(COLOR_NODE);

  function buildSnapshots() {
    const dp = Array(n + 1).fill(null);
    dp[0] = 0;
    dp[1] = 1;

    const snapshots = [
      {
        dp: [...dp],
        current: null,
        text: 'Base cases: F(0)=0, F(1)=1. Ready to compute from i=2.',
        calc: null,
      },
    ];

    for (let i = 2; i <= n; i++) {
      dp[i] = dp[i - 1] + dp[i - 2];
      snapshots.push({
        dp: [...dp],
        current: i,
        text: `i=${i}: F(${i}) = F(${i - 1}) + F(${i - 2}) = ${dp[i - 1]} + ${dp[i - 2]} = ${dp[i]}`,
        calc: {
          i,
          leftIndex: i - 1,
          rightIndex: i - 2,
          leftValue: dp[i - 1],
          rightValue: dp[i - 2],
          result: dp[i],
        },
      });
    }

    snapshots.push({
      dp: [...dp],
      current: null,
      text: `Done. F(${n}) = ${dp[n]}.`,
      calc: null,
    });

    return snapshots;
  }

  const snapshots = buildSnapshots();
  const state = {
    stepIndex: 0,
    width: 0,
    height: 0,
    animation: null,
  };

  const FIB_ANIMATION_MS = 700;

  function getLayout(width, height) {
    const marginX = 16;
    const gap = 8;
    const cellW = Math.max(40, Math.floor((width - marginX * 2 - n * gap) / (n + 1)));
    const cellH = Math.max(56, Math.min(76, Math.floor(height * 0.36)));
    const usedW = cellW * (n + 1) + gap * n;
    const startX = Math.max(12, Math.floor((width - usedW) / 2));
    const y = Math.max(78, Math.floor((height - cellH) / 2));
    return { gap, cellW, cellH, startX, y };
  }

  function getCellCenter(layout, index) {
    return {
      x: layout.startX + index * (layout.cellW + layout.gap) + layout.cellW / 2,
      y: layout.y + layout.cellH / 2,
    };
  }

  function draw() {
    const { width, height } = state;
    if (width <= 0 || height <= 0) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const layout = getLayout(width, height);
    const baseSnapshot = snapshots[state.stepIndex];
    const activeSnapshot = state.animation ? snapshots[state.animation.toIndex] : baseSnapshot;
    const animationProgress = state.animation ? easeInOutCubic(state.animation.progress) : 0;
    const activeCalc = state.animation
      ? snapshots[state.animation.toIndex].calc
      : snapshots[state.stepIndex].calc;

    ctx.fillStyle = colorLabel;
    ctx.font = '600 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`n = ${n}`, 16, 20);

    if (activeCalc) {
      const eq = `F(${activeCalc.i}) = F(${activeCalc.leftIndex}) + F(${activeCalc.rightIndex}) = ${activeCalc.leftValue} + ${activeCalc.rightValue}`;
      const showResult = !state.animation || animationProgress > 0.68;
      ctx.fillText(showResult ? `${eq} = ${activeCalc.result}` : eq, 16, 42);
    }

    for (let i = 0; i <= n; i++) {
      const x = layout.startX + i * (layout.cellW + layout.gap);
      let value = baseSnapshot.dp[i];

      if (!state.animation) {
        value = activeSnapshot.dp[i];
      } else if (activeCalc && i !== activeCalc.i && i <= activeCalc.leftIndex) {
        value = activeSnapshot.dp[i];
      } else if (activeCalc && i === activeCalc.i && animationProgress > 0.75) {
        value = activeSnapshot.dp[i];
      }

      let stroke = colorPending;
      let lineWidth = 2;
      if (value != null) {
        stroke = colorComputed;
      }
      if (activeSnapshot.current === i) {
        stroke = colorCurrent;
        lineWidth = 3;
      }

      ctx.beginPath();
      ctx.roundRect(x, layout.y, layout.cellW, layout.cellH, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      ctx.fillStyle = colorLabel;
      ctx.font = '600 11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`i=${i}`, x + layout.cellW / 2, layout.y + 14);

      ctx.font = '700 17px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.fillText(value == null ? '-' : String(value), x + layout.cellW / 2, layout.y + layout.cellH / 2 + 8);
    }

    if (state.animation && activeCalc) {
      const leftPos = getCellCenter(layout, activeCalc.leftIndex);
      const rightPos = getCellCenter(layout, activeCalc.rightIndex);
      const targetPos = getCellCenter(layout, activeCalc.i);
      const travel = easeOutCubic(animationProgress);

      const leftX = lerp(leftPos.x, targetPos.x, travel);
      const leftY = lerp(leftPos.y, targetPos.y - 18, travel);
      const rightX = lerp(rightPos.x, targetPos.x, travel);
      const rightY = lerp(rightPos.y, targetPos.y + 18, travel);

      ctx.globalAlpha = animationProgress < 0.85 ? 1 : 1 - (animationProgress - 0.85) / 0.15;

      ctx.beginPath();
      ctx.arc(leftX, leftY, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = colorCurrent;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = colorLabel;
      ctx.font = '700 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(activeCalc.leftValue), leftX, leftY + 1);

      ctx.beginPath();
      ctx.arc(rightX, rightY, 14, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = colorCurrent;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = colorLabel;
      ctx.fillText(String(activeCalc.rightValue), rightX, rightY + 1);
      ctx.globalAlpha = 1;
    }
  }

  function setStatus() {
    if (state.animation) {
      statusEl.textContent = snapshots[state.animation.toIndex].text;
      return;
    }
    statusEl.textContent = snapshots[state.stepIndex].text;
  }

  function render() {
    const { width, height } = resize2dCanvas(canvas);
    state.width = width;
    state.height = height;
    draw();
    setStatus();
    prevBtn.disabled = state.stepIndex <= 0 || state.animation !== null;
    nextBtn.disabled = state.stepIndex >= snapshots.length - 1 || state.animation !== null;
  }

  function runStepAnimation(targetIndex) {
    if (state.animation || targetIndex <= state.stepIndex || reduceMotion) {
      state.stepIndex = targetIndex;
      render();
      return;
    }

    state.animation = {
      toIndex: targetIndex,
      startTs: performance.now(),
      progress: 0,
    };

    function tick(ts) {
      if (!state.animation) return;
      const elapsed = ts - state.animation.startTs;
      state.animation.progress = clamp01(elapsed / FIB_ANIMATION_MS);

      if (state.animation.progress >= 1) {
        state.stepIndex = state.animation.toIndex;
        state.animation = null;
        render();
        return;
      }

      render();
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  prevBtn.addEventListener('click', () => {
    if (state.stepIndex <= 0) return;
    state.stepIndex -= 1;
    render();
  });

  nextBtn.addEventListener('click', () => {
    if (state.stepIndex >= snapshots.length - 1 || state.animation) return;
    runStepAnimation(state.stepIndex + 1);
  });

  resetBtn.addEventListener('click', () => {
    state.stepIndex = 0;
    state.animation = null;
    render();
  });

  const ro = new ResizeObserver(() => {
    render();
  });
  ro.observe(canvas);

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
      state.stepIndex = 0;
      state.animation = null;
      render();
    },
  });
}

function initMergeListsVisualization() {
  const canvas = document.getElementById('mergeListsCanvas');
  const statusEl = document.getElementById('mergeListsStatus');
  const prevBtn = document.getElementById('mergeListsPrev');
  const nextBtn = document.getElementById('mergeListsNext');
  const resetBtn = document.getElementById('mergeListsReset');

  if (!canvas || !statusEl || !prevBtn || !nextBtn || !resetBtn) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    statusEl.textContent = 'Canvas 2D is not available.';
    statusEl.classList.add('is-error');
    return;
  }

  const reduceMotion = getReducedMotion();
  const list1 = [1, 2, 4];
  const list2 = [1, 3, 4];

  const colorLabel = COLOR_LABEL;
  const colorCurrent = numberToCssHex(COLOR_MEET);
  const colorConsumed = numberToCssHex(COLOR_TORTOISE);
  const colorPending = numberToCssHex(COLOR_NODE);

  const MERGE_LISTS_ANIMATION_MS = 700;

  function buildSnapshots() {
    const snapshots = [];
    let p1 = 0;
    let p2 = 0;
    const merged = [];

    snapshots.push({
      p1,
      p2,
      merged: [...merged],
      text: 'Start merge. Compare list1[p1] and list2[p2], take the smaller value.',
      picked: null,
      pickedFrom: null,
      pickedSourceIndex: null,
      mergedIndex: null,
    });

    while (p1 < list1.length && p2 < list2.length) {
      const takeLeft = list1[p1] <= list2[p2];
      const value = takeLeft ? list1[p1] : list2[p2];
      merged.push(value);
      if (takeLeft) p1 += 1;
      else p2 += 1;

      snapshots.push({
        p1,
        p2,
        merged: [...merged],
        text: takeLeft
          ? `Take ${value} from list1 (stable on ties).`
          : `Take ${value} from list2.`,
        picked: value,
        pickedFrom: takeLeft ? 'list1' : 'list2',
        pickedSourceIndex: takeLeft ? p1 - 1 : p2 - 1,
        mergedIndex: merged.length - 1,
      });
    }

    while (p1 < list1.length) {
      const value = list1[p1];
      merged.push(value);
      p1 += 1;
      snapshots.push({
        p1,
        p2,
        merged: [...merged],
        text: `List2 is exhausted. Append remaining ${value} from list1.`,
        picked: value,
        pickedFrom: 'list1',
        pickedSourceIndex: p1 - 1,
        mergedIndex: merged.length - 1,
      });
    }

    while (p2 < list2.length) {
      const value = list2[p2];
      merged.push(value);
      p2 += 1;
      snapshots.push({
        p1,
        p2,
        merged: [...merged],
        text: `List1 is exhausted. Append remaining ${value} from list2.`,
        picked: value,
        pickedFrom: 'list2',
        pickedSourceIndex: p2 - 1,
        mergedIndex: merged.length - 1,
      });
    }

    snapshots.push({
      p1,
      p2,
      merged: [...merged],
      text: `Done. Merged list: ${merged.join(' → ')}.`,
      picked: null,
      pickedFrom: null,
      pickedSourceIndex: null,
      mergedIndex: null,
    });

    return snapshots;
  }

  const snapshots = buildSnapshots();
  const totalMergedLen = list1.length + list2.length;
  const state = {
    stepIndex: 0,
    width: 0,
    height: 0,
    animation: null,
  };

  function getRowLayout(totalSlots) {
    const marginX = 42;
    const gap = 12;
    const radius = Math.max(16, Math.min(24, Math.floor((state.width - marginX * 2 - gap * (totalSlots - 1)) / (totalSlots * 2.4))));
    const totalWidth = totalSlots * radius * 2 + (totalSlots - 1) * gap;
    const startX = Math.max(24, Math.floor((state.width - totalWidth) / 2));
    return { radius, gap, startX };
  }

  function getNodeCenter(rowY, totalSlots, index) {
    const layout = getRowLayout(totalSlots);
    return {
      x: layout.startX + layout.radius + index * (layout.radius * 2 + layout.gap),
      y: rowY + layout.radius,
      radius: layout.radius,
    };
  }

  function drawRow(label, values, y, options = {}) {
    const { pointerIndex = null, consumed = 0, totalSlots = values.length, mergedLen = 0 } = options;
    const layout = getRowLayout(totalSlots);

    ctx.fillStyle = colorLabel;
    ctx.font = '700 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 14, y + layout.radius);

    for (let i = 0; i < totalSlots - 1; i++) {
      const a = getNodeCenter(y, totalSlots, i);
      const b = getNodeCenter(y, totalSlots, i + 1);
      ctx.strokeStyle = numberToCssHex(COLOR_EDGE);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(a.x + a.radius, a.y);
      ctx.lineTo(b.x - b.radius, b.y);
      ctx.stroke();

      ctx.fillStyle = numberToCssHex(COLOR_EDGE);
      ctx.font = '700 10px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▶', (a.x + b.x) / 2, a.y - 1);
    }

    for (let i = 0; i < totalSlots; i++) {
      const center = getNodeCenter(y, totalSlots, i);
      const hasValue = i < values.length;

      let stroke = colorPending;
      let lineWidth = 2;
      if (i < consumed || (label === 'merged' && i < mergedLen)) {
        stroke = colorConsumed;
      }
      if (pointerIndex != null && i === pointerIndex) {
        stroke = colorCurrent;
        lineWidth = 3;
      }

      ctx.beginPath();
      ctx.arc(center.x, center.y, center.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      if (hasValue) {
        ctx.fillStyle = colorLabel;
        ctx.font = '700 16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(values[i]), center.x, center.y + 1);
      }

      if (pointerIndex != null && i === pointerIndex) {
        ctx.fillStyle = colorCurrent;
        ctx.font = '700 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↑', center.x, y - 14);
      }
    }
  }

  function draw() {
    const { width, height } = state;
    if (width <= 0 || height <= 0) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const snapshot = snapshots[state.stepIndex];
    const rowGap = Math.max(24, Math.floor((height - 3 * 52 - 32) / 3));
    const y1 = 22;
    const y2 = y1 + 52 + rowGap;
    const y3 = y2 + 52 + rowGap;

    drawRow('list1', list1, y1, {
      pointerIndex: snapshot.p1 < list1.length ? snapshot.p1 : null,
      consumed: snapshot.p1,
    });
    drawRow('list2', list2, y2, {
      pointerIndex: snapshot.p2 < list2.length ? snapshot.p2 : null,
      consumed: snapshot.p2,
    });
    drawRow('merged', snapshot.merged, y3, {
      pointerIndex: snapshot.merged.length > 0 ? snapshot.merged.length - 1 : null,
      totalSlots: totalMergedLen,
      mergedLen: snapshot.merged.length,
    });

    if (state.animation) {
      const anim = state.animation;
      const toSnapshot = snapshots[anim.toIndex];
      if (toSnapshot.picked != null && toSnapshot.pickedFrom != null && toSnapshot.pickedSourceIndex != null && toSnapshot.mergedIndex != null) {
        const p = easeInOutCubic(anim.progress);
        const sourceRowY = toSnapshot.pickedFrom === 'list1' ? y1 : y2;
        const sourceSlots = toSnapshot.pickedFrom === 'list1' ? list1.length : list2.length;
        const sourceCenter = getNodeCenter(sourceRowY, sourceSlots, toSnapshot.pickedSourceIndex);
        const targetCenter = getNodeCenter(y3, totalMergedLen, toSnapshot.mergedIndex);

        const xPos = lerp(sourceCenter.x, targetCenter.x, p);
        const arcLift = Math.sin(p * Math.PI) * 34;
        const yPos = lerp(sourceCenter.y, targetCenter.y, p) + arcLift;

        ctx.beginPath();
        ctx.arc(xPos, yPos, sourceCenter.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = colorCurrent;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = colorLabel;
        ctx.font = '700 16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(toSnapshot.picked), xPos, yPos + 1);
      }
    }
  }

  function render() {
    const { width, height } = resize2dCanvas(canvas);
    state.width = width;
    state.height = height;
    draw();
    statusEl.textContent = state.animation
      ? snapshots[state.animation.toIndex].text
      : snapshots[state.stepIndex].text;
    prevBtn.disabled = state.stepIndex <= 0 || state.animation !== null;
    nextBtn.disabled = state.stepIndex >= snapshots.length - 1 || state.animation !== null;
  }

  function runStepAnimation(targetIndex) {
    if (state.animation || targetIndex <= state.stepIndex || reduceMotion) {
      state.stepIndex = targetIndex;
      render();
      return;
    }

    state.animation = {
      toIndex: targetIndex,
      startTs: performance.now(),
      progress: 0,
    };

    function tick(ts) {
      if (!state.animation) return;
      const elapsed = ts - state.animation.startTs;
      state.animation.progress = clamp01(elapsed / MERGE_LISTS_ANIMATION_MS);

      if (state.animation.progress >= 1) {
        state.stepIndex = state.animation.toIndex;
        state.animation = null;
        render();
        return;
      }

      render();
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  prevBtn.addEventListener('click', () => {
    if (state.stepIndex <= 0) return;
    state.stepIndex -= 1;
    render();
  });

  nextBtn.addEventListener('click', () => {
    if (state.stepIndex >= snapshots.length - 1 || state.animation) return;
    runStepAnimation(state.stepIndex + 1);
  });

  resetBtn.addEventListener('click', () => {
    state.stepIndex = 0;
    state.animation = null;
    render();
  });

  const ro = new ResizeObserver(() => {
    render();
  });
  ro.observe(canvas);

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
      state.stepIndex = 0;
      state.animation = null;
      render();
    },
  });
}

function initMergeArrayVisualization() {
  const canvas = document.getElementById('mergeArrayCanvas');
  const statusEl = document.getElementById('mergeArrayStatus');
  const prevBtn = document.getElementById('mergeArrayPrev');
  const nextBtn = document.getElementById('mergeArrayNext');
  const resetBtn = document.getElementById('mergeArrayReset');

  if (!canvas || !statusEl || !prevBtn || !nextBtn || !resetBtn) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    statusEl.textContent = 'Canvas 2D is not available.';
    statusEl.classList.add('is-error');
    return;
  }

  const reduceMotion = getReducedMotion();
  const nums1Initial = [1, 2, 3, 0, 0, 0];
  const m = 3;
  const nums2 = [2, 5, 6];
  const n = 3;

  const colorLabel = COLOR_LABEL;
  const colorCurrent = numberToCssHex(COLOR_MEET);
  const colorCommitted = numberToCssHex(COLOR_TORTOISE);
  const colorPending = numberToCssHex(COLOR_NODE);

  function buildSnapshots() {
    const snapshots = [];
    const arr = [...nums1Initial];
    let i = m - 1;
    let j = n - 1;
    let k = m + n - 1;

    snapshots.push({
      arr: [...arr],
      i,
      j,
      k,
      writeIndex: null,
      text: 'Start from the back. Compare nums1[i] and nums2[j], write larger into nums1[k].',
    });

    while (i >= 0 && j >= 0) {
      if (arr[i] > nums2[j]) {
        const value = arr[i];
        arr[k] = value;
        snapshots.push({
          arr: [...arr],
          i: i - 1,
          j,
          k: k - 1,
          writeIndex: k,
          text: `Write ${value} from nums1[${i}] into nums1[${k}].`,
        });
        i -= 1;
      } else {
        const value = nums2[j];
        arr[k] = value;
        snapshots.push({
          arr: [...arr],
          i,
          j: j - 1,
          k: k - 1,
          writeIndex: k,
          text: `Write ${value} from nums2[${j}] into nums1[${k}].`,
        });
        j -= 1;
      }
      k -= 1;
    }

    while (j >= 0) {
      const value = nums2[j];
      arr[k] = value;
      snapshots.push({
        arr: [...arr],
        i,
        j: j - 1,
        k: k - 1,
        writeIndex: k,
        text: `nums1 is exhausted. Copy ${value} from nums2[${j}] into nums1[${k}].`,
      });
      j -= 1;
      k -= 1;
    }

    snapshots.push({
      arr: [...arr],
      i,
      j,
      k,
      writeIndex: null,
      text: `Done. nums1 = [${arr.join(', ')}].`,
    });

    return snapshots;
  }

  const snapshots = buildSnapshots();
  const state = {
    stepIndex: 0,
    width: 0,
    height: 0,
  };

  function drawArrayRow(label, values, y, options = {}) {
    const { pointerIndex = null, highlightIndex = null, activeLen = values.length } = options;
    const marginX = 24;
    const gap = 10;
    const slots = values.length;
    const cellW = Math.max(42, Math.floor((state.width - marginX * 2 - gap * (slots - 1)) / slots));
    const cellH = 48;
    const startX = Math.max(14, Math.floor((state.width - (cellW * slots + gap * (slots - 1))) / 2));

    ctx.fillStyle = colorLabel;
    ctx.font = '700 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 12, y + cellH / 2);

    for (let idx = 0; idx < slots; idx++) {
      const x = startX + idx * (cellW + gap);
      let stroke = idx < activeLen ? colorCommitted : colorPending;
      let lineWidth = 2;
      if (highlightIndex != null && idx === highlightIndex) {
        stroke = colorCurrent;
        lineWidth = 3;
      }
      if (pointerIndex != null && idx === pointerIndex) {
        stroke = colorCurrent;
        lineWidth = 3;
      }

      ctx.beginPath();
      ctx.roundRect(x, y, cellW, cellH, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      ctx.fillStyle = colorLabel;
      ctx.font = '700 16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(values[idx]), x + cellW / 2, y + cellH / 2 + 1);

      if (pointerIndex != null && idx === pointerIndex) {
        ctx.fillStyle = colorCurrent;
        ctx.font = '700 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
        ctx.fillText('↑', x + cellW / 2, y - 10);
      }
    }
  }

  function draw() {
    const { width, height } = state;
    if (width <= 0 || height <= 0) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const snapshot = snapshots[state.stepIndex];
    const y1 = 38;
    const y2 = y1 + 48 + 42;

    drawArrayRow('nums1', snapshot.arr, y1, {
      pointerIndex: snapshot.k >= 0 ? snapshot.k : null,
      highlightIndex: snapshot.writeIndex,
      activeLen: snapshot.k + 1,
    });
    drawArrayRow('nums2', nums2, y2, {
      pointerIndex: snapshot.j >= 0 ? snapshot.j : null,
      activeLen: nums2.length,
    });

    ctx.fillStyle = colorLabel;
    ctx.font = '600 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`i = ${Math.max(snapshot.i, -1)}, j = ${Math.max(snapshot.j, -1)}, k = ${Math.max(snapshot.k, -1)}`, 16, height - 16);
  }

  function render() {
    const { width, height } = resize2dCanvas(canvas);
    state.width = width;
    state.height = height;
    draw();
    statusEl.textContent = snapshots[state.stepIndex].text;
    prevBtn.disabled = state.stepIndex <= 0;
    nextBtn.disabled = state.stepIndex >= snapshots.length - 1;
  }

  prevBtn.addEventListener('click', () => {
    if (state.stepIndex <= 0) return;
    state.stepIndex -= 1;
    render();
  });

  nextBtn.addEventListener('click', () => {
    if (state.stepIndex >= snapshots.length - 1) return;
    state.stepIndex += 1;
    render();
  });

  resetBtn.addEventListener('click', () => {
    state.stepIndex = 0;
    render();
  });

  const ro = new ResizeObserver(() => {
    render();
  });
  ro.observe(canvas);

  render();

  createVisualizationAutoplaySkill({
    enabled: !reduceMotion,
    stepInterval: 1000,
    donePause: 1800,
    isDone: () => state.stepIndex >= snapshots.length - 1,
    onStep: () => {
      if (state.stepIndex >= snapshots.length - 1) return;
      state.stepIndex += 1;
      render();
    },
    onReset: () => {
      state.stepIndex = 0;
      render();
    },
  });
}

function initSqrtBinarySearchVisualization() {
  const canvas = document.getElementById('sqrtCanvas');
  const statusEl = document.getElementById('sqrtStatus');
  const prevBtn = document.getElementById('sqrtPrev');
  const nextBtn = document.getElementById('sqrtNext');
  const resetBtn = document.getElementById('sqrtReset');

  if (!canvas || !statusEl || !prevBtn || !nextBtn || !resetBtn) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    statusEl.textContent = 'Canvas 2D is not available.';
    statusEl.classList.add('is-error');
    return;
  }

  const reduceMotion = getReducedMotion();
  const x = 26;
  const initialHi = Math.floor(x / 2) + 1;

  const colorLabel = COLOR_LABEL;
  const colorCurrent = numberToCssHex(COLOR_MEET);
  const colorLo = numberToCssHex(COLOR_TORTOISE);
  const colorHi = numberToCssHex(COLOR_HARE);
  const colorPending = numberToCssHex(COLOR_NODE);

  function buildSnapshots() {
    const snapshots = [];
    let lo = 0;
    let hi = initialHi;
    let ans = 0;

    snapshots.push({
      lo,
      hi,
      mid: null,
      ans,
      text: `Search in [${lo}, ${hi}] for floor sqrt of ${x}.`,
    });

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const square = mid * mid;

      snapshots.push({
        lo,
        hi,
        mid,
        ans,
        text: `Check mid=${mid}: ${mid}² = ${square}.`,
      });

      if (square === x) {
        ans = mid;
        snapshots.push({
          lo,
          hi,
          mid,
          ans,
          text: `Exact match at mid=${mid}. Answer is ${mid}.`,
        });
        break;
      }

      if (square < x) {
        ans = mid;
        lo = mid + 1;
        snapshots.push({
          lo,
          hi,
          mid,
          ans,
          text: `${square} < ${x}. Move lo to ${lo}; best so far is ${ans}.`,
        });
      } else {
        hi = mid - 1;
        snapshots.push({
          lo,
          hi,
          mid,
          ans,
          text: `${square} > ${x}. Move hi to ${hi}.`,
        });
      }
    }

    const last = snapshots[snapshots.length - 1];
    if (last.mid == null || !last.text.includes('Exact match')) {
      snapshots.push({
        lo,
        hi,
        mid: null,
        ans,
        text: `Done. ⌊√${x}⌋ = ${ans}.`,
      });
    }

    return snapshots;
  }

  const snapshots = buildSnapshots();
  const state = {
    stepIndex: 0,
    width: 0,
    height: 0,
    animation: null,
  };

  const SQRT_ANIMATION_MS = 620;

  function getCellCenter(startX, cellW, gap, value, y, cellH) {
    return {
      x: startX + value * (cellW + gap) + cellW / 2,
      y: y + cellH / 2,
    };
  }

  function drawMarker(label, color, value, startX, cellW, gap, y, cellH, offsetY = -26, alpha = 1) {
    if (value == null || value < 0 || value > initialHi) return;
    const center = getCellCenter(startX, cellW, gap, value, y, cellH);

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y - cellH / 2 - 3);
    ctx.lineTo(center.x, center.y + offsetY + 8);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(center.x, center.y + offsetY, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = '700 11px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, center.x, center.y + offsetY + 1);
    ctx.globalAlpha = 1;
  }

  function draw() {
    const { width, height } = state;
    if (width <= 0 || height <= 0) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const snapshot = snapshots[state.stepIndex];
    const toSnapshot = state.animation ? snapshots[state.animation.toIndex] : snapshot;
    const t = state.animation ? easeInOutCubic(state.animation.progress) : 1;

    const viewLo = state.animation
      ? lerp(snapshot.lo, toSnapshot.lo, t)
      : snapshot.lo;
    const viewHi = state.animation
      ? lerp(snapshot.hi, toSnapshot.hi, t)
      : snapshot.hi;

    const midFrom = snapshot.mid;
    const midTo = toSnapshot.mid;
    let viewMid = midTo;
    let midAlpha = 1;
    if (state.animation) {
      if (midFrom == null && midTo != null) {
        viewMid = midTo;
        midAlpha = t;
      } else if (midFrom != null && midTo == null) {
        viewMid = midFrom;
        midAlpha = 1 - t;
      } else if (midFrom != null && midTo != null) {
        viewMid = lerp(midFrom, midTo, t);
      }
    }

    const rangeMax = initialHi;
    const marginX = 24;
    const gap = 8;
    const slots = rangeMax + 1;
    const cellW = Math.max(24, Math.floor((width - marginX * 2 - gap * (slots - 1)) / slots));
    const cellH = 44;
    const rowW = cellW * slots + gap * (slots - 1);
    const startX = Math.max(14, Math.floor((width - rowW) / 2));
    const y = Math.max(72, Math.floor(height * 0.38));

    ctx.fillStyle = colorLabel;
    ctx.font = '600 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const ansValue = state.animation
      ? Math.round(lerp(snapshot.ans, toSnapshot.ans, t))
      : snapshot.ans;
    ctx.fillText(`x = ${x}`, 16, 20);
    ctx.fillText(`best = ${ansValue}`, 16, 40);

    for (let value = 0; value <= rangeMax; value++) {
      const xPos = startX + value * (cellW + gap);
      let stroke = colorPending;
      let lineWidth = 2;

      if (value >= Math.ceil(viewLo) && value <= Math.floor(viewHi)) {
        stroke = numberToCssHex(COLOR_EDGE);
      }
      if (Math.abs(value - viewLo) < 0.5) {
        stroke = colorLo;
        lineWidth = 3;
      }
      if (Math.abs(value - viewHi) < 0.5) {
        stroke = colorHi;
        lineWidth = 3;
      }
      if (viewMid != null && Math.abs(value - viewMid) < 0.5) {
        stroke = colorCurrent;
        lineWidth = 4;
      }

      ctx.beginPath();
      ctx.roundRect(xPos, y, cellW, cellH, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      ctx.fillStyle = colorLabel;
      ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(value), xPos + cellW / 2, y + cellH / 2 + 1);
    }

    drawMarker('lo', colorLo, viewLo, startX, cellW, gap, y, cellH, -28, 1);
    drawMarker('hi', colorHi, viewHi, startX, cellW, gap, y, cellH, -52, 1);
    drawMarker('mid', colorCurrent, viewMid, startX, cellW, gap, y, cellH, 56, midAlpha);
  }

  function render() {
    const { width, height } = resize2dCanvas(canvas);
    state.width = width;
    state.height = height;
    draw();
    statusEl.textContent = state.animation
      ? snapshots[state.animation.toIndex].text
      : snapshots[state.stepIndex].text;
    prevBtn.disabled = state.stepIndex <= 0 || state.animation !== null;
    nextBtn.disabled = state.stepIndex >= snapshots.length - 1 || state.animation !== null;
  }

  function runStepAnimation(targetIndex) {
    if (state.animation || targetIndex <= state.stepIndex || reduceMotion) {
      state.stepIndex = targetIndex;
      render();
      return;
    }

    state.animation = {
      toIndex: targetIndex,
      startTs: performance.now(),
      progress: 0,
    };

    function tick(ts) {
      if (!state.animation) return;
      const elapsed = ts - state.animation.startTs;
      state.animation.progress = clamp01(elapsed / SQRT_ANIMATION_MS);

      if (state.animation.progress >= 1) {
        state.stepIndex = state.animation.toIndex;
        state.animation = null;
        render();
        return;
      }

      render();
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  prevBtn.addEventListener('click', () => {
    if (state.stepIndex <= 0) return;
    state.stepIndex -= 1;
    render();
  });

  nextBtn.addEventListener('click', () => {
    if (state.stepIndex >= snapshots.length - 1 || state.animation) return;
    runStepAnimation(state.stepIndex + 1);
  });

  resetBtn.addEventListener('click', () => {
    state.stepIndex = 0;
    state.animation = null;
    render();
  });

  const ro = new ResizeObserver(() => {
    render();
  });
  ro.observe(canvas);

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
      state.stepIndex = 0;
      state.animation = null;
      render();
    },
  });
}

function init() {
  initFloydVisualization();
  initTreeTraversalVisualization();
  initHashTableVisualization();
  initFibonacciVisualization();
  initMergeListsVisualization();
  initMergeArrayVisualization();
  initSqrtBinarySearchVisualization();
}

init();
