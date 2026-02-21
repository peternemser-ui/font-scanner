# WCAG Level Scoring — Single Source of Truth

> **Status:** Permanent Invariant
> **Owner:** accessibility-auditor + report-shell-design-system
> **Consumers:** accessibility-script.js, accessibility-report-render.js, all agent prompts listed below

## 1. Purpose

The WCAG Conformance Meter is a mandatory UI module in the Accessibility Analyzer report. It maps raw audit results to WCAG 2.1 conformance levels (A, AA, AAA), computes per-level scores using weighted criteria, renders a 3-row visual meter, and highlights the achieved level. It must appear identically on screen, in PDF export, and in print.

## 2. Data Model — `computeWcagBreakdown(results)`

```js
/**
 * @param {Object} results — raw accessibility scan results
 * @returns {WcagBreakdown}
 *
 * @typedef {Object} WcagBreakdown
 * @property {number}  overallScore       — 0-100 composite
 * @property {string}  achievedLevel      — 'None' | 'A' | 'AA' | 'AAA'
 * @property {WcagLevelDetail} levelA
 * @property {WcagLevelDetail} levelAA
 * @property {WcagLevelDetail} levelAAA
 *
 * @typedef {Object} WcagLevelDetail
 * @property {number}  score              — 0-100, weighted per criteria below
 * @property {boolean} achieved           — true if score >= threshold
 * @property {number}  criteriaPass       — count of passing criteria
 * @property {number}  criteriaTotal      — count of total criteria
 * @property {Array<WcagCriterion>} criteria
 *
 * @typedef {Object} WcagCriterion
 * @property {string}  id                 — e.g. '1.1.1'
 * @property {string}  name               — human-readable (i18n key)
 * @property {boolean} pass
 * @property {number}  weight             — relative weight within its level
 */
```

### 2.1 Tag-to-Level Mapping

Every WCAG success criterion maps to exactly one conformance level:

| Level | Criteria IDs (non-exhaustive; see WCAG 2.1 spec) | Threshold |
|-------|--------------------------------------------------|-----------|
| A     | 1.1.1, 1.2.1, 1.3.1, 1.3.2, 1.3.3, 2.1.1, 2.1.4, 2.2.1, 2.2.2, 2.3.1, 2.4.1, 2.4.2, 2.4.3, 2.4.4, 2.5.1, 2.5.2, 2.5.3, 3.1.1, 3.2.1, 3.2.2, 3.3.1, 3.3.2, 4.1.1, 4.1.2 | score >= 60 |
| AA    | 1.2.4, 1.2.5, 1.3.4, 1.3.5, 1.4.3, 1.4.4, 1.4.5, 1.4.10, 1.4.11, 1.4.12, 1.4.13, 2.4.5, 2.4.6, 2.4.7, 3.1.2, 3.2.3, 3.2.4, 3.3.3, 3.3.4, 4.1.3 | score >= 80 |
| AAA   | 1.2.6, 1.2.7, 1.2.8, 1.2.9, 1.4.6, 1.4.7, 1.4.8, 1.4.9, 2.1.3, 2.2.3, 2.2.4, 2.2.5, 2.2.6, 2.3.2, 2.3.3, 2.4.8, 2.4.9, 2.4.10, 2.5.5, 2.5.6, 3.1.3, 3.1.4, 3.1.5, 3.1.6, 3.2.5, 3.3.5, 3.3.6 | score >= 95 |

### 2.2 Achieved-Level Logic

```
achievedLevel =
  levelAAA.achieved ? 'AAA' :
  levelAA.achieved  ? 'AA'  :
  levelA.achieved   ? 'A'   :
                      'None'
```

A level is `achieved` when **all lower levels are also achieved** AND the level's own score meets its threshold. This is cumulative — AAA implies AA implies A.

### 2.3 Weighting-Based Scores

Each level's `score` is computed as:

```
levelScore = sum(criterion.pass ? criterion.weight : 0) / sum(criterion.weight) * 100
```

Default weights:
- Perceivable criteria: weight 1.0
- Operable criteria: weight 1.2 (keyboard/navigation is high-impact)
- Understandable criteria: weight 0.8
- Robust criteria: weight 1.0

The `overallScore` is a weighted average across all three levels:
```
overallScore = (levelA.score * 0.4) + (levelAA.score * 0.35) + (levelAAA.score * 0.25)
```

