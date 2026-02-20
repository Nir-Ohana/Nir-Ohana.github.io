/**
 * Hash table construction (10 buckets) — Canvas 2D visualization.
 */

import { getReducedMotion } from '../bg-utils.js';
import {
  FONT_SANS, CSS, getRandomIntInclusive, lerp, easeOutCubic,
  resize2dCanvas, clearCanvas, createVisualizationAutoplaySkill,
} from '../viz-core.js';
import { drawCircleNode, drawSectionLabel } from '../viz-draw.js';

export default function initHashTableVisualization() {
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

  /* Draw */

  function drawNumberStrip(width) {
    const l = getInputLayout(width);

    drawSectionLabel(ctx, 'Input numbers (0-100)', l.left, l.top, {
      font: `600 13px ${FONT_SANS}`,
    });

    for (let i = 0; i < state.numbers.length; i++) {
      if (state.animation && i === state.stepIndex) continue;
      const { x, y, radius } = getInputBallCenter(i, width);
      let stroke = CSS.node;
      let lw = 2;
      if (i < state.stepIndex) { stroke = CSS.tortoise; lw = 2.5; }
      if (i === state.stepIndex && state.stepIndex < state.numbers.length) { stroke = CSS.meet; lw = 3; }
      drawCircleNode(ctx, x, y, radius, state.numbers[i], {
        stroke, lineWidth: lw, font: `700 12px ${FONT_SANS}`,
      });
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
        drawCircleNode(ctx, pos.x, pos.y, pos.radius, buckets[i][j], {
          stroke: CSS.tortoise, font: `700 12px ${FONT_SANS}`,
        });
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
      drawCircleNode(ctx, x, y, slot.radius, state.animation.value, {
        stroke: CSS.meet, lineWidth: 3, font: `700 12px ${FONT_SANS}`,
      });
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
    isActive: () => document.visibilityState === 'visible' && !canvas.closest('.algo-item')?.hidden,
    isBusy: () => state.animation !== null,
    isDone: () => state.stepIndex >= state.numbers.length,
    onStep: () => {
      if (state.stepIndex >= state.numbers.length || state.animation) return;
      startInsertAnimation();
    },
    onReset: regenerate,
  });
}
