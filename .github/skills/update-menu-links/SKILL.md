---
description: Update hamburger menu links consistently across all pages.
---

Task: Update the slide-out hamburger menu across all root-level HTML pages.

Rules:
- Keep the existing menu structure and data attributes.
- Ensure each page sets `aria-current="page"` only on its own link.
- Preserve the order of links unless explicitly requested.
- Do not change styling tokens.

Process:
- Find all `*.html` at repo root.
- Apply one canonical nav list everywhere (labels + hrefs must match exactly).
- Verify the menu still works: Escape closes, overlay click closes, focus returns.
- Run `node scripts/validate-site.mjs`.

Deliverable:
- A single consistent nav list across pages.
