---
description: Add a new tool page and wire it into the site menu.
---

You are working in a static GitHub Pages repo (root-level HTML/CSS/JS). Add a new tool page.

Requirements:
- Create a new root-level page `<name>.html` using the same structure as `json-beautifier.html`.
- Create `<name>.js` for page logic.
- Reuse shared `styles.css` and `site.js`.
- Update the hamburger menu links in **all** existing HTML pages to include the new page.
- Do not add new design tokens (no new colors/fonts/shadows). Use existing CSS variables.
- Keep accessibility: menu ARIA, Escape closes, overlay click closes.
- If the page needs a background, choose the appropriate existing background module and include it.

Implementation checklist:
- Ensure links are relative (`./page.html`).
- Ensure the new page sets `aria-current="page"` on its own nav link.
- Keep markup minimal; no extra sections/features.
