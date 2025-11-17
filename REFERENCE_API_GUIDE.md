# Font Scanner - API Reference Guide

## API Overview

Base URL: `http://localhost:3000/api`  
Content-Type: `application/json`  
Authentication: None required (internal tool)  
Rate Limiting: Yes (varies by endpoint)

---

## Core Analysis Endpoints

### 1. Font Analysis

**Endpoint:** `POST /api/scan`

**Purpose:** Analyze website typography, font loading, pairing, and licensing

**Request Body:**
```json
{
  "url": "https://example.com",
  "mode": "basic"
}
```

**Parameters:**
- `url` (string, required): Target website URL
- `mode` (string, optional): Analysis depth
  - `"basic"` - Quick font detection (3-5s)
  - `"enhanced"` - Deep analysis with cross-browser testing (15-30s)
  - Default: `"basic"`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "mode": "basic",
    "timestamp": "2025-11-06T10:30:00.000Z",
    "fonts": {
      "detected": [
        {
          "family": "Roboto",
          "weights": ["400", "700"],
          "styles": ["normal", "italic"],
          "source": "Google Fonts",
          "format": "woff2"
        }
      ],
      "total": 1,
      "googleFonts": 1,
      "webFonts": 0,
      "systemFonts": 0
    },
    "typography": {
      "headings": {
        "h1": { "family": "Roboto", "size": "48px", "weight": "700" },
        "h2": { "family": "Roboto", "size": "36px", "weight": "600" }
      },
      "body": {
        "family": "Roboto",
        "size": "16px",
        "lineHeight": "1.5",
        "weight": "400"
      }
    },
    "pairing": {
      "score": 85,
      "rating": "Excellent",
      "combinations": [
        {
          "heading": "Roboto",
          "body": "Roboto",
          "harmony": "High"
        }
      ],
      "recommendations": [
        "Consider using a serif font for headings to create contrast"
      ]
    },
    "licensing": {
      "allFree": true,
      "commercial": [],
      "free": ["Roboto"],
      "warnings": []
    },
    "performance": {
      "loadTime": "250ms",
      "fileSize": "45KB",
      "renderBlocking": true,
      "fontDisplay": "swap",
      "recommendations": [
        "Consider using font-display: swap for all fonts"
      ]
    },
    "cssDeclarations": {
      "headings": "@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@700&display=swap');",
      "body": "@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400&display=swap');"
    }
  }
}
```

**Enhanced Mode Additional Fields:**
```json
{
  "crossBrowser": {
    "chrome": { "rendering": "Excellent", "fallbackUsed": false },
    "firefox": { "rendering": "Excellent", "fallbackUsed": false },
    "safari": { "rendering": "Good", "fallbackUsed": false }
  },
  "accessibility": {
    "readability": "High",
    "minimumSize": "14px",
    "contrastRatio": 7.5
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Invalid URL format",
  "message": "URL must include protocol (http:// or https://)"
}
```

**Rate Limit:** 10 requests per 5 minutes

---

### 2. SEO Analysis

**Endpoint:** `POST /api/seo`

**Purpose:** Evaluate technical SEO, meta tags, content quality, and structure

**Request Body:**
```json
{
  "url": "https://example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "timestamp": "2025-11-06T10:30:00.000Z",
    "score": 78,
    "grade": "B",
    "metaTags": {
      "title": {
        "content": "Example Domain",
        "length": 14,
        "status": "optimal"
      },
      "description": {
        "content": "Example Domain. This domain is for use in illustrative examples...",
        "length": 150,
        "status": "optimal"
      },
      "openGraph": {
        "present": true,
        "tags": {
          "og:title": "Example Domain",
          "og:description": "Example description",
          "og:image": "https://example.com/image.jpg"
        }
      },
      "twitterCards": {
        "present": false,
        "recommendations": ["Add Twitter Card meta tags"]
      }
    },
    "headings": {
      "h1": {
        "count": 1,
        "content": ["Example Domain"],
        "status": "optimal"
      },
      "h2": { "count": 3, "status": "good" },
      "h3": { "count": 5, "status": "good" },
      "structure": "hierarchical",
      "issues": []
    },
    "content": {
      "wordCount": 450,
      "readabilityScore": 65,
      "readingLevel": "8th grade",
      "keywordDensity": {
        "example": 2.5,
        "domain": 1.8
      },
      "recommendations": [
        "Add more content (target: 800+ words)",
        "Improve keyword usage"
      ]
    },
    "images": {
      "total": 15,
      "withAlt": 12,
      "withoutAlt": 3,
      "lazyLoaded": 10,
      "optimized": 8,
      "issues": [
        "3 images missing alt text",
        "7 images not optimized"
      ]
    },
    "links": {
      "internal": 25,
      "external": 8,
      "broken": 0,
      "nofollow": 3,
      "status": "good"
    },
    "mobile": {
      "responsive": true,
      "viewport": "optimal",
      "touchTargets": "adequate"
    },
    "structuredData": {
      "present": true,
      "types": ["Organization", "WebSite"],
      "valid": true,
      "recommendations": ["Add BreadcrumbList schema"]
    },
    "technical": {
      "robotsTxt": {
        "present": true,
        "accessible": true,
        "issues": []
      },
      "sitemap": {
        "present": true,
        "url": "https://example.com/sitemap.xml",
        "accessible": true
      },
      "canonicalTag": {
        "present": true,
        "url": "https://example.com/"
      },
      "hreflang": {
        "present": false
      }
    },
    "recommendations": [
      "Add Twitter Card meta tags",
      "Increase content length to 800+ words",
      "Add alt text to 3 images",
      "Optimize 7 images for web",
      "Consider adding BreadcrumbList schema"
    ]
  }
}
```

**Rate Limit:** 10 requests per 5 minutes

---

### 3. Performance Analysis

**Endpoint:** `POST /api/performance`

**Purpose:** Run Lighthouse audits and measure performance metrics

**Request Body:**
```json
{
  "url": "https://example.com",
  "device": "desktop"
}
```

**Parameters:**
- `url` (string, required): Target website URL
- `device` (string, optional): Device type
  - `"mobile"` - Mobile emulation
  - `"desktop"` - Desktop environment
  - Default: `"desktop"`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "timestamp": "2025-11-06T10:30:00.000Z",
    "device": "desktop",
    "lighthouse": {
      "performance": 85,
      "accessibility": 92,
      "bestPractices": 87,
      "seo": 90,
      "overall": 88.5
    },
    "metrics": {
      "firstContentfulPaint": {
        "value": 1200,
        "score": 95,
        "displayValue": "1.2 s"
      },
      "largestContentfulPaint": {
        "value": 2100,
        "score": 90,
        "displayValue": "2.1 s"
      },
      "totalBlockingTime": {
        "value": 150,
        "score": 88,
        "displayValue": "150 ms"
      },
      "cumulativeLayoutShift": {
        "value": 0.05,
        "score": 95,
        "displayValue": "0.05"
      },
      "speedIndex": {
        "value": 2300,
        "score": 87,
        "displayValue": "2.3 s"
      },
      "timeToInteractive": {
        "value": 3200,
        "score": 82,
        "displayValue": "3.2 s"
      }
    },
    "opportunities": [
      {
        "title": "Eliminate render-blocking resources",
        "savings": "450 ms",
        "impact": "High",
        "details": "5 resources are blocking the page load"
      },
      {
        "title": "Properly size images",
        "savings": "200 KB",
        "impact": "Medium",
        "details": "7 images could be optimized"
      }
    ],
    "diagnostics": [
      {
        "title": "Reduce JavaScript execution time",
        "value": "2.1 s",
        "impact": "High"
      },
      {
        "title": "Minimize main-thread work",
        "value": "3.5 s",
        "impact": "Medium"
      }
    ],
    "resources": {
      "scripts": { "count": 12, "size": "450 KB", "blocking": 5 },
      "stylesheets": { "count": 8, "size": "120 KB", "blocking": 3 },
      "images": { "count": 25, "size": "1.2 MB" },
      "fonts": { "count": 4, "size": "180 KB" },
      "total": { "requests": 49, "size": "2.0 MB" }
    },
    "recommendations": [
      "Eliminate render-blocking resources",
      "Optimize images (properly size and compress)",
      "Reduce JavaScript execution time",
      "Enable text compression",
      "Use efficient cache policies"
    ]
  }
}
```

