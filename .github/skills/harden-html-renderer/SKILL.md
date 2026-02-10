```skill
---
description: Harden the HTML Renderer so untrusted HTML previews are as safe as possible.
---

You are working on a static GitHub Pages tool that previews user-provided HTML.

Scope:
- Edit only `html-renderer.html` and/or `html-renderer.js` (and `styles.css` only if truly necessary).

Non-negotiables:
- Use a sandboxed iframe with `srcdoc`.
- Do NOT add `allow-scripts`, `allow-same-origin`, `allow-forms`, or any other sandbox allowances unless the user explicitly requests it and accepts the risk.
- Block network access from the preview as much as possible (e.g., CSP inside the `srcdoc`).
- Keep UI/UX minimal; do not add new controls unless explicitly requested.
- No new colors/fonts/shadows (use existing CSS variables).

Implementation checklist:
- Ensure the iframe has `sandbox` (no flags) and `referrerpolicy="no-referrer"`.
- Sanitize the input HTML before rendering:
  - Remove active content: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<applet>`, `<form>`, `<base>`.
  - Remove inline event handlers (attributes starting with `on`).
  - Strip dangerous URLs: `javascript:` and `data:text/html` in `href`/`src`.
- Inject a restrictive CSP inside the `srcdoc` (defense-in-depth), e.g. `default-src 'none'` with only what is needed for rendering.
- Prefer DOM-based construction (`DOMParser`) and safe sinks (avoid assigning unsanitized HTML into the parent document).

Validation:
- Manual sanity check: paste HTML containing `<script>alert(1)</script>` and verify nothing executes.
- Run `node scripts/validate-site.mjs`.

Deliverable:
- Preview renders harmless HTML.
- Scripts/forms/iframes do not run or load.
```
