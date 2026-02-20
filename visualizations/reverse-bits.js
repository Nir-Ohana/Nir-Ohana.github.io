/**
 * Reverse bits — 32-bit, snapshot-based visualization.
 */

import {
  FONT_SANS, FONT_MONO, CSS,
  getRandomIntInclusive, easeInOutCubic, lerp,
  createSnapshotVisualization,
} from '../viz-core.js';

export default function initReverseBitsVisualization() {
  const BITS = 32;

  function randomN() {
    return getRandomIntInclusive(3, 65535);
  }

  function toBin(v) {
    return (v >>> 0).toString(2).padStart(BITS, '0');
  }

  function buildSnapshots() {
    const original = randomN();
    let n = original;
    let res = 0;
    const snaps = [];

    snaps.push({
      iteration: 0, n, res, original,
      nBin: toBin(n), resBin: toBin(res),
      extractedBit: null, bitIndex: null,
      text: `n = ${original}. Result = 0. Will process all 32 bits.`,
    });

    const totalIter = BITS;
    for (let i = 0; i < totalIter; i++) {
      const bit = n & 1;
      res = (res << 1) | bit;
      const resUnsigned = res >>> 0;
      n = n >>> 1;

      if (i > 0 && bit === 0 && n === 0 && i < totalIter - 1) continue;

      snaps.push({
        iteration: i + 1, n, res: resUnsigned, original,
        nBin: toBin(n), resBin: toBin(resUnsigned),
        extractedBit: bit, bitIndex: i,
        text: `Iter ${i + 1}: extract bit ${bit} → result = (result << 1) | ${bit}. n >>= 1.`,
      });
    }

    const finalRes = snaps[snaps.length - 1].res;
    snaps.push({
      iteration: totalIter, n: 0, res: finalRes, original,
      nBin: toBin(0), resBin: toBin(finalRes),
      extractedBit: null, bitIndex: null,
      text: `Done. reverseBits(${original}) = ${finalRes}.`,
    });
    return snaps;
  }

  function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
    const active = isAnimating ? toSnapshot : snapshot;

    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`original = ${active.original}`, 16, 18);
    if (active.extractedBit != null) {
      ctx.fillText(`extracted bit: ${active.extractedBit}`, 16, 38);
    }

    const showBits = 16;
    const startBit = BITS - showBits;

    const mx = 16;
    const gap = 2;
    const maxCw = 24;
    const cw = Math.max(12, Math.min(maxCw, Math.floor((width - mx * 2 - gap * (showBits - 1)) / showBits)));
    const ch = 32;
    const total = cw * showBits + gap * (showBits - 1);
    const sx = Math.max(8, Math.floor((width - total) / 2));

    // n row
    const nY = Math.max(58, Math.floor(height * 0.22));
    ctx.fillStyle = CSS.label;
    ctx.font = `700 12px ${FONT_SANS}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('n', sx - 10, nY + ch / 2);

    const nBin = active.nBin;
    for (let vi = 0; vi < showBits; vi++) {
      const bi = startBit + vi;
      const bit = nBin[bi];
      const x = sx + vi * (cw + gap);

      let stroke = CSS.node;
      let lw = 1.5;
      if (bit === '1') { stroke = CSS.tortoise; lw = 2; }

      if (vi === showBits - 1 && active.extractedBit != null) {
        stroke = CSS.meet;
        lw = 3;
      }

      ctx.beginPath();
      ctx.roundRect(x, nY, cw, ch, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();

      ctx.fillStyle = bit === '1' ? CSS.tortoise : '#c0c0c0';
      ctx.font = `700 12px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bit, x + cw / 2, nY + ch / 2 + 1);
    }

    // Arrow between rows
    const arrowY = nY + ch + 10;
    if (active.extractedBit != null) {
      const fromX = sx + (showBits - 1) * (cw + gap) + cw / 2;
      const toX = sx + (showBits - 1) * (cw + gap) + cw / 2;

      let arrowProgress = isAnimating ? easeInOutCubic(progress) : 1;
      const midY = lerp(arrowY, arrowY + 20, arrowProgress);

      ctx.strokeStyle = CSS.meet;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(fromX, arrowY);
      ctx.lineTo(toX, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(toX, midY + 10, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = CSS.meet;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = CSS.meet;
      ctx.font = `700 13px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(active.extractedBit), toX, midY + 11);
    }

    // Result row
    const resY = Math.max(nY + ch + 56, Math.floor(height * 0.58));
    ctx.fillStyle = CSS.label;
    ctx.font = `700 12px ${FONT_SANS}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('res', sx - 10, resY + ch / 2);

    const resBin = active.resBin;
    for (let vi = 0; vi < showBits; vi++) {
      const bi = startBit + vi;
      const bit = resBin[bi];
      const x = sx + vi * (cw + gap);

      let stroke = CSS.node;
      let lw = 1.5;
      if (bit === '1') { stroke = CSS.tortoise; lw = 2; }

      if (vi === showBits - 1 && active.extractedBit != null && active.extractedBit === 1) {
        stroke = CSS.hare;
        lw = 3;
      }

      ctx.beginPath();
      ctx.roundRect(x, resY, cw, ch, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();

      ctx.fillStyle = bit === '1' ? CSS.tortoise : '#c0c0c0';
      ctx.font = `700 12px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bit, x + cw / 2, resY + ch / 2 + 1);
    }

    // Shift animation
    if (isAnimating && toSnapshot.extractedBit != null) {
      const shiftAmount = lerp(0, cw + gap, easeInOutCubic(progress));
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = CSS.meet;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      for (let vi = 1; vi < showBits; vi++) {
        const x = sx + vi * (cw + gap) - shiftAmount;
        ctx.beginPath();
        ctx.moveTo(x + cw / 2, resY - 3);
        ctx.lineTo(x + cw / 2 - 6, resY - 8);
        ctx.moveTo(x + cw / 2, resY - 3);
        ctx.lineTo(x + cw / 2 + 6, resY - 8);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Decimal values at the bottom
    const bottomY = Math.min(height - 14, resY + ch + 22);
    ctx.fillStyle = CSS.label;
    ctx.font = `600 12px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`n = ${active.n}`, width * 0.3, bottomY);
    ctx.fillText(`result = ${active.res}`, width * 0.7, bottomY);
  }

  createSnapshotVisualization({
    canvasId: 'reverseBitsCanvas', statusId: 'reverseBitsStatus',
    prevId: 'reverseBitsPrev', nextId: 'reverseBitsNext', resetId: 'reverseBitsReset',
    buildSnapshots, draw, animationMs: 650,
    rebuildSnapshotsOnReset: true,
  });
}
