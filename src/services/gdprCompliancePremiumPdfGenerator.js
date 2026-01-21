/**
 * GDPR Compliance Premium PDF Generator
 *
 * Creates comprehensive premium PDF reports for GDPR/privacy compliance analysis
 * with executive summaries, benchmarks, and actionable roadmaps.
 */

const { PremiumPdfReport } = require('../utils/premiumPdfTemplate');

// Industry benchmarks for GDPR compliance
const GDPR_BENCHMARKS = {
    industryAverage: 52,
    topPerformers: 90,
    categories: {
        consentManagement: { average: 55, top: 95 },
        dataPolicies: { average: 60, top: 92 },
        thirdPartyCompliance: { average: 45, top: 88 },
        userRights: { average: 48, top: 90 }
    }
};

// Business impact templates
const GDPR_BUSINESS_IMPACT = {
    excellent: {
        summary: "Your privacy compliance is excellent and minimizes legal risk.",
        impacts: [
            "Strong protection against GDPR fines (up to €20M or 4% revenue)",
            "User trust enhanced by transparent data practices",
            "Competitive advantage in privacy-conscious markets",
            "Reduced risk of data breach liability"
        ]
    },
    good: {
        summary: "Your compliance foundation is solid with some gaps to address.",
        impacts: [
            "Basic protection against regulatory action",
            "Some compliance gaps may expose you to risk",
            "User consent mechanisms in place",
            "Minor improvements needed for full compliance"
        ]
    },
    fair: {
        summary: "Compliance gaps create moderate legal and financial risk.",
        impacts: [
            "Vulnerability to regulatory complaints",
            "Potential fines if audited or reported",
            "User trust may be affected",
            "Third-party tools may be non-compliant"
        ]
    },
    poor: {
        summary: "Significant compliance issues create serious legal exposure.",
        impacts: [
            "High risk of substantial GDPR fines",
            "Likely non-compliant data processing",
            "Users' rights not properly respected",
            "Urgent remediation required"
        ]
    }
};

class GdprCompliancePremiumPdfGenerator extends PremiumPdfReport {
    constructor() {
        super();
        this.reportType = 'GDPR Compliance';
        this.reportColor = '#673AB7'; // Deep Purple for GDPR
    }

