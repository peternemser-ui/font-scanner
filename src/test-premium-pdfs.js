/**
 * Test Script for Premium PDF Generators
 *
 * Run with: node src/test-premium-pdfs.js [generator-name]
 *
 * Examples:
 *   node src/test-premium-pdfs.js           # Test all generators
 *   node src/test-premium-pdfs.js seo       # Test only SEO
 *   node src/test-premium-pdfs.js security  # Test only Security
 */

const fs = require('fs');
const path = require('path');

// Import all premium generators
const SeoPremiumPdfGenerator = require('./services/seoPremiumPdfGenerator');
const SecurityPremiumPdfGenerator = require('./services/securityPremiumPdfGenerator');
const PerformancePremiumPdfGenerator = require('./services/performancePremiumPdfGenerator');
const AccessibilityPremiumPdfGenerator = require('./services/accessibilityPremiumPdfGenerator');
const CroPremiumPdfGenerator = require('./services/croPremiumPdfGenerator');
const MobilePremiumPdfGenerator = require('./services/mobilePremiumPdfGenerator');
const TagIntelligencePremiumPdfGenerator = require('./services/tagIntelligencePremiumPdfGenerator');
const BrandConsistencyPremiumPdfGenerator = require('./services/brandConsistencyPremiumPdfGenerator');
const LocalSeoPremiumPdfGenerator = require('./services/localSeoPremiumPdfGenerator');
const GdprCompliancePremiumPdfGenerator = require('./services/gdprCompliancePremiumPdfGenerator');
const BrokenLinksPremiumPdfGenerator = require('./services/brokenLinksPremiumPdfGenerator');

