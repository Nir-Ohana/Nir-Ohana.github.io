/**
 * Implement Stack using Queues visualization
 */

import {
    FONT_SANS, FONT_MONO, CSS,
    getRandomIntInclusive,
    easeOutCubic,
    createSnapshotVisualization,
} from '../viz-core.js';

export default function initStackQueuesVisualization() {
    function generateOps() {
        const ops = [];
        const pushCount = getRandomIntInclusive(3, 5);
        for (let i = 0; i < pushCount; i++) {
            ops.push({ type: 'push', value: getRandomIntInclusive(1, 99) });
        }

        const totalOps = getRandomIntInclusive(12, 16);
        let size = pushCount;
        for (let i = pushCount; i < totalOps; i++) {
            const rand = Math.random();
            if (size === 0 || rand < 0.35) {
                ops.push({ type: 'push', value: getRandomIntInclusive(1, 99) });
                size++;
            } else if (rand < 0.65) {
                ops.push({ type: 'top' });
            } else {
                ops.push({ type: 'pop' });
                size--;
            }
        }
        return ops;
    }

    function buildSnapshots() {
        const ops = generateOps();

        let inQueue = [];
        let outQueue = [];

        const snaps = [];
        snaps.push({
            op: null,
            inQueue: [...inQueue],
            outQueue: [...outQueue],
            movingVal: null,
            activeAction: null,
            text: `Stack initialized using two queues: in_queue (main) and out_queue (helper).`,
        });

        for (let oi = 0; oi < ops.length; oi++) {
            const op = ops[oi];

            if (op.type === 'push') {
                inQueue.push(op.value);
                snaps.push({
                    op,
                    inQueue: [...inQueue],
                    outQueue: [...outQueue],
                    movingVal: null,
                    activeAction: 'push',
                    text: `push(${op.value}): O(1) - Enqueue directly to in_queue.`,
                });
            } else if (op.type === 'pop' || op.type === 'top') {
                const isTop = op.type === 'top';
                const opName = isTop ? 'top()' : 'pop()';
                snaps.push({
                    op,
                    inQueue: [...inQueue],
                    outQueue: [...outQueue],
                    movingVal: null,
                    activeAction: 'start_move',
                    text: `${opName}: O(n) - Start dequeuing elements from in_queue to out_queue...`,
                });

                while (inQueue.length > 1) {
                    const val = inQueue.shift();
                    outQueue.push(val);
                    snaps.push({
                        op,
                        inQueue: [...inQueue],
                        outQueue: [...outQueue],
                        movingVal: val,
                        activeAction: 'moving',
                        text: `${opName}: Moved ${val} to out_queue.`,
                    });
                }

                const lastElement = inQueue.shift();

                if (isTop) {
                    outQueue.push(lastElement);
                    snaps.push({
                        op,
                        inQueue: [...inQueue],
                        outQueue: [...outQueue],
                        movingVal: lastElement,
                        activeAction: 'returning_keep',
                        text: `${opName}: Last element is ${lastElement}. Enqueue back to out_queue so it's kept.`,
                    });
                } else {
                    snaps.push({
                        op,
                        inQueue: [...inQueue],
                        outQueue: [...outQueue],
                        movingVal: lastElement,
                        activeAction: 'returning_discard',
                        text: `${opName}: Last element is ${lastElement}. Discard it (return ${lastElement}).`,
                    });
                }

                const temp = inQueue;
                inQueue = outQueue;
                outQueue = temp;

                snaps.push({
                    op,
                    inQueue: [...inQueue],
                    outQueue: [...outQueue],
                    movingVal: null,
                    activeAction: 'swap',
                    text: `${opName}: Swap queue names so in_queue is ready for next operation.`,
                });
            }
        }

        snaps.push({
            op: null,
            inQueue: [...inQueue],
            outQueue: [...outQueue],
            movingVal: null,
            activeAction: null,
            text: `Done. ${ops.length} operations complete. Reset for a new sequence.`,
        });

        return snaps;
    }

    function drawChip(ctx, x, y, w, h, label, stroke, badge, badgeColor) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = CSS.label;
        ctx.font = `600 14px ${FONT_MONO}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(label), x + w / 2, y + h / 2 + 1);

        if (badge) {
            ctx.font = `bold 10px ${FONT_SANS}`;
            const bw = ctx.measureText(badge).width + 8;
            const bh = 14;
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

    function drawQueue(ctx, y, label, queueArray, startX, chipW, chipH, chipGap, hideIndex = -1) {
        const qWidth = Math.max(300, startX + queueArray.length * (chipW + chipGap) + 40);
        const qHeight = 60;

        ctx.strokeStyle = CSS.edge;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(16, y, qWidth, qHeight, 8);
        ctx.stroke();

        ctx.fillStyle = CSS.label;
        ctx.font = `700 13px ${FONT_SANS}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, 16, y - 8);

        ctx.font = `11px ${FONT_SANS}`;
        ctx.fillStyle = CSS.muted;
        ctx.textAlign = 'right';
        ctx.fillText('Back (enqueue) →', 16 + qWidth - 10, y + qHeight + 16);
        ctx.textAlign = 'left';
        ctx.fillText('← Front (dequeue)', 16 + 10, y + qHeight + 16);

        for (let i = 0; i < queueArray.length; i++) {
            if (i === hideIndex) continue;
            const cx = 16 + startX + i * (chipW + chipGap);
            const cy = y + (qHeight - chipH) / 2;
            drawChip(ctx, cx, cy, chipW, chipH, queueArray[i], CSS.node);
        }
    }

    function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
        if (width < 10 || height < 10) return;
        const active = isAnimating ? toSnapshot : snapshot;

        // Operation header
        ctx.fillStyle = CSS.label;
        ctx.font = `600 14px ${FONT_SANS}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const opStr = active.op
            ? (active.op.type === 'push' ? `push(${active.op.value})` : `${active.op.type}()`)
            : '—';
        ctx.fillText(`Op: ${opStr}`, 16, 20);

        const q1Y = 80;
        const q2Y = 200;
        const chipW = 40;
        const chipH = 40;
        const chipGap = 10;
        const startX = 20;

        let inQ = active.inQueue;
        let outQ = active.outQueue;

        let q1Label = 'in_queue';
        let q2Label = 'out_queue';

        let inQHideIndex = -1;
        let outQHideIndex = -1;

        if (isAnimating) {
            if (active.activeAction === 'push') {
                inQHideIndex = inQ.length - 1;
            } else if (active.activeAction === 'moving' || active.activeAction === 'returning_keep') {
                outQHideIndex = outQ.length - 1;
            }
        }

        drawQueue(ctx, q1Y, q1Label, inQ, startX, chipW, chipH, chipGap, inQHideIndex);
        drawQueue(ctx, q2Y, q2Label, outQ, startX, chipW, chipH, chipGap, outQHideIndex);

        const animProgress = isAnimating ? easeOutCubic(progress) : 1;

        if (isAnimating && active.movingVal !== null) {
            if (active.activeAction === 'moving' || active.activeAction === 'returning_keep') {
                const sX = 16 + startX;
                const sY = q1Y + (60 - chipH) / 2;

                const eX = 16 + startX + (toSnapshot.outQueue.length - 1) * (chipW + chipGap);
                const eY = q2Y + (60 - chipH) / 2;

                const currX = sX + (eX - sX) * animProgress;
                const currY = sY + (eY - sY) * animProgress;

                drawChip(ctx, currX, currY, chipW, chipH, active.movingVal, CSS.meet, 'Moving', CSS.meet);
            } else if (active.activeAction === 'returning_discard') {
                const sX = 16 + startX;
                const sY = q1Y + (60 - chipH) / 2;

                const eX = sX;
                const eY = sY - 50;

                const currX = sX + (eX - sX) * animProgress;
                const currY = sY + (eY - sY) * animProgress;

                ctx.save();
                ctx.globalAlpha = 1 - animProgress;
                drawChip(ctx, currX, currY, chipW, chipH, active.movingVal, CSS.hare, 'Popped', CSS.hare);
                ctx.restore();
            }
        }

        if (isAnimating && active.activeAction === 'push') {
            const eX = 16 + startX + (inQ.length - 1) * (chipW + chipGap);
            const eY = q1Y + (60 - chipH) / 2;
            const sX = eX + 80;
            const sY = eY;

            const currX = sX + (eX - sX) * animProgress;
            const currY = sY + (eY - sY) * animProgress;

            ctx.save();
            ctx.globalAlpha = animProgress;
            drawChip(ctx, currX, currY, chipW, chipH, inQ[inQ.length - 1], CSS.meet, 'Push', CSS.meet);
            ctx.restore();
        }

        // Animate Swap Queues Labels
        if (active.activeAction === 'swap') {
            const msgY = q1Y + (q2Y - q1Y) / 2 + 30;
            ctx.fillStyle = CSS.meet;
            ctx.font = `700 16px ${FONT_SANS}`;
            ctx.textAlign = 'center';

            ctx.save();
            if (isAnimating) {
                ctx.globalAlpha = animProgress; // fade in the swap text
            }
            ctx.fillText('Swapping queue roles...', width / 2, msgY);
            ctx.restore();
        }
    }

    createSnapshotVisualization({
        canvasId: 'stackQueuesCanvas', statusId: 'stackQueuesStatus',
        prevId: 'stackQueuesPrev', nextId: 'stackQueuesNext', resetId: 'stackQueuesReset',
        buildSnapshots, draw, animationMs: 700,
        rebuildSnapshotsOnReset: true,
    });
}
