# Skill — Algorithm Visualizations

## Purpose
Add or modify step-through algorithm visualizations on the
`algorithm-visualizations.html` page.

## Key files
| File | Role |
|---|---|
| `algorithm-visualizations.html` | Page markup — one `<section>` per viz |
| `algorithm-visualizations.js`   | All viz logic (shared framework + per-viz code) |
| `styles.css`                    | Canvas height classes (`.viz-canvas-*`) |
| `bg-utils.js`                   | Shared `getReducedMotion()`, `supportsWebGL()` |

## Architecture overview

### Shared infrastructure (top of JS file)
| Export | Purpose |
|---|---|
| `FONT_SANS` / `FONT_MONO` | Font-family strings used in every `ctx.font` call |
| `CSS.*` | Pre-resolved hex colors (`node`, `edge`, `tortoise`, `hare`, `meet`, `label`) |
| `clearCanvas(ctx, w, h)` | Reset transform for DPR and clear the canvas |
| `resize2dCanvas(canvas)` | Resize backing store to CSS size; returns `{ width, height }` |
| `clamp01`, `lerp`, `easeOutCubic`, `easeInOutCubic` | Math / easing helpers |
| `createVisualizationAutoplaySkill(opts)` | Autoplay engine shared by all vizs |

### Snapshot-based framework — `createSnapshotVisualization(opts)`
Most Canvas 2D vizs (Fibonacci, Merge Lists, Merge Array, Sqrt) share a
common pattern handled by this factory:

1. **DOM wiring** — looks up canvas / status / buttons by ID prefix.
2. **State management** — tracks `stepIndex`, animation progress, canvas size.
3. **Event listeners** — Prev / Next / Reset buttons.
4. **Animated stepping** — `runStepAnimation()` with easing + `requestAnimationFrame`.
5. **Resize** — `ResizeObserver` re-renders on layout change.
6. **Autoplay** — `createVisualizationAutoplaySkill` integration.
7. **Reduced motion** — skips animation, disables autoplay.

**Required opts:**
```js
createSnapshotVisualization({
  canvasId:  'fibCanvas',      // canvas element ID
  statusId:  'fibStatus',      // status <p> ID
  prevId:    'fibPrev',        // prev button ID
  nextId:    'fibNext',        // next button ID
  resetId:   'fibReset',       // reset button ID
  buildSnapshots,              // () => snapshots[]
  draw,                        // (ctx, drawState) => void
  animationMs: 700,            // optional, default 700
});
```

**`drawState` shape (passed to `draw`):**
```js
{
  width, height,       // CSS-px canvas dimensions
  snapshot,            // current snapshot (from stepIndex)
  toSnapshot,          // target snapshot (same if not animating)
  progress,            // eased 0‥1 animation progress
  isAnimating,         // boolean — true during a transition
  stepIndex,           // current step
  snapshots,           // full snapshot array
}
```

### Standalone vizs
- **Floyd's cycle detection** — WebGL / Three.js, no snapshot framework.
- **Tree traversal** — Canvas 2D, has `<select>` for order; own event wiring.
- **Hash table** — Canvas 2D, has Generate button & ball-drop animation.

These use the shared constants (`CSS.*`, `FONT_*`, `clearCanvas`) but manage
their own state and events because their UI is more specialized.

## Adding a new snapshot-based visualization

1. **HTML**: add a `<header>` + `<section>` block in
   `algorithm-visualizations.html`, following existing patterns.
   Required elements (with a consistent ID prefix, e.g. `myViz`):
   - `<canvas id="myVizCanvas" class="viz-canvas-algo">`
   - `<p id="myVizStatus" role="status">`
   - `<button id="myVizPrev">`, `<button id="myVizNext">`, `<button id="myVizReset">`

2. **JS**: write two functions + one call in `algorithm-visualizations.js`:
   ```js
   function initMyVisualization() {
     function buildSnapshots() { /* return [{...snapshot, text: '...'}] */ }
     function draw(ctx, drawState) { /* render one frame */ }
     createSnapshotVisualization({
       canvasId: 'myVizCanvas', statusId: 'myVizStatus',
       prevId: 'myVizPrev', nextId: 'myVizNext', resetId: 'myVizReset',
       buildSnapshots, draw,
     });
   }
   ```
   Then call `initMyVisualization()` inside `init()`.

3. **CSS**: if the default `.viz-canvas-algo` height (340 px) doesn't fit,
   add a new class in `styles.css`.

4. **Validation**: run `node scripts/validate-site.mjs`.

## Animation tips
- Use `isAnimating` + `progress` in your `draw()` to interpolate between
  `snapshot` (current) and `toSnapshot` (target).
- `progress` is already eased (`easeInOutCubic`). Use raw time from
  `lerp(a, b, progress)` for smooth interpolation.
- For ball-movement effects, combine `lerp` with `easeOutCubic` or
  `Math.sin(progress * Math.PI)` for arcs.
- Guard appearance changes behind a progress threshold (e.g.
  `progress > 0.75`) so results appear near the end of the transition.

## Color semantics
| Token | Use |
|---|---|
| `CSS.node` | Default / unvisited |
| `CSS.edge` | Edges / borders / range fill |
| `CSS.tortoise` | Visited / completed / "lo" pointer |
| `CSS.hare` | Second pointer / "hi" |
| `CSS.meet` | Current focus / active / "mid" |
| `CSS.label` | Text labels |

## Testing checklist
- [ ] `node scripts/validate-site.mjs` passes
- [ ] Prev / Next / Reset work correctly
- [ ] Autoplay cycles and resets
- [ ] `prefers-reduced-motion` skips animation
- [ ] Canvas resizes without artifacts
