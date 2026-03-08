/**
 * Two Sum III - Data structure design visualization
 * HashMap frequency count implementation
 */

import {
    FONT_SANS, FONT_MONO, CSS,
    getRandomIntInclusive,
    createSnapshotVisualization,
} from '../viz-core.js';

export default function initTwoSumIIIVisualization() {
    function generateAddOperations() {
        const adds = [];
        const count = getRandomIntInclusive(7, 10);
        for (let i = 0; i < count; i++) {
            // Skew towards duplicates to show counting
            const val = getRandomIntInclusive(1, 8);
            adds.push(val);
        }
        return adds;
    }

    function generateFindQueries(addedNumbers) {
        const queries = [];

        // 1. Guaranteed valid (distinct)
        if (addedNumbers.length >= 2) {
            let n1 = addedNumbers[0];
            let n2 = addedNumbers.find(n => n !== n1) || addedNumbers[1];
            queries.push(n1 + n2);
        }

        // 2. Guaranteed valid (same number twice, if exists)
        const counts = {};
        addedNumbers.forEach(n => counts[n] = (counts[n] || 0) + 1);
        const doubleNum = Object.keys(counts).find(k => counts[k] > 1);
        if (doubleNum) {
            queries.push(parseInt(doubleNum) * 2);
        }

        // 3. Guaranteed invalid (too large or odd when only evens, etc)
        const max = Math.max(...addedNumbers);
        queries.push(max * 2 + 5);

        // Shuffle and pick 3
        queries.sort(() => Math.random() - 0.5);
        return queries.slice(0, 3);
    }

    function buildSnapshots() {
        const adds = generateAddOperations();
        const queries = generateFindQueries(adds);

        const numCounts = {}; // hash map
        const snaps = [];

        snaps.push({
            numCounts: { ...numCounts },
            phase: 'init',
            addQueue: [...adds],
            queries: [...queries],
            currentNum: null,
            currentComplement: null,
            activeKey: null,
            text: `Initialized TwoSum object with an empty freq map. Will add ${adds.length} numbers.`,
        });

        // Phase 1: Adds
        for (let i = 0; i < adds.length; i++) {
            const num = adds[i];
            numCounts[num] = (numCounts[num] || 0) + 1;
            snaps.push({
                numCounts: { ...numCounts },
                phase: 'add',
                addQueue: adds.slice(i + 1),
                queries: [...queries],
                currentNum: num,
                currentComplement: null,
                activeKey: String(num),
                text: `add(${num}): map[${num}] = ${(numCounts[num] - 1) || 0} + 1 → ${numCounts[num]}.`,
            });
        }

        snaps.push({
            numCounts: { ...numCounts },
            phase: 'mid',
            addQueue: [],
            queries: [...queries],
            currentNum: null,
            currentComplement: null,
            activeKey: null,
            text: `Finished adding items. Data structure is ready. Starting queries.`,
        });

        // Phase 2: Finds
        for (const value of queries) {
            snaps.push({
                numCounts: { ...numCounts },
                phase: 'find_start',
                addQueue: [],
                queries: queries.filter(q => q !== value), // remove from queue
                currentQuery: value,
                currentNum: null,
                currentComplement: null,
                activeKey: null,
                text: `find(${value}): Iterate through map keys looking for a complement.`,
            });

            const keys = Object.keys(numCounts).map(Number);
            let found = false;

            for (const num of keys) {
                const complement = value - num;

                snaps.push({
                    numCounts: { ...numCounts },
                    phase: 'find_check',
                    addQueue: [],
                    queries: queries.filter(q => q !== value),
                    currentQuery: value,
                    currentNum: num,
                    currentComplement: complement,
                    activeKey: String(num),
                    text: `Checking key ${num}. Complement = ${value} - ${num} = ${complement}.`,
                });

                if (complement !== num) {
                    if (numCounts[complement]) {
                        snaps.push({
                            numCounts: { ...numCounts },
                            phase: 'find_success',
                            addQueue: [],
                            queries: queries.filter(q => q !== value),
                            currentQuery: value,
                            currentNum: num,
                            currentComplement: complement,
                            activeKey: String(num),
                            complementKey: String(complement),
                            text: `Case 1: complement ${complement} exists in map! Return True.`,
                        });
                        found = true;
                        break;
                    } else {
                        snaps.push({
                            numCounts: { ...numCounts },
                            phase: 'find_fail_step',
                            addQueue: [],
                            queries: queries.filter(q => q !== value),
                            currentQuery: value,
                            currentNum: num,
                            currentComplement: complement,
                            activeKey: String(num),
                            text: `Case 1: complement ${complement} is NOT in map. Continue.`,
                        });
                    }
                } else {
                    if (numCounts[num] > 1) {
                        snaps.push({
                            numCounts: { ...numCounts },
                            phase: 'find_success',
                            addQueue: [],
                            queries: queries.filter(q => q !== value),
                            currentQuery: value,
                            currentNum: num,
                            currentComplement: complement,
                            activeKey: String(num),
                            complementKey: String(num),
                            text: `Case 2: complement ${complement} is the same num, and count is ${numCounts[num]} > 1! Return True.`,
                        });
                        found = true;
                        break;
                    } else {
                        snaps.push({
                            numCounts: { ...numCounts },
                            phase: 'find_fail_step',
                            addQueue: [],
                            queries: queries.filter(q => q !== value),
                            currentQuery: value,
                            currentNum: num,
                            currentComplement: complement,
                            activeKey: String(num),
                            text: `Case 2: complement ${complement} is same num, but count is only 1. Continue.`,
                        });
                    }
                }
            }

            if (!found) {
                snaps.push({
                    numCounts: { ...numCounts },
                    phase: 'find_return_false',
                    addQueue: [],
                    queries: queries.filter(q => q !== value),
                    currentQuery: value,
                    currentNum: null,
                    currentComplement: null,
                    activeKey: null,
                    text: `Exhausted all keys. No valid pair found for ${value}. Return False.`,
                });
            }
        }

        snaps.push({
            numCounts: { ...numCounts },
            phase: 'done',
            addQueue: [],
            queries: [],
            currentQuery: null,
            currentNum: null,
            currentComplement: null,
            activeKey: null,
            text: `Done processing all queries. Reset to simulate again.`,
        });

        return snaps;
    }

    function drawMap(ctx, x, y, map, activeKey, complementKey, colorMode) {
        const keys = Object.keys(map).sort((a, b) => Number(a) - Number(b));

        ctx.fillStyle = CSS.label;
        ctx.font = `600 14px ${FONT_SANS}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Frequency Map', x + 100, y - 24);

        // Headers
        ctx.fillStyle = CSS.muted;
        ctx.font = `500 12px ${FONT_SANS}`;
        ctx.textAlign = 'left';
        ctx.fillText('Key (Num)', x, y);
        ctx.fillText('Value (Count)', x + 100, y);

        ctx.beginPath();
        ctx.moveTo(x - 10, y + 15);
        ctx.lineTo(x + 210, y + 15);
        ctx.strokeStyle = CSS.edge;
        ctx.lineWidth = 1;
        ctx.stroke();

        let rowY = y + 35;
        for (const k of keys) {
            const v = map[k];
            const isActive = String(k) === String(activeKey);
            const isComp = String(k) === String(complementKey);

            let fillStyle = '#ffffff00'; // transparent
            let textStyle = CSS.label;
            let boxStroke = '#ffffff00';
            let lw = 2;

            if (isActive) {
                if (colorMode === 'blue') {
                    fillStyle = CSS.primary;
                    textStyle = CSS.primary;
                    boxStroke = CSS.primary;
                } else if (colorMode === 'green') {
                    fillStyle = CSS.meet;
                    textStyle = CSS.meet;
                    boxStroke = CSS.meet;
                }
            } else if (isComp) {
                fillStyle = CSS.meet;
                textStyle = CSS.meet;
                boxStroke = CSS.meet;
            }

            // Draw highlight box
            if (boxStroke !== '#ffffff00') {
                ctx.beginPath();
                ctx.roundRect(x - 10, rowY - 14, 220, 28, 4);
                ctx.globalAlpha = 0.15;
                ctx.fillStyle = fillStyle;
                ctx.fill();
                ctx.globalAlpha = 1.0;
                ctx.strokeStyle = boxStroke;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            ctx.fillStyle = isActive || isComp ? textStyle : CSS.label;
            ctx.font = `600 15px ${FONT_MONO}`;
            ctx.textAlign = 'left';
            ctx.fillText(k, x + 10, rowY);

            ctx.fillStyle = isActive || isComp ? textStyle : CSS.primary;
            ctx.fillText(v, x + 130, rowY);

            rowY += 32;
        }

        if (keys.length === 0) {
            ctx.fillStyle = CSS.muted;
            ctx.font = `italic 13px ${FONT_SANS}`;
            ctx.textAlign = 'center';
            ctx.fillText('(Empty)', x + 100, rowY + 10);
        }

        return rowY;
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
        if (active.phase === 'init' || active.phase === 'add') phaseText = 'Phase 1: Stream add(num)';
        else if (active.phase === 'done' || active.phase === 'mid') phaseText = 'Idle';
        else phaseText = `Phase 2: find(${active.currentQuery})`;

        ctx.fillText(phaseText, 16, 24);

        // Left Panel: Streams/Queue
        const leftX = 40;
        ctx.fillStyle = CSS.muted;
        ctx.font = `600 13px ${FONT_SANS}`;
        ctx.textAlign = 'left';
        ctx.fillText('Incoming add(...) stream:', leftX, 70);

        ctx.fillStyle = CSS.label;
        ctx.font = `600 15px ${FONT_MONO}`;
        const addStr = active.addQueue.length > 0 ? active.addQueue.join(', ') : '(Empty)';
        ctx.fillText(addStr, leftX, 95);

        ctx.fillStyle = CSS.muted;
        ctx.font = `600 13px ${FONT_SANS}`;
        ctx.fillText('Pending find(...) queries:', leftX, 150);

        ctx.fillStyle = CSS.label;
        const qStr = active.queries.length > 0 ? active.queries.join(', ') : '(Empty)';
        ctx.fillText(qStr, leftX, 175);

        // Middle Panel: HashMap
        const mapX = 300;
        let colorMode = 'blue';
        if (active.phase.startsWith('find_success')) colorMode = 'green';

        drawMap(ctx, mapX, 70, active.numCounts, active.activeKey, active.complementKey, colorMode);

        // Right Panel: Logic breakdown for Find (Moved from bottom to prevent collisions)
        if (active.phase.startsWith('find_')) {
            const logicX = 600;
            const ly = 100;
            ctx.fillStyle = CSS.label;
            ctx.font = `600 15px ${FONT_MONO}`;
            ctx.textAlign = 'left';

            ctx.fillText(`Target Value: ${active.currentQuery}`, logicX, ly);

            if (active.currentNum !== null) {
                ctx.fillText(`Current Key (num): ${active.currentNum}`, logicX, ly + 40);

                ctx.fillStyle = CSS.primary;
                ctx.fillText(`Complement = ${active.currentQuery} - ${active.currentNum}`, logicX, ly + 80);
                ctx.fillText(`           = ${active.currentComplement}`, logicX, ly + 105);

                // Show clear visual logic resolution
                if (active.phase === 'find_success') {
                    ctx.fillStyle = CSS.meet;
                    ctx.font = `700 16px ${FONT_SANS}`;
                    ctx.fillText('✓ Valid pair found!', logicX, ly + 155);
                } else if (active.phase === 'find_fail_step') {
                    ctx.fillStyle = CSS.hare;
                    ctx.font = `600 15px ${FONT_SANS}`;
                    ctx.fillText('✗ Not a valid pair', logicX, ly + 155);
                }
            }
        }
    }

    createSnapshotVisualization({
        canvasId: 'twoSumIIICanvas', statusId: 'twoSumIIIStatus',
        prevId: 'twoSumIIIPrev', nextId: 'twoSumIIINext', resetId: 'twoSumIIIReset',
        buildSnapshots, draw, animationMs: 500,
        rebuildSnapshotsOnReset: true,
    });
}