// Test data for each report type
const testData = {
    seo: {
        url: 'https://example.com',
        score: 72,
        overallScore: 72,
        metaTags: {
            title: { present: true, length: 55, content: 'Example Website - Your Trusted Source' },
            description: { present: true, length: 145, content: 'Example website provides comprehensive services...' },
            keywords: { present: false },
            robots: { present: true, content: 'index, follow' },
            canonical: { present: true },
            ogTags: { present: true, complete: false },
            twitterCards: { present: false }
        },
        headings: {
            h1: { count: 1, content: ['Welcome to Example'] },
            h2: { count: 5, content: ['Services', 'About Us', 'Contact', 'Features', 'Pricing'] },
            h3: { count: 8 },
            structure: 'good'
        },
        images: {
            total: 24,
            withAlt: 18,
            withoutAlt: 6,
            oversized: 3
        },
        content: {
            wordCount: 1250,
            readabilityScore: 65,
            keywordDensity: 2.3
        },
        technical: {
            https: true,
            sitemap: true,
            robots: true,
            schema: true,
            mobile: true,
            speed: 'good'
        },
        issues: [
            { severity: 'warning', category: 'Images', title: '6 images missing alt text', description: 'Add descriptive alt attributes' },
            { severity: 'warning', category: 'Meta', title: 'Missing Twitter Cards', description: 'Add Twitter card meta tags' }
        ],
        recommendations: [
            { title: 'Add alt text to images', description: 'Improve accessibility and SEO', priority: 1 },
            { title: 'Implement Twitter Cards', description: 'Better social sharing', priority: 2 }
        ]
    },

    security: {
        url: 'https://example.com',
        score: 68,
        overallScore: 68,
        ssl: {
            valid: true,
            grade: 'A',
            issuer: 'Let\'s Encrypt',
            expiresIn: 45,
            protocol: 'TLS 1.3'
        },
        headers: {
            'Strict-Transport-Security': { present: true, value: 'max-age=31536000' },
            'Content-Security-Policy': { present: false },
            'X-Frame-Options': { present: true, value: 'SAMEORIGIN' },
            'X-Content-Type-Options': { present: true, value: 'nosniff' },
            'X-XSS-Protection': { present: false },
            'Referrer-Policy': { present: true, value: 'strict-origin' }
        },
        vulnerabilities: [
            { severity: 'medium', title: 'Missing CSP Header', description: 'Content Security Policy not configured' },
            { severity: 'low', title: 'Missing X-XSS-Protection', description: 'XSS protection header not set' }
        ],
        owasp: {
            injection: 'pass',
            authentication: 'warning',
            xss: 'warning',
            insecureDesign: 'pass',
            misconfiguration: 'warning'
        },
        issues: [
            { severity: 'warning', title: 'CSP not configured' }
        ]
    },

    performance: {
        url: 'https://example.com',
        score: 75,
        overallScore: 75,
        coreWebVitals: {
            lcp: { value: 2.1, unit: 's', rating: 'good' },
            fid: { value: 85, unit: 'ms', rating: 'good' },
            cls: { value: 0.12, unit: '', rating: 'needs-improvement' },
            fcp: { value: 1.5, unit: 's', rating: 'good' },
            ttfb: { value: 450, unit: 'ms', rating: 'good' }
        },
        loadTime: {
            total: 3.2,
            domContentLoaded: 1.8,
            firstByte: 0.45
        },
        resources: {
            totalSize: 2.4,
            images: { count: 24, size: 1.2 },
            scripts: { count: 12, size: 0.8 },
            styles: { count: 5, size: 0.2 },
            fonts: { count: 3, size: 0.15 }
        },
        opportunities: [
            { title: 'Optimize images', savings: '500KB', impact: 'high' },
            { title: 'Enable compression', savings: '200KB', impact: 'medium' }
        ],
        issues: [
            { severity: 'warning', title: 'CLS above threshold' }
        ]
    },

    accessibility: {
        url: 'https://example.com',
        score: 82,
        overallScore: 82,
        wcag: {
            level: 'AA',
            perceivable: { score: 85, issues: 3 },
            operable: { score: 80, issues: 5 },
            understandable: { score: 88, issues: 2 },
            robust: { score: 75, issues: 4 }
        },
        violations: [
            { impact: 'serious', title: 'Images without alt text', count: 6, wcag: '1.1.1' },
            { impact: 'moderate', title: 'Low color contrast', count: 4, wcag: '1.4.3' },
            { impact: 'minor', title: 'Missing form labels', count: 2, wcag: '1.3.1' }
        ],
        colorContrast: {
            passed: 45,
            failed: 4,
            ratio: { min: 3.2, recommended: 4.5 }
        },
        aria: {
            landmarks: true,
            roles: true,
            labels: false
        },
        keyboard: {
            focusVisible: true,
            tabOrder: true,
            skipLinks: false
        },
        issues: [
            { severity: 'warning', title: 'Some images missing alt text' }
        ]
    },

    cro: {
        url: 'https://example.com',
        score: 65,
        overallScore: 65,
        cta: {
            count: 8,
            aboveFold: 2,
            visibility: 'good',
            contrast: 'needs-improvement',
            actionWords: true
        },
        forms: {
            count: 3,
            avgFields: 5,
            validation: true,
            errorHandling: 'good',
            mobileOptimized: true
        },
        trustSignals: {
            testimonials: true,
            reviews: false,
            securityBadges: true,
            guarantees: false,
            socialProof: true
        },
        ux: {
            loadSpeed: 'good',
            mobileResponsive: true,
            navigation: 'good',
            readability: 'good'
        },
        issues: [
            { severity: 'warning', title: 'Low CTA contrast' },
            { severity: 'warning', title: 'No customer reviews displayed' }
        ]
    },

    mobile: {
        url: 'https://example.com',
        score: 78,
        overallScore: 78,
        responsive: {
            score: 85,
            breakpoints: ['320px', '768px', '1024px', '1440px'],
            issues: []
        },
        touchTargets: {
            score: 72,
            tooSmall: 5,
            tooClose: 3,
            minSize: '44x44px'
        },
        viewport: {
            configured: true,
            width: 'device-width',
            initialScale: 1,
            userScalable: true
        },
        performance: {
            mobileScore: 68,
            loadTime: 4.2,
            firstContentfulPaint: 2.1
        },
        issues: [
            { severity: 'warning', title: '5 touch targets too small' },
            { severity: 'warning', title: 'Mobile load time over 4s' }
        ]
    },

    tagIntelligence: {
        url: 'https://example.com',
        score: 70,
        overallScore: 70,
        totalTags: 18,
        analytics: {
            googleAnalytics: true,
            ga4: true,
            gtm: true,
            properlyConfigured: true
        },
        marketing: {
            facebook: true,
            linkedin: false,
            adwords: true,
            twitter: false
        },
        privacy: {
            consentManagement: true,
            cookieCompliance: false,
            gdprCompliant: false
        },
        performance: {
            tagLoadTime: 450,
            blockingTime: 80,
            asyncLoading: true
        },
        tags: [
            { name: 'Google Analytics 4', category: 'Analytics', status: 'active' },
            { name: 'Google Tag Manager', category: 'Analytics', status: 'active' },
            { name: 'Facebook Pixel', category: 'Marketing', status: 'active' },
            { name: 'Google Ads', category: 'Marketing', status: 'active' }
        ],
        issues: [
            { severity: 'warning', title: 'Cookie compliance incomplete' }
        ]
    },

    brandConsistency: {
        url: 'https://example.com',
        score: 74,
        overallScore: 74,
        colors: {
            unique: 8,
            consistency: 78,
            palette: ['#1976D2', '#FF5722', '#4CAF50', '#333333', '#FFFFFF', '#F5F5F5', '#E0E0E0', '#757575'],
            primary: true
        },
        typography: {
            fontCount: 3,
            consistency: 82,
            fonts: [
                { family: 'Inter', usage: 'Body', weights: [400, 500, 600] },
                { family: 'Poppins', usage: 'Headings', weights: [600, 700] },
                { family: 'Roboto Mono', usage: 'Code', weights: [400] }
            ]
        },
        logo: {
            detected: true,
            consistent: true,
            inHeader: true,
            svg: true
        },
        hierarchy: {
            headings: 85,
            buttons: 70,
            spacing: 75,
            cardsConsistent: true
        },
        issues: [
            { severity: 'warning', title: 'Button styles vary across pages' }
        ]
    },

    localSeo: {
        url: 'https://example.com',
        score: 62,
        overallScore: 62,
        googleBusinessProfile: {
            claimed: true,
            complete: false,
            hasPhotos: true,
            hasHours: true,
            hasDescription: false
        },
        citations: {
            count: 15,
            yelp: true,
            facebook: true,
            yellowPages: false
        },
        nap: {
            consistent: false,
            consistencyScore: 75,
            name: 'Example Business LLC',
            address: '123 Main St, City, ST 12345',
            phone: '(555) 123-4567'
        },
        reviews: {
            averageRating: 4.2,
            count: 28,
            distribution: { 5: 15, 4: 8, 3: 3, 2: 1, 1: 1 }
        },
        schema: {
            localBusiness: false
        },
        localContent: {
            cityInTitle: true,
            addressDisplayed: true
        },
        issues: [
            { severity: 'warning', title: 'GBP profile incomplete' },
            { severity: 'warning', title: 'NAP inconsistencies found' }
        ]
    },

    gdprCompliance: {
        url: 'https://example.com',
        score: 58,
        overallScore: 58,
        consent: {
            banner: true,
            granular: false,
            rejectOption: false,
            priorConsent: false,
            provider: 'Custom Implementation'
        },
        cookies: {
            total: 24,
            beforeConsent: 8,
            essential: 4,
            analytics: 12,
            marketing: 8,
            thirdParty: 16
        },
        privacyPolicy: {
            exists: true,
            url: '/privacy-policy',
            hasController: true,
            hasContact: true,
            hasPurpose: true,
            hasRights: false
        },
        thirdParty: {
            count: 12,
            analytics: true,
            marketing: true
        },
        userRights: {
            access: false,
            erasure: false,
            portability: false
        },
        issues: [
            { severity: 'critical', title: '8 cookies set before consent' },
            { severity: 'warning', title: 'No granular consent options' }
        ]
    },

    brokenLinks: {
        url: 'https://example.com',
        score: 85,
        overallScore: 85,
        totalLinks: 156,
        linksChecked: 156,
        brokenLinks: [
            { url: '/old-page', statusCode: 404, source: '/services', type: 'internal' },
            { url: 'https://external-site.com/removed', statusCode: 404, source: '/resources', type: 'external' },
            { url: '/api/deprecated', statusCode: 500, source: '/docs', type: 'internal' }
        ],
        redirects: [
            { from: '/blog/old-post', to: '/blog/new-post', statusCode: 301 },
            { from: '/services/old', to: '/services/new', statusCode: 302, chain: true, hops: 2 }
        ],
        brokenImages: [
            { url: '/images/old-logo.png', source: '/about' }
        ],
        internalLinks: new Array(100),
        externalLinks: new Array(50),
        imageLinks: new Array(6),
        issues: [
            { severity: 'critical', title: '3 broken links found' }
        ]
    }
};

