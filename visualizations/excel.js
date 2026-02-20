/**
 * Excel column title → number (base-26, shift-left logic) — snapshot-based visualization.
 */

import {
  FONT_SANS, FONT_MONO, CSS,
  getRandomIntInclusive, clamp01, easeInOutCubic, lerp,
  createSnapshotVisualization,
} from '../viz-core.js';

export default function initExcelTitleNumberVisualization() {
  function randomTitle() {
    const len = getRandomIntInclusive(2, 5);
    let out = '';
    for (let i = 0; i < len; i++) {
      out += String.fromCharCode(65 + getRandomIntInclusive(0, 25));
    }
    return out;
  }

  function charValue(ch) {
    return ch.charCodeAt(0) - 64;
  }

  function buildSnapshots() {
    const title = randomTitle();
    const chars = title.split('');
    const snaps = [];
    let result = 0;

    snaps.push({
      title,
      chars,
      idx: null,
      result,
      prevResult: null,
      value: null,
      text: `New run: columnTitle="${title}". Start with result = 0.`,
    });

    for (let i = 0; i < chars.length; i++) {
      const value = charValue(chars[i]);
      const prevResult = result;
      result = prevResult * 26 + value;
      snaps.push({
        title,
        chars,
        idx: i,
        result,
        prevResult,
        value,
        text: `i=${i}, char='${chars[i]}' (${value}): result = ${prevResult} * 26 + ${value} = ${result}.`,
      });
    }

    snaps.push({
      title,
      chars,
      idx: null,
      result,
      prevResult: null,
      value: null,
      text: `Done. "${title}" → ${result}. Next reset/autoplay cycle randomizes a new title.`,
    });

    return snaps;
  }

  function drawValueBox(ctx, x, y, w, h, text, stroke, lineWidth = 2, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.fillStyle = CSS.label;
    ctx.font = `700 16px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text), x + w / 2, y + h / 2 + 1);
    ctx.globalAlpha = 1;
  }

  function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
    const active = isAnimating ? toSnapshot : snapshot;
    const chars = active.chars;
    const current = active.idx != null ? active.idx : null;
    const hasCalc = active.idx != null && active.prevResult != null;

    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`columnTitle = "${active.title}"`, 16, 20);

    let shownResult = active.result;
    let bannerText = '';
    let shiftT = 1;
    let addT = 1;
    let shiftedValue = hasCalc ? active.prevResult * 26 : active.result;
    let runningResult = active.result;

    if (isAnimating && toSnapshot.idx != null && toSnapshot.prevResult != null) {
      const prev = toSnapshot.prevResult;
      const shifted = prev * 26;
      shiftT = easeInOutCubic(clamp01(progress / 0.58));
      addT = easeInOutCubic(clamp01((progress - 0.58) / 0.42));
      shiftedValue = Math.round(lerp(prev, shifted, shiftT));
      runningResult = Math.round(lerp(shifted, toSnapshot.result, addT));
      shownResult = runningResult;

      if (addT <= 0.01) {
        bannerText = `Step 1/2: ${prev} × 26 = ${shiftedValue}`;
      } else {
        bannerText = `Step 2/2: ${shifted} + ${toSnapshot.value} = ${runningResult}`;
      }
    } else if (hasCalc) {
      bannerText = `Compute: (${active.prevResult} × 26) + ${active.value} = ${active.result}`;
      shiftedValue = active.prevResult * 26;
      runningResult = active.result;
    }

    ctx.fillText(`result = ${shownResult}`, 16, 40);
    if (bannerText) {
      ctx.fillText(bannerText, 16, 60);
    }

    const slots = chars.length;
    const gap = 10;
    const cw = Math.max(42, Math.min(58, Math.floor((width - 80 - gap * (slots - 1)) / Math.max(1, slots))));
    const ch = 46;
    const total = cw * slots + gap * (slots - 1);
    const sx = Math.max(20, Math.floor((width - total) / 2));
    const sy = 84;

    for (let i = 0; i < slots; i++) {
      const x = sx + i * (cw + gap);
      let stroke = CSS.node;
      let lw = 2;
      if (active.idx != null && i < active.idx) stroke = CSS.tortoise;
      if (active.idx != null && i === active.idx) {
        stroke = CSS.meet;
        lw = 3;
      }

      ctx.beginPath();
      ctx.roundRect(x, sy, cw, ch, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();

      ctx.fillStyle = CSS.label;
      ctx.font = `700 16px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(chars[i], x + cw / 2, sy + ch / 2 + 1);

      ctx.font = `600 10px ${FONT_SANS}`;
      ctx.fillText(String(i), x + cw / 2, sy + ch + 12);
    }

    const boxW = Math.max(88, Math.min(130, Math.floor(width * 0.18)));
    const boxH = 50;
    const y = Math.max(176, Math.floor(height * 0.56));
    const xPrev = Math.floor(width * 0.14);
    const xShift = Math.floor(width * 0.42);
    const xFinal = Math.floor(width * 0.72);

    const stripSlots = chars.length;
    const stripGap = 10;
    const stripW = Math.max(34, Math.min(46, Math.floor((width - 100 - stripGap * (stripSlots - 1)) / Math.max(1, stripSlots))));
    const stripH = 34;
    const stripTotal = stripW * stripSlots + stripGap * (stripSlots - 1);
    const stripX = Math.max(20, Math.floor((width - stripTotal) / 2));
    const stripY = Math.min(height - stripH - 22, y + boxH + 44);

    ctx.fillStyle = CSS.label;
    ctx.font = `600 11px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('prev', xPrev + boxW / 2, y - 16);
    ctx.fillText('prev × 26', xShift + boxW / 2, y - 16);
    ctx.fillText('new result', xFinal + boxW / 2, y - 16);

    function drawOperatorText(op, x, activeColor) {
      ctx.fillStyle = activeColor ? CSS.meet : CSS.label;
      ctx.font = `700 16px ${FONT_SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(op, x, y + boxH / 2);
    }

    function slotCenterX(slotIndex) {
      return stripX + slotIndex * (stripW + stripGap) + stripW / 2;
    }

    function drawStripFrame(highlightShift) {
      ctx.fillStyle = CSS.label;
      ctx.font = `600 11px ${FONT_SANS}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('Base-26 place shift (×26 moves existing values one slot left)', stripX, stripY - 14);

      for (let si = 0; si < stripSlots; si++) {
        const x = stripX + si * (stripW + stripGap);
        const isRightmost = si === stripSlots - 1;
        ctx.beginPath();
        ctx.roundRect(x, stripY, stripW, stripH, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = isRightmost && !highlightShift ? CSS.meet : CSS.node;
        ctx.lineWidth = isRightmost && !highlightShift ? 2.5 : 1.8;
        ctx.stroke();
      }
    }

    function drawStripChip(cx, value, stroke, alpha = 1) {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(cx, stripY + stripH / 2, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.fillStyle = stroke;
      ctx.font = `700 11px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(value), cx, stripY + stripH / 2 + 1);
      ctx.globalAlpha = 1;
    }

    if (isAnimating && toSnapshot.idx != null && toSnapshot.prevResult != null) {
      const prev = toSnapshot.prevResult;
      const shifted = prev * 26;

      drawValueBox(ctx, xPrev, y, boxW, boxH, prev, CSS.node);
      drawValueBox(ctx, xShift, y, boxW, boxH, shiftedValue, CSS.tortoise, 3);

      const finalText = addT <= 0.01 ? '...' : String(runningResult);
      drawValueBox(ctx, xFinal, y, boxW, boxH, finalText, CSS.meet, 3, addT <= 0.01 ? 0.55 : 1);

      drawOperatorText('→', xPrev + boxW + 22, addT <= 0.01);
      drawOperatorText('+', xShift + boxW + 18, addT > 0.01);

      drawStripFrame(addT <= 0.01);

      const beforeValues = toSnapshot.chars.slice(0, toSnapshot.idx).map((ch) => charValue(ch));
      const bm = beforeValues.length;
      for (let k = 0; k < bm; k++) {
        const beforeSlot = stripSlots - bm + k;
        const shiftedSlot = Math.max(0, beforeSlot - 1);
        const chipX = lerp(slotCenterX(beforeSlot), slotCenterX(shiftedSlot), shiftT);
        drawStripChip(chipX, beforeValues[k], CSS.tortoise);
      }

      if (current != null) {
        const valStartX = sx + current * (cw + gap) + cw / 2;
        const valStartY = sy + ch + 24;
        const valEndX = xShift + boxW + 46;
        const valEndY = y + boxH / 2;
        const bx = lerp(valStartX, valEndX, addT);
        const by = lerp(valStartY, valEndY, addT);

        ctx.globalAlpha = addT;
        ctx.beginPath();
        ctx.arc(bx, by, 13, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = CSS.hare;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = CSS.hare;
        ctx.font = `700 12px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(toSnapshot.value), bx, by + 1);
        ctx.globalAlpha = 1;

        const stripStartX = valStartX;
        const stripEndX = slotCenterX(stripSlots - 1);
        const stripChipX = lerp(stripStartX, stripEndX, addT);
        drawStripChip(stripChipX, toSnapshot.value, CSS.hare, addT);
      }
    } else if (active.idx != null && active.prevResult != null) {
      const shifted = active.prevResult * 26;
      drawValueBox(ctx, xPrev, y, boxW, boxH, active.prevResult, CSS.node);
      drawValueBox(ctx, xShift, y, boxW, boxH, shifted, CSS.tortoise, 3);
      drawValueBox(ctx, xFinal, y, boxW, boxH, active.result, CSS.meet, 3);
      drawOperatorText('→', xPrev + boxW + 22, false);
      drawOperatorText('+', xShift + boxW + 18, false);

      const plusX = xShift + boxW + 46;
      const plusY = y + boxH / 2;
      ctx.beginPath();
      ctx.arc(plusX, plusY, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = CSS.hare;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = CSS.hare;
      ctx.font = `700 12px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(active.value), plusX, plusY + 1);

      drawStripFrame(false);
      const doneValues = active.chars.slice(0, active.idx + 1).map((ch) => charValue(ch));
      const startSlot = stripSlots - doneValues.length;
      for (let k = 0; k < doneValues.length; k++) {
        drawStripChip(slotCenterX(startSlot + k), doneValues[k], CSS.tortoise);
      }
    } else {
      drawValueBox(ctx, xFinal, y, boxW, boxH, active.result, CSS.meet, 3);
      drawStripFrame(false);
    }
  }

  createSnapshotVisualization({
    canvasId: 'excelColCanvas', statusId: 'excelColStatus',
    prevId: 'excelColPrev', nextId: 'excelColNext', resetId: 'excelColReset',
    buildSnapshots,
    draw,
    animationMs: 980,
    rebuildSnapshotsOnReset: true,
  });
}
