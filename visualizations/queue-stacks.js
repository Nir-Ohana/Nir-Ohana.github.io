/**
 * Implement Queue using Stacks visualization
 */

import {
    FONT_SANS, FONT_MONO, CSS,
    getRandomIntInclusive,
    easeOutCubic,
    createSnapshotVisualization,
} from '../viz-core.js';

export default function initQueueStacksVisualization() {
    function generateOps() {
        const ops = [];
        const pushCount = getRandomIntInclusive(3, 5);
        for (let i = 0; i < pushCount; i++) {
            ops.push({ type: 'push', value: getRandomIntInclusive(1, 99) });
        }

        // Mix pushes and pops to show amortized behavior
        let size = pushCount;
        // ensure we pop all occasionally to force a move
        ops.push({ type: 'pop' });
        ops.push({ type: 'pop' });
        size -= 2;

        ops.push({ type: 'push', value: getRandomIntInclusive(1, 99) });
        ops.push({ type: 'push', value: getRandomIntInclusive(1, 99) });
        size += 2;

        // A peek before moving more things
        ops.push({ type: 'peek' });

        // pop the rest
        while (size > 0) {
            ops.push({ type: 'pop' });
            size--;
        }

        // one more push and pop to show it starting over
        ops.push({ type: 'push', value: getRandomIntInclusive(1, 99) });
        ops.push({ type: 'pop' });

        return ops;
    }

    function buildSnapshots() {
        const ops = generateOps();

        let inStack = [];
        let outStack = [];

        const snaps = [];
        snaps.push({
            op: null,
            inStack: [...inStack],
            outStack: [...outStack],
            movingVal: null,
            activeAction: null,
            text: `Queue initialized using two stacks: in_stack (for pushing) and out_stack (for popping).`,
        });

        for (let oi = 0; oi < ops.length; oi++) {
            const op = ops[oi];

            if (op.type === 'push') {
                inStack.push(op.value);
                snaps.push({
                    op,
                    inStack: [...inStack],
                    outStack: [...outStack],
                    movingVal: null,
                    activeAction: 'push',
                    text: `push(${op.value}): O(1) - Push directly onto in_stack.`,
                });
            } else if (op.type === 'pop' || op.type === 'peek') {
                const isPeek = op.type === 'peek';
                const opName = isPeek ? 'peek()' : 'pop()';
                snaps.push({
                    op,
                    inStack: [...inStack],
                    outStack: [...outStack],
                    movingVal: null,
                    activeAction: 'start_op',
                    text: `${opName}: Amortized O(1) - Need to access the oldest element via out_stack.`,
                });

                if (outStack.length === 0) {
                    snaps.push({
                        op,
                        inStack: [...inStack],
                        outStack: [...outStack],
                        movingVal: null,
                        activeAction: 'prepare',
                        text: `${opName}: out_stack is empty! Move elements from in_stack to out_stack...`,
                    });

                    while (inStack.length > 0) {
                        const val = inStack.pop();
                        outStack.push(val);
                        snaps.push({
                            op,
                            inStack: [...inStack],
                            outStack: [...outStack],
                            movingVal: val,
                            activeAction: 'moving',
                            text: `${opName}: Popped ${val} from in_stack, pushed to out_stack.`,
                        });
                    }

                    snaps.push({
                        op,
                        inStack: [...inStack],
                        outStack: [...outStack],
                        movingVal: null,
                        activeAction: 'ready',
                        text: `${opName}: Elements moved. The oldest element is now at the top of out_stack.`,
                    });
                } else {
                    snaps.push({
                        op,
                        inStack: [...inStack],
                        outStack: [...outStack],
                        movingVal: null,
                        activeAction: 'ready',
                        text: `${opName}: out_stack is NOT empty. Oldest elements are already there.`,
                    });
                }

                if (isPeek) {
                    const topElement = outStack[outStack.length - 1];
                    snaps.push({
                        op,
                        inStack: [...inStack],
                        outStack: [...outStack],
                        movingVal: topElement,
                        activeAction: 'returning_keep',
                        text: `${opName}: Return the top of out_stack (${topElement}).`,
                    });
                } else {
                    const poppedElement = outStack.pop();
                    snaps.push({
                        op,
                        inStack: [...inStack],
                        outStack: [...outStack],
                        movingVal: poppedElement,
                        activeAction: 'returning_discard',
                        text: `${opName}: Pop and return the top of out_stack (${poppedElement}).`,
                    });
                }
            }
        }

        snaps.push({
            op: null,
            inStack: [...inStack],
            outStack: [...outStack],
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
            const by = y + h + 6; // Badge below for vertical stacks
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

    function drawStack(ctx, x, label, stackArray, startY, chipW, chipH, chipGap, hideIndex = -1) {
        const sWidth = 80;
        const sHeight = Math.max(260, Math.abs(startY) + Math.abs(stackArray.length * (chipH + chipGap)) + 40);
        const bottomY = startY;
        const topY = bottomY - sHeight;

        // Draw stack container (open at top)
        ctx.strokeStyle = CSS.edge;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x, bottomY);
        ctx.lineTo(x + sWidth, bottomY);
        ctx.lineTo(x + sWidth, topY);
        ctx.stroke();

        ctx.fillStyle = CSS.label;
        ctx.font = `700 13px ${FONT_SANS}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, x + sWidth / 2, bottomY + 10);

        ctx.font = `11px ${FONT_SANS}`;
        ctx.fillStyle = CSS.muted;
        ctx.fillText('Bottom', x + sWidth / 2, bottomY - 14);
        ctx.fillText('Top', x + sWidth / 2, topY + 10);

        for (let i = 0; i < stackArray.length; i++) {
            if (i === hideIndex) continue;
            const cx = x + (sWidth - chipW) / 2;
            // Stack goes UP from the bottom
            const cy = bottomY - 20 - (i + 1) * chipH - i * chipGap;
            drawChip(ctx, cx, cy, chipW, chipH, stackArray[i], CSS.node);
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

        const s1X = width / 2 - 120;
        const s2X = width / 2 + 40;
        const startY = 320; // Bottom of stacks
        const chipW = 50;
        const chipH = 30;
        const chipGap = 8;

        let inS = active.inStack;
        let outS = active.outStack;

        let s1Label = 'in_stack';
        let s2Label = 'out_stack';

        let inSHideIndex = -1;
        let outSHideIndex = -1;

        if (isAnimating) {
            if (active.activeAction === 'push') {
                inSHideIndex = inS.length - 1;
            } else if (active.activeAction === 'moving' && toSnapshot.outStack.length > 0) {
                outSHideIndex = outS.length - 1;
            }
        }

        drawStack(ctx, s1X, s1Label, inS, startY, chipW, chipH, chipGap, inSHideIndex);
        drawStack(ctx, s2X, s2Label, outS, startY, chipW, chipH, chipGap, outSHideIndex);

        const animProgress = isAnimating ? easeOutCubic(progress) : 1;

        // Animate item popping from in_stack and pushing to out_stack
        if (isAnimating && active.movingVal !== null) {
            if (active.activeAction === 'moving') {
                // Start from top of inStack (which is one element higher conceptually since it was popped)
                const sX = s1X + (80 - chipW) / 2;
                const sY = startY - 20 - (active.inStack.length + 1) * chipH - active.inStack.length * chipGap;

                // End at top of outStack
                const eX = s2X + (80 - chipW) / 2;
                const eY = startY - 20 - (active.outStack.length) * chipH - (active.outStack.length - 1) * chipGap;

                // Parabolic arc for moving between stacks
                const currX = sX + (eX - sX) * animProgress;
                const linearY = sY + (eY - sY) * animProgress;
                const arcHeight = -50;
                const currY = linearY + arcHeight * Math.sin(animProgress * Math.PI);

                drawChip(ctx, currX, currY, chipW, chipH, active.movingVal, CSS.meet, 'Moving', CSS.meet);
            } else if (active.activeAction === 'returning_discard' || active.activeAction === 'returning_keep') {
                const isKeep = active.activeAction === 'returning_keep';
                // From top of out_stack
                const sX = s2X + (80 - chipW) / 2;
                const sLength = isKeep ? active.outStack.length : active.outStack.length + 1; // if discarded, length was reduced
                const sY = startY - 20 - (sLength) * chipH - (sLength - 1) * chipGap;

                // Move up and fade out if discard, or just jiggle if keep
                let currX = sX;
                let currY = sY;

                ctx.save();
                if (isKeep) {
                    currY = sY - 10 * Math.sin(animProgress * Math.PI);
                    drawChip(ctx, currX, currY, chipW, chipH, active.movingVal, CSS.meet, 'Peek', CSS.meet);
                } else {
                    const eY = sY - 60;
                    currY = sY + (eY - sY) * animProgress;
                    ctx.globalAlpha = 1 - animProgress;
                    drawChip(ctx, currX, currY, chipW, chipH, active.movingVal, CSS.hare, 'Popped', CSS.hare);
                }
                ctx.restore();
            }
        }

        // Animate pushing onto in_stack
        if (isAnimating && active.activeAction === 'push') {
            const eX = s1X + (80 - chipW) / 2;
            const eY = startY - 20 - (inS.length) * chipH - (inS.length - 1) * chipGap;
            const sX = eX;
            const sY = eY - 80;

            const currX = sX + (eX - sX) * animProgress;
            const currY = sY + (eY - sY) * animProgress;

            ctx.save();
            ctx.globalAlpha = animProgress;
            drawChip(ctx, currX, currY, chipW, chipH, inS[inS.length - 1], CSS.meet, 'Push', CSS.meet);
            ctx.restore();
        }
    }

    createSnapshotVisualization({
        canvasId: 'queueStacksCanvas', statusId: 'queueStacksStatus',
        prevId: 'queueStacksPrev', nextId: 'queueStacksNext', resetId: 'queueStacksReset',
        buildSnapshots, draw, animationMs: 700,
        rebuildSnapshotsOnReset: true,
    });
}
