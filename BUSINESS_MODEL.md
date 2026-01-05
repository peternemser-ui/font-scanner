# Site Mechanic - Business Model & Pricing

## 🎯 Overview

Site Mechanic uses a **freemium model** with free basic scans and paid premium reports. PDF exports are exclusively available for paid reports to maintain consistent monetization.

---

## 💰 Pricing Structure

### **Free Features**

#### 1. **Performance Hub - Quick Scan**
- **Price:** FREE
- **Access:** No account required
- **Features:**
  - Resource-based performance analysis
  - Total requests, page weight, render blocking resources
  - Server response time
  - Likely performance issues
  - Resource breakdown by type (CSS, JS, images, fonts)
- **PDF Export:** ❌ Not available
- **Use Case:** Quick snapshot for troubleshooting

#### 2. **Dashboard - Comprehensive Analysis**
- **Price:** FREE
- **Access:** Requires account (free signup)
- **Features:**
  - 8-category comprehensive scan
  - Performance, SEO, Accessibility, Security, Fonts
  - Top fixes prioritized by severity
  - Category-specific deep dives
  - Shareable link to results
- **PDF Export:** ❌ Not available
- **Use Case:** Full site health check for authenticated users

---

### **Paid Features**

#### 1. **Core Web Vitals Report** - $5 One-Time Payment
- **Price:** $5 per URL
- **Access:** No account required
- **Validity:** 24 hours per URL
- **Features:**
  - ✅ Mobile & Desktop CWV metrics (LCP, INP, CLS)
  - ✅ Google ranking impact analysis
  - ✅ Detailed metric breakdowns with color-coding
  - ✅ Understanding CWV education section
  - ✅ Professional PDF export
- **Payment:** Stripe Checkout
- **Location:** [Performance Hub](/performance-hub.html)

#### 2. **Lighthouse Full Audit** - $5 One-Time Payment
- **Price:** $5 per URL
- **Access:** No account required
- **Validity:** 24 hours per URL
- **Features:**
  - ✅ Desktop & Mobile Lighthouse analysis
  - ✅ Performance, Accessibility, Best Practices, SEO scores
  - ✅ Core Web Vitals metrics (LCP, CLS, TBT, FCP)
  - ✅ Top 5 optimization recommendations
  - ✅ Detailed fixes to make section
  - ✅ Professional PDF export
- **Payment:** Stripe Checkout
- **Location:** [Performance Hub](/performance-hub.html)

---

## 📄 PDF Export Policy

### **When PDFs Are Available**

PDF exports are **ONLY** available for:
1. ✅ Core Web Vitals Report ($5)
2. ✅ Lighthouse Full Audit ($5)

### **When PDFs Are NOT Available**

PDF exports are **NOT** available for:
1. ❌ Performance Hub - Quick Scan (free)
2. ❌ Dashboard - Comprehensive Analysis (free)

### **Why This Policy?**

**Consistent Monetization:**
- Free features provide immediate value for basic needs
- Paid reports include professional PDF exports for client deliverables
- Clear value proposition: pay $5, get detailed analysis + PDF report

**User Clarity:**
- No confusing "coming soon" messages
- Clear indication of what's free vs paid
- No broken promises about PDF availability

**Business Rationale:**
- PDF exports = professional client-ready reports
- $5 pricing covers Stripe fees + provides value
- 24-hour validity per URL encourages repeat purchases

---

## 🔑 Feature Comparison Table

| Feature | Quick Scan (FREE) | Dashboard (FREE) | CWV Report ($5) | Lighthouse Audit ($5) |
|---------|-------------------|------------------|-----------------|----------------------|
| **Account Required** | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **Performance Analysis** | ✅ Basic | ✅ Comprehensive | ✅ Google CWV | ✅ Lighthouse Scores |
| **SEO Analysis** | ❌ No | ✅ Yes | ❌ No | ✅ Yes |
| **Accessibility** | ❌ No | ✅ Yes | ❌ No | ✅ Yes |
| **Security Check** | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **Font Analysis** | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **PDF Export** | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| **Shareable Link** | ❌ No | ✅ Yes | ✅ Yes (via URL) | ✅ Yes (via URL) |
| **Validity** | Single session | Until logout | 24 hours | 24 hours |

