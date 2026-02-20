/**
 * LFU Cache — freq buckets + HashMap, snapshot-based visualization.
 */

import {
  FONT_SANS, FONT_MONO, CSS,
  getRandomIntInclusive,
  createSnapshotVisualization,
} from '../viz-core.js';

export default function initLFUCacheVisualization() {
  function generateOps(capacity) {
    const ops = [];
    const keyRange = capacity + 5;
    const usedKeys = new Set();
    for (let i = 0; i < capacity + 2; i++) {
      let k;
      do { k = getRandomIntInclusive(1, keyRange); } while (usedKeys.has(k));
      usedKeys.add(k);
      ops.push({ type: 'put', key: k, value: getRandomIntInclusive(1, 20) });
    }
    const allKeys = [...usedKeys];
    for (let i = 0; i < 3; i++) {
      ops.push({ type: 'get', key: allKeys[getRandomIntInclusive(0, allKeys.length - 1)] });
    }
    const totalOps = getRandomIntInclusive(18, 22);
    while (ops.length < totalOps) {
      const k = getRandomIntInclusive(1, keyRange);
      if (Math.random() < 0.35) {
        ops.push({ type: 'get', key: k });
      } else {
        ops.push({ type: 'put', key: k, value: getRandomIntInclusive(1, 20) });
      }
    }
    return ops;
  }

  function buildSnapshots() {
    const capacity = getRandomIntInclusive(2, 6);
    const ops = generateOps(capacity);

    const keyNode = new Map();
    const freqKeys = new Map();
    let minFreq = 0;

    function addToFreq(freq, key) {
      if (!freqKeys.has(freq)) freqKeys.set(freq, []);
      freqKeys.get(freq).push(key);
    }
    function removeFromFreq(freq, key) {
      const list = freqKeys.get(freq);
      if (!list) return;
      const idx = list.indexOf(key);
      if (idx >= 0) list.splice(idx, 1);
      if (list.length === 0) freqKeys.delete(freq);
    }

    function snapshotBuckets() {
      const buckets = [];
      const freqs = [...freqKeys.keys()].sort((a, b) => a - b);
      for (const f of freqs) {
        buckets.push({ freq: f, keys: [...freqKeys.get(f)] });
      }
      return buckets;
    }
    function snapshotMap() {
      const rows = [];
      for (const [k, node] of keyNode) {
        rows.push({ key: k, value: node.value, freq: node.freq });
      }
      return rows;
    }

    const snaps = [];
    snaps.push({
      capacity,
      op: null,
      result: null,
      evictedKey: null,
      minFreq: 0,
      buckets: [],
      mapRows: [],
      activeKey: null,
      text: `LFU Cache created with capacity = ${capacity}.`,
    });

    for (let oi = 0; oi < ops.length; oi++) {
      const op = ops[oi];
      let result = null;
      let evictedKey = null;

      if (op.type === 'get') {
        if (keyNode.has(op.key)) {
          const node = keyNode.get(op.key);
          result = node.value;
          const oldFreq = node.freq;
          removeFromFreq(oldFreq, op.key);
          node.freq += 1;
          addToFreq(node.freq, op.key);
          if (minFreq === oldFreq && !freqKeys.has(oldFreq)) {
            minFreq = oldFreq + 1;
          }
        } else {
          result = -1;
        }
      } else {
        if (capacity <= 0) continue;
        if (keyNode.has(op.key)) {
          const node = keyNode.get(op.key);
          node.value = op.value;
          const oldFreq = node.freq;
          removeFromFreq(oldFreq, op.key);
          node.freq += 1;
          addToFreq(node.freq, op.key);
          if (minFreq === oldFreq && !freqKeys.has(oldFreq)) {
            minFreq = oldFreq + 1;
          }
        } else {
          if (keyNode.size >= capacity) {
            const minList = freqKeys.get(minFreq);
            const victimKey = minList.shift();
            if (minList.length === 0) freqKeys.delete(minFreq);
            keyNode.delete(victimKey);
            evictedKey = victimKey;
          }
          keyNode.set(op.key, { key: op.key, value: op.value, freq: 1 });
          addToFreq(1, op.key);
          minFreq = 1;
        }
      }

      const getDesc = result === -1
        ? `get(${op.key}): miss → -1.`
        : `get(${op.key}): hit → ${result}, freq++.`;
      const putDesc = evictedKey != null
        ? `put(${op.key}, ${op.value}): full → evict key ${evictedKey} (minFreq bucket), insert.`
        : `put(${op.key}, ${op.value}): ${keyNode.has(op.key) && ops.slice(0, oi).some(o => o.key === op.key) ? 'update, freq++' : 'insert, freq=1'}.`;

      snaps.push({
        capacity,
        op,
        result,
        evictedKey,
        minFreq,
        buckets: snapshotBuckets(),
        mapRows: snapshotMap(),
        activeKey: op.key,
        text: op.type === 'get' ? getDesc : putDesc,
      });
    }

    const last = snaps[snaps.length - 1];
    snaps.push({
      ...last,
      op: null,
      evictedKey: null,
      activeKey: null,
      text: `Done. ${ops.length} operations complete. Reset for a new random sequence.`,
    });

    return snaps;
  }

  /* Drawing helpers */

  function drawChip(ctx, x, y, w, h, label, { stroke = CSS.node, lw = 2 } = {}) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();

    ctx.fillStyle = CSS.label;
    ctx.font = `700 12px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label), x + w / 2, y + h / 2 + 1);
  }

  function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
    if (width < 10 || height < 10) return;
    const active = isAnimating ? toSnapshot : snapshot;

    /* ---- Operation header ---- */
    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const opStr = active.op
      ? (active.op.type === 'get'
        ? `get(${active.op.key})` + (active.result != null ? ` → ${active.result}` : '')
        : `put(${active.op.key}, ${active.op.value})`)
      : '—';
    ctx.fillText(`Op: ${opStr}`, 16, 20);
    ctx.fillText(`Capacity: ${active.capacity}`, width - 140, 20);
    ctx.fillText(`minFreq: ${active.minFreq}`, width / 2 - 40, 20);

    if (active.evictedKey != null) {
      ctx.fillStyle = CSS.hare;
      ctx.fillText(`Evicted: key ${active.evictedKey}`, 16, 40);
    }

    /* ---- Frequency buckets (left ~60%) ---- */
    const bucketsX = 16;
    const bucketsW = Math.floor(width * 0.58);
    const bucketsTopY = 60;

    ctx.fillStyle = CSS.label;
    ctx.font = `700 12px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.fillText('Frequency Buckets (oldest → newest)', bucketsX, bucketsTopY - 8);

    const buckets = active.buckets;
    const bucketRowH = 44;
    const bucketGap = 10;
    const chipW = 40;
    const chipH = 30;
    const chipGap = 6;

    if (buckets.length === 0) {
      ctx.fillStyle = CSS.edge;
      ctx.font = `600 12px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText('(empty)', bucketsX + bucketsW / 2, bucketsTopY + 20);
    }

    for (let bi = 0; bi < buckets.length; bi++) {
      const bucket = buckets[bi];
      const by = bucketsTopY + bi * (bucketRowH + bucketGap);
      const isMin = bucket.freq === active.minFreq;

      const frameW = bucketsW - 10;
      ctx.save();
      if (isMin) {
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = CSS.meet;
        ctx.beginPath();
        ctx.roundRect(bucketsX, by, frameW, bucketRowH, 8);
        ctx.fill();
      }
      ctx.restore();

      ctx.strokeStyle = isMin ? CSS.meet : CSS.edge;
      ctx.lineWidth = isMin ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(bucketsX, by, frameW, bucketRowH, 8);
      ctx.stroke();

      ctx.fillStyle = isMin ? CSS.meet : CSS.label;
      ctx.font = `700 11px ${FONT_SANS}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`freq=${bucket.freq}`, bucketsX + 6, by + bucketRowH / 2);

      const chipStartX = bucketsX + 72;
      for (let ki = 0; ki < bucket.keys.length; ki++) {
        const cx = chipStartX + ki * (chipW + chipGap);
        const isActive = active.activeKey != null && bucket.keys[ki] === active.activeKey;
        drawChip(ctx, cx, by + (bucketRowH - chipH) / 2, chipW, chipH,
          `k:${bucket.keys[ki]}`, {
            stroke: isActive ? CSS.meet : CSS.tortoise,
            lw: isActive ? 3 : 2,
          });
      }
    }

    /* ---- HashMap table (right ~38%) ---- */
    const tableX = Math.floor(width * 0.62);
    const tableTopY = 60;
    const colW = Math.min(78, Math.floor((width - tableX - 16) / 3));
    const rowH = 26;

    ctx.fillStyle = CSS.label;
    ctx.font = `700 12px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.fillText('HashMap', tableX, tableTopY - 8);

    ctx.fillStyle = CSS.edge;
    ctx.font = `700 11px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Key', tableX + colW / 2, tableTopY + rowH / 2);
    ctx.fillText('Val', tableX + colW + colW / 2, tableTopY + rowH / 2);
    ctx.fillText('Freq', tableX + colW * 2 + colW / 2, tableTopY + rowH / 2);

    ctx.strokeStyle = CSS.edge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tableX, tableTopY + rowH);
    ctx.lineTo(tableX + colW * 3, tableTopY + rowH);
    ctx.stroke();

    const mapRows = active.mapRows;
    for (let i = 0; i < mapRows.length; i++) {
      const ry = tableTopY + rowH + i * rowH;
      const isAct = active.activeKey != null && mapRows[i].key === active.activeKey;

      if (isAct) {
        ctx.save();
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = CSS.meet;
        ctx.fillRect(tableX, ry, colW * 3, rowH);
        ctx.restore();
      }

      ctx.fillStyle = CSS.label;
      ctx.font = `600 12px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(mapRows[i].key), tableX + colW / 2, ry + rowH / 2);
      ctx.fillText(String(mapRows[i].value), tableX + colW + colW / 2, ry + rowH / 2);
      ctx.fillText(String(mapRows[i].freq), tableX + colW * 2 + colW / 2, ry + rowH / 2);
    }

    if (mapRows.length === 0) {
      ctx.fillStyle = CSS.edge;
      ctx.font = `600 12px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText('(empty)', tableX + colW * 1.5, tableTopY + rowH + 14);
    }
  }

  createSnapshotVisualization({
    canvasId: 'lfuCanvas', statusId: 'lfuStatus',
    prevId: 'lfuPrev', nextId: 'lfuNext', resetId: 'lfuReset',
    buildSnapshots, draw, animationMs: 680,
    rebuildSnapshotsOnReset: true,
  });
}