**Timeout:** 120 seconds (configurable via `LIGHTHOUSE_TIMEOUT_MS`)

**Rate Limit:** 5 requests per 10 minutes

---

### 4. Accessibility Analysis

**Endpoint:** `POST /api/accessibility`

**Purpose:** Test WCAG 2.1 compliance and accessibility issues

**Request Body:**
```json
{
  "url": "https://example.com",
  "level": "AA"
}
```

**Parameters:**
- `url` (string, required): Target website URL
- `level` (string, optional): WCAG conformance level
  - `"A"` - Level A
  - `"AA"` - Level AA (default)
  - `"AAA"` - Level AAA

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "timestamp": "2025-11-06T10:30:00.000Z",
    "level": "AA",
    "score": 82,
    "grade": "B",
    "compliance": {
      "levelA": {
        "passed": 18,
        "failed": 2,
        "percentage": 90,
        "status": "partial"
      },
      "levelAA": {
        "passed": 14,
        "failed": 4,
        "percentage": 78,
        "status": "partial"
      },
      "levelAAA": {
        "passed": 8,
        "failed": 8,
        "percentage": 50,
        "status": "partial"
      }
    },
    "issues": [
      {
        "id": "color-contrast",
        "impact": "serious",
        "level": "AA",
        "description": "Elements must have sufficient color contrast",
        "count": 5,
        "elements": [
          {
            "html": "<a href=\"/about\">About Us</a>",
            "target": ["a[href='/about']"],
            "contrast": 3.2,
            "required": 4.5
          }
        ],
        "fix": "Increase contrast ratio to at least 4.5:1 for normal text"
      },
      {
        "id": "image-alt",
        "impact": "critical",
        "level": "A",
        "description": "Images must have alternate text",
        "count": 3,
        "elements": [
          {
            "html": "<img src=\"logo.png\">",
            "target": ["img[src='logo.png']"]
          }
        ],
        "fix": "Add alt attribute to all images"
      }
    ],
    "colorContrast": {
      "tested": 45,
      "passed": 40,
      "failed": 5,
      "issues": [
        {
          "foreground": "#777777",
          "background": "#ffffff",
          "ratio": 3.2,
          "required": 4.5,
          "level": "AA"
        }
      ]
    },
    "keyboardNavigation": {
      "tested": true,
      "focusable": 32,
      "issues": [
        "2 interactive elements not keyboard accessible"
      ]
    },
    "ariaUsage": {
      "correct": 18,
      "incorrect": 2,
      "missing": 5,
      "issues": [
        "Button missing aria-label",
        "Invalid aria-expanded value"
      ]
    },
    "forms": {
      "tested": 3,
      "accessible": 2,
      "issues": [
        "Input field missing associated label"
      ]
    },
    "recommendations": [
      "Fix color contrast issues (5 elements)",
      "Add alt text to 3 images",
      "Ensure all interactive elements are keyboard accessible",
      "Add missing aria-labels to buttons",
      "Associate labels with form inputs"
    ]
  }
}
```

**Rate Limit:** 10 requests per 5 minutes

---

### 5. Security Analysis

**Endpoint:** `POST /api/security`

**Purpose:** Audit SSL/TLS, security headers, and OWASP vulnerabilities

**Request Body:**
```json
{
  "url": "https://example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "timestamp": "2025-11-06T10:30:00.000Z",
    "score": 75,
    "grade": "B",
    "ssl": {
      "valid": true,
      "issuer": "Let's Encrypt",
      "expiresAt": "2026-02-06T00:00:00.000Z",
      "daysRemaining": 92,
      "protocol": "TLSv1.3",
      "cipherSuite": "TLS_AES_128_GCM_SHA256",
      "grade": "A+",
      "warnings": []
    },
    "headers": {
      "present": [
        {
          "name": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains",
          "status": "optimal"
        },
        {
          "name": "X-Content-Type-Options",
          "value": "nosniff",
          "status": "optimal"
        },
        {
          "name": "X-Frame-Options",
          "value": "SAMEORIGIN",
          "status": "good"
        }
      ],
      "missing": [
        {
          "name": "Content-Security-Policy",
          "impact": "high",
          "recommendation": "Add CSP header to prevent XSS attacks"
        },
        {
          "name": "Permissions-Policy",
          "impact": "medium",
          "recommendation": "Add Permissions-Policy to control feature access"
        }
      ],
      "warnings": [
        {
          "name": "X-Frame-Options",
          "issue": "Consider using Content-Security-Policy frame-ancestors instead"
        }
      ]
    },
    "vulnerabilities": {
      "critical": 0,
      "high": 1,
      "medium": 3,
      "low": 5,
      "details": [
        {
          "severity": "high",
          "category": "XSS Protection",
          "description": "Missing Content-Security-Policy header",
          "recommendation": "Implement strict CSP to prevent XSS attacks"
        },
        {
          "severity": "medium",
          "category": "Cookie Security",
          "description": "3 cookies without Secure flag",
          "recommendation": "Set Secure flag on all cookies"
        }
      ]
    },
    "cookies": {
      "total": 8,
      "secure": 5,
      "httpOnly": 6,
      "sameSite": 7,
      "issues": [
        "3 cookies missing Secure flag",
        "2 cookies missing HttpOnly flag",
        "1 cookie missing SameSite attribute"
      ]
    },
    "mixedContent": {
      "detected": false,
      "resources": []
    },
    "thirdPartyScripts": {
      "count": 12,
      "domains": [
        "google-analytics.com",
        "googletagmanager.com",
        "fonts.googleapis.com"
      ],
      "warnings": [
        "Consider using Subresource Integrity (SRI) for third-party scripts"
      ]
    },
    "recommendations": [
      "Add Content-Security-Policy header",
      "Set Secure flag on 3 cookies",
      "Set HttpOnly flag on 2 cookies",
      "Add SameSite attribute to 1 cookie",
      "Add Permissions-Policy header",
      "Implement Subresource Integrity for third-party scripts"
    ]
  }
}
```

**Rate Limit:** 10 requests per 5 minutes

---

### 6. Core Web Vitals

**Endpoint:** `POST /api/cwv`

**Purpose:** Measure Google's Core Web Vitals (LCP, INP, CLS)

**Request Body:**
```json
{
  "url": "https://example.com",
  "device": "mobile"
}
```

**Parameters:**
- `url` (string, required): Target website URL
- `device` (string, optional): Device type (`"mobile"` or `"desktop"`)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "timestamp": "2025-11-06T10:30:00.000Z",
    "device": "mobile",
    "score": 78,
    "grade": "Good",
    "vitals": {
      "lcp": {
        "value": 2.3,
        "unit": "s",
        "rating": "good",
        "threshold": {
          "good": 2.5,
          "needsImprovement": 4.0
        },
        "percentile": 75,
        "element": "img.hero-image"
      },
      "inp": {
        "value": 180,
        "unit": "ms",
        "rating": "good",
        "threshold": {
          "good": 200,
          "needsImprovement": 500
        },
        "percentile": 75
      },
      "cls": {
        "value": 0.08,
        "unit": "",
        "rating": "good",
        "threshold": {
          "good": 0.1,
          "needsImprovement": 0.25
        },
        "percentile": 75,
        "elements": [
          {
            "node": "div.banner",
            "shift": 0.05
          },
          {
            "node": "img.ad",
            "shift": 0.03
          }
        ]
      }
    },
    "fieldData": {
      "available": true,
      "origin": "https://example.com",
      "period": "LAST_28_DAYS"
    },
    "opportunities": [
      {
        "metric": "LCP",
        "recommendation": "Optimize hero image (use WebP, lazy loading)",
        "impact": "Could improve LCP by 0.5s"
      },
      {
        "metric": "CLS",
        "recommendation": "Reserve space for banner and ad elements",
        "impact": "Could reduce CLS to 0.03"
      }
    ],
    "diagnostics": {
      "renderBlocking": {
        "scripts": 3,
        "stylesheets": 2,
        "impact": "500ms"
      },
      "unoptimizedImages": {
        "count": 8,
        "potentialSavings": "400KB"
      },
      "fontLoading": {
        "blocking": true,
        "recommendation": "Use font-display: swap"
      }
    },
    "recommendations": [
      "Optimize hero image (use WebP format)",
      "Reserve space for dynamic content to reduce CLS",
      "Eliminate render-blocking resources",
      "Optimize images (8 images could be improved)",
      "Use font-display: swap for web fonts"
    ]
  }
}
```

