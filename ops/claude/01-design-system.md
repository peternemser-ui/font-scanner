# 01 — Design System Unification (Swiss / Inter)

## Goal
Make the UI feel cohesive across dashboard + analyzers using a lightweight design system:
- Inter as the primary font
- tighter Swiss-style typography (less airy)
- consistent spacing, card layout, buttons, and headings
- breadcrumb UI component (simple, consistent)

## Hard constraints
- Minimal refactor. No framework migration.
- Use existing structure under `src/public/`.
- Don’t redesign everything—standardize tokens and apply them to the highest impact surfaces.

## Required changes
1) **Add design tokens**
   - Centralize tokens in `src/public/styles.css` using CSS variables:
     - font family
     - base text color (slightly lighter than pure black; target a charcoal feel)
     - border color, surface, shadow, radius
     - spacing scale (e.g. 4/8/12/16/24/32)
   - Ensure tokens do not break existing pages.

2) **Typography tightening**
   - Update headings, body, and label sizes to feel modern (Swiss).
   - Reduce excessive line-height and padding where it causes “loose” look.
   - Ensure consistent `h1/h2/h3` sizing across pages.

3) **Buttons and controls**
   - Standardize primary/secondary buttons.
   - Standardize input fields and select styles.

4) **Breadcrumb component**
   - Add a tiny breadcrumb renderer in:
     - `src/public/js/components/` (new file or extend existing component folder)
   - Integrate breadcrumb into analyzer pages and results pages:
     - Example: `Dashboard > Performance Hub > Core Web Vitals`
   - Must be accessible: semantic nav + `aria-label="Breadcrumb"`.

5) **Demo page refresh**
   - Update `src/public/design-system-demo.html` to show typography, buttons, cards, breadcrumb, and spacing.
   - This is the “source of truth” visual reference.

## Acceptance checklist
- Inter is applied site-wide.
- Dashboard + at least 3 analyzer pages look consistent (buttons/cards/typography).
- Breadcrumb shows on analyzer pages and results page.
- No layout regressions on mobile.
- `npm test` passes.

