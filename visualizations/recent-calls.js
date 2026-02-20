/**
 * Number of recent calls — RecentCounter, snapshot-based visualization.
 */

import {
  FONT_SANS, FONT_MONO, CSS,
  getRandomIntInclusive,
  createSnapshotVisualization,
} from '../viz-core.js';

export default function initRecentCounterVisualization() {
  function generatePings() {
    const count = getRandomIntInclusive(16, 20);
    const pings = [];
    let t = getRandomIntInclusive(1, 200);
    for (let i = 0; i < count; i++) {
      pings.push(t);
      t += getRandomIntInclusive(200, 1800);
    }
    return pings;
  }

  function buildSnapshots() {
    const pings = generatePings();
    const snaps = [];
    const queue = [];

    snaps.push({
      pings,
      pingIdx: -1,
      incoming: null,
      removed: [],
      queue: [],
      windowStart: null,
      windowEnd: null,
      count: 0,
      text: `Start. Each ping(t) returns the number of pings in [t - 3000, t].`,
    });

    for (let i = 0; i < pings.length; i++) {
      const t = pings[i];
      const removed = [];
      queue.push(t);
      while (queue.length > 0 && queue[0] < t - 3000) {
        removed.push(queue.shift());
      }

      const removeText = removed.length > 0
        ? ` Removed ${removed.length} old ping${removed.length > 1 ? 's' : ''}.`
        : '';

      snaps.push({
        pings,
        pingIdx: i,
        incoming: t,
        removed,
        queue: [...queue],
        windowStart: t - 3000,
        windowEnd: t,
        count: queue.length,
        text: `ping(${t}): window [${t - 3000}, ${t}], count = ${queue.length}.${removeText}`,
      });
    }

    const last = snaps[snaps.length - 1];
    snaps.push({
      ...last,
      incoming: null,
      removed: [],
      text: `Done. Last count = ${last.count}. Reset for a new random sequence.`,
    });

    return snaps;
  }

  function drawCell(ctx, x, y, w, h, value, { stroke, lineWidth = 2 } = {}) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = stroke || CSS.node;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    ctx.fillStyle = CSS.label;
    ctx.font = `700 11px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), x + w / 2, y + h / 2 + 1);
  }

  function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
    if (width < 10 || height < 10) return;
    const active = isAnimating ? toSnapshot : snapshot;
    const pings = active.pings;
    const slots = pings.length;

    /* Layout */
    const mx = 18;
    const gap = 4;
    const cw = Math.max(28, Math.floor((width - mx * 2 - gap * (slots - 1)) / slots));
    const ch = 38;
    const rw = cw * slots + gap * (slots - 1);
    const sx = Math.max(10, Math.floor((width - rw) / 2));
    const rowY = Math.max(70, Math.floor(height * 0.32));

    /* Header info */
    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('All pings', sx, rowY - 14);

    /* Window highlight frame */
    if (active.windowStart != null && active.queue.length > 0) {
      let firstInWindow = -1;
      let lastInWindow = -1;
      for (let i = 0; i < slots; i++) {
        if (pings[i] >= active.windowStart && pings[i] <= active.windowEnd) {
          if (firstInWindow < 0) firstInWindow = i;
          lastInWindow = i;
        }
      }
      if (firstInWindow >= 0) {
        const fx = sx + firstInWindow * (cw + gap) - 4;
        const fw = (lastInWindow - firstInWindow + 1) * cw +
          Math.max(0, lastInWindow - firstInWindow) * gap + 8;
        ctx.save();
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = CSS.hare;
        ctx.beginPath();
        ctx.roundRect(fx, rowY - 6, fw, ch + 12, 10);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = CSS.hare;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(fx, rowY - 6, fw, ch + 12, 10);
        ctx.stroke();

        ctx.fillStyle = CSS.hare;
        ctx.font = `700 10px ${FONT_SANS}`;
        ctx.textAlign = 'center';
        ctx.fillText(
          `[${active.windowStart}, ${active.windowEnd}]`,
          fx + fw / 2,
          rowY - 18,
        );
      }
    }

    /* Ping cells */
    for (let i = 0; i < slots; i++) {
      const x = sx + i * (cw + gap);
      const isCurrent = i === active.pingIdx;
      const inQueue = active.queue.includes(pings[i]);
      const alreadySeen = active.pingIdx >= 0 && i <= active.pingIdx;
      let stroke = CSS.node;
      let lw = 2;
      if (alreadySeen && !inQueue) stroke = CSS.edge;
      if (inQueue) stroke = CSS.tortoise;
      if (isCurrent) { stroke = CSS.meet; lw = 3; }
      drawCell(ctx, x, rowY, cw, ch, pings[i], { stroke, lineWidth: lw });
    }

    /* Queue row */
    const queueY = rowY + ch + 50;
    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.fillText('Active queue', sx, queueY - 14);

    if (active.queue.length > 0) {
      const qGap = 6;
      const qcw = Math.max(34, Math.floor((width - mx * 2 - qGap * (active.queue.length - 1)) / active.queue.length));
      const qrw = qcw * active.queue.length + qGap * (active.queue.length - 1);
      const qsx = Math.max(10, Math.floor((width - qrw) / 2));
      for (let i = 0; i < active.queue.length; i++) {
        const x = qsx + i * (qcw + qGap);
        drawCell(ctx, x, queueY, qcw, ch, active.queue[i], { stroke: CSS.tortoise });
      }
    } else {
      ctx.fillStyle = CSS.edge;
      ctx.font = `600 12px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText('(empty)', width / 2, queueY + ch / 2);
    }

    /* Bottom summary */
    const bottomY = Math.min(height - 14, queueY + ch + 28);
    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.fillText(`count = ${active.count}`, 16, bottomY);
    if (active.removed.length > 0) {
      ctx.fillStyle = CSS.hare;
      ctx.fillText(
        `removed: ${active.removed.join(', ')}`,
        160, bottomY,
      );
    }
  }

  createSnapshotVisualization({
    canvasId: 'recentCallsCanvas', statusId: 'recentCallsStatus',
    prevId: 'recentCallsPrev', nextId: 'recentCallsNext', resetId: 'recentCallsReset',
    buildSnapshots, draw, animationMs: 620,
    rebuildSnapshotsOnReset: true,
  });
}
