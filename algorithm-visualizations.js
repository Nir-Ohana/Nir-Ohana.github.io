import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { getReducedMotion, supportsWebGL } from './bg-utils.js';

/* ── Config ─────────────────────────────────────────────────── */
const TAIL_LEN = 5;
const CYCLE_LEN = 8;
const STEP_INTERVAL = 800;          // ms between algorithm steps
const PAUSE_AFTER_DONE = 2400;      // ms before restarting
const NODE_RADIUS = 8;
const POINTER_RADIUS = 3.2;

const COLOR_NODE      = 0xd1d5db;   // grey wireframe
const COLOR_EDGE      = 0x6b7280;
const COLOR_TORTOISE  = 0x16a34a;   // green
const COLOR_HARE      = 0xdc2626;   // red
const COLOR_ENTRY     = 0x1d4ed8;   // accent blue
const COLOR_LABEL     = '#4b5563';

/* ── Linked-list helpers ────────────────────────────────────── */

function createList(tailLen, cycleLen) {
  const total = tailLen + cycleLen;
  const entry = tailLen;
  const next = new Array(total);
  for (let i = 0; i < total - 1; i++) next[i] = i + 1;
  next[total - 1] = entry;
  return { total, entry, next };
}

/** Returns 3-D positions (x, y on a plane, z = 0). */
function buildLayout(list, spread) {
  const { total, entry } = list;
  const cycleLen = total - entry;
  const positions = new Array(total);

  // Cycle ring
  const ringR = cycleLen * spread / (2 * Math.PI);
  const cx = 0;
  const cy = 0;
  for (let k = 0; k < cycleLen; k++) {
    const angle = -Math.PI / 2 + (k / cycleLen) * Math.PI * 2;
    positions[entry + k] = new THREE.Vector3(
      cx + ringR * Math.cos(angle),
      cy + ringR * Math.sin(angle),
      0,
    );
  }

  // Tail stretching to the left of the entry
  const entryPos = positions[entry];
  const gap = spread;
  for (let i = 0; i < entry; i++) {
    const dist = (entry - i) * gap;
    positions[i] = new THREE.Vector3(entryPos.x - dist, entryPos.y, 0);
  }

  return positions;
}

/* ── Text sprite factory ────────────────────────────────────── */

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

/* ── Three.js scene setup ───────────────────────────────────── */

function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();

  // Perspective camera, tilted so you can see the 3-D wireframes
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

/* ── Build the visual graph ─────────────────────────────────── */

function buildGraph(scene, list, positions) {
  const group = new THREE.Group();

  const nodeGeom = new THREE.IcosahedronGeometry(NODE_RADIUS, 1);
  const nodeMat = new THREE.MeshBasicMaterial({ color: COLOR_NODE, wireframe: true });
  const entryMat = new THREE.MeshBasicMaterial({ color: COLOR_ENTRY, wireframe: true });
  const tortoiseNodeMat = new THREE.MeshBasicMaterial({ color: COLOR_TORTOISE, wireframe: true });
  const hareNodeMat = new THREE.MeshBasicMaterial({ color: COLOR_HARE, wireframe: true });
  const overlapNodeMat = new THREE.MeshBasicMaterial({ color: COLOR_ENTRY, wireframe: true });

  const nodes = [];
  const labels = [];

  for (let i = 0; i < list.total; i++) {
    const p = positions[i];
    const mat = i === list.entry ? entryMat : nodeMat;
    const mesh = new THREE.Mesh(nodeGeom, mat);
    mesh.position.copy(p);
    group.add(mesh);
    nodes.push(mesh);

    const label = makeTextSprite(String(i), COLOR_LABEL, 36);
    label.position.set(p.x, p.y, NODE_RADIUS + 6);
    label.scale.set(10, 10, 1);
    group.add(label);
    labels.push(label);
  }

  // Edges
  const edgeVerts = new Float32Array(list.total * 6);
  for (let i = 0; i < list.total; i++) {
    const a = positions[i];
    const b = positions[list.next[i]];
    const base = i * 6;
    edgeVerts[base]     = a.x;
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

  // Pointer meshes (tortoise = green sphere, hare = red sphere)
  const ptrGeom = new THREE.IcosahedronGeometry(POINTER_RADIUS, 2);
  const tortoiseMat = new THREE.MeshBasicMaterial({ color: COLOR_TORTOISE, wireframe: true });
  const hareMat = new THREE.MeshBasicMaterial({ color: COLOR_HARE, wireframe: true });

  const tortoiseMesh = new THREE.Mesh(ptrGeom, tortoiseMat);
  const hareMesh = new THREE.Mesh(ptrGeom, hareMat);
  tortoiseMesh.renderOrder = 5;
  hareMesh.renderOrder = 5;
  group.add(tortoiseMesh);
  group.add(hareMesh);

  // Pointer label sprites
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
    labels,
    tortoiseMesh,
    hareMesh,
    tLabel,
    hLabel,
    materials: { nodeMat, entryMat, tortoiseNodeMat, hareNodeMat, overlapNodeMat },
  };
}

