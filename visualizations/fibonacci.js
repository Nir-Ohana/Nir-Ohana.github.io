/**
 * Fibonacci DP table — snapshot-based visualization.
 */

import {
  FONT_SANS, FONT_MONO, CSS,
  easeOutCubic, lerp,
  createSnapshotVisualization,
} from '../viz-core.js';

export default function initFibonacciVisualization() {
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
