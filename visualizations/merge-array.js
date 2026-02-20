/**
 * Merge sorted array from the back — snapshot-based visualization.
 */

import {
  FONT_SANS, FONT_MONO, CSS,
  createSnapshotVisualization,
} from '../viz-core.js';

export default function initMergeArrayVisualization() {
  const nums1Init = [1, 2, 3, 0, 0, 0];
  const m = 3;
  const nums2 = [2, 5, 6];
  const arrN = 3;

  function buildSnapshots() {
    const snaps = [];
    const arr = [...nums1Init];
    let i = m - 1;
    let j = arrN - 1;
    let k = m + arrN - 1;

    snaps.push({
      arr: [...arr], i, j, k, wi: null,
      text: 'Start from the back. Compare nums1[i] and nums2[j], write larger into nums1[k].',
    });

    while (i >= 0 && j >= 0) {
      const takeI = arr[i] > nums2[j];
      const v = takeI ? arr[i] : nums2[j];
      arr[k] = v;
      const src = takeI ? `nums1[${i}]` : `nums2[${j}]`;
      snaps.push({
        arr: [...arr], i: i - (takeI ? 1 : 0), j: j - (takeI ? 0 : 1), k: k - 1, wi: k,
        text: `Write ${v} from ${src} into nums1[${k}].`,
      });
      if (takeI) i--; else j--;
      k--;
    }

    while (j >= 0) {
      arr[k] = nums2[j];
      snaps.push({
        arr: [...arr], i, j: j - 1, k: k - 1, wi: k,
        text: `Copy ${nums2[j]} from nums2[${j}] into nums1[${k}].`,
      });
      j--;
      k--;
    }

    snaps.push({
      arr: [...arr], i, j, k, wi: null,
      text: `Done. nums1 = [${arr.join(', ')}].`,
    });
    return snaps;
  }

  function drawArrayRow(ctx, width, label, values, y, opts) {
    const { pointer = null, highlight = null, activeLen = values.length } = opts;
    const mx = 24;
    const gap = 10;
    const slots = values.length;
    const cw = Math.max(42, Math.floor((width - mx * 2 - gap * (slots - 1)) / slots));
    const ch = 48;
    const sx = Math.max(14, Math.floor((width - (cw * slots + gap * (slots - 1))) / 2));

    ctx.fillStyle = CSS.label;
    ctx.font = `700 12px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 12, y + ch / 2);

    for (let idx = 0; idx < slots; idx++) {
      const x = sx + idx * (cw + gap);
      let stroke = idx < activeLen ? CSS.tortoise : CSS.node;
      let lw = 2;
      if (highlight != null && idx === highlight) { stroke = CSS.meet; lw = 3; }
      if (pointer != null && idx === pointer) { stroke = CSS.meet; lw = 3; }

      ctx.beginPath();
      ctx.roundRect(x, y, cw, ch, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();

      ctx.fillStyle = CSS.label;
      ctx.font = `700 16px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(values[idx]), x + cw / 2, y + ch / 2 + 1);

      if (pointer != null && idx === pointer) {
        ctx.fillStyle = CSS.meet;
        ctx.font = `700 12px ${FONT_SANS}`;
        ctx.fillText('↑', x + cw / 2, y - 10);
      }
    }
  }

  function draw(ctx, { width, height, snapshot }) {
    const y1 = 38;
    const y2 = y1 + 90;

    drawArrayRow(ctx, width, 'nums1', snapshot.arr, y1, {
      pointer: snapshot.k >= 0 ? snapshot.k : null,
      highlight: snapshot.wi,
      activeLen: snapshot.k + 1,
    });
    drawArrayRow(ctx, width, 'nums2', nums2, y2, {
      pointer: snapshot.j >= 0 ? snapshot.j : null,
      activeLen: nums2.length,
    });

    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `i = ${Math.max(snapshot.i, -1)}, j = ${Math.max(snapshot.j, -1)}, k = ${Math.max(snapshot.k, -1)}`,
      16, height - 16,
    );
  }

  createSnapshotVisualization({
    canvasId: 'mergeArrayCanvas', statusId: 'mergeArrayStatus',
    prevId: 'mergeArrayPrev', nextId: 'mergeArrayNext', resetId: 'mergeArrayReset',
    buildSnapshots, draw, animationMs: 600,
  });
}
