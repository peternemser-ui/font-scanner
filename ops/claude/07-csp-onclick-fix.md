# 07 — CSP + onclick Fix (event delegation)

## Goal
Remove inline JS handlers that violate CSP and convert to event delegation.
Ensure pages work under stricter CSP without unsafe-inline.

## Required changes
1) **Remove inline handlers**
   - Find inline `onclick=`, `onchange=`, etc. across `src/public/*.html`.
   - Replace with `data-action="..."` attributes and a centralized event handler.

2) **Event delegation**
   - Add/update a shared handler file (e.g. `src/public/js/app-events.js`) that:
     - attaches once on DOMContentLoaded
     - listens on `document` for clicks/changes
     - dispatches by `data-action`

3) **CSP headers**
   - In server (`src/server.js` or middleware), ensure CSP can work without unsafe-inline.
   - If the app uses inline scripts today, move them into external `.js` files.

4) **Regression checks**
   - Verify account login/register flows still function.
   - Verify pricing modal open/close still functions.

## Acceptance checklist
- No inline event handlers remain in key pages.
- App works with CSP that avoids `unsafe-inline` for scripts (where feasible).
- `npm test` passes.

