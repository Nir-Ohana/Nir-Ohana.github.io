/**
 * Square root — binary search, snapshot-based visualization.
 */

import {
  FONT_SANS, FONT_MONO, CSS,
  lerp,
  createSnapshotVisualization,
} from '../viz-core.js';

export default function initSqrtBinarySearchVisualization() {
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