**Rate Limit:** 10 requests per 5 minutes

---

### 7. Competitive Analysis

**Endpoint:** `POST /api/competitive/analyze`

**Purpose:** Compare your site against up to 5 competitors across all metrics

**Request Body:**
```json
{
  "sites": [
    "https://yoursite.com",
    "https://competitor1.com",
    "https://competitor2.com",
    "https://competitor3.com"
  ]
}
```

**Parameters:**
- `sites` (array, required): 2-6 URLs to compare (first is "your site")

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-11-06T10:30:00.000Z",
    "sitesAnalyzed": 4,
    "analysisTime": "8m 32s",
    "comparison": [
      {
        "url": "https://yoursite.com",
        "rank": 2,
        "scores": {
          "performance": 78,
          "accessibility": 85,
          "seo": 82,
          "security": 75,
          "coreWebVitals": 80,
          "overall": 80.0
        },
        "metrics": {
          "lcp": 2.4,
          "inp": 195,
          "cls": 0.09,
          "ttfb": 450,
          "fcp": 1.2
        },
        "strengths": [
          "Excellent accessibility score",
          "Good Core Web Vitals"
        ],
        "weaknesses": [
          "Security headers need improvement",
          "Performance could be optimized"
        ]
      },
      {
        "url": "https://competitor1.com",
        "rank": 1,
        "scores": {
          "performance": 88,
          "accessibility": 82,
          "seo": 85,
          "security": 90,
          "coreWebVitals": 92,
          "overall": 87.4
        },
        "metrics": {
          "lcp": 1.8,
          "inp": 150,
          "cls": 0.05,
          "ttfb": 320,
          "fcp": 0.9
        },
        "strengths": [
          "Best overall performance",
          "Excellent Core Web Vitals",
          "Strong security implementation"
        ],
        "weaknesses": [
          "Slightly lower accessibility score"
        ]
      }
    ],
    "insights": {
      "leader": "https://competitor1.com",
      "yourRank": 2,
      "totalSites": 4,
      "gaps": [
        {
          "category": "performance",
          "yourScore": 78,
          "leaderScore": 88,
          "gap": 10,
          "recommendations": [
            "Optimize images and reduce JavaScript",
            "Implement better caching strategy"
          ]
        },
        {
          "category": "security",
          "yourScore": 75,
          "leaderScore": 90,
          "gap": 15,
          "recommendations": [
            "Add Content-Security-Policy header",
            "Improve cookie security"
          ]
        }
      ],
      "advantages": [
        {
          "category": "accessibility",
          "yourScore": 85,
          "averageScore": 79,
          "advantage": "+6 points"
        }
      ]
    },
    "recommendations": [
      "Focus on performance optimization to close 10-point gap with leader",
      "Implement security best practices (CSP, secure cookies)",
      "Maintain your accessibility advantage",
      "Improve Core Web Vitals to match competitor1.com",
      "Consider A/B testing competitor1.com's font loading strategy"
    ]
  }
}
```

**Rate Limit:** 3 requests per 30 minutes (due to long execution time)

**Timeout:** 20 minutes total

---

### 8. Unified Dashboard Analysis

**Endpoint:** `POST /api/dashboard/analyze`

**Purpose:** Run all analyzers in parallel with real-time WebSocket progress

**Request Body:**
```json
{
  "url": "https://example.com",
  "mode": "comprehensive"
}
```

**Parameters:**
- `url` (string, required): Target website URL
- `mode` (string, optional): Analysis mode
  - `"basic"` - Fast overview (30-45s)
  - `"comprehensive"` - Deep analysis all categories (60-120s)
  - Default: `"comprehensive"`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "timestamp": "2025-11-06T10:30:00.000Z",
    "mode": "comprehensive",
    "analysisTime": "92s",
    "overallScore": 82,
    "overallGrade": "B",
    "healthStatus": "Good",
    "categories": {
      "typography": {
        "score": 85,
        "grade": "B+",
        "status": "good",
        "summary": "Good font choices with room for optimization",
        "detailsUrl": "/font-scanner.html?url=https://example.com"
      },
      "seo": {
        "score": 78,
        "grade": "B",
        "status": "good",
        "summary": "Solid SEO foundation, needs meta tag improvements",
        "detailsUrl": "/seo-analyzer.html?url=https://example.com"
      },
      "performance": {
        "score": 80,
        "grade": "B",
        "status": "good",
        "summary": "Good performance with optimization opportunities",
        "detailsUrl": "/performance-analyzer.html?url=https://example.com"
      },
      "accessibility": {
        "score": 82,
        "grade": "B",
        "status": "good",
        "summary": "Accessible with minor contrast issues",
        "detailsUrl": "/accessibility-analyzer.html?url=https://example.com"
      },
      "security": {
        "score": 75,
        "grade": "B-",
        "status": "needs-improvement",
        "summary": "Basic security in place, missing key headers",
        "detailsUrl": "/security-analyzer.html?url=https://example.com"
      },
      "coreWebVitals": {
        "score": 88,
        "grade": "A-",
        "status": "excellent",
        "summary": "Excellent Core Web Vitals performance",
        "detailsUrl": "/core-web-vitals.html?url=https://example.com"
      }
    },
    "prioritizedRecommendations": [
      {
        "priority": "high",
        "category": "security",
        "issue": "Missing Content-Security-Policy header",
        "impact": "Vulnerability to XSS attacks",
        "effort": "medium",
        "fix": "Add CSP header with strict policy"
      },
      {
        "priority": "high",
        "category": "performance",
        "issue": "Render-blocking resources",
        "impact": "500ms delay to page load",
        "effort": "medium",
        "fix": "Defer non-critical JavaScript"
      },
      {
        "priority": "medium",
        "category": "accessibility",
        "issue": "Color contrast issues",
        "impact": "5 elements fail WCAG AA",
        "effort": "low",
        "fix": "Adjust text colors to meet 4.5:1 ratio"
      }
    ],
    "timeline": {
      "initialized": "2025-11-06T10:28:00.000Z",
      "typographyCompleted": "2025-11-06T10:28:15.000Z",
      "seoCompleted": "2025-11-06T10:28:28.000Z",
      "performanceCompleted": "2025-11-06T10:29:10.000Z",
      "accessibilityCompleted": "2025-11-06T10:28:45.000Z",
      "securityCompleted": "2025-11-06T10:28:32.000Z",
      "coreWebVitalsCompleted": "2025-11-06T10:29:32.000Z",
      "completed": "2025-11-06T10:29:32.000Z"
    }
  }
}
```

