```skill
---
description: Validate the site after changes (links, required blocks, and consistency checks).
---

This repo has no build step. After editing pages, run the validation script.

Command:
- `node scripts/validate-site.mjs`

Use it after:
- Adding a new page.
- Changing hamburger menu links.
- Renaming/moving files.

What to fix when it fails:
- Missing/incorrect relative links (e.g., `./json-beautifier.html`).
- Pages missing shared markup blocks (menu, bg canvas).
- Menu link lists not matching across pages.

Deliverable:
- Validation script exits 0.
```
