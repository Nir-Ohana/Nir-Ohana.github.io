/**
 * Floyd's cycle detection (Tortoise & Hare) — WebGL / Three.js visualization.
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { getReducedMotion, supportsWebGL } from '../bg-utils.js';
import {
  FONT_MONO, COLOR_NODE, COLOR_EDGE, COLOR_TORTOISE, COLOR_HARE,
  COLOR_MEET, COLOR_LABEL, createVisualizationAutoplaySkill,
} from '../viz-core.js';

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

export default function initFloydVisualization() {
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
    isActive: () => document.visibilityState === 'visible' && !canvas.closest('.algo-item')?.hidden,
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
