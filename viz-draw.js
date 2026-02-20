/**
 * viz-draw.js — Shared Canvas 2D drawing primitives for algorithm visualizations.
 *
 * DRY helpers extracted from recurring patterns across multiple visualizations.
 * Every function receives an explicit `ctx` so it stays stateless and testable.
 */

import { CSS, FONT_MONO, FONT_SANS } from './viz-core.js';

/* ───── Rounded-rectangle cell with centered text ────────────────── */

/**
 * Draw a rounded-rect "cell" with white fill, a colored border, and one line
 * of centered text.  Covers the pattern used in Fibonacci, Merge-array,
 * Moving-average, Majority, RecentCounter, Sqrt, Hamming, Reverse-bits, etc.
 */
export function drawRectCell(ctx, x, y, w, h, text, {
  stroke = CSS.node,
  lineWidth = 2,
  radius = 10,
  font = `700 16px ${FONT_MONO}`,
  textColor = CSS.label,
  fillColor = '#ffffff',
  alpha = 1,
} = {}) {
  const needAlpha = alpha !== 1;
  if (needAlpha) ctx.globalAlpha = alpha;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  if (text != null) {
    ctx.fillStyle = textColor;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text), x + w / 2, y + h / 2 + 1);
  }

  if (needAlpha) ctx.globalAlpha = 1;
}

/* ───── Circle node with centered text ───────────────────────────── */

/**
 * Draw a circle "node" with white fill, colored border, and optional label.
 * Used by Hash-table (drawBall), Merge-lists (linked-list nodes), Tree
 * (binary-tree nodes), and animated operand balls.
 */
export function drawCircleNode(ctx, x, y, r, text, {
  stroke = CSS.node,
  lineWidth = 2,
  font = `700 16px ${FONT_MONO}`,
  textColor = CSS.label,
  fillColor = '#ffffff',
} = {}) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  if (text != null) {
    ctx.fillStyle = textColor;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text), x, y + 1);
  }
}

/* ───── Highlight frame ──────────────────────────────────────────── */

/**
 * Draw a translucent highlighted rectangle (fill + stroke).  Used for
 * sliding-window indicators (Moving Average, RecentCounter) and LFU's
 * minFreq bucket highlight.
 */
export function drawHighlightFrame(ctx, x, y, w, h, color, {
  radius = 12,
  fillAlpha = 0.12,
  strokeWidth = 2.5,
} = {}) {
  ctx.save();
  ctx.globalAlpha = fillAlpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.stroke();
}

/* ───── Directional arrow line ───────────────────────────────────── */

/**
 * Draw a line segment with a small triangular arrowhead at (x2, y2).
 * Used in LRU's doubly-linked-list arrows and Merge-lists edge arrows.
 */
export function drawArrowLine(ctx, x1, y1, x2, y2, color, {
  lineWidth = 1.5,
  tipLen = 5,
} = {}) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Direction-aware arrowhead
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - tipLen * Math.cos(angle - Math.PI / 6),
    y2 - tipLen * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    x2 - tipLen * Math.cos(angle + Math.PI / 6),
    y2 - tipLen * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/* ───── Section label ────────────────────────────────────────────── */

/** Draw a small section header label (e.g. "Stream", "Active queue"). */
export function drawSectionLabel(ctx, text, x, y, {
  font = `700 12px ${FONT_SANS}`,
  color = CSS.label,
  align = 'left',
} = {}) {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/* ───── HashMap table ────────────────────────────────────────────── */

/**
 * Draw a compact key-value (or key-value-extra) table.  Shared by
 * LRU Cache (key|value) and LFU Cache (key|value|freq).
 *
 * @param {string[]} headers  Column header labels.
 * @param {Object[]} rows     Array of row objects; values drawn by column order.
 * @param {Function} rowKey   Returns the key value of a row to match `activeKey`.
 */
export function drawHashmapTable(ctx, x, y, {
  headers,
  rows,
  activeKey = null,
  colW = 78,
  rowH = 26,
  headerFont = `700 11px ${FONT_SANS}`,
  cellFont = `600 12px ${FONT_MONO}`,
} = {}) {
  const totalW = colW * headers.length;

  // Header
  ctx.fillStyle = CSS.edge;
  ctx.font = headerFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  headers.forEach((h, i) => {
    ctx.fillText(h, x + colW * i + colW / 2, y + rowH / 2);
  });

  ctx.strokeStyle = CSS.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + rowH);
  ctx.lineTo(x + totalW, y + rowH);
  ctx.stroke();

  // Data rows
  if (rows.length === 0) {
    ctx.fillStyle = CSS.edge;
    ctx.font = `600 12px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('(empty)', x + totalW / 2, y + rowH + 14);
    return;
  }

  for (let i = 0; i < rows.length; i++) {
    const ry = y + rowH + i * rowH;
    const values = Object.values(rows[i]);
    const rowKeyVal = values[0]; // first column is the key
    const isActive = activeKey != null && rowKeyVal === activeKey;

    if (isActive) {
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = CSS.meet;
      ctx.fillRect(x, ry, totalW, rowH);
      ctx.restore();
    }

    ctx.fillStyle = CSS.label;
    ctx.font = cellFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    values.forEach((v, ci) => {
      ctx.fillText(String(v), x + colW * ci + colW / 2, ry + rowH / 2);
    });
  }
}