## 3. Required UI Structure — WCAG Conformance Meter

### 3.1 Screen Report (accessibility-script.js)

The meter renders as a 3-row grid where each row represents one conformance level. The achieved level row is visually highlighted.

```
┌──────────────────────────────────────────────────────────┐
│  [A]   Level A — Minimum Accessibility       72/100  ✓  │  ← achieved
├──────────────────────────────────────────────────────────┤
│  [AA]  Level AA — Industry Standard          58/100  ✗  │
├──────────────────────────────────────────────────────────┤
│  [AAA] Level AAA — Highest Accessibility     31/100  ✗  │
└──────────────────────────────────────────────────────────┘
                  ▲ Current Level: A
```

### 3.2 Required DOM Selectors

| Selector | Type | Purpose |
|----------|------|---------|
| `[data-testid="wcag-conformance-meter"]` | attribute | Root container — regression test hook |
| `.wcag-level-A` | class | Level A row |
| `.wcag-level-AA` | class | Level AA row |
| `.wcag-level-AAA` | class | Level AAA row |
| `.wcag-level--achieved` | modifier | Applied to the achieved level's row |
| `.wcag-level__badge` | class | The circle badge containing "A" / "AA" / "AAA" |
| `.wcag-level__score` | class | The numeric score display |
| `.wcag-level__status` | class | Pass/fail icon |

### 3.3 Layout Rules

- 3 rows, each row is a flex container with badge, label, score bar, and status indicator
- Grid: `grid-template-columns: auto 1fr auto auto` (badge | label+description | score | status)
- Achieved row gets: highlighted border (`2px solid`), subtle background tint, `aria-current="true"`
- Non-achieved rows: muted opacity (0.6), standard border
- Mobile (<768px): stack vertically if needed, but maintain 3 distinct rows
- Minimum touch target: 44x44px on badge and status elements

### 3.4 Color Tokens (from design-tokens.css)

Level colors must use report surface tokens, NOT neon colors:

| Level | Badge border | Achieved bg tint | Text accent |
|-------|-------------|------------------|-------------|
| A     | `#f59e0b` (amber-500) | `rgba(245, 158, 11, 0.08)` | `#f59e0b` |
| AA    | `#10b981` (emerald-500) | `rgba(16, 185, 129, 0.08)` | `#10b981` |
| AAA   | `#0ea5e9` (sky-500) | `rgba(14, 165, 233, 0.08)` | `#0ea5e9` |

**NEVER use neon colors** (`#ffd700`, `#00ff41`, `#00d9ff`) in the conformance meter. Use the Tailwind-based palette specified by the design system.

### 3.5 Accessibility of the Meter Itself

- The meter MUST NOT rely on color alone to communicate level status. Each row has:
  - A text label ("Level A", "Level AA", "Level AAA")
  - A numeric score
  - A pass/fail text or icon with `aria-label`
- The achieved row is also indicated by `aria-current="true"` and a text indicator ("Current Level")
- All text in the meter must use `t()` for i18n
- `role="list"` on the container, `role="listitem"` on each row

### 3.6 Print / PDF Rules

- Background colors must use `print-color-adjust: exact` / `-webkit-print-color-adjust: exact`
- Achieved-level highlight must be visible in print (use border, not just background)
- All 3 rows must render — never collapse or hide any level
- Scores must be printed as text, not as dynamic elements
- The meter must appear in the same relative position (after summary donuts, within the WCAG section)

## 4. PDF Template Integration

In `accessibility-report-render.js` the WCAG Conformance Meter renders inside `#section-wcag-levels .pdf-section__content`. The PDF version uses `PR.renderTable()` for the 3 rows and `PR.renderCallout()` for the achieved-level status.

The `data-testid="wcag-conformance-meter"` attribute must be present in both screen and PDF DOM for test hooks.

## 5. Required i18n Keys

All keys must exist in all 8 locale files (`en`, `es`, `fr`, `de`, `pt`, `ja`, `zh`, `ru`).

### Screen report keys (under `reports.accessibility.*`)

