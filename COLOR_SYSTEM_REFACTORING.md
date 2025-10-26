# Color System Refactoring Plan

## Goal
Simplify from multiple variations to **TWO CLEAN PALETTES**: Dark Theme and Light Theme using CSS variables.

## Current State
- Hundreds of hardcoded hex colors across CSS and JS files
- Inconsistent color choices (many shades of similar colors)
- Inline styles in JavaScript with embedded colors
- Mix of `body.white-theme` overrides and inline styles

## New System - CSS Variables

### Dark Theme (Default)
```css
:root {
  /* Backgrounds */
  --bg-primary: #000000        /* Main background */
  --bg-secondary: #111111      /* Cards, sections */
  --bg-tertiary: #1a1a1a       /* Nested elements */
  --bg-hover: #222222          /* Hover states */
  --bg-input: #0a0a0a          /* Input fields */
  
  /* Text */
  --text-primary: #ffffff      /* Headings, emphasis */
  --text-secondary: #d0d0d0    /* Body text */
  --text-tertiary: #a0a0a0     /* Labels */
  --text-muted: #808080        /* Disabled, hints */
  
  /* Accents */
  --accent-primary: #00ff41    /* Terminal green - primary CTA */
  --accent-primary-dark: #00cc33
  --accent-secondary: #bb86fc  /* Purple - secondary actions */
  --accent-secondary-dark: #9d5fdb
  
  /* Status */
  --status-success: #00ff41
  --status-warning: #ffa500
  --status-error: #ff4444
  --status-info: #00d9ff
  
  /* Borders */
  --border-primary: #333333
  --border-secondary: #555555
  --border-accent: #00ff41
  
  /* Scores */
  --score-excellent: #00ff41   /* 90-100 */
  --score-good: #00d9ff        /* 70-89 */
  --score-fair: #ffa500        /* 50-69 */
  --score-poor: #ff4444        /* 0-49 */
}
```

### Light Theme
```css
body.white-theme {
  /* Backgrounds */
  --bg-primary: #ffffff
  --bg-secondary: #f5f5f5
  --bg-tertiary: #eeeeee
  --bg-hover: #e8e8e8
  --bg-input: #fafafa
  
  /* Text */
  --text-primary: #000000
  --text-secondary: #333333
  --text-tertiary: #666666
  --text-muted: #999999
  
  /* Accents (darker for readability on light bg) */
  --accent-primary: #00aa33
  --accent-primary-dark: #008825
  --accent-secondary: #7c3aed
  --accent-secondary-dark: #6d28d9
  
  /* Status */
  --status-success: #00aa33
  --status-warning: #d97706
  --status-error: #dc2626
  --status-info: #0891b2
  
  /* Borders */
  --border-primary: #dddddd
  --border-secondary: #cccccc
  --border-accent: #00aa33
  
  /* Scores */
  --score-excellent: #00aa33
  --score-good: #0891b2
  --score-fair: #d97706
  --score-poor: #dc2626
}
```

## Refactoring Checklist

### Phase 1: CSS File Updates ✅
- [x] Add CSS variables to styles.css
- [x] Update body, h1-h4, p tags
- [ ] Update all component classes (buttons, inputs, accordions, tables, etc.)
- [ ] Remove all `body.white-theme` individual overrides (lines 685-905)
- [ ] Replace with automatic CSS variable theme switching

### Phase 2: JavaScript Inline Styles
Files to update:
- [ ] **script.js** (Font Scanner) - ~50 color references
- [ ] **seo-script.js** - ~30 color references
- [ ] **performance-script.js** - ~40 color references
- [ ] **accessibility-script.js** - ~35 color references
- [ ] **security-script.js** - ~30 color references

Strategy for JS files:
1. **Option A**: Replace inline colors with CSS classes
   ```javascript
   // Before:
   style="color: #00ff41; background: #111111;"
   
   // After:
   class="accent-text bg-secondary"
   ```

2. **Option B**: Use CSS variables in inline styles
   ```javascript
   // Before:
   style="color: #00ff41;"
   
   // After:
   style="color: var(--accent-primary);"
   ```

### Phase 3: Create Utility Classes
Add to styles.css:
```css
/* Text Colors */
.text-primary { color: var(--text-primary) !important; }
.text-secondary { color: var(--text-secondary) !important; }
.text-accent { color: var(--accent-primary) !important; }
.text-success { color: var(--status-success) !important; }
.text-warning { color: var(--status-warning) !important; }
.text-error { color: var(--status-error) !important; }

/* Background Colors */
.bg-primary { background-color: var(--bg-primary) !important; }
.bg-secondary { background-color: var(--bg-secondary) !important; }
.bg-tertiary { background-color: var(--bg-tertiary) !important; }

/* Border Colors */
.border-primary { border-color: var(--border-primary) !important; }
.border-accent { border-color: var(--border-accent) !important; }
```

### Phase 4: Helper Functions
Add to each *-script.js:
```javascript
// Get color from CSS variable
function getThemeColor(varName) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName).trim();
}

// Usage:
const accentColor = getThemeColor('--accent-primary');
```

## Benefits

1. **Single Source of Truth**: All colors defined in one place
2. **Instant Theme Switching**: No manual overrides needed
3. **Consistency**: Only 2 color palettes to maintain
4. **Maintainability**: Change a color once, updates everywhere
5. **Accessibility**: Predefined contrast-safe color combinations
6. **Performance**: Less CSS, no duplicate theme definitions

## Breaking Changes
None - this is backward compatible. The theme toggle will continue to work by adding/removing `white-theme` class.

## Testing Plan
1. Toggle dark/light theme on each page
2. Verify all UI elements respect theme
3. Check score colors (excellent/good/fair/poor)
4. Test form inputs, buttons, accordions
5. Verify PDF modals and download buttons
6. Check progress indicators and loading states

## Implementation Order
1. ✅ Define CSS variables (DONE)
2. ✅ Update base styles (DONE)
3. Update remaining CSS components
4. Create utility classes
5. Update script.js (largest file)
6. Update SEO analyzer
7. Update Performance analyzer
8. Update Accessibility analyzer
9. Update Security analyzer
10. Remove old `body.white-theme` overrides
11. Test all pages
12. Document changes

## Estimated Time
- CSS updates: 2-3 hours
- JavaScript updates: 3-4 hours
- Testing: 1 hour
- **Total: 6-8 hours**

## Next Steps
1. Continue updating CSS component classes
2. Create utility classes
3. Begin JavaScript file updates one at a time