// Output directory for test PDFs
const outputDir = path.join(__dirname, '../reports/test-premium');

async function ensureOutputDir() {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created output directory: ${outputDir}`);
    }
}

async function testGenerator(name, GeneratorClass, data) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${name} Premium PDF Generator`);
    console.log('='.repeat(60));

    try {
        const generator = new GeneratorClass();
        console.log('  ✓ Generator instantiated');

        const startTime = Date.now();

        // Support both generate() and generateReport() methods
        let result;
        if (typeof generator.generate === 'function') {
            result = await generator.generate(data, data.url);
        } else if (typeof generator.generateReport === 'function') {
            result = await generator.generateReport(data);
        } else {
            throw new Error('No generate or generateReport method found');
        }

        const duration = Date.now() - startTime;
        console.log(`  ✓ PDF generated in ${duration}ms`);

        // Handle different return types (buffers array, result object, or single buffer)
        let pdfBuffer;
        if (Array.isArray(result)) {
            pdfBuffer = Buffer.concat(result);
        } else if (result && result.filepath) {
            // Result object with filepath - read the file
            pdfBuffer = fs.readFileSync(result.filepath);
        } else if (Buffer.isBuffer(result)) {
            pdfBuffer = result;
        } else {
            // Try to get buffers from generator
            pdfBuffer = generator.buffers ? Buffer.concat(generator.buffers) : Buffer.alloc(0);
        }

        console.log(`  ✓ PDF size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

        // Save to file
        const filename = `${name.toLowerCase().replace(/\s+/g, '-')}-premium-test.pdf`;
        const filepath = path.join(outputDir, filename);
        fs.writeFileSync(filepath, pdfBuffer);
        console.log(`  ✓ Saved to: ${filepath}`);

        return { success: true, filename, size: pdfBuffer.length, duration };
    } catch (error) {
        console.error(`  ✗ ERROR: ${error.message}`);
        console.error(`    Stack: ${error.stack}`);
        return { success: false, error: error.message };
    }
}

async function runTests(filterName = null) {
    console.log('\n' + '█'.repeat(60));
    console.log('  PREMIUM PDF GENERATOR TEST SUITE');
    console.log('█'.repeat(60));

    await ensureOutputDir();

    const generators = [
        { name: 'SEO', class: SeoPremiumPdfGenerator, data: testData.seo },
        { name: 'Security', class: SecurityPremiumPdfGenerator, data: testData.security },
        { name: 'Performance', class: PerformancePremiumPdfGenerator, data: testData.performance },
        { name: 'Accessibility', class: AccessibilityPremiumPdfGenerator, data: testData.accessibility },
        { name: 'CRO', class: CroPremiumPdfGenerator, data: testData.cro },
        { name: 'Mobile', class: MobilePremiumPdfGenerator, data: testData.mobile },
        { name: 'Tag Intelligence', class: TagIntelligencePremiumPdfGenerator, data: testData.tagIntelligence },
        { name: 'Brand Consistency', class: BrandConsistencyPremiumPdfGenerator, data: testData.brandConsistency },
        { name: 'Local SEO', class: LocalSeoPremiumPdfGenerator, data: testData.localSeo },
        { name: 'GDPR Compliance', class: GdprCompliancePremiumPdfGenerator, data: testData.gdprCompliance },
        { name: 'Broken Links', class: BrokenLinksPremiumPdfGenerator, data: testData.brokenLinks }
    ];

    // Filter if specific generator requested
    const toTest = filterName
        ? generators.filter(g => g.name.toLowerCase().includes(filterName.toLowerCase()))
        : generators;

    if (toTest.length === 0) {
        console.log(`\nNo generators found matching "${filterName}"`);
        console.log('Available generators:');
        generators.forEach(g => console.log(`  - ${g.name}`));
        process.exit(1);
    }

    const results = [];
    for (const gen of toTest) {
        const result = await testGenerator(gen.name, gen.class, gen.data);
        results.push({ name: gen.name, ...result });
    }

    // Summary
    console.log('\n' + '█'.repeat(60));
    console.log('  TEST SUMMARY');
    console.log('█'.repeat(60));

    const passed = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`\nTotal: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length}`);

    if (passed.length > 0) {
        console.log('\n✓ PASSED:');
        passed.forEach(r => {
            console.log(`  ${r.name}: ${(r.size / 1024).toFixed(1)} KB in ${r.duration}ms`);
        });
    }

    if (failed.length > 0) {
        console.log('\n✗ FAILED:');
        failed.forEach(r => {
            console.log(`  ${r.name}: ${r.error}`);
        });
    }

    console.log(`\nTest PDFs saved to: ${outputDir}`);
    console.log('\nOpen the PDFs to visually verify the reports look correct.');

    process.exit(failed.length > 0 ? 1 : 0);
}

// Run tests
const filterArg = process.argv[2];
runTests(filterArg).catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
