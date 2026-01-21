/**
 * Tag Intelligence Premium PDF Generator
 *
 * Creates comprehensive premium PDF reports for tag intelligence analysis
 * with executive summaries, benchmarks, and actionable roadmaps.
 */

const { PremiumPdfReport } = require('../utils/premiumPdfTemplate');

// Industry benchmarks for tag management
const TAG_BENCHMARKS = {
    industryAverage: 60,
    topPerformers: 90,
    categories: {
        analytics: { average: 72, top: 95 },
        marketing: { average: 65, top: 90 },
        performance: { average: 58, top: 88 },
        privacy: { average: 55, top: 92 }
    }
};

// Business impact templates
const TAG_BUSINESS_IMPACT = {
    excellent: {
        summary: "Your tag implementation is well-optimized and follows best practices.",
        impacts: [
            "Accurate data collection enabling informed business decisions",
            "Minimal performance overhead from tag execution",
            "Strong privacy compliance reducing legal exposure",
            "Efficient marketing attribution and ROI tracking"
        ]
    },
    good: {
        summary: "Your tag setup is functional with room for optimization.",
        impacts: [
            "Most analytics data is being captured correctly",
            "Some tags may be impacting page load times",
            "Privacy compliance needs attention in some areas",
            "Marketing effectiveness could be improved with better tagging"
        ]
    },
    fair: {
        summary: "Your tag implementation has notable gaps affecting data quality.",
        impacts: [
            "Missing or misconfigured tags causing data gaps",
            "Performance degradation from inefficient tag loading",
            "Privacy compliance risks from outdated consent mechanisms",
            "Marketing attribution likely inaccurate or incomplete"
        ]
    },
    poor: {
        summary: "Significant tag issues are impacting business operations.",
        impacts: [
            "Critical data collection failures affecting decision-making",
            "Severe performance impact from tag bloat",
            "High privacy compliance risk and potential fines",
            "Marketing spend cannot be properly attributed"
        ]
    }
};

class TagIntelligencePremiumPdfGenerator extends PremiumPdfReport {
    constructor() {
        super();
        this.reportType = 'Tag Intelligence';
        this.reportColor = '#9C27B0'; // Purple for Tag Intelligence
    }

    /**
     * Generate the complete premium Tag Intelligence PDF report
     */
    async generate(analysisData, url) {
        await this.initDocument();

        const score = this._calculateOverallScore(analysisData);
        const keyStats = this._extractKeyStats(analysisData);
        const componentScores = this._extractComponentScores(analysisData);
        const findings = this._extractKeyFindings(analysisData);
        const businessImpact = this._getBusinessImpact(score);
        const recommendations = this._enhanceRecommendations(analysisData);

        // Cover Page
        await this.addCoverPage({
            title: 'Tag Intelligence Analysis',
            subtitle: 'Comprehensive Tag & Tracking Assessment',
            url: url,
            score: score,
            date: new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
        });

        // Executive Summary
        this.addExecutiveSummary({
            score,
            keyStats,
            componentScores,
            businessImpact: businessImpact.summary,
            impactPoints: businessImpact.impacts
        });

        // Benchmark Comparison
        this.addBenchmarkComparison({
            score,
            industryAverage: TAG_BENCHMARKS.industryAverage,
            topPerformers: TAG_BENCHMARKS.topPerformers,
            categoryBenchmarks: TAG_BENCHMARKS.categories,
            componentScores
        });

        // Action Roadmap
        this.addActionRoadmap(recommendations);

        // Tag Intelligence Specific Sections
        this.addTagInventorySection(analysisData);
        this.addAnalyticsSection(analysisData);
        this.addMarketingTagsSection(analysisData);
        this.addPrivacyComplianceSection(analysisData);
        this.addPerformanceImpactSection(analysisData);
        this.addTagManagementChecklist(analysisData, score);

        return await this.endDocument();
    }

