---
description: Tune the Mandelbrot background (center/zoom/opacity) without changing page UX.
---

You are modifying `mandelbrot-bg.js` only.

Goals:
- Keep a top-down 2D Mandelbrot view.
- Adjust zoom center (`u_center`), zoom speed (`zoomCycleSeconds`), and scale range (`scaleStart`/`scaleEnd`) as requested.
- Keep it subtle behind text: keep opacity low and avoid harsh flicker.
- Respect `prefers-reduced-motion` (render once, no animation).

Constraints:
- No new UI elements.
- No new colors/tokens.
- Avoid heavy GPU work (no huge loops beyond what already exists).
- Prefer using helpers from `bg-utils.js` (canvas lookup, reduced-motion, WebGL guard).