---

## 💡 User Journey

### **Free User Path**

```
1. Visit Performance Hub
   ↓
2. Run Quick Scan (FREE)
   - Get basic performance snapshot
   - See resource breakdown
   - Identify likely issues
   ↓
3. Want more details?
   - Upgrade to CWV or Lighthouse ($5)
   - Get professional PDF report
```

### **Authenticated User Path**

```
1. Sign up for account (FREE)
   ↓
2. Access Dashboard
   - Run comprehensive 8-category scan
   - Get prioritized fixes
   - Share results via link
   ↓
3. Want PDF reports?
   - Go to Performance Hub
   - Run CWV or Lighthouse ($5)
   - Download professional PDF
```

### **Client Deliverable Path**

```
1. Client wants performance report
   ↓
2. Go to Performance Hub
   ↓
3. Purchase CWV or Lighthouse ($5)
   - No account needed
   - Pay via Stripe Checkout
   ↓
4. Get professional PDF
   - Client-ready format
   - Detailed metrics
   - Actionable recommendations
   ↓
5. Deliver to client
```

---

## 🎯 Value Propositions

### **Quick Scan (FREE)**
**Value:** "Get a performance snapshot in 30 seconds without signup"
- **Target:** Developers troubleshooting issues
- **Pain Point:** Quick check without commitment
- **Solution:** Instant resource analysis, no barriers

### **Dashboard (FREE)**
**Value:** "Comprehensive site health check across 8 categories"
- **Target:** Website owners, agencies
- **Pain Point:** Need full picture of site health
- **Solution:** Complete analysis with prioritized fixes

### **CWV Report ($5)**
**Value:** "Professional Google Core Web Vitals report with PDF for client deliverables"
- **Target:** Agencies, consultants, SEO professionals
- **Pain Point:** Need authoritative CWV data for clients
- **Solution:** Detailed mobile+desktop CWV with PDF export

### **Lighthouse Audit ($5)**
**Value:** "Full Lighthouse performance audit with PDF for presentations"
- **Target:** Developers, agencies, performance teams
- **Pain Point:** Need comprehensive Lighthouse data + exportable report
- **Solution:** Desktop+mobile Lighthouse with actionable fixes + PDF

---

## 💳 Payment Details

### **Stripe Integration**

**Payment Flow:**
1. User selects CWV or Lighthouse mode
2. Clicks "Run scan"
3. Payment gate modal appears
4. User clicks "Get Report for $5"
5. Redirects to Stripe Checkout
6. Enters card details (test mode: 4242 4242 4242 4242)
7. Payment processed
8. Redirects back to Performance Hub
9. Report auto-runs
10. PDF export button appears

**Technical Details:**
- **Mode:** One-time payment (not subscription)
- **Amount:** $5.00 USD (500 cents)
- **Fees:** Stripe 2.9% + $0.30 = $0.445 per transaction
- **Net Revenue:** $4.56 per report
- **Validity:** 24 hours per URL (stored in localStorage)
- **Authentication:** None required (localStorage tracking)

### **Security & Validation**

