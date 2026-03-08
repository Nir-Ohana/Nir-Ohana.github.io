/**
 * Range Sum Query - Immutable visualization
 */

import {
    FONT_SANS, FONT_MONO, CSS,
    getRandomIntInclusive,
    createSnapshotVisualization,
} from '../viz-core.js';

export default function initRangeSumVisualization() {
    function generateArray() {
        const size = getRandomIntInclusive(6, 8);
        const nums = [];
        for (let i = 0; i < size; i++) {
            nums.push(getRandomIntInclusive(-5, 15));
        }
        return nums;
    }

    function generateQueries(n) {
        const queries = [];
        const count = getRandomIntInclusive(3, 4);
        for (let i = 0; i < count; i++) {
            const left = getRandomIntInclusive(0, n - 1);
            const right = getRandomIntInclusive(left, n - 1);
            queries.push({ left, right });
        }
        return queries;
    }

    function buildSnapshots() {
        const nums = generateArray();
        const queries = generateQueries(nums.length);
        const prefixSums = new Array(nums.length + 1).fill(0);

        const snaps = [];
        snaps.push({
            nums: [...nums],
            prefixSums: [...prefixSums],
            phase: 'init_start',
            currI: null,
            query: null,
            text: `Initialization: create prefix_sums array of size ${nums.length + 1} with a leading 0.`,
        });

        for (let i = 0; i < nums.length; i++) {
            prefixSums[i + 1] = prefixSums[i] + nums[i];
            snaps.push({
                nums: [...nums],
                prefixSums: [...prefixSums],
                phase: 'init_step',
                currI: i,
                query: null,
                text: `prefix_sums[${i + 1}] = prefix_sums[${i}] + nums[${i}] → ${prefixSums[i]} + ${nums[i]} = ${prefixSums[i + 1]}.`,
            });
        }

        snaps.push({
            nums: [...nums],
            prefixSums: [...prefixSums],
            phase: 'init_done',
            currI: null,
            query: null,
            text: `Initialization complete in O(N). Ready for O(1) range queries.`,
        });

        for (let qi = 0; qi < queries.length; qi++) {
            const q = queries[qi];
            const sum = prefixSums[q.right + 1] - prefixSums[q.left];
            snaps.push({
                nums: [...nums],
                prefixSums: [...prefixSums],
                phase: 'query',
                currI: null,
                query: q,
                result: sum,
                text: `sumRange(${q.left}, ${q.right}): prefix_sums[${q.right + 1}] - prefix_sums[${q.left}] → ${prefixSums[q.right + 1]} - ${prefixSums[q.left]} = ${sum}.`,
            });
        }

        snaps.push({
            nums: [...nums],
            prefixSums: [...prefixSums],
            phase: 'done',
            currI: null,
            query: null,
            text: `Done. Processed ${queries.length} queries. Reset for a new random array.`,
        });

        return snaps;
    }

    function drawArray(ctx, y, label, labelSub, array, cellW, cellH, activeIndices, colorMode) {
        const totalW = array.length * cellW;
        const arrayX = 150;

        ctx.fillStyle = CSS.label;
        ctx.font = `600 14px ${FONT_SANS}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, arrayX - 16, y + cellH / 2 - 6);

        ctx.fillStyle = CSS.muted;
        ctx.font = `11px ${FONT_SANS}`;
        ctx.fillText(labelSub, arrayX - 16, y + cellH / 2 + 10);

        for (let i = 0; i < array.length; i++) {
            const cx = arrayX + i * cellW;
            const cy = y;

            const isActive = activeIndices.includes(i);

            let fillStyle = '#ffffff';
            let strokeStyle = CSS.edge;
            let textStyle = CSS.label;
            let lw = 2;

            if (isActive) {
                if (colorMode === 'blue') {
                    fillStyle = CSS.primary;
                    strokeStyle = CSS.primary;
                    textStyle = CSS.primary;
                } else if (colorMode === 'green') {
                    fillStyle = CSS.meet;
                    strokeStyle = CSS.meet;
                    textStyle = CSS.meet;
                    lw = 3;
                } else if (colorMode === 'red') {
                    fillStyle = CSS.hare;
                    strokeStyle = CSS.hare;
                    textStyle = CSS.hare;
                    lw = 3;
                }
            }

            ctx.beginPath();
            ctx.rect(cx, cy, cellW, cellH);

            if (isActive) {
                ctx.globalAlpha = 0.2;
                ctx.fillStyle = fillStyle;
                ctx.fill();
                ctx.globalAlpha = 1.0;
            } else {
                ctx.fillStyle = '#ffffff';
                ctx.fill();
            }

            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = lw;
            ctx.stroke();

            ctx.fillStyle = textStyle;
            ctx.font = `600 15px ${FONT_MONO}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(array[i]), cx + cellW / 2, cy + cellH / 2 + 1);

            // Draw index
            ctx.fillStyle = CSS.muted;
            ctx.font = `500 11px ${FONT_MONO}`;
            ctx.fillText(String(i), cx + cellW / 2, cy + cellH + 14);
        }
    }

    function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
        if (width < 10 || height < 10) return;
        const active = isAnimating && snapshot.phase === toSnapshot.phase ? toSnapshot : snapshot;

        // View Header
        ctx.fillStyle = CSS.label;
        ctx.font = `600 16px ${FONT_SANS}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        let phaseText = '—';
        if (active.phase.startsWith('init')) phaseText = 'Phase 1: Build Prefix Sums';
        else if (active.phase === 'query') phaseText = 'Phase 2: O(1) Queries';
        else phaseText = 'Finished';

        ctx.fillText(phaseText, 16, 24);

        const cellW = 50;
        const cellH = 50;
        const y1 = 100; // nums
        const y2 = 220; // prefix_sums

        let activeNums = [];
        let activePrefixColors = []; // Array of {index, color}
        let colorModeNums = 'blue';

        if (active.phase === 'init_step' && active.currI !== null) {
            activeNums = [active.currI];
            activePrefixColors.push({ index: active.currI, color: 'blue' }); // previous prefix
            activePrefixColors.push({ index: active.currI + 1, color: 'green' }); // new prefix sum
        } else if (active.phase === 'query' && active.query !== null) {
            // Highlight range [left...right] in nums
            for (let j = active.query.left; j <= active.query.right; j++) {
                activeNums.push(j);
            }
            colorModeNums = 'green';

            // Highlight prefix_sums[right+1] (the total to right) and prefix_sums[left] (the chunk to subtract)
            activePrefixColors.push({ index: active.query.right + 1, color: 'green' }); // positive chunk
            activePrefixColors.push({ index: active.query.left, color: 'red' });        // subtracting chunk
        }

        drawArray(ctx, y1, 'nums', 'Original Array', active.nums, cellW, cellH, activeNums, colorModeNums);

        // Draw prefix_sums with potentially multiple different colored cells
        const ps = active.prefixSums;
        const totalW = ps.length * cellW;
        const arrayX = 150;

        ctx.fillStyle = CSS.label;
        ctx.font = `600 14px ${FONT_SANS}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('prefix_sums', arrayX - 16, y2 + cellH / 2 - 6);

        ctx.fillStyle = CSS.muted;
        ctx.font = `11px ${FONT_SANS}`;
        ctx.fillText('Prefix array', arrayX - 16, y2 + cellH / 2 + 10);

        for (let i = 0; i < ps.length; i++) {
            const cx = arrayX + i * cellW;
            const cy = y2;

            const activeObj = activePrefixColors.find(a => a.index === i);
            const isActive = !!activeObj;
            const colorMode = activeObj ? activeObj.color : null;

            let fillStyle = '#ffffff';
            let strokeStyle = CSS.edge;
            let textStyle = CSS.label;
            let lw = 2;

            // Unfilled cells in initialization phase
            if (active.phase === 'init_start') {
                if (i > 0) textStyle = '#ffffff00'; // hide zeroes before initialization
            } else if (active.phase === 'init_step' && active.currI !== null && i > active.currI + 1) {
                textStyle = '#ffffff00';
            }

            if (isActive) {
                if (colorMode === 'blue') {
                    fillStyle = CSS.primary;
                    strokeStyle = CSS.primary;
                    textStyle = CSS.primary;
                } else if (colorMode === 'green') {
                    fillStyle = CSS.meet;
                    strokeStyle = CSS.meet;
                    textStyle = CSS.meet;
                    lw = 3;
                } else if (colorMode === 'red') {
                    fillStyle = CSS.hare;
                    strokeStyle = CSS.hare;
                    textStyle = CSS.hare;
                    lw = 3;
                }
            }

            ctx.beginPath();
            ctx.rect(cx, cy, cellW, cellH);

            if (isActive) {
                ctx.globalAlpha = 0.2;
                ctx.fillStyle = fillStyle;
                ctx.fill();
                ctx.globalAlpha = 1.0;
            } else {
                ctx.fillStyle = '#ffffff';
                ctx.fill();
            }

            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = lw;
            ctx.stroke();

            ctx.fillStyle = textStyle;
            ctx.font = `600 15px ${FONT_MONO}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (!(textStyle === '#ffffff00')) {
                ctx.fillText(String(ps[i]), cx + cellW / 2, cy + cellH / 2 + 1);
            }

            ctx.fillStyle = CSS.muted;
            ctx.font = `500 11px ${FONT_MONO}`;
            ctx.fillText(String(i), cx + cellW / 2, cy + cellH + 14);
        }

        // Draw mathematical connection arrows during init
        if (active.phase === 'init_step' && active.currI !== null) {
            const i = active.currI;

            // From nums[i]
            const fromNx = arrayX + i * cellW + cellW / 2;
            const fromNy = y1 + cellH;

            // From prefix[i]
            const fromPx = arrayX + i * cellW + cellW / 2;
            const fromPy = y2;

            // To prefix[i+1]
            const toX = arrayX + (i + 1) * cellW + cellW / 2;
            const toY = y2;

            ctx.strokeStyle = CSS.muted;
            ctx.lineWidth = 1.5;

            ctx.beginPath();
            // Down from nums
            ctx.moveTo(fromNx, fromNy);
            ctx.lineTo(fromNx, fromNy + 20);
            // Over right to prefix[i+1] center
            ctx.lineTo(toX, fromNy + 20);
            ctx.lineTo(toX, toY - 6);
            ctx.stroke();

            // Tiny arrow head from nums
            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(toX - 4, toY - 6);
            ctx.lineTo(toX + 4, toY - 6);
            ctx.fillStyle = CSS.muted;
            ctx.fill();

            // Arrow rightwards from prefix[i] to prefix[i+1]
            const fromPxR = arrayX + i * cellW + cellW;
            const fromPyR = y2 + cellH / 2;
            const toPxR = arrayX + (i + 1) * cellW;
            ctx.beginPath();
            ctx.moveTo(fromPxR, fromPyR);
            ctx.lineTo(toPxR - 4, fromPyR);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(toPxR, fromPyR);
            ctx.lineTo(toPxR - 5, fromPyR - 4);
            ctx.lineTo(toPxR - 5, fromPyR + 4);
            ctx.fillStyle = CSS.muted;
            ctx.fill();

            // Plus sign in the path
            ctx.fillStyle = CSS.meet;
            ctx.font = `700 18px ${FONT_MONO}`;
            ctx.fillText('+', toX, fromNy + 20);
        }

        // Draw explicit query formula text and brackets at the bottom
        if (active.phase === 'query' && active.query !== null) {
            const q = active.query;
            const startX = arrayX + q.left * cellW;
            const endX = arrayX + q.right * cellW + cellW;

            // Draw bracket over nums
            const bracketY = y1 - 10;
            ctx.strokeStyle = CSS.meet;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(startX, bracketY + 5);
            ctx.lineTo(startX, bracketY);
            ctx.lineTo(endX, bracketY);
            ctx.lineTo(endX, bracketY + 5);
            ctx.stroke();

            ctx.fillStyle = CSS.meet;
            ctx.font = `600 13px ${FONT_SANS}`;
            ctx.textAlign = 'center';
            ctx.fillText(`Sum of this range = ${active.result}`, (startX + endX) / 2, bracketY - 12);

            // Draw equation at the bottom
            ctx.fillStyle = CSS.label;
            ctx.font = `600 16px ${FONT_SANS}`;
            ctx.textAlign = 'center';
            const val1 = active.prefixSums[q.right + 1];
            const val2 = active.prefixSums[q.left];

            ctx.fillText(`sumRange(${q.left}, ${q.right})  =  prefix_sums[${q.right + 1}] - prefix_sums[${q.left}]`, width / 2, y2 + 100);

            ctx.font = `700 18px ${FONT_MONO}`;
            ctx.fillStyle = CSS.meet;
            ctx.fillText(`=  ${val1}  -  ${val2}  =  ${active.result}`, width / 2, y2 + 130);
        }
    }

    createSnapshotVisualization({
        canvasId: 'rangeSumCanvas', statusId: 'rangeSumStatus',
        prevId: 'rangeSumPrev', nextId: 'rangeSumNext', resetId: 'rangeSumReset',
        buildSnapshots, draw, animationMs: 500,
        rebuildSnapshotsOnReset: true,
    });
}
