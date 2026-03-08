/**
 * Design Compressed String Iterator visualization
 */

import {
    FONT_SANS, FONT_MONO, CSS,
    getRandomIntInclusive,
    createSnapshotVisualization,
} from '../viz-core.js';

export default function initStringIteratorVisualization() {
    const chars = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

    function generateCompressedString() {
        // e.g. "a10b2c1"
        let s = "";
        const numGroups = getRandomIntInclusive(3, 4);
        for (let i = 0; i < numGroups; i++) {
            const char = chars[Math.floor(Math.random() * chars.length)];
            // Give a good chance of getting a >9 number to show multi-digit parsing
            let count = getRandomIntInclusive(1, 6);
            if (Math.random() < 0.3) count = getRandomIntInclusive(10, 15);
            s += char + count;
        }
        return s;
    }

    function buildSnapshots() {
        const compressedString = generateCompressedString();
        let ptr = 0;
        let currentChar = '';
        let count = 0;
        let outputStream = "";

        const snaps = [];

        const capture = (phase, text, highlightIndexes = []) => {
            snaps.push({
                s: compressedString,
                ptr,
                currentChar,
                count,
                outputStream,
                phase,
                text,
                highlightIndexes
            });
        };

        capture('init', `Initialized StringIterator with compressed string: "${compressedString}"`);

        // Simulate calling next() until hasNext() is false
        // We will just do a while loop until ptr >= len and count == 0
        let nextCallNum = 1;

        while (count > 0 || ptr < compressedString.length) {
            capture('next_call', `Call #${nextCallNum}: next()`);

            if (count === 0) {
                // 1. Get the character
                currentChar = compressedString[ptr];
                capture('parse_char', `count is 0. Read next character: '${currentChar}'.`, [ptr]);
                ptr += 1;

                // 2. Get the full number
                capture('parse_num_start', `Read subsequent digits to form the count.`, [ptr]);

                let numStr = "";
                let digitsRead = [];
                while (ptr < compressedString.length && !isNaN(parseInt(compressedString[ptr], 10))) {
                    numStr += compressedString[ptr];
                    digitsRead.push(ptr);
                    capture('parse_num_step', `Found digit '${compressedString[ptr]}'. numStr="${numStr}"`, [...digitsRead]);
                    ptr += 1;
                }
                count = parseInt(numStr, 10);
                capture('parse_num_done', `Parsed count = ${count}. Character '${currentChar}' will be repeated ${count} times.`);
            }

            // Emitting the character
            count -= 1;
            outputStream += currentChar;
            capture('emit', `count -= 1 (now ${count}). Emit '${currentChar}'.`, ptr > 0 ? [ptr - 1] : []);

            nextCallNum++;
        }

        capture('next_exhausted', `Call #${nextCallNum}: next(). hasNext() is false. Return " ".`);

        capture('done', `Finished expanding the string.`);

        return snaps;
    }

    function draw(ctx, { width, height, snapshot, toSnapshot, progress, isAnimating }) {
        if (width < 10 || height < 10) return;
        const active = isAnimating && snapshot.phase === toSnapshot.phase ? toSnapshot : snapshot;

        ctx.fillStyle = CSS.label;
        ctx.font = `600 16px ${FONT_SANS}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(active.text, 16, 24);

        const s = active.s;
        const len = s.length;

        // Draw compressed string array
        const cellW = 36;
        const cellH = 36;
        const totalW = len * cellW;
        const startX = width / 2 - totalW / 2;
        const startY = 120;

        for (let i = 0; i < len; i++) {
            const cx = startX + i * cellW;
            const cy = startY;

            let fillStyle = '#ffffff';
            let textStyle = CSS.label;
            let strokeStyle = CSS.edge;
            const isHighlighted = active.highlightIndexes && active.highlightIndexes.includes(i);

            if (isHighlighted) {
                ctx.beginPath();
                ctx.rect(cx, cy, cellW, cellH);
                ctx.globalAlpha = 0.2;
                ctx.fillStyle = CSS.meet;
                ctx.fill();
                ctx.globalAlpha = 1.0;

                strokeStyle = CSS.meet;
                textStyle = CSS.meet;
            }

            ctx.beginPath();
            ctx.rect(cx, cy, cellW, cellH);
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = isHighlighted ? 3 : 2;
            ctx.stroke();

            ctx.fillStyle = textStyle;
            ctx.font = `600 16px ${FONT_MONO}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(s[i], cx + cellW / 2, cy + cellH / 2 + 1);

            // Index
            ctx.fillStyle = CSS.muted;
            ctx.font = `500 11px ${FONT_MONO}`;
            ctx.fillText(i, cx + cellW / 2, cy - 12);
        }

        ctx.fillStyle = CSS.muted;
        ctx.font = `600 14px ${FONT_SANS}`;
        ctx.textAlign = 'right';
        ctx.fillText('compressedString', startX - 16, startY + cellH / 2 - 2);

        // Draw pointer
        if (active.ptr <= len) {
            const ptrX = startX + active.ptr * cellW + cellW / 2;
            const ptrY = startY + cellH + 15;

            ctx.beginPath();
            ctx.moveTo(ptrX, ptrY + 16);
            ctx.lineTo(ptrX, ptrY);
            ctx.lineTo(ptrX - 5, ptrY + 5);
            ctx.moveTo(ptrX, ptrY);
            ctx.lineTo(ptrX + 5, ptrY + 5);
            ctx.strokeStyle = CSS.primary;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = CSS.primary;
            ctx.font = `600 13px ${FONT_MONO}`;
            ctx.textAlign = 'center';
            ctx.fillText('ptr', ptrX, ptrY + 28);
        }

        // Draw State variables
        const stateY = startY + 120;
        ctx.fillStyle = CSS.label;
        ctx.font = `600 14px ${FONT_SANS}`;
        ctx.textAlign = 'left';
        ctx.fillText(`State Variables:`, startX, stateY);

        ctx.font = `500 15px ${FONT_MONO}`;
        ctx.fillText(`current_char: '${active.currentChar}'`, startX, stateY + 30);
        ctx.fillText(`count:        ${active.count}`, startX, stateY + 56);

        // Draw Output Stream
        const outY = stateY + 120;
        ctx.fillStyle = CSS.meet;
        ctx.font = `600 14px ${FONT_SANS}`;
        ctx.textAlign = 'left';
        ctx.fillText(`Output Stream (Uncompressed):`, startX, outY);

        ctx.fillStyle = CSS.label;
        ctx.font = `600 15px ${FONT_MONO}`;

        // Line breaks for long output strings
        const charsPerLine = 40;
        for (let i = 0; i < active.outputStream.length; i += charsPerLine) {
            const chunk = active.outputStream.slice(i, i + charsPerLine);
            ctx.fillText(chunk, startX, outY + 30 + (i / charsPerLine) * 25);
        }
    }

    createSnapshotVisualization({
        canvasId: 'stringIteratorCanvas', statusId: 'stringIteratorStatus',
        prevId: 'stringIteratorPrev', nextId: 'stringIteratorNext', resetId: 'stringIteratorReset',
        buildSnapshots, draw, animationMs: 500,
        rebuildSnapshotsOnReset: true,
    });
}