**WebSocket Progress Events:**
```javascript
// Connect to WebSocket
const socket = io();

// Listen for progress updates
socket.on('analysis-progress', (data) => {
  console.log(data);
  // {
  //   step: 'typography',
  //   status: 'in-progress',
  //   progress: 25,
  //   message: 'Analyzing fonts and typography...',
  //   timeRemaining: '45s'
  // }
});

// Listen for completion
socket.on('analysis-complete', (data) => {
  console.log('Analysis finished!', data);
});

// Listen for errors
socket.on('analysis-error', (error) => {
  console.error('Analysis failed:', error);
});
```

**Rate Limit:** 5 requests per 15 minutes

---

## Administrative Endpoints

### 1. Health Check

**Endpoint:** `GET /api/health`

**Purpose:** Check if the application is running and healthy

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-06T10:30:00.000Z",
  "uptime": "24h 15m 32s",
  "version": "1.0.0",
  "browserPool": {
    "active": 3,
    "idle": 2,
    "total": 5,
    "status": "healthy"
  }
}
```

---

### 2. Rate Limit Statistics

**Endpoint:** `GET /api/admin/rate-limits`

**Purpose:** View rate limiting statistics and violations

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "violations": {
      "total": 47,
      "last24Hours": 12,
      "byEndpoint": {
        "/api/scan": 8,
        "/api/competitive/analyze": 4
      }
    },
    "topOffenders": [
      {
        "ip": "192.168.1.100",
        "violations": 8,
        "lastViolation": "2025-11-06T10:25:00.000Z"
      }
    ],
    "currentLimits": {
      "global": {
        "windowMs": 900000,
        "max": 100,
        "current": 45
      },
      "scan": {
        "windowMs": 300000,
        "max": 10
      }
    }
  }
}
```