| Key | English Fallback |
|-----|-----------------|
| `wcagComplianceLevels` | "WCAG Compliance Levels" |
| `understandingWcag` | "Understanding WCAG 2.1 Conformance Levels" |
| `levelA` | "Level A" |
| `levelAA` | "Level AA" |
| `levelAAA` | "Level AAA" |
| `minimumAccessibility` | "Minimum Accessibility" |
| `industryStandard` | "Industry Standard" |
| `highestAccessibility` | "Highest Accessibility" |
| `levelADescription` | "Removes the most critical barriers to access for people with disabilities." |
| `levelAADescription` | "The accepted legal and industry standard (ADA, Section 508, EN 301 549)." |
| `levelAAADescription` | "Highest conformance level. Addresses all accessibility requirements." |
| `notCompliant` | "Not Compliant" |
| `meetsWcagLevel` | "Meets WCAG Level {{level}}" |
| `wcagComplianceStatus` | "WCAG 2.1 Compliance Status" |
| `keyRequirements` | "Key Requirements" |
| `score` | "Score" |
| `currentLevel` | "Current Level" |
| `reqTextAlternatives` | "Text alternatives for images" |
| `reqKeyboardAccessibility` | "Keyboard accessibility" |
| `reqNoSeizure` | "No seizure-inducing content" |
| `reqColorContrast` | "Sufficient color contrast (4.5:1)" |
| `reqFocusIndicators` | "Visible focus indicators" |
| `reqContentReflows` | "Content reflows properly" |
| `reqAllLevelA` | "All Level A requirements" |
| `reqSignLanguage` | "Sign language interpretation" |
| `reqAudioDescriptions` | "Extended audio descriptions" |
| `reqHighContrast` | "Very high contrast (7:1)" |
| `reqAllLevelAAA` | "All Level A & AA requirements" |
| `wcagNote` | "Level AA is the industry standard..." |

### PDF template keys (under `accessibility.report.wcagLevels.*`)

| Key | English Fallback |
|-----|-----------------|
| `title` | "WCAG Compliance Levels" |
| `intro` | "WCAG 2.1 defines three conformance levels..." |
| `levelA` | "Level A" |
| `levelASubtitle` | "Minimum Accessibility" |
| `levelAReqs` | (criteria summary) |
| `levelAA` | "Level AA" |
| `levelAASubtitle` | "Industry Standard" |
| `levelAAReqs` | (criteria summary) |
| `levelAAA` | "Level AAA" |
| `levelAAASubtitle` | "Highest Accessibility" |
| `levelAAAReqs` | (criteria summary) |
| `current` | "Current" |
| `notCompliant` | "Not Compliant" |
| `notCompliantDesc` | (description) |
| `meetsA` / `meetsAA` / `meetsAAA` | (status text) |
| `meetsADesc` / `meetsAADesc` / `meetsAAADesc` | (status description) |
| `noteTitle` | "About WCAG Compliance" |
| `noteBody` | (note text) |
| `levelCol` | "Level" |
| `classCol` | "Classification" |
| `requirementsCol` | "Key Requirements" |
| `scoreRange` | "Score Range" |

## 6. Enforcing Agents

| Agent | Responsibility |
|-------|---------------|
| `report-shell-design-system` | UI structure (3 rows, tokens, mobile/print), no neon colors |
| `accessibility-auditor` | Meter itself is WCAG-compliant (non-color-reliance, aria-labels, contrast) |
| `i18n-language-lock` | All keys present across 8 locales, no English leakage |
| `report-data-completeness` | `wcagBreakdown` is a REQUIRED module with placeholders and machine-readable flag |
| `pdf-fidelity-auditor` | Meter renders in PDF, print CSS rules enforced |
| `qa-harness-regression` | Regression tests: meter presence, 3 rows, `data-testid`, non-English locale |
| `orchestrator-planner` | Auto-routes WCAG scoring requests to the agents above |

## 7. Regression Test Contract

Tests in `tests/regression/wcag-conformance-meter.spec.js` must assert:

1. `[data-testid="wcag-conformance-meter"]` exists in the DOM
2. Exactly 3 child rows (`.wcag-level-A`, `.wcag-level-AA`, `.wcag-level-AAA`)
3. Exactly one row has `.wcag-level--achieved`
4. Each row contains `.wcag-level__badge`, `.wcag-level__score`, `.wcag-level__status`
5. No hardcoded English when locale is set to a non-English language
6. In PDF export: `[data-testid="wcag-conformance-meter"]` is present with 3 rows
7. In print media: all 3 rows visible, achieved highlight uses border (not just background)