    /**
     * Calculate overall tag intelligence score
     */
    _calculateOverallScore(data) {
        if (data.score !== undefined) return Math.round(data.score);
        if (data.overallScore !== undefined) return Math.round(data.overallScore);

        let score = 70; // Base score

        // Analytics tags
        if (data.analytics) {
            if (data.analytics.googleAnalytics) score += 5;
            if (data.analytics.gtm) score += 5;
            if (data.analytics.properlyConfigured) score += 5;
        }

        // Privacy compliance
        if (data.privacy) {
            if (data.privacy.consentManagement) score += 5;
            if (data.privacy.cookieCompliance) score += 5;
        }

        // Deductions
        if (data.issues) {
            score -= Math.min(data.issues.length * 3, 30);
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Extract key statistics for executive summary
     */
    _extractKeyStats(data) {
        const stats = [];

        const totalTags = data.totalTags || data.tags?.length || 0;
        stats.push({
            label: 'Total Tags',
            value: totalTags.toString(),
            status: totalTags > 20 ? 'warning' : 'good'
        });

        const analyticsTags = data.analytics?.count ||
            data.tags?.filter(t => t.category === 'analytics').length || 0;
        stats.push({
            label: 'Analytics Tags',
            value: analyticsTags.toString(),
            status: analyticsTags > 0 ? 'good' : 'warning'
        });

        const marketingTags = data.marketing?.count ||
            data.tags?.filter(t => t.category === 'marketing').length || 0;
        stats.push({
            label: 'Marketing Tags',
            value: marketingTags.toString(),
            status: 'neutral'
        });

        const issues = data.issues?.length || data.warnings?.length || 0;
        stats.push({
            label: 'Issues Found',
            value: issues.toString(),
            status: issues === 0 ? 'good' : issues < 5 ? 'warning' : 'critical'
        });

        return stats;
    }

    /**
     * Extract component scores for breakdown
     */
    _extractComponentScores(data) {
        return {
            'Analytics Setup': data.analyticsScore || this._estimateAnalyticsScore(data),
            'Marketing Tags': data.marketingScore || this._estimateMarketingScore(data),
            'Performance Impact': data.performanceScore || 75,
            'Privacy Compliance': data.privacyScore || this._estimatePrivacyScore(data)
        };
    }

    _estimateAnalyticsScore(data) {
        let score = 60;
        if (data.analytics?.googleAnalytics) score += 15;
        if (data.analytics?.gtm) score += 15;
        if (data.analytics?.ga4) score += 10;
        return Math.min(100, score);
    }

    _estimateMarketingScore(data) {
        let score = 70;
        if (data.marketing?.facebook) score += 10;
        if (data.marketing?.linkedin) score += 10;
        if (data.marketing?.adwords) score += 10;
        return Math.min(100, score);
    }

    _estimatePrivacyScore(data) {
        let score = 50;
        if (data.privacy?.consentManagement) score += 20;
        if (data.privacy?.cookiePolicy) score += 15;
        if (data.privacy?.gdprCompliant) score += 15;
        return Math.min(100, score);
    }

    /**
     * Extract key findings from analysis
     */
    _extractKeyFindings(data) {
        const findings = [];

        // Analytics findings
        if (data.analytics) {
            if (data.analytics.googleAnalytics) {
                findings.push({
                    type: 'positive',
                    category: 'Analytics',
                    title: 'Google Analytics Detected',
                    description: `GA ${data.analytics.ga4 ? '4' : 'Universal'} is properly installed and tracking.`
                });
            } else {
                findings.push({
                    type: 'critical',
                    category: 'Analytics',
                    title: 'No Analytics Found',
                    description: 'No Google Analytics or similar analytics platform detected.'
                });
            }

            if (data.analytics.gtm) {
                findings.push({
                    type: 'positive',
                    category: 'Tag Management',
                    title: 'GTM Implemented',
                    description: 'Google Tag Manager is being used for centralized tag management.'
                });
            }
        }

        // Privacy findings
        if (data.privacy) {
            if (!data.privacy.consentManagement) {
                findings.push({
                    type: 'critical',
                    category: 'Privacy',
                    title: 'No Consent Management',
                    description: 'Cookie consent management platform not detected.'
                });
            }
        }

        // Tag issues
        if (data.issues) {
            data.issues.slice(0, 5).forEach(issue => {
                findings.push({
                    type: issue.severity || 'warning',
                    category: issue.category || 'Tags',
                    title: issue.title || issue.message,
                    description: issue.description || issue.details || ''
                });
            });
        }

        // Tag inventory findings
        const totalTags = data.totalTags || data.tags?.length || 0;
        if (totalTags > 25) {
            findings.push({
                type: 'warning',
                category: 'Performance',
                title: 'High Tag Count',
                description: `${totalTags} tags detected. Consider auditing for redundant or unused tags.`
            });
        }

        return findings.slice(0, 10);
    }

    /**
     * Get business impact based on score
     */
    _getBusinessImpact(score) {
        if (score >= 85) return TAG_BUSINESS_IMPACT.excellent;
        if (score >= 70) return TAG_BUSINESS_IMPACT.good;
        if (score >= 50) return TAG_BUSINESS_IMPACT.fair;
        return TAG_BUSINESS_IMPACT.poor;
    }

    /**
     * Enhance recommendations with effort/impact ratings
     */
    _enhanceRecommendations(data) {
        const recommendations = [];

        // Check analytics setup
        if (!data.analytics?.googleAnalytics && !data.analytics?.gtm) {
            recommendations.push({
                title: 'Implement Analytics Platform',
                description: 'Install Google Analytics 4 with GTM for comprehensive tracking.',
                effort: 'medium',
                impact: 'high',
                priority: 1,
                category: 'Analytics'
            });
        }

        // Check consent management
        if (!data.privacy?.consentManagement) {
            recommendations.push({
                title: 'Add Consent Management Platform',
                description: 'Implement a CMP for GDPR/CCPA compliance.',
                effort: 'medium',
                impact: 'high',
                priority: 1,
                category: 'Privacy'
            });
        }

        // Check for tag bloat
        const totalTags = data.totalTags || data.tags?.length || 0;
        if (totalTags > 20) {
            recommendations.push({
                title: 'Audit Tag Inventory',
                description: 'Review and remove unused or redundant tags.',
                effort: 'medium',
                impact: 'medium',
                priority: 2,
                category: 'Performance'
            });
        }

        // Check for GTM
        if (data.analytics?.googleAnalytics && !data.analytics?.gtm) {
            recommendations.push({
                title: 'Migrate to Tag Manager',
                description: 'Use GTM for centralized tag management and easier updates.',
                effort: 'high',
                impact: 'medium',
                priority: 3,
                category: 'Management'
            });
        }

        // Add from existing recommendations
        if (data.recommendations) {
            data.recommendations.forEach((rec, index) => {
                if (!recommendations.find(r => r.title === rec.title)) {
                    recommendations.push({
                        title: rec.title || rec.message,
                        description: rec.description || rec.details || '',
                        effort: rec.effort || 'medium',
                        impact: rec.impact || 'medium',
                        priority: rec.priority || index + 3,
                        category: rec.category || 'General'
                    });
                }
            });
        }

        return recommendations.slice(0, 10);
    }

    /**
     * Add tag inventory section
     */
    addTagInventorySection(data) {
        this.doc.addPage();
        this._addSectionHeader('Tag Inventory', 'Complete analysis of all detected tags');

        let yPos = 130;
        const tags = data.tags || [];
        const categories = this._categorizeTaggs(tags, data);

        // Category summary cards
        const cardWidth = 125;
        const cardSpacing = 10;
        let xPos = this.PREMIUM.PAGE.MARGIN;

        Object.entries(categories).forEach(([category, tagList], index) => {
            if (index > 0 && index % 4 === 0) {
                yPos += 90;
                xPos = this.PREMIUM.PAGE.MARGIN;
            }

            this._drawCategoryCard(xPos, yPos, cardWidth, category, tagList);
            xPos += cardWidth + cardSpacing;
        });

        yPos += 110;

        // Tag details table
        if (tags.length > 0) {
            this._addSubsectionTitle('Detected Tags', yPos);
            yPos += 30;

            tags.slice(0, 15).forEach(tag => {
                if (yPos > 700) {
                    this.doc.addPage();
                    yPos = 80;
                }

                this._drawTagRow(yPos, tag);
                yPos += 35;
            });

            if (tags.length > 15) {
                this.doc.fontSize(10)
                    .fillColor('#666666')
                    .text(`... and ${tags.length - 15} more tags`, this.PREMIUM.PAGE.MARGIN, yPos);
            }
        }

        // Plain English explanation
        yPos = Math.max(yPos + 30, 600);
        if (yPos > 650) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'Understanding Your Tag Inventory',
            `Your website has ${tags.length || data.totalTags || 0} tracking tags installed. ` +
            `These tags collect data about how visitors interact with your site. ` +
            `While tags are essential for analytics and marketing, too many tags can slow down your site ` +
            `and create privacy concerns. The ideal setup uses a tag manager like GTM to load tags ` +
            `efficiently and maintain control over what data is collected.`,
            yPos
        );
    }

    _categorizeTaggs(tags, data) {
        const categories = {
            'Analytics': [],
            'Marketing': [],
            'Social': [],
            'Other': []
        };

        tags.forEach(tag => {
            const cat = tag.category || 'Other';
            if (categories[cat]) {
                categories[cat].push(tag);
            } else {
                categories['Other'].push(tag);
            }
        });

        // Add from data if available
        if (data.analytics?.googleAnalytics) {
            if (!categories['Analytics'].find(t => t.name?.includes('Google'))) {
                categories['Analytics'].push({ name: 'Google Analytics', status: 'active' });
            }
        }
        if (data.analytics?.gtm) {
            if (!categories['Analytics'].find(t => t.name?.includes('GTM'))) {
                categories['Analytics'].push({ name: 'Google Tag Manager', status: 'active' });
            }
        }

        return categories;
    }

    _drawCategoryCard(x, y, width, category, tags) {
        const height = 80;
        const categoryColors = {
            'Analytics': '#4285F4',
            'Marketing': '#EA4335',
            'Social': '#34A853',
            'Other': '#9E9E9E'
        };

        const color = categoryColors[category] || '#9E9E9E';

        // Card background
        this.doc.roundedRect(x, y, width, height, 5)
            .fill('#FFFFFF')
            .roundedRect(x, y, width, height, 5)
            .stroke('#E0E0E0');

        // Color accent bar
        this.doc.rect(x, y, 4, height)
            .fill(color);

        // Category name
        this.doc.fontSize(11)
            .fillColor('#333333')
            .text(category, x + 12, y + 12, { width: width - 20 });

        // Tag count
        this.doc.fontSize(24)
            .fillColor(color)
            .text(tags.length.toString(), x + 12, y + 32);

        // Label
        this.doc.fontSize(9)
            .fillColor('#666666')
            .text('tags', x + 12, y + 58);
    }

    _drawTagRow(y, tag) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        // Row background
        this.doc.roundedRect(x, y, width, 30, 3)
            .fill('#FAFAFA');

        // Tag name
        this.doc.fontSize(10)
            .fillColor('#333333')
            .text(tag.name || tag.id || 'Unknown Tag', x + 10, y + 8, { width: 200 });

        // Category badge
        const category = tag.category || 'Unknown';
        this.doc.fontSize(8)
            .fillColor('#666666')
            .text(category, x + 220, y + 10);

        // Status indicator
        const status = tag.status || 'active';
        const statusColor = status === 'active' ? '#212121' :
                           status === 'error' ? '#F44336' : '#FFC107';
        this.doc.circle(x + width - 30, y + 15, 5)
            .fill(statusColor);
    }

