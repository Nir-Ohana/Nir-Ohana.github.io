/**
 * LRU Cache — DLL with dummy head/tail + HashMap, snapshot-based visualization.
 */

import {
  FONT_SANS, FONT_MONO, CSS,
  getRandomIntInclusive,
  createSnapshotVisualization,
} from '../viz-core.js';

export default function initLRUCacheVisualization() {
  function generateOps(capacity) {
    const ops = [];
    const keyRange = capacity + 4;
    const usedKeys = new Set();
    for (let i = 0; i < capacity + 2; i++) {
      let k;
      do { k = getRandomIntInclusive(1, keyRange); } while (usedKeys.has(k));
      usedKeys.add(k);
      ops.push({ type: 'put', key: k, value: getRandomIntInclusive(1, 20) });
    }
    const totalOps = getRandomIntInclusive(12, 16);
    while (ops.length < totalOps) {
      const k = getRandomIntInclusive(1, keyRange);
      if (Math.random() < 0.4) {
        ops.push({ type: 'get', key: k });
      } else {
        ops.push({ type: 'put', key: k, value: getRandomIntInclusive(1, 20) });
      }
    }
    return ops;
  }

  function buildSnapshots() {
    const capacity = 5;
    const ops = generateOps(capacity);

    let idCounter = 0;
    function makeNode(key, value) {
      return { id: ++idCounter, key, value, prev: null, next: null };
    }
    const head = makeNode('H', '');
    const tail = makeNode('T', '');
    head.next = tail;
    tail.prev = head;
    const map = new Map();

    function remove(node) {
      node.prev.next = node.next;
      node.next.prev = node.prev;
    }
    function insertAfterHead(node) {
      node.next = head.next;
      node.prev = head;
      head.next.prev = node;
      head.next = node;
    }
    function listOrder() {
      const order = [];
      let cur = head.next;
      while (cur !== tail) {
        order.push({ key: cur.key, value: cur.value });
        cur = cur.next;
      }
      return order;
    }
    function mapView() {
      const rows = [];
      for (const [k, n] of map) rows.push({ key: k, value: n.value });
      return rows;
    }

    const snaps = [];
    snaps.push({
      capacity,
      op: null,
      result: null,
      evictedKey: null,
      listOrder: [],
      mapView: [],
      activeKey: null,
      text: `LRU Cache created with capacity = ${capacity}. Dummy head ↔ tail.`,
    });

    for (let oi = 0; oi < ops.length; oi++) {
      const op = ops[oi];
      let result = null;
      let evictedKey = null;
      let activeAction = null;

      if (op.type === 'get') {
        if (map.has(op.key)) {
          activeAction = 'Hit';
          const node = map.get(op.key);
          result = node.value;
          remove(node);
          insertAfterHead(node);
        } else {
          activeAction = 'Miss';
          result = -1;
        }
      } else {
        if (map.has(op.key)) {
          activeAction = 'Updated';
          const node = map.get(op.key);
          node.value = op.value;
          remove(node);
          insertAfterHead(node);
        } else {
          activeAction = 'Inserted';
          if (map.size >= capacity) {
            const victim = tail.prev;
            evictedKey = victim.key;
            remove(victim);
            map.delete(victim.key);
          }
          const node = makeNode(op.key, op.value);
          insertAfterHead(node);
          map.set(op.key, node);
        }
      }

      const getDesc = result === -1
        ? `get(${op.key}): miss → -1.`
        : `get(${op.key}): hit → ${result}, move to front.`;
      const putDesc = evictedKey != null
        ? `put(${op.key}, ${op.value}): full → evict key ${evictedKey}, insert at front.`
        : `put(${op.key}, ${op.value}): ${activeAction.toLowerCase()} at front.`;

      snaps.push({
        capacity,
        op,
        result,
        evictedKey,
        activeAction,
        listOrder: listOrder(),
        mapView: mapView(),
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

  function drawDLLNode(ctx, x, y, w, h, label, sublabel, { stroke = CSS.node, lw = 2, dimmed = false, badge = null, badgeColor = CSS.meet } = {}) {
    ctx.save();
    if (dimmed) ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();

    ctx.fillStyle = CSS.label;
    ctx.font = `700 14px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label), x + w / 2, y + h / 2 - (sublabel != null ? 6 : 0));

    if (sublabel != null) {
      ctx.font = `600 10px ${FONT_SANS}`;
      ctx.fillText(String(sublabel), x + w / 2, y + h / 2 + 10);
    }
    ctx.restore();

    if (badge) {
      ctx.font = `bold 10px ${FONT_SANS}`;
      const bw = ctx.measureText(badge).width + 10;
      const bh = 16;
      const bx = x + w / 2 - bw / 2;
      const by = y - bh - 6;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 4);
      ctx.fillStyle = badgeColor;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badge, x + w / 2, by + bh / 2 + 1);
    }
  }

  function drawArrow(ctx, x1, y, x2, color, offsetY) {
    const tipLen = 5;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y + offsetY);
    ctx.lineTo(x2, y + offsetY);
    ctx.stroke();
    if (x2 > x1) {
      ctx.beginPath();
      ctx.moveTo(x2, y + offsetY);
      ctx.lineTo(x2 - tipLen, y + offsetY - 3);
      ctx.lineTo(x2 - tipLen, y + offsetY + 3);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(x2, y + offsetY);
      ctx.lineTo(x2 + tipLen, y + offsetY - 3);
      ctx.lineTo(x2 + tipLen, y + offsetY + 3);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
    if (width < 10 || height < 10) return;
    const active = isAnimating ? toSnapshot : snapshot;

    /* ---- Operation strip ---- */
    ctx.fillStyle = CSS.label;
    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const opStr = active.op
      ? (active.op.type === 'get'
        ? `get(${active.op.key})` + (active.result != null ? ` → ${active.result}` : '')
        : `put(${active.op.key}, ${active.op.value})`)
      : '—';
    ctx.fillText(`Operation: ${opStr}`, 16, 22);
    ctx.fillText(`Capacity: ${active.capacity}`, width - 140, 22);

    if (active.evictedKey != null) {
      ctx.fillStyle = CSS.hare;
      ctx.fillText(`Evicted: key ${active.evictedKey}`, 16, 42);
    }

    /* ---- Doubly linked list (head → ... → tail) ---- */
    const listY = 72;
    const nodeW = 52;
    const nodeH = 44;
    const listNodes = active.listOrder;
    const totalNodes = listNodes.length + 2;
    const gap = 28;
    const totalW = totalNodes * nodeW + (totalNodes - 1) * gap;
    const listSx = Math.max(10, Math.floor((width - totalW) / 2));

    ctx.fillStyle = CSS.label;
    ctx.font = `700 12px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.fillText('Doubly Linked List (MRU ← → LRU)', 16, listY - 10);

    drawDLLNode(ctx, listSx, listY, nodeW, nodeH, 'HEAD', null, {
      stroke: CSS.edge, lw: 2, dimmed: true,
    });

    for (let i = 0; i < listNodes.length; i++) {
      const nx = listSx + (i + 1) * (nodeW + gap);
      const isActive = active.activeKey != null && listNodes[i].key === active.activeKey;
      const isEvicted = active.evictedKey != null && listNodes[i].key === active.evictedKey;
      drawDLLNode(ctx, nx, listY, nodeW, nodeH,
        `k:${listNodes[i].key}`, `v:${listNodes[i].value}`, {
          stroke: isEvicted ? CSS.hare : (isActive ? CSS.meet : CSS.tortoise),
          lw: isActive || isEvicted ? 3 : 2,
          badge: isActive ? active.activeAction : null,
          badgeColor: CSS.meet
        });
    }

    const tailX = listSx + (listNodes.length + 1) * (nodeW + gap);
    drawDLLNode(ctx, tailX, listY, nodeW, nodeH, 'TAIL', null, {
      stroke: CSS.edge, lw: 2, dimmed: true,
    });

    for (let i = 0; i < totalNodes - 1; i++) {
      const x1 = listSx + i * (nodeW + gap) + nodeW;
      const x2 = listSx + (i + 1) * (nodeW + gap);
      const cy = listY + nodeH / 2;
      drawArrow(ctx, x1 + 2, cy, x2 - 2, CSS.edge, -5);
      drawArrow(ctx, x2 - 2, cy, x1 + 2, CSS.edge, 5);
    }

    /* ---- HashMap table ---- */
    const mapY = listY + nodeH + 60;
    ctx.fillStyle = CSS.label;
    ctx.font = `700 12px ${FONT_SANS}`;
    ctx.textAlign = 'left';
    ctx.fillText('HashMap  key → value', 16, mapY - 10);

    const tableX = 16;
    const colW = Math.min(100, Math.floor((width - 40) / 3));
    const rowH = 28;

    ctx.fillStyle = CSS.edge;
    ctx.font = `700 12px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('Key', tableX + colW / 2, mapY + rowH / 2);
    ctx.fillText('Value', tableX + colW + colW / 2, mapY + rowH / 2);

    ctx.strokeStyle = CSS.edge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tableX, mapY + rowH);
    ctx.lineTo(tableX + colW * 2, mapY + rowH);
    ctx.stroke();

    const mapRows = active.mapView;
    for (let i = 0; i < mapRows.length; i++) {
      const ry = mapY + rowH + i * rowH;
      const isAct = active.activeKey != null && mapRows[i].key === active.activeKey;

      if (isAct) {
        ctx.save();
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = CSS.meet;
        ctx.fillRect(tableX, ry, colW * 2, rowH);
        ctx.restore();
        ctx.fillStyle = CSS.meet;
      } else {
        ctx.fillStyle = CSS.label;
      }

      ctx.font = `600 13px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(mapRows[i].key), tableX + colW / 2, ry + rowH / 2);
      ctx.fillText(String(mapRows[i].value), tableX + colW + colW / 2, ry + rowH / 2);
    }

    if (mapRows.length === 0) {
      ctx.fillStyle = CSS.edge;
      ctx.font = `600 12px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText('(empty)', tableX + colW, mapY + rowH + 14);
    }
  }

  createSnapshotVisualization({
    canvasId: 'lruCanvas', statusId: 'lruStatus',
    prevId: 'lruPrev', nextId: 'lruNext', resetId: 'lruReset',
    buildSnapshots, draw, animationMs: 680,
    rebuildSnapshotsOnReset: true,
  });
}