---

### 3. Error Telemetry

**Endpoint:** `GET /api/admin/errors`

**Purpose:** View error patterns and telemetry

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 127,
      "last24Hours": 23,
      "errorRate": 2.5
    },
    "byType": {
      "ValidationError": 15,
      "TimeoutError": 5,
      "NetworkError": 3
    },
    "byCategory": {
      "input-validation": 15,
      "network": 8,
      "timeout": 5
    },
    "recentErrors": [
      {
        "type": "TimeoutError",
        "message": "Lighthouse analysis timed out after 120s",
        "timestamp": "2025-11-06T10:20:00.000Z",
        "url": "https://slow-site.com"
      }
    ],
    "thresholds": {
      "criticalRate": 5.0,
      "warningRate": 3.0,
      "currentRate": 2.5,
      "status": "normal"
    }
  }
}
```

---

### 4. Report Statistics

**Endpoint:** `GET /api/reports/stats`

**Purpose:** View PDF report generation and cleanup statistics

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "total": 1247,
    "retentionDays": 7,
    "lastCleanup": "2025-11-06T00:00:00.000Z",
    "cleanedUp": {
      "last24Hours": 12,
      "lastWeek": 89,
      "total": 423
    },
    "storage": {
      "current": "2.4 GB",
      "freed": "1.8 GB"
    }
  }
}
```