    /**
     * Add analytics section
     */
    addAnalyticsSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Analytics Implementation', 'Assessment of your analytics tracking setup');

        let yPos = 130;
        const analytics = data.analytics || {};

        // Analytics platform cards
        const platforms = [
            {
                name: 'Google Analytics 4',
                detected: analytics.ga4 || analytics.googleAnalytics,
                icon: 'GA4',
                description: 'Modern analytics with event-based tracking'
            },
            {
                name: 'Google Tag Manager',
                detected: analytics.gtm,
                icon: 'GTM',
                description: 'Centralized tag management system'
            },
            {
                name: 'Facebook Pixel',
                detected: analytics.facebookPixel || data.marketing?.facebook,
                icon: 'FB',
                description: 'Facebook/Meta conversion tracking'
            },
            {
                name: 'LinkedIn Insight',
                detected: analytics.linkedin || data.marketing?.linkedin,
                icon: 'LI',
                description: 'LinkedIn advertising attribution'
            }
        ];

        platforms.forEach((platform, index) => {
            this._drawPlatformCard(yPos, platform);
            yPos += 70;
        });

        yPos += 20;

        // Analytics configuration quality
        this._addSubsectionTitle('Configuration Quality', yPos);
        yPos += 30;

        const configItems = [
            { name: 'Enhanced Measurement', status: analytics.enhancedMeasurement || false },
            { name: 'Cross-Domain Tracking', status: analytics.crossDomain || false },
            { name: 'Event Tracking', status: analytics.eventTracking !== false },
            { name: 'Conversion Goals', status: analytics.conversions || false },
            { name: 'E-commerce Tracking', status: analytics.ecommerce || false }
        ];

