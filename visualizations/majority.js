/**
 * Majority element — Boyer-Moore voting, snapshot-based visualization.
 */

import {
  FONT_SANS, FONT_MONO, CSS,
  getRandomIntInclusive, easeOutCubic, lerp,
  createSnapshotVisualization,
} from '../viz-core.js';

export default function initMajorityElementVisualization() {
  function shuffle(values) {
    const arr = [...values];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = getRandomIntInclusive(0, i);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function createRandomMajorityInput() {
    const length = getRandomIntInclusive(9, 13);
    const majorityValue = getRandomIntInclusive(1, 9);
    const minMajority = Math.floor(length / 2) + 1;
    const majorityCount = minMajority;
    const arr = [];

    for (let i = 0; i < majorityCount; i++) arr.push(majorityValue);
    while (arr.length < length) {
      let candidate = getRandomIntInclusive(0, 9);
      if (candidate === majorityValue) candidate = (candidate + 1) % 10;
      arr.push(candidate);
    }

    return shuffle(arr);
  }

  function buildSnapshots() {
    const nums = createRandomMajorityInput();
    const snapshots = [];
    let candidate = null;
    let count = 0;

    snapshots.push({
      nums,
      idx: null,
      processed: 0,
      candidate,
      count,
      text: `New run: nums = [${nums.join(', ')}]. Start with candidate = -, count = 0.`,
    });

    for (let i = 0; i < nums.length; i++) {
      const num = nums[i];
      const previousCount = count;
      if (count === 0) candidate = num;
      count += num === candidate ? 1 : -1;

      snapshots.push({
        nums,
        idx: i,
        processed: i + 1,
        candidate,
        count,
        current: num,
        picked: previousCount === 0,
        text: previousCount === 0
          ? `i=${i}, num=${num}: count was 0, pick candidate=${candidate}, then count -> ${count}.`
          : `i=${i}, num=${num}: ${num === candidate ? 'match' : 'mismatch'} with candidate=${candidate}, count -> ${count}.`,
      });
    }

    snapshots.push({
      nums,
      idx: null,
      processed: nums.length,
      candidate,
      count,
      text: `Done. Majority element is ${candidate}. Next reset/autoplay cycle randomizes a new list.`,
    });

    return snapshots;
  }

  function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
    const active = isAnimating ? toSnapshot : snapshot;
    const nums = active.nums;
    const slots = nums.length;
    const mx = 24;
    const gap = 10;
    const cw = Math.max(34, Math.floor((width - mx * 2 - gap * (slots - 1)) / slots));
    const ch = 56;
    const rw = cw * slots + gap * (slots - 1);
    const sx = Math.max(12, Math.floor((width - rw) / 2));
    const y = Math.max(96, Math.floor(height * 0.38));

    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`candidate = ${active.candidate == null ? '-' : active.candidate}`, 16, 22);
    ctx.fillText(`count = ${active.count}`, 16, 42);
    ctx.fillText(`processed = ${active.processed}/${nums.length}`, 16, 62);

    for (let i = 0; i < slots; i++) {
      const x = sx + i * (cw + gap);
      let stroke = CSS.node;
      let lw = 2;
      if (i < active.processed) {
        stroke = CSS.tortoise;
      }
      if (active.idx != null && i === active.idx) {
        stroke = CSS.meet;
        lw = 3;
      }

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
      ctx.fillText(String(nums[i]), x + cw / 2, y + ch / 2 + 2);

      ctx.font = `600 10px ${FONT_SANS}`;
      ctx.fillText(String(i), x + cw / 2, y + ch + 12);
    }

    let markerIndex = active.idx;
    if (isAnimating && snapshot.idx != null && toSnapshot.idx != null) {
      markerIndex = lerp(snapshot.idx, toSnapshot.idx, easeOutCubic(progress));
    }
    if (markerIndex != null) {
      const cx = sx + markerIndex * (cw + gap) + cw / 2;
      const cy = y - 18;
      ctx.beginPath();
      ctx.arc(cx, cy, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = CSS.meet;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = CSS.meet;
      ctx.font = `700 11px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('i', cx, cy + 1);
    }
  }

  createSnapshotVisualization({
    canvasId: 'majorityCanvas', statusId: 'majorityStatus',
    prevId: 'majorityPrev', nextId: 'majorityNext', resetId: 'majorityReset',
    buildSnapshots,
    draw,
    animationMs: 560,
    rebuildSnapshotsOnReset: true,
  });
}
