# 🎨 DESIGN SYSTEM VISUAL REFERENCE

## Component Gallery with Code Examples

---

## 1️⃣ Ring Chart (Score Display)

### Visual Appearance
```
     ┌─────────────────┐
     │   Excellent     │ ← Grade label (green text)
     │                 │
     │     ┏━━━━━┓     │
     │    ┃       ┃    │
     │    ┃  95   ┃    │ ← Large score number (white)
     │    ┃ Score ┃    │ ← Small label (gray)
     │     ┗━━━━━┛     │
     │   (Green glow)  │ ← Animated glow effect
     └─────────────────┘
```

### Implementation
```html
<div class="ring-chart ring-chart--excellent">
  <div class="ring-chart__circle">
    <div class="ring-chart__score">95</div>
    <div class="ring-chart__label">Score</div>
  </div>
  <div class="ring-chart__grade">Excellent</div>
</div>
```

### Color Variants
- `.ring-chart--excellent` → Green border + glow (90-100)
- `.ring-chart--good` → Cyan border + glow (70-89)
- `.ring-chart--fair` → Orange border + glow (50-69)
- `.ring-chart--poor` → Red border + glow (0-49)

### Use Cases
✅ Lighthouse scores (performance, accessibility, SEO, best practices)
✅ Overall site health scores
✅ Security scan grades
✅ Font optimization scores

---

## 2️⃣ Metric Card (Key Stats)

### Visual Appearance
```
┌────────────────────────────┐
│ TOTAL FONTS               │ ← Label (gray, uppercase)
│                            │
│ 12                         │ ← Value (large, white, monospace)
│                            │
│ Across all pages          │ ← Subtitle (small, gray)
│                            │
└────────────────────────────┘
   (Cyan border, card bg)
   Hover: Lifts up 2px
```

### Implementation
```html
<div class="metric-card metric-card--primary">
  <div class="metric-card__label">Total Fonts</div>
  <div class="metric-card__value">12</div>
  <div class="metric-card__subtitle">Across all pages</div>
</div>
```