---

### 5. Prometheus Metrics

**Endpoint:** `GET /metrics`

**Purpose:** Prometheus scrape endpoint for monitoring

**Response (200 OK):**
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="POST",endpoint="/api/scan",status="200"} 1247

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.5",endpoint="/api/scan"} 523
http_request_duration_seconds_bucket{le="1.0",endpoint="/api/scan"} 892
http_request_duration_seconds_bucket{le="5.0",endpoint="/api/scan"} 1200
http_request_duration_seconds_sum{endpoint="/api/scan"} 3542.5
http_request_duration_seconds_count{endpoint="/api/scan"} 1247

# HELP browser_pool_active Active browser instances
# TYPE browser_pool_active gauge
browser_pool_active 3

# HELP cache_hits_total Total number of cache hits
# TYPE cache_hits_total counter
cache_hits_total 456
```

---

## Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message",
  "details": {
    "field": "Additional context"
  },
  "requestId": "req_abc123xyz",
  "timestamp": "2025-11-06T10:30:00.000Z"
}
```

### Common Error Codes

**400 Bad Request**
- Invalid URL format
- Missing required parameters
- Invalid parameter values

**429 Too Many Requests**
- Rate limit exceeded
- Retry-After header included

**500 Internal Server Error**
- Analysis failed unexpectedly
- Browser pool exhausted
- Timeout errors