    /**
     * Generate the complete premium GDPR Compliance PDF report
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
            title: 'GDPR Compliance Analysis',
            subtitle: 'Privacy & Data Protection Assessment',
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
            industryAverage: GDPR_BENCHMARKS.industryAverage,
            topPerformers: GDPR_BENCHMARKS.topPerformers,
            categoryBenchmarks: GDPR_BENCHMARKS.categories,
            componentScores
        });

        // Action Roadmap
        this.addActionRoadmap(recommendations);

        // GDPR Specific Sections
        this.addConsentManagementSection(analysisData);
        this.addCookieAnalysisSection(analysisData);
        this.addPrivacyPolicySection(analysisData);
        this.addThirdPartyServicesSection(analysisData);
        this.addUserRightsSection(analysisData);
        this.addGdprChecklist(analysisData, score);

        return await this.endDocument();
    }

    /**
     * Calculate overall GDPR compliance score
     */
    _calculateOverallScore(data) {
        if (data.score !== undefined) return Math.round(data.score);
        if (data.overallScore !== undefined) return Math.round(data.overallScore);

        let score = 40; // Base score

        // Consent management
        if (data.consent?.banner) score += 15;
        if (data.consent?.granular) score += 10;

        // Privacy policy
        if (data.privacyPolicy?.exists) score += 10;
        if (data.privacyPolicy?.comprehensive) score += 5;

        // Cookie compliance
        if (data.cookies?.priorConsent) score += 10;
        if (data.cookies?.categorized) score += 5;

        // User rights
        if (data.userRights?.dataAccess) score += 5;

        // Deductions
        if (data.issues) {
            score -= Math.min(data.issues.length * 4, 30);
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Extract key statistics for executive summary
     */
    _extractKeyStats(data) {
        const stats = [];

        // Consent banner
        const hasConsent = data.consent?.banner;
        stats.push({
            label: 'Consent Banner',
            value: hasConsent ? 'Present' : 'Missing',
            status: hasConsent ? 'good' : 'critical'
        });

        // Privacy policy
        const hasPolicy = data.privacyPolicy?.exists;
        stats.push({
            label: 'Privacy Policy',
            value: hasPolicy ? 'Found' : 'Missing',
            status: hasPolicy ? 'good' : 'critical'
        });

        // Cookies before consent
        const cookiesBeforeConsent = data.cookies?.beforeConsent || 0;
        stats.push({
            label: 'Pre-Consent Cookies',
            value: cookiesBeforeConsent.toString(),
            status: cookiesBeforeConsent === 0 ? 'good' : cookiesBeforeConsent < 5 ? 'warning' : 'critical'
        });

        // Third-party trackers
        const trackers = data.thirdParty?.count || data.trackers?.length || 0;
        stats.push({
            label: 'Third-Party Trackers',
            value: trackers.toString(),
            status: trackers <= 5 ? 'good' : trackers <= 15 ? 'warning' : 'critical'
        });

        return stats;
    }

    /**
     * Extract component scores for breakdown
     */
    _extractComponentScores(data) {
        return {
            'Consent Management': data.consent?.score || this._estimateConsentScore(data),
            'Privacy Policies': data.privacyPolicy?.score || (data.privacyPolicy?.exists ? 70 : 30),
            'Third-Party Compliance': data.thirdParty?.score || 55,
            'User Rights': data.userRights?.score || 50
        };
    }

    _estimateConsentScore(data) {
        let score = 30;
        if (data.consent?.banner) score += 25;
        if (data.consent?.granular) score += 20;
        if (data.consent?.rejectOption) score += 15;
        if (data.consent?.priorConsent) score += 10;
        return Math.min(100, score);
    }

    /**
     * Extract key findings from analysis
     */
    _extractKeyFindings(data) {
        const findings = [];

        // Consent findings
        if (data.consent?.banner) {
            findings.push({
                type: 'positive',
                category: 'Consent',
                title: 'Cookie Consent Banner Present',
                description: 'A cookie consent mechanism is implemented on your site.'
            });

            if (!data.consent?.granular) {
                findings.push({
                    type: 'warning',
                    category: 'Consent',
                    title: 'No Granular Consent Options',
                    description: 'Users cannot select specific cookie categories.'
                });
            }

            if (!data.consent?.rejectOption) {
                findings.push({
                    type: 'warning',
                    category: 'Consent',
                    title: 'No Clear Reject Option',
                    description: 'Rejecting cookies should be as easy as accepting.'
                });
            }
        } else {
            findings.push({
                type: 'critical',
                category: 'Consent',
                title: 'No Cookie Consent Banner',
                description: 'GDPR requires consent before setting non-essential cookies.'
            });
        }

        // Privacy policy findings
        if (data.privacyPolicy?.exists) {
            findings.push({
                type: 'positive',
                category: 'Policies',
                title: 'Privacy Policy Found',
                description: 'A privacy policy is accessible on your website.'
            });
        } else {
            findings.push({
                type: 'critical',
                category: 'Policies',
                title: 'Privacy Policy Missing',
                description: 'A comprehensive privacy policy is legally required.'
            });
        }

        // Cookie findings
        if (data.cookies?.beforeConsent > 0) {
            findings.push({
                type: 'critical',
                category: 'Cookies',
                title: 'Cookies Set Before Consent',
                description: `${data.cookies.beforeConsent} cookies set without user consent.`
            });
        }

        // Third-party findings
        if ((data.thirdParty?.count || 0) > 10) {
            findings.push({
                type: 'warning',
                category: 'Third Parties',
                title: 'Many Third-Party Services',
                description: 'Each third-party service requires disclosure and consent.'
            });
        }

        // Add from existing issues
        if (data.issues) {
            data.issues.slice(0, 4).forEach(issue => {
                findings.push({
                    type: issue.severity || 'warning',
                    category: issue.category || 'Compliance',
                    title: issue.title || issue.message,
                    description: issue.description || ''
                });
            });
        }

        return findings.slice(0, 10);
    }

    /**
     * Get business impact based on score
     */
    _getBusinessImpact(score) {
        if (score >= 80) return GDPR_BUSINESS_IMPACT.excellent;
        if (score >= 60) return GDPR_BUSINESS_IMPACT.good;
        if (score >= 40) return GDPR_BUSINESS_IMPACT.fair;
        return GDPR_BUSINESS_IMPACT.poor;
    }

    /**
     * Enhance recommendations with effort/impact ratings
     */
    _enhanceRecommendations(data) {
        const recommendations = [];

        // Consent banner
        if (!data.consent?.banner) {
            recommendations.push({
                title: 'Implement Cookie Consent Banner',
                description: 'Add a GDPR-compliant consent management platform.',
                effort: 'medium',
                impact: 'high',
                priority: 1,
                category: 'Consent'
            });
        } else if (!data.consent?.granular) {
            recommendations.push({
                title: 'Add Granular Consent Options',
                description: 'Allow users to choose specific cookie categories.',
                effort: 'low',
                impact: 'high',
                priority: 1,
                category: 'Consent'
            });
        }

        // Privacy policy
        if (!data.privacyPolicy?.exists) {
            recommendations.push({
                title: 'Create Privacy Policy',
                description: 'Publish a comprehensive GDPR-compliant privacy policy.',
                effort: 'medium',
                impact: 'high',
                priority: 1,
                category: 'Policies'
            });
        }

        // Cookies before consent
        if (data.cookies?.beforeConsent > 0) {
            recommendations.push({
                title: 'Block Non-Essential Cookies',
                description: 'Prevent cookies from loading until consent is given.',
                effort: 'medium',
                impact: 'high',
                priority: 1,
                category: 'Technical'
            });
        }

        // User rights
        if (!data.userRights?.dataAccess) {
            recommendations.push({
                title: 'Implement Data Access Request',
                description: 'Allow users to request their personal data.',
                effort: 'high',
                impact: 'medium',
                priority: 2,
                category: 'User Rights'
            });
        }

        // Third-party disclosure
        if ((data.thirdParty?.count || 0) > 5 && !data.thirdParty?.disclosed) {
            recommendations.push({
                title: 'Document Third-Party Services',
                description: 'List all third parties in your privacy policy.',
                effort: 'low',
                impact: 'medium',
                priority: 2,
                category: 'Policies'
            });
        }

        // Add from existing recommendations
        if (data.recommendations) {
            data.recommendations.forEach((rec, index) => {
                if (!recommendations.find(r => r.title === rec.title)) {
                    recommendations.push({
                        title: rec.title || rec.message,
                        description: rec.description || '',
                        effort: rec.effort || 'medium',
                        impact: rec.impact || 'medium',
                        priority: rec.priority || index + 4,
                        category: rec.category || 'Compliance'
                    });
                }
            });
        }

        return recommendations.slice(0, 10);
    }

    /**
     * Add consent management section
     */
    addConsentManagementSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Consent Management', 'Cookie consent and user choice mechanisms');

        let yPos = 130;
        const consent = data.consent || {};

        // Consent banner status
        const hasBanner = consent.banner;
        this.doc.roundedRect(this.PREMIUM.PAGE.MARGIN, yPos,
            this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN), 80, 8)
            .fill(hasBanner ? '#F5F5F5' : '#FFEBEE');

        this.doc.fontSize(16)
            .fillColor(hasBanner ? '#212121' : '#F44336')
            .text(hasBanner ? 'Consent Banner Detected' : 'No Consent Banner Found',
                this.PREMIUM.PAGE.MARGIN + 25, yPos + 25);

        this.doc.fontSize(11)
            .fillColor('#666666')
            .text(hasBanner ?
                `Provider: ${consent.provider || 'Unknown CMP'}` :
                'GDPR requires explicit consent before setting non-essential cookies.',
                this.PREMIUM.PAGE.MARGIN + 25, yPos + 50);

        yPos += 100;

        // Consent requirements checklist
        this._addSubsectionTitle('GDPR Consent Requirements', yPos);
        yPos += 25;

        const requirements = [
            {
                name: 'Prior Consent',
                description: 'Consent obtained before setting cookies',
                met: consent.priorConsent,
                critical: true
            },
            {
                name: 'Granular Options',
                description: 'Users can choose cookie categories',
                met: consent.granular,
                critical: true
            },
            {
                name: 'Equal Reject Option',
                description: 'Rejecting is as easy as accepting',
                met: consent.rejectOption,
                critical: true
            },
            {
                name: 'Informed Consent',
                description: 'Clear explanation of data use',
                met: consent.informed,
                critical: false
            },
            {
                name: 'Withdraw Consent',
                description: 'Easy way to change preferences',
                met: consent.withdrawable,
                critical: false
            },
            {
                name: 'No Pre-Checked Boxes',
                description: 'Options not pre-selected',
                met: consent.noPreChecked !== false,
                critical: true
            }
        ];

        requirements.forEach(req => {
            this._drawRequirementRow(yPos, req);
            yPos += 40;

            if (yPos > 700) {
                this.doc.addPage();
                yPos = 80;
            }
        });

        // Plain English
        yPos += 20;
        if (yPos > 600) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'Consent Under GDPR',
            `GDPR requires "freely given, specific, informed, and unambiguous" consent before ` +
            `processing personal data. For cookies, this means users must actively opt-in, ` +
            `not just be notified. The "reject" option must be as prominent as "accept" - ` +
            `using dark patterns to trick users into accepting is illegal. Fines for consent ` +
            `violations can reach €20 million or 4% of global annual revenue.`,
            yPos
        );
    }

    _drawRequirementRow(y, requirement) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        // Row background
        this.doc.roundedRect(x, y, width, 35, 4)
            .fill(requirement.met ? '#F5F5F5' : requirement.critical ? '#FFEBEE' : '#FFF3E0');

        // Status icon
        this.doc.fontSize(14)
            .fillColor(requirement.met ? '#212121' : requirement.critical ? '#F44336' : '#FF9800')
            .text(requirement.met ? 'YES' : 'NO', x + 15, y + 10);

        // Requirement name
        this.doc.fontSize(11)
            .fillColor('#333333')
            .text(requirement.name, x + 45, y + 6);

        // Description
        this.doc.fontSize(9)
            .fillColor('#666666')
            .text(requirement.description, x + 45, y + 20);

        // Critical badge
        if (requirement.critical && !requirement.met) {
            this.doc.fontSize(8)
                .fillColor('#F44336')
                .text('CRITICAL', x + width - 70, y + 12);
        }
    }

    /**
     * Add cookie analysis section
     */
    addCookieAnalysisSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Cookie Analysis', 'Detailed cookie inventory and compliance');

        let yPos = 130;
        const cookies = data.cookies || {};

        // Cookie statistics
        this._addSubsectionTitle('Cookie Overview', yPos);
        yPos += 30;

        const cookieStats = [
            { label: 'Total Cookies', value: cookies.total || 0, color: '#2196F3' },
            { label: 'Before Consent', value: cookies.beforeConsent || 0,
              color: (cookies.beforeConsent || 0) === 0 ? '#212121' : '#F44336' },
            { label: 'Third-Party', value: cookies.thirdParty || 0, color: '#FF9800' },
            { label: 'Session Cookies', value: cookies.session || 0, color: '#9C27B0' }
        ];

        const cardWidth = 120;
        cookieStats.forEach((stat, index) => {
            const x = this.PREMIUM.PAGE.MARGIN + (index * (cardWidth + 10));
            this._drawCookieStatCard(x, yPos, cardWidth, stat);
        });

        yPos += 90;

        // Cookie categories
        this._addSubsectionTitle('Cookie Categories', yPos);
        yPos += 25;

        const categories = [
            { name: 'Essential', count: cookies.essential || 0, description: 'Required for site function', compliant: true },
            { name: 'Analytics', count: cookies.analytics || 0, description: 'Site usage tracking', compliant: cookies.analyticsConsent },
            { name: 'Marketing', count: cookies.marketing || 0, description: 'Advertising and remarketing', compliant: cookies.marketingConsent },
            { name: 'Functional', count: cookies.functional || 0, description: 'Enhanced features', compliant: cookies.functionalConsent }
        ];

        categories.forEach(cat => {
            this._drawCookieCategoryRow(yPos, cat);
            yPos += 45;
        });

        // Cookie list
        yPos += 20;
        if (cookies.list && cookies.list.length > 0) {
            this._addSubsectionTitle('Detected Cookies', yPos);
            yPos += 25;

            cookies.list.slice(0, 10).forEach(cookie => {
                if (yPos > 700) {
                    this.doc.addPage();
                    yPos = 80;
                }
                this._drawCookieDetailRow(yPos, cookie);
                yPos += 30;
            });
        }

        // Plain English
        yPos += 30;
        if (yPos > 600) {
            this.doc.addPage();
            yPos = 80;
        }

        const beforeConsent = cookies.beforeConsent || 0;
        this._addPlainEnglishBox(
            'Cookie Compliance Explained',
            beforeConsent === 0 ?
                `Your site correctly waits for consent before setting non-essential cookies. ` +
                `Continue to audit new features and third-party integrations to maintain compliance. ` +
                `Remember: only truly essential cookies (like session IDs) can be set without consent.` :
                `${beforeConsent} cookies are being set before user consent, which violates GDPR. ` +
                `These cookies must be blocked until the user explicitly agrees. Most Consent Management ` +
                `Platforms can handle this automatically - ensure your CMP is properly configured to ` +
                `block all non-essential scripts until consent is given.`,
            yPos
        );
    }

    _drawCookieStatCard(x, y, width, stat) {
        const height = 70;

        this.doc.roundedRect(x, y, width, height, 5)
            .fill('#FAFAFA');

        this.doc.rect(x, y, 4, height)
            .fill(stat.color);

        this.doc.fontSize(24)
            .fillColor(stat.color)
            .text(stat.value.toString(), x + 15, y + 15);

        this.doc.fontSize(9)
            .fillColor('#666666')
            .text(stat.label, x + 15, y + 48);
    }

    _drawCookieCategoryRow(y, category) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        this.doc.roundedRect(x, y, width, 40, 4)
            .fill('#FAFAFA');

        // Category name and count
        this.doc.fontSize(12)
            .fillColor('#333333')
            .text(category.name, x + 15, y + 8);

        this.doc.fontSize(10)
            .fillColor('#666666')
            .text(`${category.count} cookies`, x + 15, y + 24);

        // Description
        this.doc.fontSize(9)
            .fillColor('#9E9E9E')
            .text(category.description, x + 150, y + 14);

        // Compliance status
        const needsConsent = category.name !== 'Essential';
        if (needsConsent) {
            this.doc.fontSize(9)
                .fillColor(category.compliant ? '#212121' : '#FF9800')
                .text(category.compliant ? 'Consent managed' : 'Needs consent config',
                    x + width - 130, y + 14);
        } else {
            this.doc.fontSize(9)
                .fillColor('#212121')
                .text('No consent needed', x + width - 130, y + 14);
        }
    }

    _drawCookieDetailRow(y, cookie) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        this.doc.roundedRect(x, y, width, 25, 3)
            .fill('#FFFFFF')
            .roundedRect(x, y, width, 25, 3)
            .stroke('#E0E0E0');

        // Cookie name
        this.doc.fontSize(9)
            .fillColor('#333333')
            .text(cookie.name || cookie, x + 10, y + 7, { width: 150 });

        // Domain
        if (cookie.domain) {
            this.doc.fontSize(8)
                .fillColor('#666666')
                .text(cookie.domain, x + 170, y + 8, { width: 120 });
        }

        // Category
        if (cookie.category) {
            this.doc.fontSize(8)
                .fillColor('#9E9E9E')
                .text(cookie.category, x + 300, y + 8);
        }

        // Expiry
        if (cookie.expiry) {
            this.doc.fontSize(8)
                .fillColor('#9E9E9E')
                .text(cookie.expiry, x + width - 80, y + 8);
        }
    }

    /**
     * Add privacy policy section
     */
    addPrivacyPolicySection(data) {
        this.doc.addPage();
        this._addSectionHeader('Privacy Policy Analysis', 'Required disclosures and policy assessment');

        let yPos = 130;
        const policy = data.privacyPolicy || {};

        // Policy status
        const hasPolicy = policy.exists;
        this.doc.roundedRect(this.PREMIUM.PAGE.MARGIN, yPos,
            this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN), 70, 5)
            .fill(hasPolicy ? '#F5F5F5' : '#FFEBEE');

        this.doc.fontSize(14)
            .fillColor(hasPolicy ? '#212121' : '#F44336')
            .text(hasPolicy ? 'Privacy Policy Found' : 'Privacy Policy Not Found',
                this.PREMIUM.PAGE.MARGIN + 20, yPos + 20);

        if (policy.url) {
            this.doc.fontSize(9)
                .fillColor('#1976D2')
                .text(policy.url, this.PREMIUM.PAGE.MARGIN + 20, yPos + 42);
        }

        yPos += 90;

        // Required elements
        this._addSubsectionTitle('GDPR Required Elements', yPos);
        yPos += 25;

        const requiredElements = [
            { name: 'Data Controller Identity', present: policy.hasController, description: 'Who is responsible for data' },
            { name: 'Contact Details', present: policy.hasContact, description: 'How to reach you' },
            { name: 'DPO Contact', present: policy.hasDpo, description: 'Data Protection Officer (if applicable)' },
            { name: 'Purpose of Processing', present: policy.hasPurpose, description: 'Why you collect data' },
            { name: 'Legal Basis', present: policy.hasLegalBasis, description: 'Justification for processing' },
            { name: 'Data Recipients', present: policy.hasRecipients, description: 'Who receives the data' },
            { name: 'Retention Period', present: policy.hasRetention, description: 'How long data is kept' },
            { name: 'User Rights', present: policy.hasRights, description: 'Access, deletion, etc.' },
            { name: 'Right to Complain', present: policy.hasComplaint, description: 'Supervisory authority info' },
            { name: 'International Transfers', present: policy.hasTransfers, description: 'Data leaving EU' }
        ];

        requiredElements.forEach(element => {
            if (yPos > 700) {
                this.doc.addPage();
                yPos = 80;
            }
            this._drawPolicyElementRow(yPos, element);
            yPos += 32;
        });

        // Plain English
        yPos += 20;
        if (yPos > 600) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'Privacy Policy Requirements',
            `GDPR Article 13 specifies exactly what must be in your privacy policy. It's not enough ` +
            `to have generic text - you must specifically describe YOUR data processing. The policy ` +
            `must be written in clear, plain language (not legal jargon) and be easily accessible. ` +
            `Update it whenever your data practices change. Missing elements can result in fines ` +
            `even if your actual data handling is compliant.`,
            yPos
        );
    }

    _drawPolicyElementRow(y, element) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        this.doc.roundedRect(x, y, width, 28, 3)
            .fill('#FAFAFA');

        // Status icon
        this.doc.fontSize(12)
            .fillColor(element.present ? '#212121' : '#FF9800')
            .text(element.present ? 'YES' : '-', x + 12, y + 7);

        // Element name
        this.doc.fontSize(10)
            .fillColor(element.present ? '#333333' : '#9E9E9E')
            .text(element.name, x + 35, y + 8);

        // Description
        this.doc.fontSize(8)
            .fillColor('#9E9E9E')
            .text(element.description, x + 220, y + 9);
    }

    /**
     * Add third-party services section
     */
    addThirdPartyServicesSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Third-Party Services', 'External services and data sharing');

        let yPos = 130;
        const thirdParty = data.thirdParty || {};

        // Overview
        this._addSubsectionTitle('Detected Third-Party Services', yPos);
        yPos += 30;

        const serviceCount = thirdParty.count || thirdParty.services?.length || 0;

        // Service count card
        this.doc.roundedRect(this.PREMIUM.PAGE.MARGIN, yPos, 150, 70, 5)
            .fill('#FAFAFA');

        this.doc.fontSize(28)
            .fillColor(serviceCount <= 10 ? '#212121' : serviceCount <= 20 ? '#FF9800' : '#F44336')
            .text(serviceCount.toString(), this.PREMIUM.PAGE.MARGIN + 20, yPos + 15);

        this.doc.fontSize(10)
            .fillColor('#666666')
            .text('Third-Party Services', this.PREMIUM.PAGE.MARGIN + 20, yPos + 48);

        yPos += 90;

        // Service categories
        const services = thirdParty.services || [];
        const categories = this._categorizeServices(services, thirdParty);

        Object.entries(categories).forEach(([category, serviceList]) => {
            if (yPos > 650) {
                this.doc.addPage();
                yPos = 80;
            }

            this._addSubsectionTitle(category, yPos);
            yPos += 25;

            serviceList.forEach(service => {
                this._drawServiceRow(yPos, service);
                yPos += 32;

                if (yPos > 700) {
                    this.doc.addPage();
                    yPos = 80;
                }
            });

            yPos += 15;
        });

        // Data transfer implications
        yPos += 20;
        if (yPos > 550) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addSubsectionTitle('Data Transfer Considerations', yPos);
        yPos += 25;

        const transfers = [
            { region: 'US-Based Services', risk: 'High', note: 'Requires additional safeguards post-Schrems II' },
            { region: 'EU-Based Services', risk: 'Low', note: 'Within GDPR jurisdiction' },
            { region: 'Other Countries', risk: 'Varies', note: 'Check adequacy decisions' }
        ];

        transfers.forEach(transfer => {
            this._drawTransferRow(yPos, transfer);
            yPos += 35;
        });

        // Plain English
        yPos += 30;
        if (yPos > 600) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'Third-Party Compliance',
            `Every third-party service that processes personal data must be disclosed in your privacy ` +
            `policy and, for non-essential services, requires user consent. You're responsible for ` +
            `ensuring these services are GDPR-compliant. For US-based services (Google, Facebook, etc.), ` +
            `additional legal mechanisms like Standard Contractual Clauses are required since the ` +
            `Privacy Shield was invalidated. Review each vendor's data processing agreement.`,
            yPos
        );
    }

    _categorizeServices(services, thirdParty) {
        const categories = {
            'Analytics & Tracking': [],
            'Marketing & Advertising': [],
            'Social Media': [],
            'Essential Services': []
        };

        // Add from detected services
        if (thirdParty.analytics) {
            categories['Analytics & Tracking'].push(...(
                Array.isArray(thirdParty.analytics) ? thirdParty.analytics :
                [{ name: 'Google Analytics', type: 'Analytics', region: 'US' }]
            ));
        }

        if (thirdParty.marketing) {
            categories['Marketing & Advertising'].push(...(
                Array.isArray(thirdParty.marketing) ? thirdParty.marketing :
                [{ name: 'Marketing Services', type: 'Marketing', region: 'Varies' }]
            ));
        }

        if (thirdParty.social) {
            categories['Social Media'].push(...(
                Array.isArray(thirdParty.social) ? thirdParty.social :
                [{ name: 'Social Widgets', type: 'Social', region: 'Varies' }]
            ));
        }

        // Add from services array
        services.forEach(service => {
            const cat = service.category === 'analytics' ? 'Analytics & Tracking' :
                       service.category === 'marketing' ? 'Marketing & Advertising' :
                       service.category === 'social' ? 'Social Media' : 'Essential Services';
            if (!categories[cat].find(s => s.name === service.name)) {
                categories[cat].push(service);
            }
        });

        // Filter empty categories
        return Object.fromEntries(
            Object.entries(categories).filter(([_, list]) => list.length > 0)
        );
    }

    _drawServiceRow(y, service) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        this.doc.roundedRect(x, y, width, 28, 3)
            .fill('#FAFAFA');

        // Service name
        const name = typeof service === 'string' ? service : service.name;
        this.doc.fontSize(10)
            .fillColor('#333333')
            .text(name, x + 15, y + 8);

        // Region/Risk indicator
        const region = service.region || 'Unknown';
        const regionColor = region === 'EU' ? '#212121' : region === 'US' ? '#FF9800' : '#9E9E9E';
        this.doc.fontSize(8)
            .fillColor(regionColor)
            .text(region, x + width - 60, y + 10);
    }

    _drawTransferRow(y, transfer) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        this.doc.roundedRect(x, y, width, 30, 3)
            .fill('#FAFAFA');

        // Region
        this.doc.fontSize(10)
            .fillColor('#333333')
            .text(transfer.region, x + 15, y + 5);

        // Risk level
        const riskColor = transfer.risk === 'Low' ? '#212121' :
                         transfer.risk === 'High' ? '#F44336' : '#FF9800';
        this.doc.fontSize(9)
            .fillColor(riskColor)
            .text(`Risk: ${transfer.risk}`, x + 200, y + 6);

        // Note
        this.doc.fontSize(8)
            .fillColor('#666666')
            .text(transfer.note, x + 15, y + 18);
    }

    /**
     * Add user rights section
     */
    addUserRightsSection(data) {
        this.doc.addPage();
        this._addSectionHeader('User Rights (GDPR Articles 15-22)', 'Data subject rights implementation');

        let yPos = 130;
        const rights = data.userRights || {};

        // Rights overview
        const gdprRights = [
            {
                article: 'Art. 15',
                name: 'Right of Access',
                description: 'Users can request a copy of their data',
                implemented: rights.access || rights.dataAccess,
                critical: true
            },
            {
                article: 'Art. 16',
                name: 'Right to Rectification',
                description: 'Users can correct inaccurate data',
                implemented: rights.rectification,
                critical: true
            },
            {
                article: 'Art. 17',
                name: 'Right to Erasure',
                description: 'Users can request deletion ("Right to be Forgotten")',
                implemented: rights.erasure || rights.deletion,
                critical: true
            },
            {
                article: 'Art. 18',
                name: 'Right to Restrict Processing',
                description: 'Users can limit how their data is used',
                implemented: rights.restriction,
                critical: false
            },
            {
                article: 'Art. 20',
                name: 'Right to Data Portability',
                description: 'Users can get data in machine-readable format',
                implemented: rights.portability,
                critical: false
            },
            {
                article: 'Art. 21',
                name: 'Right to Object',
                description: 'Users can object to certain processing',
                implemented: rights.objection,
                critical: true
            },
            {
                article: 'Art. 22',
                name: 'Automated Decision Making',
                description: 'Users can request human review of automated decisions',
                implemented: rights.automatedDecision,
                critical: false
            }
        ];

        gdprRights.forEach(right => {
            this._drawRightCard(yPos, right);
            yPos += 65;

            if (yPos > 700) {
                this.doc.addPage();
                yPos = 80;
            }
        });

        // Implementation guidance
        yPos += 20;
        if (yPos > 550) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'Implementing User Rights',
            `You must respond to rights requests within 30 days (extendable to 3 months for complex ` +
            `requests). Create clear processes for handling each type of request. This typically ` +
            `includes a contact form or email for requests, identity verification procedures, and ` +
            `documented workflows. For small businesses, manual processes are acceptable - you don't ` +
            `need a self-service portal. Document your procedures in case of regulatory inquiry.`,
            yPos
        );
    }

    _drawRightCard(y, right) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);
        const height = 55;

        // Card background
        this.doc.roundedRect(x, y, width, height, 5)
            .fill(right.implemented ? '#F5F5F5' : right.critical ? '#FFEBEE' : '#FFF3E0');

        // Article number
        this.doc.fontSize(10)
            .fillColor(this.reportColor)
            .text(right.article, x + 15, y + 10);

        // Right name
        this.doc.fontSize(12)
            .fillColor('#333333')
            .text(right.name, x + 70, y + 8);

        // Description
        this.doc.fontSize(9)
            .fillColor('#666666')
            .text(right.description, x + 70, y + 26);

        // Status
        this.doc.fontSize(10)
            .fillColor(right.implemented ? '#212121' : '#F44336')
            .text(right.implemented ? 'Implemented' : 'Not Found',
                x + width - 110, y + 15);

        // Critical badge
        if (right.critical && !right.implemented) {
            this.doc.fontSize(8)
                .fillColor('#F44336')
                .text('REQUIRED', x + width - 110, y + 35);
        }
    }

    /**
     * Add GDPR checklist
     */
    addGdprChecklist(data, score) {
        this.doc.addPage();
        this._addSectionHeader('GDPR Compliance Checklist', 'Complete compliance verification');

        let yPos = 130;

        const checklistSections = [
            {
                category: 'Consent Management',
                items: [
                    { text: 'Cookie consent banner implemented', checked: data.consent?.banner },
                    { text: 'Granular consent options available', checked: data.consent?.granular },
                    { text: 'Equal reject/accept options', checked: data.consent?.rejectOption },
                    { text: 'Consent recorded and auditable', checked: data.consent?.recorded }
                ]
            },
            {
                category: 'Privacy Documentation',
                items: [
                    { text: 'Privacy policy published', checked: data.privacyPolicy?.exists },
                    { text: 'All GDPR elements included', checked: data.privacyPolicy?.comprehensive },
                    { text: 'Cookie policy/notice available', checked: data.cookiePolicy?.exists },
                    { text: 'Regular policy reviews', checked: data.privacyPolicy?.reviewed }
                ]
            },
            {
                category: 'Technical Compliance',
                items: [
                    { text: 'Cookies blocked until consent', checked: (data.cookies?.beforeConsent || 0) === 0 },
                    { text: 'Data encryption in transit (HTTPS)', checked: data.security?.https },
                    { text: 'Secure data storage', checked: data.security?.secureStorage },
                    { text: 'Data minimization practiced', checked: data.dataMinimization }
                ]
            },
            {
                category: 'User Rights',
                items: [
                    { text: 'Data access request process', checked: data.userRights?.access },
                    { text: 'Data deletion process', checked: data.userRights?.erasure },
                    { text: 'Data portability capability', checked: data.userRights?.portability },
                    { text: 'Complaint process documented', checked: data.userRights?.complaint }
                ]
            }
        ];

        checklistSections.forEach(section => {
            this._drawGdprChecklistSection(yPos, section);
            yPos += 30 + (section.items.length * 25);

            if (yPos > 650) {
                this.doc.addPage();
                yPos = 80;
            }
        });

        // Final score card
        yPos += 20;
        if (yPos > 580) {
            this.doc.addPage();
            yPos = 80;
        }

        this._drawGdprScoreCard(yPos, score);
    }

    _drawGdprChecklistSection(y, section) {
        const x = this.PREMIUM.PAGE.MARGIN;

        this.doc.fontSize(12)
            .fillColor(this.reportColor)
            .text(section.category, x, y);

        y += 22;

        section.items.forEach(item => {
            this.doc.roundedRect(x, y, 14, 14, 2)
                .lineWidth(1)
                .stroke(item.checked ? '#212121' : '#BDBDBD');

            if (item.checked) {
                this.doc.fontSize(10)
                    .fillColor('#212121')
                    .text('*', x + 2, y);
            }

            this.doc.fontSize(10)
                .fillColor(item.checked ? '#333333' : '#9E9E9E')
                .text(item.text, x + 24, y + 1);

            y += 25;
        });
    }

    _drawGdprScoreCard(y, score) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);
        const height = 100;

        this.doc.roundedRect(x, y, width, height, 8)
            .fill(this.reportColor);

        // Score
        this.doc.fontSize(36)
            .fillColor('#FFFFFF')
            .text(score.toString(), x + 30, y + 25);

        this.doc.fontSize(14)
            .fillColor('rgba(255,255,255,0.8)')
            .text('/100', x + 85, y + 45);

        // Summary
        this.doc.fontSize(14)
            .fillColor('#FFFFFF')
            .text('GDPR Compliance Score', x + 160, y + 25);

        const summary = score >= 80 ? 'Strong compliance posture' :
                       score >= 60 ? 'Adequate with improvements needed' :
                       score >= 40 ? 'Significant compliance gaps' :
                       'Critical compliance issues';

        this.doc.fontSize(11)
            .fillColor('rgba(255,255,255,0.9)')
            .text(summary, x + 160, y + 50);

        this.doc.fontSize(9)
            .fillColor('rgba(255,255,255,0.7)')
            .text(`Report generated: ${new Date().toLocaleDateString()}`, x + 160, y + 75);
    }
}

module.exports = GdprCompliancePremiumPdfGenerator;
