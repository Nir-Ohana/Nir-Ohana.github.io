/**
 * Merge two sorted linked lists — snapshot-based visualization.
 */

import {
  FONT_SANS, FONT_MONO, CSS,
  easeInOutCubic, lerp,
  createSnapshotVisualization,
} from '../viz-core.js';

export default function initMergeListsVisualization() {
  const list1 = [1, 2, 4];
  const list2 = [1, 3, 4];
  const totalLen = list1.length + list2.length;

  function buildSnapshots() {
    const snaps = [];
    let p1 = 0;
    let p2 = 0;
    const merged = [];

    snaps.push({
      p1, p2, merged: [], pick: null,
      text: 'Start merge. Compare list1[p1] and list2[p2], take the smaller value.',
    });

    while (p1 < list1.length && p2 < list2.length) {
      const takeLeft = list1[p1] <= list2[p2];
      const value = takeLeft ? list1[p1] : list2[p2];
      const si = takeLeft ? p1 : p2;
      merged.push(value);
      if (takeLeft) p1 += 1; else p2 += 1;

      snaps.push({
        p1, p2, merged: [...merged],
        pick: { from: takeLeft ? 'list1' : 'list2', si, mi: merged.length - 1, value },
        text: takeLeft ? `Take ${value} from list1 (stable on ties).` : `Take ${value} from list2.`,
      });
    }

    while (p1 < list1.length) {
      merged.push(list1[p1]);
      snaps.push({
        p1: p1 + 1, p2, merged: [...merged],
        pick: { from: 'list1', si: p1, mi: merged.length - 1, value: list1[p1] },
        text: `List2 exhausted. Append ${list1[p1]} from list1.`,
      });
      p1 += 1;
    }

    while (p2 < list2.length) {
      merged.push(list2[p2]);
      snaps.push({
        p1, p2: p2 + 1, merged: [...merged],
        pick: { from: 'list2', si: p2, mi: merged.length - 1, value: list2[p2] },
        text: `List1 exhausted. Append ${list2[p2]} from list2.`,
      });
      p2 += 1;
    }

    snaps.push({
      p1, p2, merged: [...merged], pick: null,
      text: `Done. Merged list: ${merged.join(' → ')}.`,
    });
    return snaps;
  }

  /* Row layout helpers */

  function rowLayout(width, slots) {
    const mx = 42;
    const gap = 12;
    const r = Math.max(16, Math.min(24, Math.floor((width - mx * 2 - gap * (slots - 1)) / (slots * 2.4))));
    const tw = slots * r * 2 + (slots - 1) * gap;
    return { r, gap, sx: Math.max(24, Math.floor((width - tw) / 2)) };
  }

  function nodeCenter(width, rowY, slots, idx) {
    const l = rowLayout(width, slots);
    return { x: l.sx + l.r + idx * (l.r * 2 + l.gap), y: rowY + l.r, r: l.r };
  }

  function drawRow(ctx, width, label, values, y, opts) {
    const { pointerIndex = null, consumed = 0, totalSlots = values.length, mergedLen = 0 } = opts;
    const l = rowLayout(width, totalSlots);

    ctx.fillStyle = CSS.label;
    ctx.font = `700 12px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 14, y + l.r);

    /* Arrows between nodes */
    for (let i = 0; i < totalSlots - 1; i++) {
      const a = nodeCenter(width, y, totalSlots, i);
      const b = nodeCenter(width, y, totalSlots, i + 1);
      ctx.strokeStyle = CSS.edge;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(a.x + a.r, a.y);
      ctx.lineTo(b.x - b.r, b.y);
      ctx.stroke();

      ctx.fillStyle = CSS.edge;
      ctx.font = `700 10px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▶', (a.x + b.x) / 2, a.y - 1);
    }

    /* Nodes */
    for (let i = 0; i < totalSlots; i++) {
      const c = nodeCenter(width, y, totalSlots, i);
      const hasVal = i < values.length;
      let stroke = CSS.node;
      let lw = 2;
      if (i < consumed || (label === 'merged' && i < mergedLen)) stroke = CSS.tortoise;
      if (pointerIndex != null && i === pointerIndex) { stroke = CSS.meet; lw = 3; }

      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();

      if (hasVal) {
        ctx.fillStyle = CSS.label;
        ctx.font = `700 16px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(values[i]), c.x, c.y + 1);
      }

      if (pointerIndex != null && i === pointerIndex) {
        ctx.fillStyle = CSS.meet;
        ctx.font = `700 13px ${FONT_SANS}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↑', c.x, y - 14);
      }
    }
  }

  function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
    const rowGap = Math.max(24, Math.floor((height - 3 * 52 - 32) / 3));
    const y1 = 22;
    const y2 = y1 + 52 + rowGap;
    const y3 = y2 + 52 + rowGap;

    drawRow(ctx, width, 'list1', list1, y1, {
      pointerIndex: snapshot.p1 < list1.length ? snapshot.p1 : null,
      consumed: snapshot.p1,
    });
    drawRow(ctx, width, 'list2', list2, y2, {
      pointerIndex: snapshot.p2 < list2.length ? snapshot.p2 : null,
      consumed: snapshot.p2,
    });
    drawRow(ctx, width, 'merged', snapshot.merged, y3, {
      pointerIndex: snapshot.merged.length > 0 ? snapshot.merged.length - 1 : null,
      totalSlots: totalLen,
      mergedLen: snapshot.merged.length,
    });

    /* Animated ball drop */
    if (isAnimating && toSnapshot.pick) {
      const pk = toSnapshot.pick;
      const srcY = pk.from === 'list1' ? y1 : y2;
      const srcSlots = pk.from === 'list1' ? list1.length : list2.length;
      const src = nodeCenter(width, srcY, srcSlots, pk.si);
      const tgt = nodeCenter(width, y3, totalLen, pk.mi);
      const p = easeInOutCubic(progress);
      const bx = lerp(src.x, tgt.x, p);
      const by = lerp(src.y, tgt.y, p) + Math.sin(p * Math.PI) * 34;

      ctx.beginPath();
      ctx.arc(bx, by, src.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = CSS.meet;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = CSS.label;
      ctx.font = `700 16px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(pk.value), bx, by + 1);
    }
  }

  createSnapshotVisualization({
    canvasId: 'mergeListsCanvas', statusId: 'mergeListsStatus',
    prevId: 'mergeListsPrev', nextId: 'mergeListsNext', resetId: 'mergeListsReset',
    buildSnapshots, draw, animationMs: 700,
  });
}
