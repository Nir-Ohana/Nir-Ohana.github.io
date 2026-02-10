---
description: Add a new tool page and wire it into the site menu.
---

You are working in a static GitHub Pages repo (root-level HTML/CSS/JS). Add a new tool page.

Requirements:
- Create a new root-level page `<name>.html` using the same structure as `json-beautifier.html` / `html-renderer.html`.
- Create `<name>.js` for page logic.
- Reuse shared `styles.css` and `site.js`.
- Include the standard background canvas layer (`.bg-layer` + `#bg-canvas`) so visuals work consistently.
- Update the hamburger menu links in **all** existing HTML pages to include the new page.
- Do not add new design tokens (no new colors/fonts/shadows). Use existing CSS variables.
- Keep accessibility: menu ARIA, Escape closes menu, overlay click closes, focus restores to the opener.
- Respect `prefers-reduced-motion`: if you add a background animation, render once when reduced motion is enabled.
- If the page needs a background, choose the appropriate existing background module and include it.

Implementation checklist:
- Ensure links are relative (`./page.html`).
- Ensure the new page sets `aria-current="page"` only on its own nav link.
- Keep the nav list identical across pages (same order + labels).
- Keep markup minimal; no extra sections/features.
- Run `node scripts/validate-site.mjs` after wiring links.
