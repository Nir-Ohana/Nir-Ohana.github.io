/**
 * Number of 1 bits — Hamming weight, snapshot-based visualization.
 */

import {
  FONT_SANS, FONT_MONO, CSS,
  getRandomIntInclusive, easeOutCubic, lerp,
  createSnapshotVisualization,
} from '../viz-core.js';

export default function initHammingWeightVisualization() {
  const BITS = 32;

  function randomN() {
    return getRandomIntInclusive(3, 65535);
  }

  function toBin(v) {
    return (v >>> 0).toString(2).padStart(BITS, '0');
  }

  function buildSnapshots() {
    let n = randomN();
    const original = n;
    const snaps = [];
    let hamm = 0;

    snaps.push({
      n, original, hamm, cleared: null, binary: toBin(n),
      text: `n = ${original} (binary: ${toBin(original).replace(/^0+/, '') || '0'}). Count = 0.`,
    });

    while (n !== 0) {
      const prev = n;
      const cleared = prev & ~(prev & -prev);
      n = n & (n - 1);
      hamm += 1;

      snaps.push({
        n, original, hamm, prevN: prev,
        cleared: BITS - 1 - Math.floor(Math.log2(prev & -prev)),
        binary: toBin(n), prevBinary: toBin(prev),
        text: `n &= (n-1): ${prev} → ${n}. Cleared bit ${BITS - 1 - Math.floor(Math.log2(prev & -prev))}. Count = ${hamm}.`,
      });
    }

    snaps.push({
      n: 0, original, hamm, cleared: null, binary: toBin(0),
      text: `Done. Hamming weight of ${original} is ${hamm}.`,
    });
    return snaps;
  }

  function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
    const active = isAnimating ? toSnapshot : snapshot;
    const binary = active.binary;

    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`n = ${active.original}`, 16, 20);
    ctx.fillText(`count = ${active.hamm}`, 16, 40);
    if (active.prevN != null) {
      ctx.fillText(`n &= (n - 1):  ${active.prevN} & ${active.prevN - 1} = ${active.n}`, 16, 60);
    }

    const firstOne = binary.indexOf('1');
    const startBit = Math.max(0, Math.min(firstOne, BITS - 8));
    const visibleBits = BITS - startBit;

    const mx = 16;
    const gap = 3;
    const maxCw = 28;
    const cw = Math.max(14, Math.min(maxCw, Math.floor((width - mx * 2 - gap * (visibleBits - 1)) / visibleBits)));
    const ch = 38;
    const total = cw * visibleBits + gap * (visibleBits - 1);
    const sx = Math.max(8, Math.floor((width - total) / 2));
    const sy = Math.max(78, Math.floor(height * 0.32));

    for (let vi = 0; vi < visibleBits; vi++) {
      const bi = startBit + vi;
      const bit = binary[bi];
      const x = sx + vi * (cw + gap);

      let stroke = CSS.node;
      let lw = 2;
      if (bit === '1') { stroke = CSS.tortoise; lw = 2.5; }

      if (active.cleared != null && bi === active.cleared) {
        stroke = CSS.hare;
        lw = 3;
        if (isAnimating) {
          const flash = Math.sin(progress * Math.PI);
          ctx.globalAlpha = 0.4 + 0.6 * (1 - flash);
        }
      }

      ctx.beginPath();
      ctx.roundRect(x, sy, cw, ch, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = bit === '1' ? CSS.tortoise : CSS.label;
      ctx.font = `700 14px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bit, x + cw / 2, sy + ch / 2 + 1);
    }

    ctx.fillStyle = CSS.label;
    ctx.font = `500 9px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    for (let vi = 0; vi < visibleBits; vi++) {
      const bi = startBit + vi;
      const x = sx + vi * (cw + gap);
      ctx.fillText(String(bi), x + cw / 2, sy + ch + 12);
    }

    if (active.prevBinary && !isAnimating) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = CSS.label;
      ctx.font = `600 11px ${FONT_SANS}`;
      ctx.textAlign = 'left';
      ctx.fillText('prev:', 16, sy - 20);
      ctx.font = `700 11px ${FONT_MONO}`;
      for (let vi = 0; vi < visibleBits; vi++) {
        const bi = startBit + vi;
        const x = sx + vi * (cw + gap);
        const pBit = active.prevBinary[bi];
        ctx.fillStyle = pBit === '1' ? CSS.tortoise : CSS.label;
        ctx.fillText(pBit, x + cw / 2, sy - 20);
      }
      ctx.globalAlpha = 1;
    }

    if (isAnimating && toSnapshot.cleared != null) {
      const clearedVi = toSnapshot.cleared - startBit;
      if (clearedVi >= 0 && clearedVi < visibleBits) {
        const cx = sx + clearedVi * (cw + gap) + cw / 2;
        const cy = sy + ch / 2;
        const r = lerp(cw * 0.4, cw * 1.2, easeOutCubic(progress));
        ctx.globalAlpha = 1 - easeOutCubic(progress);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = CSS.hare;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  createSnapshotVisualization({
    canvasId: 'hammingCanvas', statusId: 'hammingStatus',
    prevId: 'hammingPrev', nextId: 'hammingNext', resetId: 'hammingReset',
    buildSnapshots, draw, animationMs: 700,
    rebuildSnapshotsOnReset: true,
  });
}
