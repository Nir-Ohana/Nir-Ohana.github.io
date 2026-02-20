/**
 * viz-core.js — Shared constants, helpers, and framework for algorithm visualizations.
 *
 * Centralizes all reusable logic so individual visualization modules stay focused
 * on their own algorithm simulation and draw routine.
 */

import { getReducedMotion } from './bg-utils.js';

/* ───── Font stacks ──────────────────────────────────────────────── */

export const FONT_SANS = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
export const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

/* ───── Color constants ──────────────────────────────────────────── */

export const COLOR_NODE = 0xd1d5db;
export const COLOR_EDGE = 0x6b7280;
export const COLOR_TORTOISE = 0x16a34a;
export const COLOR_HARE = 0xdc2626;
export const COLOR_MEET = 0x1d4ed8;
export const COLOR_LABEL = '#4b5563';

function numberToCssHex(value) {
  return `#${value.toString(16).padStart(6, '0')}`;
}

/** Pre-resolved CSS color strings — avoids repeated numberToCssHex calls. */
export const CSS = Object.freeze({
  node: numberToCssHex(COLOR_NODE),
  edge: numberToCssHex(COLOR_EDGE),
  tortoise: numberToCssHex(COLOR_TORTOISE),
  hare: numberToCssHex(COLOR_HARE),
  meet: numberToCssHex(COLOR_MEET),
  label: COLOR_LABEL,
});

/* ───── Math / utility helpers ───────────────────────────────────── */

export function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function easeOutCubic(t) {
  const k = clamp01(t);
  return 1 - Math.pow(1 - k, 3);
}

export function easeInOutCubic(t) {
  const k = clamp01(t);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

export function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function getRandomIntInclusive(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/* ───── Canvas helpers ───────────────────────────────────────────── */

/** Resize a 2D canvas backing store to match its CSS size (clamped DPR). */
export function resize2dCanvas(canvas) {
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
export function clearCanvas(ctx, width, height) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
}

/* ───── Autoplay engine ──────────────────────────────────────────── */

export function createVisualizationAutoplaySkill({
  enabled,
  stepInterval,
  donePause,
  isBusy,
  isDone,
  isActive,
  onStep,
  onReset,
}) {
  if (!enabled) return { stop() {} };

  const TICK_MS = 120;
  let prev = 0;
  let acc = 0;
  let pauseUntil = 0;
  let stopped = false;
  let timeoutId = 0;

  function schedule(delay = TICK_MS) {
    if (stopped) return;
    timeoutId = window.setTimeout(loop, delay);
  }

  function loop() {
    if (stopped) return;

    const ts = performance.now();
    const active = typeof isActive === 'function'
      ? isActive()
      : document.visibilityState === 'visible';

    if (!active) {
      prev = ts;
      acc = 0;
      schedule();
      return;
    }

    if (prev === 0) {
      prev = ts;
      schedule();
      return;
    }

    const dt = Math.min(250, ts - prev);
    prev = ts;

    if (ts < pauseUntil) {
      schedule();
      return;
    }

    if (isBusy && isBusy()) {
      schedule();
      return;
    }

    acc += dt;
    if (acc < stepInterval) {
      schedule();
      return;
    }

    acc %= stepInterval;

    if (isDone && isDone()) {
      if (onReset) onReset();
      pauseUntil = ts + donePause;
      schedule();
      return;
    }

    if (onStep) onStep();

    if (isDone && isDone()) {
      pauseUntil = ts + donePause;
    }

    schedule();
  }

  schedule(0);
  return {
    stop() {
      stopped = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = 0;
      }
    },
  };
}

/* ───── Snapshot-based visualization framework ────────────────────── *
 *                                                                     *
 * Handles: DOM lookup, canvas resize, Prev/Next/Reset wiring,        *
 * animated step transitions, ResizeObserver, and autoplay.            *
 *                                                                     *
 * Each visualization only needs to provide:                           *
 *   buildSnapshots()  — returns the step array                        *
 *   draw(ctx, state)  — renders one frame                             *
 * ──────────────────────────────────────────────────────────────────── */

export function createSnapshotVisualization({
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

    const activeSnap = state.animation ? toSnapshot : snapshot;
    const total = snapshots.length - 1;
    const stepLabel = state.stepIndex <= 0
      ? ''
      : state.stepIndex >= total
        ? `[${total}/${total}] `
        : `[${state.stepIndex}/${total}] `;
    statusEl.textContent = stepLabel + activeSnap.text;
    prevBtn.disabled = state.stepIndex <= 0 || state.animation !== null;
    nextBtn.disabled = state.stepIndex >= snapshots.length - 1 || state.animation !== null;
  }

  function stepForward() {
    if (state.stepIndex >= snapshots.length - 1 || state.animation) return;
    runStepAnimation(state.stepIndex + 1);
  }

  function stepBackward() {
    if (state.stepIndex <= 0 || state.animation) return;
    state.stepIndex -= 1;
    render();
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

  prevBtn.addEventListener('click', stepBackward);

  nextBtn.addEventListener('click', stepForward);

  resetBtn.addEventListener('click', () => {
    resetToStart(rebuildSnapshotsOnReset);
  });

  /* Keyboard navigation — only when this panel is visible */
  document.addEventListener('keydown', (e) => {
    const item = canvas.closest('.algo-item');
    if (item && item.hidden) return;
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      stepForward();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      stepBackward();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      resetToStart(rebuildSnapshotsOnReset);
    }
  });

  new ResizeObserver(() => render()).observe(canvas);
  render();

  createVisualizationAutoplaySkill({
    enabled: !reduceMotion,
    stepInterval: 1000,
    donePause: 1800,
    isActive: () => document.visibilityState === 'visible' && !canvas.closest('.algo-item')?.hidden,
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
