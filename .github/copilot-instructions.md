# Copilot instructions (repo)

This repo is a static GitHub Pages site (no build step). Keep changes minimal, readable, and consistent.

## Project layout
- Pages live at repo root:
  - `index.html` (portfolio)
  - `json-beautifier.html` (tool)
  - `html-renderer.html` (tool)
- Shared styling: `styles.css`
- Shared UI behavior: `site.js` (menu + year)
- Backgrounds:
  - `three-bg.js` (Rubik’s cube background)
  - `mandelbrot-bg.js` (Mandelbrot background for JSON page)
  - `bg-utils.js` (shared background helpers)

## Non‑negotiables
- Do not add build tooling or frameworks.
- Do not introduce new colors, font families, or shadows. Use existing CSS variables/tokens.
- Do not add new pages/features unless the user explicitly asks.
- Keep accessibility intact: ARIA on menu, Escape closes menu, focus restoration.
- Respect `prefers-reduced-motion`: backgrounds should render once and not animate.

## When adding a new page (tool)
- Copy the existing page structure from `json-beautifier.html` / `html-renderer.html`.
- Include:
  - background canvas block (`.bg-layer` + `#bg-canvas`)
  - hamburger menu markup (same data attributes)
  - shared scripts: `site.js`
  - page-specific script
- Update menu links in **all** HTML pages so navigation stays consistent.

## Background code guidelines
- Prefer small, testable helpers (DRY): use `bg-utils.js` for canvas lookup, reduced-motion, WebGL check.
- Keep rendering lightweight (this is a background): low opacity, low GPU churn, guard rails on pixel ratio.
- Avoid allocating in animation loops (no per-frame geometry rebuilds unless absolutely necessary).

## Security guidelines
- For HTML rendering or any user-provided content preview:
  - Use sandboxed iframe (`<iframe sandbox>`) and `srcdoc`.
  - Do NOT enable `allow-scripts` unless user explicitly requests and accepts risk.

## Style / code quality
- KISS: small functions, clear names.
- SOLID: isolate responsibilities (menu logic in `site.js`, tool logic in its own file, backgrounds isolated).
- Prefer early returns and explicit guards.
