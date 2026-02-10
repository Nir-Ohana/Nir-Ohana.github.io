```skill
---
description: Tune the Three.js background (performance/behavior) without changing site UX.
---

You are modifying `three-bg.js` only.

Goals:
- Keep the background subtle behind content.
- Keep GPU/CPU usage low.
- Respect `prefers-reduced-motion` (render once, no animation loop).

Constraints:
- No new UI elements.
- No new design tokens.
- Avoid per-frame allocations (no geometry rebuilds inside the animation loop).

Implementation checklist:
- Use helpers from `bg-utils.js`:
  - Canvas lookup
  - Reduced-motion detection
  - WebGL support guard
- Clamp pixel ratio to avoid extreme GPU load.
- Ensure resize handling updates renderer/camera correctly.
- Keep animations deterministic and low-frequency (avoid flicker).

Validation:
- Load `index.html` and confirm background renders.
- Toggle OS reduced-motion and confirm animation stops (one render).
```