### Color Variants
- `.metric-card--primary` → Cyan border (#00FF9D)
- `.metric-card--success` → Green border (#0FFF73)
- `.metric-card--warning` → Orange border (#FFB84D)
- `.metric-card--error` → Red border (#FF4D4D)

### Use Cases
✅ Font counts, load times, file sizes
✅ Security findings (vulnerabilities, warnings)
✅ SEO metrics (meta tags, headings, links)
✅ Performance metrics (FCP, LCP, CLS)

---

## 3️⃣ Hero Bar (Page Header)

### Visual Appearance
```
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║                    SEO ANALYZER                            ║ ← Title (cyan, mono)
║    Analyze your website's search engine optimization       ║ ← Subtitle (gray)
║                                                            ║
║  ┌──────────────────────────────────┐  ┌──────────────┐   ║
║  │ Enter website URL (e.g., ...)   │  │ Analyze SEO  │   ║ ← Input + Button
║  └──────────────────────────────────┘  └──────────────┘   ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

### Implementation
```html
<div class="hero-bar">
  <div class="hero-bar__header">
    <h1 class="hero-bar__title">SEO Analyzer</h1>
    <p class="hero-bar__subtitle">
      Analyze your website's search engine optimization and discover ranking opportunities
    </p>
  </div>
  
  <div class="action-bar">
    <input type="text" id="urlInput" placeholder="Enter website URL (e.g., example.com)" 
           class="action-bar__input">
    <button onclick="analyzeSEO()" class="action-bar__button">
      Analyze SEO
    </button>
  </div>
</div>
```

### Features
✅ Centered content
✅ Responsive (button stacks on mobile)
✅ Consistent spacing
✅ Focus states on input (cyan glow)
✅ Hover states on button (lift + glow)

---

## 4️⃣ CTA Box (Call-to-Action)

### Visual Appearance
```
╔═══════════════════════════════════════════════════════╗
║  (Animated gradient background with rotating glow)   ║
║                                                       ║
║         Get Your Comprehensive PDF Report            ║ ← Title (white, bold)
║                                                       ║
║  Save this analysis with detailed recommendations,   ║ ← Description
║  visual charts, and actionable insights.             ║   (gray)
║                                                       ║
║  ┌─────────────────────┐  ┌─────────────────────┐   ║
║  │ Download PDF Report │  │   Share Results     │   ║ ← Buttons
║  └─────────────────────┘  └─────────────────────┘   ║
║         (Primary)               (Secondary)          ║
║                                                       ║
║           🔒 Your data is never stored or shared     ║ ← Trust badge
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

### Implementation
```html
<div class="cta-box">
  <h2 class="cta-box__title">Get Your Comprehensive PDF Report</h2>
  <p class="cta-box__description">
    Save this analysis with detailed recommendations, visual charts, and actionable insights.
  </p>
  
  <div class="cta-box__buttons">
    <button class="cta-box__button cta-box__button--primary" onclick="downloadPDF()">
      Download PDF Report
    </button>
    <button class="cta-box__button cta-box__button--secondary" onclick="shareResults()">
      Share Results
    </button>
  </div>
  
  <div class="cta-box__trust-badge">
    Your data is never stored or shared
  </div>
</div>
```

### Features
✅ Gradient border animation
✅ Rotating glow effect (4s loop)
✅ Hover lift (4px translateY)
✅ Responsive buttons (stack on mobile)
✅ Trust badge with lock icon

---

## 5️⃣ Accordion Section (Collapsible Content)

### Visual Appearance (Closed)
```
┌────────────────────────────────────────────────────┐
│  Font Details                              ▼      │ ← Header (clickable)
└────────────────────────────────────────────────────┘
```

### Visual Appearance (Open)
```
┌────────────────────────────────────────────────────┐
│  Font Details                              ▲      │ ← Header (clickable)
├────────────────────────────────────────────────────┤
│                                                    │
│  Font Family: Inter                                │
│  Font Weight: 400                                  │ ← Body content
│  Font Size: 18px                                   │   (revealed)
│  Line Height: 1.6                                  │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Implementation
```html
<div class="accordion accordion--open">
  <div class="accordion__header" onclick="toggleAccordion(this)">
    <h3 class="accordion__title">Font Details</h3>
    <svg class="accordion__icon"><!-- Arrow icon --></svg>
  </div>
  
  <div class="accordion__content">
    <div class="accordion__body">
      <p><strong>Font Family:</strong> Inter</p>
      <p><strong>Font Weight:</strong> 400</p>
      <p><strong>Font Size:</strong> 18px</p>
      <p><strong>Line Height:</strong> 1.6</p>
    </div>
  </div>
</div>
```

### Features
✅ Smooth expand/collapse animation
✅ Rotates arrow icon (180deg)
✅ Hover state on header
✅ Add `.accordion--open` class to expand

---

## 6️⃣ Action Bar (Input + Button)

### Visual Appearance
```
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│  ┌──────────────────────────────────┐  ┌──────────────────┐  │
│  │ Enter website URL...             │  │   Analyze Now    │  │
│  └──────────────────────────────────┘  └──────────────────┘  │
│     (Flex: 1, dark bg)                   (Fixed width)       │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Implementation
```html
<div class="action-bar">
  <input type="text" id="urlInput" placeholder="Enter website URL..." 
         class="action-bar__input">
  <button onclick="analyze()" class="action-bar__button">
    Analyze Now
  </button>
</div>
```

### Responsive Behavior
- **Desktop:** Input + button side-by-side
- **Mobile:** Input + button stacked vertically (button full-width)

### Features
✅ Flex layout with proper gaps
✅ Input focus glow (cyan)
✅ Button hover effects (lift + glow)
✅ Disabled state styling

---

## 7️⃣ Badge (Status Indicators)

### Visual Appearance
```
 SUCCESS   WARNING    ERROR      INFO
┌────────┐┌────────┐┌────────┐┌────────┐
│EXCELLENT││ FAIR   ││  POOR  ││  N/A   │
└────────┘└────────┘└────────┘└────────┘
  (Green)   (Orange)   (Red)    (Blue)
```

### Implementation
```html
<span class="badge badge--success">Excellent</span>
<span class="badge badge--warning">Fair</span>
<span class="badge badge--error">Poor</span>
<span class="badge badge--info">N/A</span>
```

### Use Cases
✅ Score grades (Excellent, Good, Fair, Poor)
✅ Status labels (Active, Pending, Failed)
✅ Feature flags (Beta, New, Deprecated)
✅ Security levels (Secure, Warning, Vulnerable)

---

## 8️⃣ Section Header

### Visual Appearance
```
Performance Metrics                    ← Title (white, bold, 2xl)
Monitor your website's speed and responsiveness  ← Subtitle (gray)
────────────────────────────────────────────────  ← Border (subtle)
```

### Implementation
```html
<div class="section-header">
  <h2 class="section-header__title">Performance Metrics</h2>
  <p class="section-header__subtitle">
    Monitor your website's speed and responsiveness
  </p>
</div>
```

---

## 9️⃣ Stat Grid (Quick Overview)

### Visual Appearance
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│              │  │              │  │              │  │              │
│      95      │  │     12       │  │   2.4s       │  │    345KB     │
│              │  │              │  │              │  │              │
│ PERFORMANCE  │  │ TOTAL FONTS  │  │  LOAD TIME   │  │  PAGE SIZE   │
│              │  │              │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

### Implementation
```html
<div class="stat-grid">
  <div class="stat">
    <div class="stat__value">95</div>
    <div class="stat__label">Performance</div>
  </div>
  
  <div class="stat">
    <div class="stat__value">12</div>
    <div class="stat__label">Total Fonts</div>
  </div>
  
  <div class="stat">
    <div class="stat__value">2.4s</div>
    <div class="stat__label">Load Time</div>
  </div>
  
  <div class="stat">
    <div class="stat__value">345KB</div>
    <div class="stat__label">Page Size</div>
  </div>
</div>
```

### Features
✅ Auto-fit responsive (4 cols → 2 cols → 1 col)
✅ Hover states (lift + cyan border)
✅ Monospace values for alignment

---

## 🎯 Layout Patterns

### Pattern 1: Hero → Summary → Details → CTA

```html
<div class="page-wrapper">
  <main class="page-main">
    <div class="container">
      
      <!-- 1. Hero Section -->
      <div class="hero-bar">
        <div class="hero-bar__header">
          <h1 class="hero-bar__title">SEO Analyzer</h1>
          <p class="hero-bar__subtitle">...</p>
        </div>
        <div class="action-bar">...</div>
      </div>
      
      <!-- 2. Summary Section -->
      <div class="section">
        <div class="stat-grid">
          <div class="stat">...</div>
          <div class="stat">...</div>
          <div class="stat">...</div>
          <div class="stat">...</div>
        </div>
      </div>
      
      <!-- 3. Details Section -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-header__title">Detailed Analysis</h2>
        </div>
        
        <div class="grid grid-cols-3 gap-6">
          <div class="metric-card">...</div>
          <div class="metric-card">...</div>
          <div class="metric-card">...</div>
        </div>
      </div>
      
      <!-- 4. CTA Section -->
      <div class="cta-box">
        <h2 class="cta-box__title">Download Your Report</h2>
        <div class="cta-box__buttons">...</div>
      </div>
      
    </div>
  </main>
</div>
```

---

### Pattern 2: Sidebar Layout (Dashboard)

```html
<div class="container">
  <div class="split split--sidebar">
    
    <!-- Left Sidebar (300px) -->
    <aside class="sticky">
      <nav>
        <a href="#performance">Performance</a>
        <a href="#accessibility">Accessibility</a>
        <a href="#seo">SEO</a>
      </nav>
    </aside>
    
    <!-- Main Content (Flex: 1) -->
    <main>
      <section id="performance">...</section>
      <section id="accessibility">...</section>
      <section id="seo">...</section>
    </main>
    
  </div>
</div>
```

---

### Pattern 3: Comparison Grid (Before/After)

```html
<div class="grid grid-cols-2 sm:grid-cols-1 gap-8">
  
  <!-- Before Column -->
  <div>
    <div class="section-header">
      <h3 class="section-header__title">Before Optimization</h3>
    </div>
    
    <div class="metric-card metric-card--error">
      <div class="metric-card__label">Load Time</div>
      <div class="metric-card__value">5.8s</div>
      <div class="metric-card__subtitle">
        <span class="badge badge--error">Poor</span>
      </div>
    </div>
  </div>
  
  <!-- After Column -->
  <div>
    <div class="section-header">
      <h3 class="section-header__title">After Optimization</h3>
    </div>
    
    <div class="metric-card metric-card--success">
      <div class="metric-card__label">Load Time</div>
      <div class="metric-card__value">1.2s</div>
      <div class="metric-card__subtitle">
        <span class="badge badge--success">Excellent</span>
      </div>
    </div>
  </div>
  
</div>
```

---

## 📐 Grid System Examples

### 12-Column Layout
```html
<!-- 8-column main content + 4-column sidebar -->
<div class="grid grid-cols-12 gap-6">
  <div class="col-span-8">Main content...</div>
  <div class="col-span-4">Sidebar...</div>
</div>
```

### Auto-Fit Responsive
```html
<!-- Automatically adjusts columns based on container width -->
<div class="grid grid-auto-fit gap-6">
  <div class="card">Card 1</div>
  <div class="card">Card 2</div>
  <div class="card">Card 3</div>
  <div class="card">Card 4</div>
</div>
```

### Responsive Breakpoints
```html
<!-- 4 cols (desktop) → 2 cols (tablet) → 1 col (mobile) -->
<div class="grid grid-cols-4 md:grid-cols-2 sm:grid-cols-1 gap-6">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
  <div>Item 4</div>
</div>
```

---

## 🎨 Color Usage Guidelines

### When to Use Each Color

**Primary (#00FF9D - Cyan/Green)**
✅ Primary CTAs ("Analyze", "Download", "Get Started")
✅ Links and interactive elements
✅ Good scores (70-89)
✅ Active states

**Success (#0FFF73 - Bright Green)**
✅ Excellent scores (90-100)
✅ Completed actions ("✓ Analysis Complete")
✅ Positive metrics
✅ Success messages

**Warning (#FFB84D - Orange)**
✅ Fair scores (50-69)
✅ Caution messages ("⚠️ Large file size")
✅ Needs attention items
✅ Warnings (not critical)

**Error (#FF4D4D - Red)**
✅ Poor scores (0-49)
✅ Failed actions
✅ Critical issues
✅ Error messages

**Secondary (#0AFFEF - Bright Cyan)**
✅ Accents and highlights
✅ Secondary CTAs
✅ Decorative elements
✅ Hover states

---

## 📱 Responsive Behavior

### Mobile (< 768px)
- Grid columns collapse to 1
- Action bar buttons stack vertically
- Font sizes scale down slightly (via CSS clamp)
- Touch targets minimum 48px (WCAG AAA)
- Horizontal scrolling removed

### Tablet (768px - 1023px)
- 3-4 column grids become 2 columns
- Sidebar layouts stack vertically
- Increased padding on containers
- Reduced font sizes on headings

### Desktop (≥ 1024px)
- Full 12-column grid available
- Sidebar layouts display side-by-side
- Maximum container width: 1280px
- Hover states active

---

## ✨ Animation Reference

### Hover Effects
```css
/* Metric Card */
.metric-card:hover {
  transform: translateY(-2px);  /* Lift 2px */
  box-shadow: var(--shadow-lg); /* Larger shadow */
}

/* CTA Box */
.cta-box:hover {
  transform: translateY(-4px);  /* Lift 4px */
  box-shadow: var(--shadow-2xl), var(--glow-primary-strong);
}

/* Button */
.action-bar__button:hover {
  background: var(--color-primary-hover);
  box-shadow: var(--glow-primary-strong);
  transform: translateY(-1px);  /* Lift 1px */
}
```

### Loading States
```html
<!-- Indeterminate progress bar -->
<div class="progress-bar">
  <div class="progress-bar__fill progress-bar__fill--indeterminate"></div>
</div>

<!-- Animated ring chart -->
<div class="ring-chart ring-chart--animating">...</div>
```

### Focus States
```css
/* All interactive elements */
*:focus {
  outline: var(--focus-ring-width) solid var(--color-primary);
  outline-offset: var(--focus-ring-offset);
}
```

---

## 🔧 Utility Combinations

### Centered Card with Shadow
```html
<div class="card shadow-xl mx-auto max-w-2xl">
  <h2>Card Title</h2>
  <p>Card content...</p>
</div>
```

### Flex Row with Gap and Center Alignment
```html
<div class="flex items-center justify-between gap-4">
  <span>Label</span>
  <span class="badge badge--success">Active</span>
</div>
```

### Responsive Grid with Consistent Spacing
```html
<div class="grid grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-6 mt-8 mb-12">
  <div class="card">...</div>
  <div class="card">...</div>
  <div class="card">...</div>
</div>
```

---

## 📚 Component Checklist

When refactoring a page, replace:

| Old Pattern | New Component | Class Name |
|-------------|---------------|------------|
| Inline score circle | Ring Chart | `.ring-chart` |
| Custom metric box | Metric Card | `.metric-card` |
| Header + input + button | Hero Bar + Action Bar | `.hero-bar`, `.action-bar` |
| Download PDF section | CTA Box | `.cta-box` |
| Collapsible section | Accordion | `.accordion` |
| Section title | Section Header | `.section-header` |
| Status labels | Badge | `.badge` |
| Quick stats | Stat Grid | `.stat-grid` |
| Progress indicator | Progress Bar | `.progress-bar` |

---

## 🎯 Before/After Comparison

### BEFORE (Current Code)
```html
<div style="text-align: center; padding: 40px 20px; background: #1a1a1a;">
  <h1 style="color: #00FF9D; font-size: 2.5rem; margin-bottom: 10px;">
    [SEO_ANALYZER]
  </h1>
  <p style="color: #888; margin-bottom: 30px;">
    Analyze your website's search engine optimization
  </p>
  <div style="display: flex; gap: 16px; max-width: 800px; margin: 0 auto;">
    <input type="text" id="urlInput" placeholder="Enter URL..." 
           style="flex: 1; padding: 12px; background: #2a2a2a; border: 1px solid #444; color: white; border-radius: 6px;">
    <button onclick="analyzeSEO()" 
            style="padding: 12px 32px; background: #00FF9D; color: black; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
      Analyze SEO
    </button>
  </div>
  
  <div id="results" style="margin-top: 40px;">
    <div style="display: inline-block; width: 120px; height: 120px; border-radius: 50%; border: 4px solid #00FF9D; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <div style="font-size: 2.5rem; font-weight: bold; color: white;">95</div>
      <div style="font-size: 0.9rem; color: #888;">Score</div>
    </div>
  </div>
</div>
```

**Problems:**
❌ Inline styles (hard to maintain)
❌ Bracket notation `[SEO_ANALYZER]`
❌ No design system consistency
❌ Not responsive
❌ No hover/focus states
❌ Accessibility issues

### AFTER (Design System)
```html
<div class="hero-bar">
  <div class="hero-bar__header">
    <h1 class="hero-bar__title">SEO Analyzer</h1>
    <p class="hero-bar__subtitle">
      Analyze your website's search engine optimization and discover ranking opportunities
    </p>
  </div>
  
  <div class="action-bar">
    <input type="text" id="urlInput" placeholder="Enter website URL (e.g., example.com)" 
           class="action-bar__input">
    <button onclick="analyzeSEO()" class="action-bar__button">
      Analyze SEO
    </button>
  </div>
</div>

<div class="section">
  <div class="ring-chart ring-chart--excellent">
    <div class="ring-chart__circle">
      <div class="ring-chart__score">95</div>
      <div class="ring-chart__label">Score</div>
    </div>
    <div class="ring-chart__grade">Excellent</div>
  </div>
</div>
```

**Improvements:**
✅ Semantic component classes
✅ No inline styles
✅ User-friendly copy
✅ Responsive by default
✅ Hover/focus states built-in
✅ Accessibility-first (focus rings, touch targets)
✅ Consistent with design tokens
✅ Reusable across all pages

---

## 🚀 Next Steps

1. **Link CSS files** in all HTML pages (5 min)
2. **Refactor one page** completely as template (1-2 hours)
3. **Copy pattern** to other analyzers (3-4 hours)
4. **Test responsiveness** on all devices (30 min)
5. **Polish animations** and hover states (1 hour)

**Total time investment: 6-8 hours for complete transformation!**
