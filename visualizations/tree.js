/**
 * Binary tree traversals — Canvas 2D visualization.
 */

import { getReducedMotion } from '../bg-utils.js';
import {
  FONT_SANS, FONT_MONO, CSS, capitalize,
  resize2dCanvas, clearCanvas, createVisualizationAutoplaySkill,
} from '../viz-core.js';
import { drawCircleNode } from '../viz-draw.js';

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

export default function initTreeTraversalVisualization() {
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

      drawCircleNode(ctx, x, y, radius, String(node.value), {
        stroke, lineWidth: lw, font: `700 18px ${FONT_SANS}`,
      });
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
    isActive: () => document.visibilityState === 'visible' && !canvas.closest('.algo-item')?.hidden,
    isDone: () => state.stepIndex >= seq().length,
    onStep: () => { if (state.stepIndex < seq().length) { state.stepIndex += 1; render(); } },
    onReset: () => { state.stepIndex = 0; render(); },
  });
}
