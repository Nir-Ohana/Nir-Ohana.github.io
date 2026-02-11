const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

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

function drawArrow(ctx, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return;

  const ux = dx / len;
  const uy = dy / len;

  const paddingFrom = 16;
  const paddingTo = 18;
  const start = { x: from.x + ux * paddingFrom, y: from.y + uy * paddingFrom };
  const end = { x: to.x - ux * paddingTo, y: to.y - uy * paddingTo };

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  const headLen = 8;
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 7), end.y - headLen * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 7), end.y - headLen * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
}

function drawScene(ctx, state) {
  const {
    width,
    height,
    list,
    layout,
    tortoise,
    hare,
    phase,
    entry,
    foundEntry,
  } = state;

  ctx.clearRect(0, 0, width, height);

  // Background (transparent to let page styling show through)

  // Edges
  ctx.save();
  ctx.strokeStyle = 'rgba(17 24 39 / 0.28)';
  ctx.fillStyle = 'rgba(17 24 39 / 0.28)';
  ctx.lineWidth = 2;

  for (let i = 0; i < list.total; i++) {
    const from = layout.positions[i];
    const to = layout.positions[list.next[i]];
    drawArrow(ctx, from, to);
  }
  ctx.restore();

  // Nodes
  const nodeR = 16;
  ctx.save();
  ctx.lineWidth = 2;
  for (let i = 0; i < list.total; i++) {
    const p = layout.positions[i];

    ctx.beginPath();
    ctx.arc(p.x, p.y, nodeR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255 255 255 / 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(229 231 235 / 1)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(75 85 99 / 1)';
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i), p.x, p.y);
  }
  ctx.restore();

  // Entry marker
  ctx.save();
  {
    const p = layout.positions[entry];
    ctx.fillStyle = 'rgba(29 78 216 / 0.9)';
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('E', p.x, p.y - nodeR - 6);
  }
  ctx.restore();

  // Pointer labels
  function drawPointerLabel(nodeIndex, label, color, yOffset = 0) {
    const p = layout.positions[nodeIndex];
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, p.x, p.y + nodeR + 6 + yOffset);
    ctx.restore();
  }

  const tortoiseColor = 'rgba(17 24 39 / 0.9)';
  const hareColor = 'rgba(29 78 216 / 0.9)';

  if (tortoise === hare) {
    drawPointerLabel(tortoise, 'T/H', hareColor);
  } else {
    drawPointerLabel(tortoise, 'T', tortoiseColor);
    drawPointerLabel(hare, 'H', hareColor, 0);
  }

  if (phase === 'done' && Number.isInteger(foundEntry)) {
    ctx.save();
    ctx.fillStyle = 'rgba(17 24 39 / 0.85)';
    ctx.font = '14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Entry found: ${foundEntry}`, 12, 12);
    ctx.restore();
  }
}

function makeHiDPICanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssWidth = canvas.width;
  const cssHeight = canvas.height;

  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { ctx, width: cssWidth, height: cssHeight };
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

  const { ctx, width, height } = makeHiDPICanvas(canvas);

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
    drawScene(ctx, state);
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
    drawScene(ctx, state);
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
        state = { ...state, phase: 'phase2', meet: newT, hare: newT, tortoise: 0 };
        setStatus(`Phase 1: met at node ${newT}. Phase 2: move both 1× to find entry.`);
      } else {
        setStatus(`Phase 1: step ${steps}.`);
      }

      drawScene(ctx, state);
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

      drawScene(ctx, state);
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