function colorActiveNodes(graph, list, tIdx, hIdx) {
  const { nodes, materials } = graph;
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].material = i === list.entry ? materials.entryMat : materials.nodeMat;
  }

  if (tIdx === hIdx) {
    nodes[tIdx].material = materials.overlapNodeMat;
    return;
  }

  nodes[tIdx].material = materials.tortoiseNodeMat;
  nodes[hIdx].material = materials.hareNodeMat;

  // Preserve entry coloring if a pointer is on the entry.
  if (tIdx === list.entry) nodes[tIdx].material = materials.tortoiseNodeMat;
  if (hIdx === list.entry) nodes[hIdx].material = materials.hareNodeMat;
}

function positionPointers(graph, positions, tIdx, hIdx) {
  const tPos = positions[tIdx];
  const hPos = positions[hIdx];
  const offset = NODE_RADIUS + POINTER_RADIUS + 2;

  graph.tortoiseMesh.position.set(tPos.x, tPos.y - offset, tPos.z);
  graph.hareMesh.position.set(hPos.x, hPos.y + offset, hPos.z);

  graph.tLabel.position.set(tPos.x, tPos.y - offset - 8, tPos.z + 4);
  graph.hLabel.position.set(hPos.x, hPos.y + offset + 8, hPos.z + 4);
}

/* ── Floyd's cycle detection state machine ──────────────────── */

function createFloydState() {
  return { tortoise: 0, hare: 0, phase: 'phase1', done: false, foundEntry: null };
}

/** Advance one tick. Returns a status message. */
function floydStep(s, list) {
  const { next } = list;

  if (s.phase === 'phase1') {
    // Tortoise moves 1, hare moves 2
    s.tortoise = next[s.tortoise];
    s.hare = next[next[s.hare]];

    if (s.tortoise === s.hare) {
      s.phase = 'phase2';
      // Standard Floyd: reset tortoise to head, keep hare at meeting point
      s.tortoise = 0;
      return `Met at node ${s.hare}. Starting phase 2…`;
    }
    return `Phase 1 — T:${s.tortoise}  H:${s.hare}`;
  }

  if (s.phase === 'phase2') {
    // Both move 1 step
    s.tortoise = next[s.tortoise];
    s.hare = next[s.hare];

    if (s.tortoise === s.hare) {
      s.phase = 'done';
      s.done = true;
      s.foundEntry = s.tortoise;
      return `Cycle entry found at node ${s.foundEntry}!`;
    }
    return `Phase 2 — T:${s.tortoise}  H:${s.hare}`;
  }

  return `Cycle entry: node ${s.foundEntry}`;
}

/* ── Main ───────────────────────────────────────────────────── */

function init() {
  const canvas = document.getElementById('vizCanvas');
  const statusEl = document.getElementById('status');
  if (!canvas || !statusEl) return;

  if (!supportsWebGL()) {
    statusEl.textContent = 'WebGL is not available.';
    statusEl.classList.add('is-error');
    return;
  }

  const three = initScene(canvas);
  resize(three, canvas);

  const list = createList(TAIL_LEN, CYCLE_LEN);
  const spread = 28;
  const positions = buildLayout(list, spread);

  // Centre the graph
  const box = new THREE.Box3();
  for (const p of positions) box.expandByPoint(p);
  const centre = new THREE.Vector3();
  box.getCenter(centre);
  for (const p of positions) p.sub(centre);

  // Adjust camera distance to fit graph
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxSpan = Math.max(size.x, size.y) * 0.7;
  three.camera.position.set(0, -maxSpan * 0.6, maxSpan * 1.1);
  three.camera.lookAt(0, 0, 0);

  const graph = buildGraph(three.scene, list, positions);

  let floyd = createFloydState();
  positionPointers(graph, positions, floyd.tortoise, floyd.hare);
  colorActiveNodes(graph, list, floyd.tortoise, floyd.hare);
  three.renderer.render(three.scene, three.camera);
  statusEl.textContent = 'Phase 1 — T:0  H:0';

  // Handle resize
  const ro = new ResizeObserver(() => {
    resize(three, canvas);
    three.renderer.render(three.scene, three.camera);
  });
  ro.observe(canvas);

  // Reduced motion: render once and stop
  if (getReducedMotion()) {
    statusEl.textContent = 'Reduced motion enabled — animation paused.';
    return;
  }

  // Auto-play loop
  let acc = 0;
  let prev = 0;
  let pauseUntil = 0;

  function loop(ts) {
    requestAnimationFrame(loop);

    if (prev === 0) { prev = ts; return; }
    const dt = Math.min(200, ts - prev);
    prev = ts;

    if (ts < pauseUntil) return;

    acc += dt;
    if (acc < STEP_INTERVAL) return;
    acc -= STEP_INTERVAL;

    if (floyd.done) {
      // Restart after a pause
      floyd = createFloydState();
      positionPointers(graph, positions, floyd.tortoise, floyd.hare);
      colorActiveNodes(graph, list, floyd.tortoise, floyd.hare);
      statusEl.textContent = 'Restarting… Phase 1 — T:0  H:0';
      pauseUntil = ts + PAUSE_AFTER_DONE;
      three.renderer.render(three.scene, three.camera);
      return;
    }

    const msg = floydStep(floyd, list);
    statusEl.textContent = msg;
    positionPointers(graph, positions, floyd.tortoise, floyd.hare);
    colorActiveNodes(graph, list, floyd.tortoise, floyd.hare);
    three.renderer.render(three.scene, three.camera);

    if (floyd.done) {
      pauseUntil = ts + PAUSE_AFTER_DONE;
    }
  }

  requestAnimationFrame(loop);
}

init();