**503 Service Unavailable**
- Server shutting down
- Maintenance mode

---

## Rate Limiting

### Global Limits
- **Window:** 15 minutes
- **Max Requests:** 100

### Endpoint-Specific Limits
- **`/api/scan`:** 10 requests per 5 minutes
- **`/api/seo`:** 10 requests per 5 minutes
- **`/api/performance`:** 5 requests per 10 minutes
- **`/api/accessibility`:** 10 requests per 5 minutes
- **`/api/security`:** 10 requests per 5 minutes
- **`/api/cwv`:** 10 requests per 5 minutes
- **`/api/competitive/analyze`:** 3 requests per 30 minutes
- **`/api/dashboard/analyze`:** 5 requests per 15 minutes

### Rate Limit Headers
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1699267200
Retry-After: 300
```

---

## Best Practices

### 1. Always Validate URLs
- Use HTTPS when possible
- Include protocol (`https://` or `http://`)
- Avoid localhost/internal IPs

### 2. Handle Rate Limits
- Check rate limit headers
- Implement exponential backoff
- Cache results when possible

### 3. Use Appropriate Modes
- Use `basic` mode for quick scans
- Use `comprehensive` mode for detailed analysis
- Use `competitive` analysis sparingly (long execution)

### 4. Monitor Progress with WebSockets
- Connect to Socket.IO for real-time updates
- Display progress to users
- Handle reconnection gracefully

### 5. Request ID Tracking
- Log request IDs for debugging
- Include in error reports
- Use for support inquiries

---

**Last Updated:** November 6, 2025  
**API Version:** 1.0  
**Maintainer:** WordPress Architecture Team
