```skill
---
description: Make the JSON Beautifier output collapsible (tree view) while preserving copy-as-formatted.
---

You are working on the JSON Beautifier tool.

Scope:
- `json-beautifier.html`, `json-beautifier.js`, and `styles.css`.

Requirements:
- Render a collapsible tree view using native elements (`<details>`/`<summary>`).
- Keep an internal "formatted JSON" string for copying (e.g., `JSON.stringify(value, null, 2)`).
- Handle errors cleanly for invalid JSON input.
- Do not add new design tokens.

Implementation checklist:
- Replace the output `<textarea>` with a scrollable container (e.g., `<div class="textarea json-tree" ...>`).
- Build the tree using DOM nodes (avoid injecting user text as HTML).
- For objects/arrays, show a summary line with type + item count.
- Keep copy button behavior stable:
  - Primary: `navigator.clipboard.writeText(formattedText)`
  - Fallback: temporary hidden `<textarea>` + `document.execCommand('copy')`
- Add only minimal CSS for indentation and disclosure styling, reusing existing tokens.

Validation:
- Try small + large nested JSON.
- Ensure copy produces valid formatted JSON.
- Run `node scripts/validate-site.mjs`.

Deliverable:
- Collapsible JSON tree output that stays readable and copyable.
```
