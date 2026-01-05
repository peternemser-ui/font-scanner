# UI Simplification Guidelines

## Core Principle

**Default views show what's actionable. Details are for experts.**

## What to Show by Default

1. **What's wrong** - Clear issue identification
2. **How bad it is** - Severity indicator (Critical/Warning/OK)
3. **What to fix first** - Prioritized action list

## What to Hide by Default (Collapsible)

- Raw data dumps
- Large tables (>5 rows)
- Edge cases and exceptions
- Technical metrics experts care about
- Secondary/tertiary information

## Standard UI Pattern

```
┌────────────────────────────────────────┐
│ HEALTH SCORE                    85/100 │  ← Visible by default
├────────────────────────────────────────┤
│ Category Breakdown (mini scores)       │  ← Visible by default
├────────────────────────────────────────┤
│ Top Issues to Fix                      │
│ 1. [Critical] Issue title - Impact     │  ← Visible by default
│ 2. [Warning] Issue title - Impact      │     (max 3-5 items)
│ 3. [Warning] Issue title - Impact      │
├────────────────────────────────────────┤
│ ▶ Recommended Next Step               │  ← Visible by default
├────────────────────────────────────────┤
│ ▼ View Full Details [collapsed]        │  ← Hidden by default
│   └─ Raw data, tables, deep analysis   │
└────────────────────────────────────────┘
```

## Accordion Behavior

### ✅ Correct Implementation

```javascript
// Accordions start COLLAPSED
// Score visible in header so users can see severity without expanding
header.innerHTML = `
  <span>${displayTitle}</span>
  <span style="display: flex; align-items: center; gap: 0.5rem;">
    <span style="color: ${getScoreColor(score)};">${score}/100</span>
    <span class="accordion-toggle">▼</span>
  </span>
`;

// Content loads lazily when expanded (better performance)
header.addEventListener('click', () => {
  if (!contentInner.hasChildNodes()) {
    contentInner.innerHTML = contentCreator(); // Only load when needed
  }
  // Toggle expansion...
});
```

### ❌ Avoid

```javascript
// DON'T start sections expanded
section.classList.add('expanded');
content.style.display = 'block';

// DON'T show large tables by default
resultsContainer.innerHTML = `<table>${hundredRows}</table>`;
```

## Severity Indicators

Use consistent color coding across all analyzers:

| Score Range | Label | Color | Icon |
|-------------|-------|-------|------|
| 90-100 | Excellent | `#00ff41` (green) | ✓ |
| 75-89 | Good | `#00d4ff` (blue) | ✓ |
| 50-74 | Needs Work | `#ffa500` (orange) | ~ |
| 0-49 | Critical | `#ff4444` (red) | ✗ |

## "Top Issues" Component

Show 3-5 prioritized issues, each with:

```javascript
{
  title: 'Missing meta description',     // What's wrong
  severity: 'critical',                   // How bad (critical/warning)
  impact: 'Hurts SEO rankings',          // Why it matters
  link: '/seo.html',                     // Where to fix
  effort: 'quick'                        // Optional: quick/medium/hard
}
```

Rendered as:

```html
<div style="border-left: 3px solid ${severityColor};">
  <div class="issue-title">${title}</div>
  <div class="issue-impact">${impact}</div>
  <a href="${link}">Fix →</a>
</div>
```

## Using `<details>` for Expert Content

```html
<!-- Native HTML5, no JS needed, accessible by default -->
<details>
  <summary>View Full Details & Export Options</summary>
  <div>
    <!-- Tables, raw data, deep metrics go here -->
    <!-- Only rendered when user expands -->
  </div>
</details>
```

## Checklist for New Analyzers

- [ ] Health score visible immediately
- [ ] Category scores visible (if applicable)
- [ ] Top 3-5 issues listed with severity
- [ ] Clear "next step" recommendation
- [ ] All tables inside collapsed sections
- [ ] Accordions start collapsed
- [ ] Score/severity visible in accordion headers
- [ ] Lazy-load content inside accordions
- [ ] No raw data dumps in default view

## Files Following This Pattern

Reference implementations:
- [dashboard-script.js](src/public/dashboard-script.js) - Full implementation
- [performance-script.js](src/public/performance-script.js) - Lazy-load accordions
- [accessibility-script.js](src/public/accessibility-script.js) - Score in headers
- [security-script.js](src/public/security-script.js) - Category accordions

## Migration Notes

### seo-script.js
Changed `initializeAccordions()` from:
```javascript
// Start expanded (OLD)
section.classList.add('expanded');
content.style.display = 'block';
```
To:
```javascript
// Start collapsed (NEW)
section.classList.remove('expanded');
content.style.display = 'none';
```