        configItems.forEach(item => {
            this._drawConfigItem(yPos, item);
            yPos += 28;
        });

        // Plain English explanation
        yPos += 30;
        if (yPos > 650) {
            this.doc.addPage();
            yPos = 80;
        }

        const hasGA = analytics.ga4 || analytics.googleAnalytics;
        const hasGTM = analytics.gtm;

        this._addPlainEnglishBox(
            'What This Means For Your Business',
            hasGA && hasGTM ?
                `Your analytics setup is well-configured with Google Analytics and Tag Manager. ` +
                `This gives you comprehensive visitor insights and flexible tag management. ` +
                `Focus on ensuring all conversion events are properly tracked for accurate ROI measurement.` :
            hasGA ?
                `You have Google Analytics installed, which provides basic visitor tracking. ` +
                `Consider adding Google Tag Manager for easier tag management and more sophisticated tracking ` +
                `without requiring code changes for each new tag.` :
                `Your site is missing essential analytics tracking. Without proper analytics, ` +
                `you can't measure marketing effectiveness, understand user behavior, or make data-driven decisions. ` +
                `Implementing Google Analytics 4 with GTM should be a top priority.`,
            yPos
        );
    }

    _drawPlatformCard(y, platform) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);
        const height = 60;

        // Card background
        this.doc.roundedRect(x, y, width, height, 5)
            .fill(platform.detected ? '#F5F5F5' : '#FFEBEE');

        // Status icon
        this.doc.fontSize(14)
            .fillColor(platform.detected ? '#212121' : '#F44336')
            .text(platform.detected ? 'YES' : 'NO', x + 15, y + 20);

        // Platform name
        this.doc.fontSize(12)
            .fillColor('#333333')
            .text(platform.name, x + 45, y + 12);

        // Description
        this.doc.fontSize(9)
            .fillColor('#666666')
            .text(platform.description, x + 45, y + 30);

        // Status label
        this.doc.fontSize(10)
            .fillColor(platform.detected ? '#212121' : '#F44336')
            .text(platform.detected ? 'DETECTED' : 'NOT FOUND', x + width - 100, y + 22);
    }

    _drawConfigItem(y, item) {
        const x = this.PREMIUM.PAGE.MARGIN;

        // Status indicator
        this.doc.circle(x + 10, y + 8, 5)
            .fill(item.status ? '#212121' : '#BDBDBD');

        // Item name
        this.doc.fontSize(10)
            .fillColor('#333333')
            .text(item.name, x + 25, y + 3);

        // Status text
        this.doc.fontSize(9)
            .fillColor(item.status ? '#212121' : '#9E9E9E')
            .text(item.status ? 'Configured' : 'Not Configured', x + 200, y + 4);
    }

    /**
     * Add marketing tags section
     */
    addMarketingTagsSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Marketing Tags', 'Analysis of advertising and marketing pixels');

        let yPos = 130;
        const marketing = data.marketing || {};

        // Marketing tag effectiveness chart
        this._addSubsectionTitle('Marketing Tag Coverage', yPos);
        yPos += 30;

        const marketingPlatforms = [
            { name: 'Google Ads', detected: marketing.adwords || marketing.googleAds, importance: 'High' },
            { name: 'Facebook/Meta', detected: marketing.facebook, importance: 'High' },
            { name: 'LinkedIn', detected: marketing.linkedin, importance: 'Medium' },
            { name: 'Twitter/X', detected: marketing.twitter, importance: 'Medium' },
            { name: 'TikTok', detected: marketing.tiktok, importance: 'Medium' },
            { name: 'Microsoft Ads', detected: marketing.bing || marketing.microsoft, importance: 'Low' }
        ];

        marketingPlatforms.forEach(platform => {
            this._drawMarketingPlatformRow(yPos, platform);
            yPos += 40;
        });

        yPos += 30;

        // Conversion tracking assessment
        this._addSubsectionTitle('Conversion Tracking', yPos);
        yPos += 30;

        const conversions = data.conversions || marketing.conversions || {};
        const conversionTypes = [
            { name: 'Purchase/Transaction', configured: conversions.purchase },
            { name: 'Lead Form Submission', configured: conversions.lead },
            { name: 'Newsletter Signup', configured: conversions.newsletter },
            { name: 'Contact Form', configured: conversions.contact },
            { name: 'Button Click Events', configured: conversions.clicks }
        ];

        conversionTypes.forEach(conv => {
            this._drawConversionRow(yPos, conv);
            yPos += 28;
        });

        // Plain English
        yPos += 30;
        if (yPos > 650) {
            this.doc.addPage();
            yPos = 80;
        }

        const detectedCount = marketingPlatforms.filter(p => p.detected).length;
        this._addPlainEnglishBox(
            'Understanding Marketing Tag Impact',
            detectedCount > 2 ?
                `You have ${detectedCount} marketing platforms configured, providing good advertising attribution. ` +
                `Ensure each platform has proper conversion events configured so you can measure which ads ` +
                `drive actual business results, not just clicks.` :
            detectedCount > 0 ?
                `You have basic marketing tracking in place. Consider expanding to additional platforms ` +
                `if you advertise elsewhere. More importantly, verify that conversion events are properly ` +
                `configured to measure ROI accurately.` :
                `No marketing pixels detected. If you run paid advertising, you're flying blind without ` +
                `proper attribution tracking. Install pixels for each advertising platform you use ` +
                `to measure campaign effectiveness.`,
            yPos
        );
    }

    _drawMarketingPlatformRow(y, platform) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        // Row background
        this.doc.roundedRect(x, y, width, 35, 3)
            .fill('#FAFAFA');

        // Platform name
        this.doc.fontSize(11)
            .fillColor('#333333')
            .text(platform.name, x + 15, y + 10);

        // Importance badge
        const importanceColors = { 'High': '#1976D2', 'Medium': '#7B1FA2', 'Low': '#616161' };
        this.doc.fontSize(8)
            .fillColor(importanceColors[platform.importance])
            .text(platform.importance + ' Priority', x + 200, y + 12);

        // Status
        this.doc.fontSize(10)
            .fillColor(platform.detected ? '#212121' : '#9E9E9E')
            .text(platform.detected ? 'Installed' : 'Not Installed', x + width - 120, y + 10);
    }

    _drawConversionRow(y, conversion) {
        const x = this.PREMIUM.PAGE.MARGIN;

        this.doc.circle(x + 10, y + 6, 4)
            .fill(conversion.configured ? '#212121' : '#E0E0E0');

        this.doc.fontSize(10)
            .fillColor(conversion.configured ? '#333333' : '#9E9E9E')
            .text(conversion.name, x + 25, y + 2);
    }

    /**
     * Add privacy compliance section
     */
    addPrivacyComplianceSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Privacy & Compliance', 'GDPR, CCPA, and cookie consent assessment');

        let yPos = 130;
        const privacy = data.privacy || {};

        // Compliance status cards
        const complianceItems = [
            {
                regulation: 'GDPR (EU)',
                status: privacy.gdprCompliant ? 'compliant' : 'non-compliant',
                requirements: ['Cookie consent banner', 'Data processing notice', 'Opt-out mechanism']
            },
            {
                regulation: 'CCPA (California)',
                status: privacy.ccpaCompliant ? 'compliant' : 'needs-review',
                requirements: ['Do Not Sell link', 'Privacy policy', 'Data request process']
            },
            {
                regulation: 'ePrivacy',
                status: privacy.cookieCompliance ? 'compliant' : 'non-compliant',
                requirements: ['Prior consent', 'Cookie categorization', 'Clear rejection option']
            }
        ];

        complianceItems.forEach(item => {
            this._drawComplianceCard(yPos, item);
            yPos += 100;
        });

        yPos += 20;

        // Consent Management Platform
        this._addSubsectionTitle('Consent Management', yPos);
        yPos += 30;

        const cmpDetected = privacy.consentManagement || privacy.cmp;
        this.doc.roundedRect(this.PREMIUM.PAGE.MARGIN, yPos,
            this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN), 60, 5)
            .fill(cmpDetected ? '#F5F5F5' : '#FFF3E0');

        this.doc.fontSize(12)
            .fillColor('#333333')
            .text('Consent Management Platform (CMP)', this.PREMIUM.PAGE.MARGIN + 15, yPos + 15);

        this.doc.fontSize(10)
            .fillColor(cmpDetected ? '#212121' : '#FF9800')
            .text(
                cmpDetected ?
                    `CMP Detected: ${privacy.cmpName || 'Unknown provider'}` :
                    'No CMP detected - Required for GDPR compliance',
                this.PREMIUM.PAGE.MARGIN + 15, yPos + 35
            );

        yPos += 90;

        // Plain English
        if (yPos > 650) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'Privacy Compliance Explained',
            privacy.consentManagement ?
                `You have consent management in place, which is essential for legal compliance. ` +
                `However, having a cookie banner isn't enough - you must ensure tags only fire ` +
                `after consent is given, and that users can easily withdraw consent. ` +
                `Non-compliance can result in fines up to 4% of annual revenue under GDPR.` :
                `Your website lacks proper consent management, which puts you at legal risk. ` +
                `GDPR requires explicit consent before setting non-essential cookies. ` +
                `Fines for non-compliance can reach €20 million or 4% of global revenue. ` +
                `Implementing a Consent Management Platform should be an immediate priority.`,
            yPos
        );
    }

    _drawComplianceCard(y, item) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);
        const height = 90;

        const statusColors = {
            'compliant': { bg: '#F5F5F5', text: '#212121', label: 'COMPLIANT' },
            'non-compliant': { bg: '#FFEBEE', text: '#F44336', label: 'NON-COMPLIANT' },
            'needs-review': { bg: '#FFF3E0', text: '#FF9800', label: 'NEEDS REVIEW' }
        };

        const colors = statusColors[item.status] || statusColors['needs-review'];

        // Card background
        this.doc.roundedRect(x, y, width, height, 5)
            .fill(colors.bg);

        // Regulation name
        this.doc.fontSize(14)
            .fillColor('#333333')
            .text(item.regulation, x + 15, y + 12);

        // Status badge
        this.doc.fontSize(9)
            .fillColor(colors.text)
            .text(colors.label, x + width - 100, y + 15);

        // Requirements
        this.doc.fontSize(9)
            .fillColor('#666666');

        item.requirements.forEach((req, index) => {
            this.doc.text(`• ${req}`, x + 15, y + 38 + (index * 14));
        });
    }

    /**
     * Add performance impact section
     */
    addPerformanceImpactSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Tag Performance Impact', 'How tags affect your page load speed');

        let yPos = 130;
        const performance = data.performance || data.tagPerformance || {};

        // Performance metrics
        this._addSubsectionTitle('Load Time Impact', yPos);
        yPos += 30;

        const metrics = [
            {
                label: 'Tag Load Time',
                value: performance.tagLoadTime || 'N/A',
                unit: 'ms',
                benchmark: '< 500ms',
                status: (performance.tagLoadTime || 0) < 500 ? 'good' : 'warning'
            },
            {
                label: 'Blocking Time',
                value: performance.blockingTime || 'N/A',
                unit: 'ms',
                benchmark: '< 100ms',
                status: (performance.blockingTime || 0) < 100 ? 'good' : 'warning'
            },
            {
                label: 'Total Tag Size',
                value: performance.totalSize ? Math.round(performance.totalSize / 1024) : 'N/A',
                unit: 'KB',
                benchmark: '< 200KB',
                status: (performance.totalSize || 0) < 200000 ? 'good' : 'warning'
            }
        ];

        metrics.forEach(metric => {
            this._drawPerformanceMetric(yPos, metric);
            yPos += 60;
        });

        yPos += 20;

        // Tag loading strategy
        this._addSubsectionTitle('Loading Strategy', yPos);
        yPos += 30;

        const strategies = [
            { name: 'Async Loading', enabled: performance.asyncLoading !== false, recommended: true },
            { name: 'Deferred Execution', enabled: performance.deferredExecution, recommended: true },
            { name: 'Tag Prioritization', enabled: performance.prioritized, recommended: true },
            { name: 'Lazy Loading', enabled: performance.lazyLoading, recommended: false }
        ];

        strategies.forEach(strategy => {
            this._drawStrategyRow(yPos, strategy);
            yPos += 30;
        });

        // Plain English
        yPos += 30;
        if (yPos > 650) {
            this.doc.addPage();
            yPos = 80;
        }

        const tagCount = data.totalTags || data.tags?.length || 0;
        this._addPlainEnglishBox(
            'Performance Impact Explained',
            tagCount > 20 ?
                `With ${tagCount} tags, your site may experience noticeable slowdowns. ` +
                `Each tag adds network requests and JavaScript execution time. ` +
                `Consider auditing your tags to remove unused ones, and ensure critical tags ` +
                `load first while marketing tags can be deferred.` :
                `Your tag count is reasonable. Focus on ensuring tags load asynchronously ` +
                `so they don't block page rendering. Using Google Tag Manager helps manage ` +
                `tag loading priorities and can defer non-essential tags until after the page loads.`,
            yPos
        );
    }

    _drawPerformanceMetric(y, metric) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        // Card background
        this.doc.roundedRect(x, y, width, 50, 5)
            .fill('#FAFAFA');

        // Metric label
        this.doc.fontSize(10)
            .fillColor('#666666')
            .text(metric.label, x + 15, y + 8);

        // Value
        this.doc.fontSize(20)
            .fillColor(metric.status === 'good' ? '#212121' : '#FF9800')
            .text(`${metric.value}${metric.unit}`, x + 15, y + 22);

        // Benchmark
        this.doc.fontSize(9)
            .fillColor('#9E9E9E')
            .text(`Benchmark: ${metric.benchmark}`, x + width - 150, y + 20);
    }

    _drawStrategyRow(y, strategy) {
        const x = this.PREMIUM.PAGE.MARGIN;

        // Status circle
        this.doc.circle(x + 10, y + 6, 5)
            .fill(strategy.enabled ? '#212121' : '#E0E0E0');

        // Strategy name
        this.doc.fontSize(10)
            .fillColor('#333333')
            .text(strategy.name, x + 25, y + 2);

        // Recommendation badge
        if (strategy.recommended && !strategy.enabled) {
            this.doc.fontSize(8)
                .fillColor('#FF9800')
                .text('Recommended', x + 200, y + 3);
        }
    }

    /**
     * Add tag management checklist
     */
    addTagManagementChecklist(data, score) {
        this.doc.addPage();
        this._addSectionHeader('Tag Management Checklist', 'Action items for optimal tag implementation');

        let yPos = 130;

        const checklistItems = [
            {
                category: 'Foundation',
                items: [
                    { text: 'Google Tag Manager implemented', checked: data.analytics?.gtm },
                    { text: 'GA4 properly configured', checked: data.analytics?.ga4 || data.analytics?.googleAnalytics },
                    { text: 'Container published and verified', checked: data.analytics?.gtm },
                    { text: 'Debug mode tested', checked: score >= 80 }
                ]
            },
            {
                category: 'Privacy & Consent',
                items: [
                    { text: 'Consent Management Platform installed', checked: data.privacy?.consentManagement },
                    { text: 'Tags fire only after consent', checked: data.privacy?.consentControlled },
                    { text: 'Cookie categories properly defined', checked: data.privacy?.cookieCategories },
                    { text: 'Privacy policy updated', checked: data.privacy?.policyUpdated }
                ]
            },
            {
                category: 'Marketing Attribution',
                items: [
                    { text: 'Conversion events configured', checked: data.conversions?.configured },
                    { text: 'UTM parameters tracked', checked: data.analytics?.utmTracking },
                    { text: 'Cross-domain tracking set up', checked: data.analytics?.crossDomain },
                    { text: 'Remarketing audiences created', checked: data.marketing?.remarketing }
                ]
            },
            {
                category: 'Performance',
                items: [
                    { text: 'Tags load asynchronously', checked: data.performance?.asyncLoading !== false },
                    { text: 'Non-essential tags deferred', checked: data.performance?.deferredExecution },
                    { text: 'Unused tags removed', checked: (data.totalTags || 0) <= 20 },
                    { text: 'Tag loading monitored', checked: data.performance?.monitoring }
                ]
            }
        ];

        checklistItems.forEach(section => {
            this._drawChecklistSection(yPos, section);
            yPos += 30 + (section.items.length * 25);

            if (yPos > 650) {
                this.doc.addPage();
                yPos = 80;
            }
        });

        // Final score card
        yPos += 20;
        if (yPos > 600) {
            this.doc.addPage();
            yPos = 80;
        }

        this._drawFinalScoreCard(yPos, score);
    }

    _drawChecklistSection(y, section) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        // Section header
        this.doc.fontSize(12)
            .fillColor(this.reportColor)
            .text(section.category, x, y);

        y += 20;

        section.items.forEach(item => {
            // Checkbox
            this.doc.roundedRect(x, y, 14, 14, 2)
                .lineWidth(1)
                .stroke(item.checked ? '#212121' : '#BDBDBD');

            if (item.checked) {
                this.doc.fontSize(10)
                    .fillColor('#212121')
                    .text('*', x + 2, y + 1);
            }

            // Item text
            this.doc.fontSize(10)
                .fillColor(item.checked ? '#333333' : '#9E9E9E')
                .text(item.text, x + 25, y + 2);

            y += 25;
        });
    }

    _drawFinalScoreCard(y, score) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);
        const height = 100;

        // Card background with gradient effect
        this.doc.roundedRect(x, y, width, height, 8)
            .fill(this.reportColor);

        // Score
        this.doc.fontSize(36)
            .fillColor('#FFFFFF')
            .text(score.toString(), x + 30, y + 25);

        this.doc.fontSize(14)
            .fillColor('rgba(255,255,255,0.8)')
            .text('/100', x + 85, y + 45);

        // Summary text
        this.doc.fontSize(14)
            .fillColor('#FFFFFF')
            .text('Tag Intelligence Score', x + 160, y + 25);

        const summary = score >= 80 ? 'Excellent tag implementation' :
                       score >= 60 ? 'Good foundation, room for improvement' :
                       score >= 40 ? 'Significant gaps need attention' :
                       'Critical issues require immediate action';

        this.doc.fontSize(11)
            .fillColor('rgba(255,255,255,0.9)')
            .text(summary, x + 160, y + 50);

        // Report generation info
        this.doc.fontSize(9)
            .fillColor('rgba(255,255,255,0.7)')
            .text(`Report generated: ${new Date().toLocaleDateString()}`, x + 160, y + 75);
    }
}

module.exports = TagIntelligencePremiumPdfGenerator;
