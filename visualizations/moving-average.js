/**
 * Moving average from data stream — sliding window, snapshot-based visualization.
 */

import {
  FONT_SANS, FONT_MONO, CSS,
  easeOutCubic, easeInOutCubic, lerp,
  createSnapshotVisualization,
} from '../viz-core.js';

export default function initMovingAverageVisualization() {
  const windowSize = 3;
  const stream = [1, 10, 3, 5, 8, 2, 6, 4, 7];

  function formatAvg(value) {
    if (value == null) return '-';
    if (Number.isInteger(value)) return `${value.toFixed(1)}`;
    return value.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
  }

  function buildSnapshots() {
    const snaps = [];
    const queue = [];
    let sum = 0;

    snaps.push({
      streamIndex: -1,
      incoming: null,
      removed: null,
      queue: [],
      windowStart: null,
      windowEnd: null,
      windowLength: 0,
      sum: 0,
      avg: null,
      text: `Start. Window size is ${windowSize}; values will stream in left to right.`,
    });

    for (let i = 0; i < stream.length; i++) {
      const incoming = stream[i];
      let removed = null;

      if (queue.length === windowSize) {
        removed = queue.shift();
        sum -= removed;
      }

      queue.push(incoming);
      sum += incoming;
      const avg = sum / queue.length;

      const queueText = `[${queue.join(', ')}]`;
      const removeText = removed == null ? '' : ` remove ${removed},`;
      const windowStart = Math.max(0, i - windowSize + 1);
      const windowEnd = i;
      snaps.push({
        streamIndex: i,
        incoming,
        removed,
        queue: [...queue],
        windowStart,
        windowEnd,
        windowLength: queue.length,
        sum,
        avg,
        text: `Read ${incoming}:${removeText} sum=${sum}, window=${queueText}, avg=${formatAvg(avg)}.`,
      });
    }

    const last = snaps[snaps.length - 1];
    snaps.push({
      ...last,
      incoming: null,
      removed: null,
      text: `Done. Final window [${last.queue.join(', ')}], average=${formatAvg(last.avg)}.`,
    });

    return snaps;
  }

  function drawCell(ctx, x, y, w, h, value, { stroke, lineWidth = 2, label = null } = {}) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = stroke || CSS.node;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    ctx.fillStyle = CSS.label;
    ctx.font = `700 16px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(value == null ? '-' : String(value), x + w / 2, y + h / 2 + 1);

    if (label) {
      ctx.fillStyle = CSS.label;
      ctx.font = `600 11px ${FONT_SANS}`;
      ctx.fillText(label, x + w / 2, y - 10);
    }
  }

  function layoutRow(width, count, y) {
    const mx = 32;
    const gap = 12;
    const cw = Math.max(48, Math.floor((width - mx * 2 - gap * (count - 1)) / count));
    const ch = 52;
    const total = cw * count + gap * (count - 1);
    const sx = Math.max(14, Math.floor((width - total) / 2));
    return { sx, y, cw, ch, gap, count };
  }

  function cellCenter(row, index) {
    return {
      x: row.sx + index * (row.cw + row.gap) + row.cw / 2,
      y: row.y + row.ch / 2,
    };
  }

  function drawWindowFrame(ctx, row, start, length, color) {
    if (start == null || length <= 0) return;
    const x = row.sx + start * (row.cw + row.gap) - 8;
    const y = row.y - 10;
    const width = length * row.cw + Math.max(0, length - 1) * row.gap + 16;
    const height = row.ch + 20;

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 12);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 12);
    ctx.stroke();
  }

  function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
    const active = isAnimating ? toSnapshot : snapshot;
    const streamRow = layoutRow(width, stream.length, Math.max(72, Math.floor(height * 0.3)));

    ctx.fillStyle = CSS.label;
    ctx.font = `700 12px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Stream', 12, streamRow.y + streamRow.ch / 2);

    const fromStart = snapshot.windowStart ?? active.windowStart;
    const toStart = active.windowStart;
    const fromLength = snapshot.windowLength ?? active.windowLength;
    const toLength = active.windowLength;
    const t = easeInOutCubic(progress);
    const frameStart = isAnimating ? lerp(fromStart ?? 0, toStart ?? 0, t) : toStart;
    const frameLength = isAnimating ? lerp(fromLength ?? 0, toLength ?? 0, t) : toLength;

    drawWindowFrame(ctx, streamRow, frameStart, frameLength, CSS.hare);

    if (active.windowStart != null && active.windowLength > 0) {
      const left = cellCenter(streamRow, active.windowStart).x;
      const right = cellCenter(streamRow, active.windowEnd).x;
      const y = streamRow.y - 22;
      ctx.strokeStyle = CSS.hare;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.fillStyle = CSS.hare;
      ctx.font = `700 11px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.fillText(`window size = ${active.windowLength}`, (left + right) / 2, y - 10);
    }

    for (let i = 0; i < stream.length; i++) {
      const x = streamRow.sx + i * (streamRow.cw + streamRow.gap);
      const seen = i <= active.streamIndex;
      const isCurrent = i === active.streamIndex;
      const inWindow = active.windowStart != null && i >= active.windowStart && i <= active.windowEnd;
      drawCell(ctx, x, streamRow.y, streamRow.cw, streamRow.ch, stream[i], {
        stroke: isCurrent ? CSS.meet : (inWindow ? CSS.hare : (seen ? CSS.tortoise : CSS.node)),
        lineWidth: isCurrent ? 3 : 2,
      });
    }

    if (isAnimating && toSnapshot.incoming != null && toSnapshot.streamIndex >= 0) {
      const from = cellCenter(streamRow, toSnapshot.streamIndex);
      const x = from.x;
      const y = streamRow.y - 34 - Math.sin(easeOutCubic(progress) * Math.PI) * 10;

      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = CSS.meet;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = CSS.label;
      ctx.font = `700 11px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(toSnapshot.incoming), x, y + 1);

      ctx.fillStyle = CSS.meet;
      ctx.font = `700 12px ${FONT_SANS}`;
      ctx.fillText('incoming', x, y - 16);
    }

    const bottomY = Math.min(height - 22, streamRow.y + streamRow.ch + 92);
    const avgText = formatAvg(active.avg);
    const windowText = active.queue.length > 0 ? `[${active.queue.join(', ')}]` : '-';
    const sumText = `sum = ${active.sum}`;
    const avgFormula = active.avg == null
      ? 'average = -'
      : `average = ${active.sum} / ${Math.max(active.queue.length, 1)} = ${avgText}`;

    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.fillText(`current window = ${windowText}`, 16, bottomY - 20);
    ctx.fillText(sumText, 16, bottomY);
    ctx.fillText(avgFormula, 16, bottomY + 20);
  }

  createSnapshotVisualization({
    canvasId: 'movingAvgCanvas', statusId: 'movingAvgStatus',
    prevId: 'movingAvgPrev', nextId: 'movingAvgNext', resetId: 'movingAvgReset',
    buildSnapshots, draw, animationMs: 650,
  });
}