- ✅ Payment verified server-side via Stripe API
- ✅ SessionId validated before granting access
- ✅ Cannot fake payment by editing localStorage alone
- ✅ URL params used only for user convenience, not security
- ⚠️ localStorage can be cleared (user loses 24h access)
- ⚠️ Browser-specific (payment doesn't transfer across browsers)

---

## 📊 Revenue Projections

### **Conservative Estimate**

**Assumptions:**
- 100 Performance Hub visits/day
- 5% conversion to paid reports
- 5 paid reports/day @ $5 each

**Revenue:**
- Daily: 5 × $4.56 = **$22.80/day**
- Monthly: $22.80 × 30 = **$684/month**
- Annual: $684 × 12 = **$8,208/year**

### **Moderate Estimate**

**Assumptions:**
- 500 Performance Hub visits/day
- 10% conversion rate
- 50 paid reports/day @ $5 each

**Revenue:**
- Daily: 50 × $4.56 = **$228/day**
- Monthly: $228 × 30 = **$6,840/month**
- Annual: $6,840 × 12 = **$82,080/year**

### **Optimistic Estimate**

**Assumptions:**
- 1,000 Performance Hub visits/day
- 15% conversion rate
- 150 paid reports/day @ $5 each

**Revenue:**
- Daily: 150 × $4.56 = **$684/day**
- Monthly: $684 × 30 = **$20,520/month**
- Annual: $20,520 × 12 = **$246,240/year**

---

## 🚀 Future Monetization Options

### **1. Bulk Discounts**
- 5 reports for $20 (save $5) = $4/report
- 10 reports for $35 (save $15) = $3.50/report
- 25 reports for $75 (save $50) = $3/report
- Stored as "credits" in account or localStorage

### **2. Agency Subscription**
- $50/month for unlimited CWV + Lighthouse reports
- White-label PDF exports (remove Site Mechanic branding)
- Custom domain support
- Priority support

### **3. Enterprise Plan**
- $200/month
- Unlimited scans across all tools
- API access for automation
- Custom branding
- Dedicated support
- Team seats

### **4. Report History & Cloud Storage**
- $10/month to store all reports indefinitely
- Access from any device
- Shareable client portal
- Compare reports over time

### **5. Monitoring & Alerts**
- $15/month per URL
- Weekly CWV checks
- Email alerts when metrics degrade
- Historical trend charts
- Automated PDF delivery

---

## 📝 Implementation Checklist

### **Current Implementation** ✅

- [x] Performance Hub - Quick Scan (FREE)
- [x] Performance Hub - CWV Report ($5)
- [x] Performance Hub - Lighthouse Audit ($5)
- [x] Stripe Checkout integration
- [x] Payment verification
- [x] localStorage payment tracking
- [x] PDF export for paid reports
- [x] Payment gate modal UI
- [x] Removed placeholder PDF button from Dashboard

### **Business Model Consistency** ✅

- [x] Clear pricing on each page
- [x] No "coming soon" messages for unimplemented features
- [x] PDF exports only for paid reports
- [x] Helpful messaging directing users to paid features
- [x] Consistent $5 pricing across premium reports

### **Documentation** ✅

- [x] Payment integration guide
- [x] Layout standardization guide
- [x] Business model documentation (this file)
- [x] Testing instructions
- [x] Revenue projections

---

## 🎨 UI/UX Guidelines

### **How to Communicate Pricing**

**DO:**
- ✅ Show clear pricing before any commitment
- ✅ Explain what's included in paid reports
- ✅ Highlight PDF export as a premium feature
- ✅ Use payment gates to showcase value
- ✅ Display trust badges (Stripe)
- ✅ Show 24-hour validity clearly

**DON'T:**
- ❌ Hide pricing until checkout
- ❌ Show "coming soon" for unimplemented features
- ❌ Promise PDF exports that aren't available
- ❌ Use confusing terminology (freemium, trial, etc.)
- ❌ Require account creation for one-time purchases
- ❌ Auto-renew or subscribe without consent

### **Payment Gate Modal Best Practices**

**Elements:**
1. **Large icon** - Visual identifier (📊 for CWV, 🔍 for Lighthouse)
2. **Color-coding** - Green (#10b981) for CWV, Purple (#8b5cf6) for Lighthouse
3. **Feature list** - 5 key benefits with checkmarks
4. **Price display** - Large "$5" with "One-time payment" disclaimer
5. **Trust badges** - "Secure payment powered by Stripe"
6. **Validity notice** - "24-hour access for this URL"
7. **Cancel button** - Easy exit without commitment
8. **CTA button** - "Get Report for $5" (clear action)

---

## 📍 Summary

**Current Business Model:**

1. **Free Tier:**
   - Quick Scan (Performance Hub)
   - Comprehensive Dashboard (with account)
   - No PDF exports
   - Shareable links (Dashboard only)

2. **Paid Tier:**
   - Core Web Vitals Report: $5
   - Lighthouse Audit: $5
   - Professional PDF exports
   - 24-hour access per URL
   - No account required

3. **Consistency Rules:**
   - PDF exports = paid only
   - No placeholder buttons for unimplemented features
   - Clear upgrade path from free to paid
   - Helpful messaging directing to paid features

**Result:** Clean, simple, predictable pricing that users can understand immediately.

---

**Last Updated:** 2026-01-04
**Status:** Implemented ✅
**Next Review:** Monthly revenue analysis
