/**
 * GEO SEO Premium PDF Generator
 *
 * Creates comprehensive premium PDF reports for GEO SEO analysis
 * with executive summaries, benchmarks, and actionable roadmaps.
 */

const { PremiumPdfReport } = require('../utils/premiumPdfTemplate');

// Industry benchmarks for GEO SEO
const GEO_SEO_BENCHMARKS = {
    industryAverage: 55,
    topPerformers: 88,
    categories: {
        googleBusinessProfile: { average: 60, top: 95 },
        localCitations: { average: 52, top: 85 },
        reviewManagement: { average: 48, top: 90 },
        localContent: { average: 55, top: 85 },
        citationsDirectories: { average: 50, top: 82 },
        multiLocation: { average: 45, top: 80 },
        reviewsReputation: { average: 50, top: 88 }
    }
};

// Business impact templates
const GEO_SEO_BUSINESS_IMPACT = {
    excellent: {
        summary: "Your GEO SEO is highly optimized for local and geographic search visibility.",
        impacts: [
            "Strong visibility in 'near me' and local searches",
            "Google Maps presence driving foot traffic",
            "Positive reviews building local trust",
            "Competitive advantage in your service area",
            "Multi-location pages capturing geo-specific queries"
        ]
    },
    good: {
        summary: "Your GEO SEO foundation is solid with room for improvement.",
        impacts: [
            "Appearing in some local search results",
            "Basic Google Business Profile presence",
            "Some local citations established",
            "Opportunities to improve local rankings",
            "Multi-location strategy partially implemented"
        ]
    },
    fair: {
        summary: "GEO SEO gaps are limiting your local and geographic visibility.",
        impacts: [
            "Missing from many local search results",
            "Competitors likely outranking you locally",
            "Inconsistent business information online",
            "Losing potential local customers",
            "No multi-location or geo-targeting strategy"
        ]
    },
    poor: {
        summary: "Significant GEO SEO issues are hurting your business.",
        impacts: [
            "Nearly invisible in local search results",
            "Incorrect business info confusing customers",
            "No Google Maps presence or poor ranking",
            "Missing significant local business opportunities",
            "No citations, reviews, or geo pages in place"
        ]
    }
};

class GeoSeoPremiumPdfGenerator extends PremiumPdfReport {
    constructor() {
        super();
        this.reportType = 'GEO SEO';
        this.reportColor = '#FF5722'; // Deep Orange for GEO SEO
    }

    /**
     * Generate the complete premium GEO SEO PDF report
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
            title: 'GEO SEO Analysis',
            subtitle: 'Geographic & Local Search Optimization Report',
            url: url,
            score: score,
            date: (() => { const d = new Date(); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' \u2022 ' + d.getUTCHours().toString().padStart(2, '0') + ':' + d.getUTCMinutes().toString().padStart(2, '0') + ' GMT'; })()
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
            industryAverage: GEO_SEO_BENCHMARKS.industryAverage,
            topPerformers: GEO_SEO_BENCHMARKS.topPerformers,
            categoryBenchmarks: GEO_SEO_BENCHMARKS.categories,
            componentScores
        });

        // Action Roadmap
        this.addActionRoadmap(recommendations);

        // GEO SEO Specific Sections
        this.addGoogleBusinessProfileSection(analysisData);
        this.addLocalCitationsSection(analysisData);
        this.addCitationsDirectoriesSection(analysisData);
        this.addMultiLocationSection(analysisData);
        this.addReviewsReputationSection(analysisData);
        this.addReviewAnalysisSection(analysisData);
        this.addLocalContentSection(analysisData);
        this.addLocalSchemaSection(analysisData);
        this.addGeoSeoChecklist(analysisData, score);

        return await this.endDocument();
    }

    /**
     * Calculate overall GEO SEO score
     */
    _calculateOverallScore(data) {
        if (data.score !== undefined) return Math.round(data.score);
        if (data.overallScore !== undefined) return Math.round(data.overallScore);

        let score = 50; // Base score

        // Google Business Profile
        if (data.googleBusinessProfile?.claimed) score += 10;
        if (data.googleBusinessProfile?.complete) score += 5;

        // Local schema
        if (data.schema?.localBusiness) score += 8;

        // NAP consistency
        if (data.nap?.consistent) score += 7;

        // Reviews
        if (data.reviews?.averageRating >= 4) score += 5;

        // Citations & directories
        if ((data.citations?.count || 0) >= 10) score += 5;

        // Multi-location
        if (data.multiLocation?.locationPages?.length > 0) score += 5;

        // Deductions
        if (data.issues) {
            score -= Math.min(data.issues.length * 3, 25);
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Extract key statistics for executive summary
     */
    _extractKeyStats(data) {
        const stats = [];

        // Google Business Profile status
        const gbpStatus = data.googleBusinessProfile?.claimed ? 'Claimed' :
                         data.googleBusinessProfile?.detected ? 'Unclaimed' : 'Not Found';
        stats.push({
            label: 'GBP Status',
            value: gbpStatus,
            status: gbpStatus === 'Claimed' ? 'good' : gbpStatus === 'Unclaimed' ? 'warning' : 'critical'
        });

        // Review rating
        const rating = data.reviews?.averageRating || 0;
        stats.push({
            label: 'Avg Rating',
            value: rating > 0 ? `${rating.toFixed(1)}/5` : 'N/A',
            status: rating >= 4 ? 'good' : rating >= 3 ? 'warning' : 'critical'
        });

        // Citation count
        const citations = data.citations?.count || 0;
        stats.push({
            label: 'Citations',
            value: citations.toString(),
            status: citations >= 30 ? 'good' : citations >= 10 ? 'warning' : 'critical'
        });

        // NAP consistency
        const napConsistent = data.nap?.consistencyScore || 0;
        stats.push({
            label: 'NAP Score',
            value: `${Math.round(napConsistent)}%`,
            status: napConsistent >= 90 ? 'good' : napConsistent >= 70 ? 'warning' : 'critical'
        });

        return stats;
    }

    /**
     * Extract component scores for breakdown
     */
    _extractComponentScores(data) {
        return {
            'Google Business': data.googleBusinessProfile?.score ||
                              (data.googleBusinessProfile?.claimed ? 80 : 30),
            'Citations': data.citations?.score || 60,
            'Reviews': data.reviews?.score ||
                      (data.reviews?.averageRating >= 4 ? 85 : 50),
            'Local Content': data.localContent?.score || 65,
            'Multi-Location': data.multiLocation?.score || 50,
            'Reputation': data.reviewsReputation?.score || 55
        };
    }

    /**
     * Extract key findings from analysis
     */
    _extractKeyFindings(data) {
        const findings = [];

        // Google Business Profile findings
        if (data.googleBusinessProfile?.claimed) {
            findings.push({
                type: 'positive',
                category: 'Google Business',
                title: 'GBP Claimed & Verified',
                description: 'Your Google Business Profile is claimed and verified.'
            });

            if (!data.googleBusinessProfile?.complete) {
                findings.push({
                    type: 'warning',
                    category: 'Google Business',
                    title: 'Incomplete GBP Profile',
                    description: 'Your GBP profile has missing information that could improve visibility.'
                });
            }
        } else {
            findings.push({
                type: 'critical',
                category: 'Google Business',
                title: 'GBP Not Claimed',
                description: 'Your Google Business Profile is not claimed or verified.'
            });
        }

        // NAP findings
        if (data.nap) {
            if (data.nap.consistent || data.nap.consistencyScore >= 90) {
                findings.push({
                    type: 'positive',
                    category: 'Citations',
                    title: 'Consistent NAP Information',
                    description: 'Your business name, address, and phone are consistent across listings.'
                });
            } else {
                findings.push({
                    type: 'warning',
                    category: 'Citations',
                    title: 'NAP Inconsistencies Found',
                    description: 'Your business information varies across different directories.'
                });
            }
        }

        // Review findings
        if (data.reviews) {
            if (data.reviews.averageRating >= 4.5) {
                findings.push({
                    type: 'positive',
                    category: 'Reviews',
                    title: 'Excellent Review Rating',
                    description: `${data.reviews.averageRating.toFixed(1)} star average demonstrates strong customer satisfaction.`
                });
            } else if (data.reviews.averageRating < 3.5) {
                findings.push({
                    type: 'warning',
                    category: 'Reviews',
                    title: 'Review Rating Needs Improvement',
                    description: 'Low review ratings may be deterring potential customers.'
                });
            }
        }

        // Multi-location findings
        if (data.multiLocation?.locationPages?.length > 0) {
            findings.push({
                type: 'positive',
                category: 'Multi-Location',
                title: 'Location Pages Detected',
                description: `Found ${data.multiLocation.locationPages.length} location-specific pages.`
            });
        }

        // Schema findings
        if (data.schema?.localBusiness) {
            findings.push({
                type: 'positive',
                category: 'Technical',
                title: 'Local Business Schema',
                description: 'LocalBusiness structured data is properly implemented.'
            });
        } else {
            findings.push({
                type: 'warning',
                category: 'Technical',
                title: 'Missing Local Schema',
                description: 'No LocalBusiness structured data found on the website.'
            });
        }

        // Add from existing issues
        if (data.issues) {
            data.issues.slice(0, 4).forEach(issue => {
                findings.push({
                    type: issue.severity || 'warning',
                    category: issue.category || 'GEO SEO',
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
        if (score >= 80) return GEO_SEO_BUSINESS_IMPACT.excellent;
        if (score >= 60) return GEO_SEO_BUSINESS_IMPACT.good;
        if (score >= 40) return GEO_SEO_BUSINESS_IMPACT.fair;
        return GEO_SEO_BUSINESS_IMPACT.poor;
    }

    /**
     * Enhance recommendations with effort/impact ratings
     */
    _enhanceRecommendations(data) {
        const recommendations = [];

        // GBP recommendations
        if (!data.googleBusinessProfile?.claimed) {
            recommendations.push({
                title: 'Claim Google Business Profile',
                description: 'Claim and verify your GBP listing to appear in Google Maps.',
                effort: 'low',
                impact: 'high',
                priority: 1,
                category: 'Google Business'
            });
        } else if (!data.googleBusinessProfile?.complete) {
            recommendations.push({
                title: 'Complete GBP Profile',
                description: 'Add photos, business hours, services, and description.',
                effort: 'low',
                impact: 'high',
                priority: 1,
                category: 'Google Business'
            });
        }

        // Schema recommendations
        if (!data.schema?.localBusiness) {
            recommendations.push({
                title: 'Add Local Business Schema',
                description: 'Implement LocalBusiness structured data on your website.',
                effort: 'medium',
                impact: 'high',
                priority: 2,
                category: 'Technical'
            });
        }

        // Citation recommendations
        if ((data.citations?.count || 0) < 20) {
            recommendations.push({
                title: 'Build Local Citations',
                description: 'List your business on major directories (Yelp, YP, etc.).',
                effort: 'high',
                impact: 'medium',
                priority: 3,
                category: 'Citations'
            });
        }

        // NAP recommendations
        if (data.nap && !data.nap.consistent) {
            recommendations.push({
                title: 'Fix NAP Inconsistencies',
                description: 'Ensure name, address, phone are identical everywhere.',
                effort: 'medium',
                impact: 'high',
                priority: 2,
                category: 'Citations'
            });
        }

        // Review recommendations
        if (!data.reviews || data.reviews.count < 10) {
            recommendations.push({
                title: 'Generate More Reviews',
                description: 'Implement a review generation strategy for happy customers.',
                effort: 'medium',
                impact: 'high',
                priority: 2,
                category: 'Reviews'
            });
        }

        // Multi-location recommendations
        if (!data.multiLocation?.locationPages || data.multiLocation.locationPages.length === 0) {
            recommendations.push({
                title: 'Create Location-Specific Pages',
                description: 'Build dedicated pages for each service area with unique local content.',
                effort: 'high',
                impact: 'high',
                priority: 2,
                category: 'Multi-Location'
            });
        }

        // Reputation recommendations
        if (!data.reviews?.responding) {
            recommendations.push({
                title: 'Respond to Reviews',
                description: 'Actively respond to all reviews, especially negative ones, to show engagement.',
                effort: 'low',
                impact: 'medium',
                priority: 3,
                category: 'Reviews'
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
                        category: rec.category || 'GEO SEO'
                    });
                }
            });
        }

        return recommendations.slice(0, 12);
    }

    /**
     * Add Google Business Profile section
     */
    addGoogleBusinessProfileSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Google Business Profile', 'Your Google Maps and local search presence');

        let yPos = 130;
        const gbp = data.googleBusinessProfile || {};

        // Profile status card
        const isClaimed = gbp.claimed;
        const isComplete = gbp.complete;

        this.doc.roundedRect(this.PREMIUM.PAGE.MARGIN, yPos,
            this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN), 80, 8)
            .fill(isClaimed ? '#F5F5F5' : '#FFEBEE');

        // Status icon and text
        this.doc.fontSize(24)
            .fillColor(isClaimed ? '#212121' : '#F44336')
            .text(isClaimed ? 'YES' : 'NO', this.PREMIUM.PAGE.MARGIN + 25, yPos + 25);

        this.doc.fontSize(16)
            .fillColor('#333333')
            .text(isClaimed ? 'Profile Claimed & Verified' : 'Profile Not Claimed',
                this.PREMIUM.PAGE.MARGIN + 60, yPos + 20);

        this.doc.fontSize(11)
            .fillColor('#666666')
            .text(isClaimed ?
                'Your business appears in Google Maps and local search results.' :
                'You\'re missing out on visibility in Google Maps and local searches.',
                this.PREMIUM.PAGE.MARGIN + 60, yPos + 45);

        yPos += 100;

        // Profile completeness
        if (isClaimed) {
            this._addSubsectionTitle('Profile Completeness', yPos);
            yPos += 30;

            const completionItems = [
                { name: 'Business Name', complete: gbp.hasName !== false },
                { name: 'Address', complete: gbp.hasAddress !== false },
                { name: 'Phone Number', complete: gbp.hasPhone !== false },
                { name: 'Business Hours', complete: gbp.hasHours },
                { name: 'Website URL', complete: gbp.hasWebsite },
                { name: 'Business Category', complete: gbp.hasCategory },
                { name: 'Business Description', complete: gbp.hasDescription },
                { name: 'Photos', complete: gbp.hasPhotos },
                { name: 'Services/Products', complete: gbp.hasServices }
            ];

            const columns = 3;
            const colWidth = (this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN)) / columns;

            completionItems.forEach((item, index) => {
                const col = index % columns;
                const row = Math.floor(index / columns);
                const x = this.PREMIUM.PAGE.MARGIN + (col * colWidth);
                const y = yPos + (row * 28);

                this._drawCompletionItem(x, y, item);
            });

            yPos += Math.ceil(completionItems.length / columns) * 28 + 20;
        }

        // GBP optimization tips
        yPos += 20;
        if (yPos > 600) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'Why Google Business Profile Matters',
            isClaimed ?
                `Your claimed GBP profile helps you appear in the "Map Pack" - the top 3 local results ` +
                `that appear in Google searches. 46% of all Google searches have local intent, and ` +
                `businesses with complete profiles are 70% more likely to attract location visits. ` +
                `Keep your profile updated with photos, posts, and respond to reviews.` :
                `Without a claimed Google Business Profile, you're invisible in Google Maps and ` +
                `local search results. 76% of people who search for something nearby visit a business ` +
                `within a day. Claiming your profile is free and typically takes 1-2 weeks for verification.`,
            yPos
        );
    }

    _drawCompletionItem(x, y, item) {
        // Status circle
        this.doc.circle(x + 8, y + 6, 5)
            .fill(item.complete ? '#212121' : '#E0E0E0');

        // Item name
        this.doc.fontSize(9)
            .fillColor(item.complete ? '#333333' : '#9E9E9E')
            .text(item.name, x + 20, y + 2);
    }

    /**
     * Add local citations section
     */
    addLocalCitationsSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Local Citations', 'Business directory listings and NAP consistency');

        let yPos = 130;
        const citations = data.citations || {};
        const nap = data.nap || {};

        // Citation overview
        this._addSubsectionTitle('Citation Overview', yPos);
        yPos += 30;

        const citationCount = citations.count || 0;
        const napScore = nap.consistencyScore || 0;

        // Stats cards
        const cardWidth = 150;
        const cardData = [
            { label: 'Total Citations', value: citationCount.toString(), color: '#2196F3' },
            { label: 'NAP Consistency', value: `${Math.round(napScore)}%`, color: napScore >= 80 ? '#212121' : '#FF9800' },
            { label: 'Top Directories', value: citations.topDirectories?.length?.toString() || '0', color: '#9C27B0' }
        ];

        cardData.forEach((card, index) => {
            const x = this.PREMIUM.PAGE.MARGIN + (index * (cardWidth + 15));
            this._drawStatCard(x, yPos, cardWidth, card);
        });

        yPos += 90;

        // Directory listings
        this._addSubsectionTitle('Directory Presence', yPos);
        yPos += 25;

        const directories = [
            { name: 'Google Business Profile', listed: data.googleBusinessProfile?.claimed, importance: 'Critical' },
            { name: 'Yelp', listed: citations.yelp, importance: 'High' },
            { name: 'Facebook', listed: citations.facebook, importance: 'High' },
            { name: 'Apple Maps', listed: citations.appleMaps, importance: 'High' },
            { name: 'Bing Places', listed: citations.bingPlaces, importance: 'Medium' },
            { name: 'Yellow Pages', listed: citations.yellowPages, importance: 'Medium' },
            { name: 'BBB', listed: citations.bbb, importance: 'Medium' },
            { name: 'Industry-Specific', listed: citations.industrySpecific, importance: 'High' }
        ];

        directories.forEach(dir => {
            this._drawDirectoryRow(yPos, dir);
            yPos += 32;

            if (yPos > 700) {
                this.doc.addPage();
                yPos = 80;
            }
        });

        // NAP consistency detail
        yPos += 20;
        if (yPos > 550) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addSubsectionTitle('NAP (Name, Address, Phone) Consistency', yPos);
        yPos += 25;

        this._drawNapAnalysis(yPos, nap);
        yPos += 100;

        // Plain English
        this._addPlainEnglishBox(
            'Why Citations Matter',
            `Local citations are mentions of your business name, address, and phone (NAP) on other websites. ` +
            `Search engines use citations to verify your business exists and is legitimate. Consistent NAP ` +
            `across all directories is crucial - even small variations (St. vs Street) can hurt rankings. ` +
            `Focus on quality directories relevant to your industry, not just quantity.`,
            yPos
        );
    }

    _drawStatCard(x, y, width, data) {
        const height = 70;

        this.doc.roundedRect(x, y, width, height, 5)
            .fill('#FAFAFA');

        // Accent bar
        this.doc.rect(x, y, 4, height)
            .fill(data.color);

        // Value
        this.doc.fontSize(24)
            .fillColor(data.color)
            .text(data.value, x + 15, y + 15);

        // Label
        this.doc.fontSize(10)
            .fillColor('#666666')
            .text(data.label, x + 15, y + 48);
    }

    _drawDirectoryRow(y, directory) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        this.doc.roundedRect(x, y, width, 28, 3)
            .fill('#FAFAFA');

        // Directory name
        this.doc.fontSize(10)
            .fillColor('#333333')
            .text(directory.name, x + 15, y + 8);

        // Importance badge
        const importanceColors = {
            'Critical': '#D32F2F',
            'High': '#1976D2',
            'Medium': '#7B1FA2'
        };
        this.doc.fontSize(8)
            .fillColor(importanceColors[directory.importance] || '#666666')
            .text(directory.importance, x + 220, y + 10);

        // Status
        this.doc.fontSize(10)
            .fillColor(directory.listed ? '#212121' : '#9E9E9E')
            .text(directory.listed ? 'Listed' : 'Not Listed', x + width - 100, y + 8);
    }

    _drawNapAnalysis(y, nap) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        // Background
        this.doc.roundedRect(x, y, width, 80, 5)
            .fill('#FAFAFA');

        const items = [
            { label: 'Business Name', value: nap.name || 'Not analyzed', consistent: nap.nameConsistent !== false },
            { label: 'Address', value: nap.address || 'Not analyzed', consistent: nap.addressConsistent },
            { label: 'Phone', value: nap.phone || 'Not analyzed', consistent: nap.phoneConsistent }
        ];

        items.forEach((item, index) => {
            const itemY = y + 15 + (index * 22);

            // Status indicator
            this.doc.circle(x + 20, itemY + 5, 4)
                .fill(item.consistent ? '#212121' : '#FF9800');

            // Label
            this.doc.fontSize(9)
                .fillColor('#666666')
                .text(item.label + ':', x + 35, itemY);

            // Value
            this.doc.fontSize(9)
                .fillColor('#333333')
                .text(item.value, x + 120, itemY, { width: width - 150 });
        });
    }

    /**
     * Add Citations & Directories section
     */
    addCitationsDirectoriesSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Citations & Directories', 'Third-party directory citation analysis');

        let yPos = 130;
        const citations = data.citations || {};

        // Citation metrics overview
        this._addSubsectionTitle('Citation Profile', yPos);
        yPos += 30;

        const directoryCount = citations.directoryCount || citations.count || 0;
        const hasCitationSection = citations.hasCitationSection || false;
        const hasDirectoryBadges = citations.hasDirectoryBadges || false;

        const cardWidth = 150;
        const citationCards = [
            { label: 'Directories Found', value: directoryCount.toString(), color: '#2196F3' },
            { label: 'Citation Section', value: hasCitationSection ? 'Present' : 'Missing', color: hasCitationSection ? '#4CAF50' : '#FF9800' },
            { label: 'Directory Badges', value: hasDirectoryBadges ? 'Present' : 'Missing', color: hasDirectoryBadges ? '#4CAF50' : '#FF9800' }
        ];

        citationCards.forEach((card, index) => {
            const x = this.PREMIUM.PAGE.MARGIN + (index * (cardWidth + 15));
            this._drawStatCard(x, yPos, cardWidth, card);
        });

        yPos += 90;

        // Directory links table
        const directoryLinks = citations.directoryLinks || [];
        if (directoryLinks.length > 0) {
            this._addSubsectionTitle('Directory Links', yPos);
            yPos += 25;

            directoryLinks.slice(0, 15).forEach(link => {
                const domain = typeof link === 'string' ? link : (link.domain || link.url || '-');
                const text = typeof link === 'object' ? (link.text || link.linkText || '') : '';

                this.doc.roundedRect(this.PREMIUM.PAGE.MARGIN, yPos,
                    this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN), 28, 3)
                    .fill('#FAFAFA');

                this.doc.fontSize(10)
                    .fillColor('#1976D2')
                    .text(domain, this.PREMIUM.PAGE.MARGIN + 15, yPos + 5, {
                        width: 250
                    });

                if (text) {
                    this.doc.fontSize(9)
                        .fillColor('#666666')
                        .text(text, this.PREMIUM.PAGE.MARGIN + 280, yPos + 6, {
                            width: 200
                        });
                }

                yPos += 32;

                if (yPos > 700) {
                    this.doc.addPage();
                    yPos = 80;
                }
            });
        } else {
            this.doc.roundedRect(this.PREMIUM.PAGE.MARGIN, yPos,
                this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN), 50, 4)
                .fill('#FFF3E0');

            this.doc.fontSize(11)
                .fillColor('#E65100')
                .text('No directory citation links found. Building citations on major directories can significantly boost local rankings.',
                    this.PREMIUM.PAGE.MARGIN + 15, yPos + 18, {
                        width: this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN) - 30
                    });
            yPos += 70;
        }

        // Plain English
        if (yPos > 600) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'Building a Strong Citation Profile',
            `Citations on authoritative directories signal to search engines that your business is established ` +
            `and trustworthy. Start with the big players - Google, Yelp, Facebook, Apple Maps - then expand to ` +
            `industry-specific directories. Ensure your NAP (Name, Address, Phone) is identical everywhere. ` +
            `Even small inconsistencies like abbreviations can dilute your citation authority.`,
            yPos
        );
    }

    /**
     * Add Multi-Location & Geo Pages section
     */
    addMultiLocationSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Multi-Location & Geo Pages', 'Geographic targeting and location page optimization');

        let yPos = 130;
        const multiLoc = data.multiLocation || {};

        // Multi-location metrics
        this._addSubsectionTitle('Geographic Coverage', yPos);
        yPos += 30;

        const locationPageCount = (multiLoc.locationPages || multiLoc.locationLinks || []).length;
        const hreflangCount = multiLoc.hreflangCount || 0;

        const cardWidth = 150;
        const geoCards = [
            { label: 'Location Pages', value: locationPageCount.toString(), color: '#2196F3' },
            { label: 'Hreflang Tags', value: hreflangCount.toString(), color: '#9C27B0' },
            { label: 'Service Areas', value: multiLoc.serviceAreaCount?.toString() || '0', color: '#FF5722' }
        ];

        geoCards.forEach((card, index) => {
            const x = this.PREMIUM.PAGE.MARGIN + (index * (cardWidth + 15));
            this._drawStatCard(x, yPos, cardWidth, card);
        });

        yPos += 90;

        // Geo feature status
        this._addSubsectionTitle('Geographic Features', yPos);
        yPos += 25;

        const geoFeatures = [
            { name: 'ServiceArea Schema', present: multiLoc.hasServiceAreaSchema },
            { name: 'Store Locator', present: multiLoc.hasStoreLocator },
            { name: 'Geo-Specific Content', present: multiLoc.hasGeoContent },
            { name: 'Hreflang Implementation', present: hreflangCount > 0 },
            { name: 'Location-Based URLs', present: multiLoc.hasLocationUrls },
            { name: 'Local Landing Pages', present: locationPageCount > 0 }
        ];

        geoFeatures.forEach(feature => {
            this._drawLocalElementRow(yPos, { name: feature.name, present: feature.present });
            yPos += 32;

            if (yPos > 700) {
                this.doc.addPage();
                yPos = 80;
            }
        });

        // Location pages list
        const locationPages = multiLoc.locationPages || multiLoc.locationLinks || [];
        if (locationPages.length > 0) {
            yPos += 10;
            if (yPos > 550) {
                this.doc.addPage();
                yPos = 80;
            }

            this._addSubsectionTitle('Detected Location Pages', yPos);
            yPos += 25;

            locationPages.slice(0, 8).forEach(page => {
                const pageTitle = typeof page === 'string' ? page : (page.title || page.url || page.label || page);
                this._drawLocationPageRow(yPos, typeof page === 'object' ? page : { title: pageTitle });
                yPos += 35;

                if (yPos > 700) {
                    this.doc.addPage();
                    yPos = 80;
                }
            });
        }

        // Plain English
        if (yPos > 600) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'Multi-Location SEO Strategy',
            `If you serve multiple locations, each area deserves its own optimized page with unique content. ` +
            `Avoid simply swapping city names - Google can detect thin, duplicated location pages. Include local ` +
            `landmarks, testimonials from local customers, and area-specific service details. Use ServiceArea ` +
            `schema to explicitly define your coverage. For international audiences, implement hreflang tags ` +
            `to serve the right language and regional content.`,
            yPos
        );
    }

    /**
     * Add Reviews & Reputation section
     */
    addReviewsReputationSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Reviews & Reputation', 'Online reputation and review signal analysis');

        let yPos = 130;
        const reviews = data.reviews || {};
        const reputation = data.reviewsReputation || data.reviews || {};

        // Aggregate rating overview
        this._addSubsectionTitle('Review Overview', yPos);
        yPos += 30;

        const aggregateRating = reputation.aggregateRating || reviews.aggregateRating || {};
        const ratingValue = aggregateRating.ratingValue || reviews.averageRating || 0;
        const reviewCount = aggregateRating.reviewCount || reviews.count || reviews.total || 0;
        const platformCount = reputation.platformCount || (reputation.platforms || reviews.platforms || []).length || 0;

        const cardWidth = 150;
        const reviewCards = [
            { label: 'Aggregate Rating', value: ratingValue > 0 ? ratingValue.toFixed(1) : 'N/A', color: ratingValue >= 4 ? '#4CAF50' : ratingValue >= 3 ? '#FF9800' : '#F44336' },
            { label: 'Total Reviews', value: reviewCount.toString(), color: '#2196F3' },
            { label: 'Review Platforms', value: platformCount.toString(), color: '#9C27B0' }
        ];

        reviewCards.forEach((card, index) => {
            const x = this.PREMIUM.PAGE.MARGIN + (index * (cardWidth + 15));
            this._drawStatCard(x, yPos, cardWidth, card);
        });

        yPos += 90;

        // Reputation signals
        this._addSubsectionTitle('Reputation Signals', yPos);
        yPos += 25;

        const reputationSignals = [
            { name: 'Testimonials Section', present: reputation.hasTestimonialsSection || reviews.hasTestimonials },
            { name: 'Star Rating Widgets', present: reputation.hasStarWidgets || reviews.hasStarWidgets },
            { name: 'Review Count Displayed', present: reputation.hasReviewCount || reviews.hasReviewCount },
            { name: 'AggregateRating Schema', present: !!aggregateRating.ratingValue },
            { name: 'Review Response Activity', present: reviews.responding || (reviews.responseRate && reviews.responseRate > 0) }
        ];

        reputationSignals.forEach(signal => {
            this._drawLocalElementRow(yPos, { name: signal.name, present: signal.present });
            yPos += 32;

            if (yPos > 700) {
                this.doc.addPage();
                yPos = 80;
            }
        });

        // Review platform details
        const platformLinks = reputation.platformLinks || reviews.platformLinks || [];
        if (platformLinks.length > 0) {
            yPos += 10;
            if (yPos > 550) {
                this.doc.addPage();
                yPos = 80;
            }

            this._addSubsectionTitle('Review Platform Presence', yPos);
            yPos += 25;

            platformLinks.slice(0, 10).forEach(link => {
                const platform = typeof link === 'string' ? link : (link.platform || link.name || '-');
                const url = typeof link === 'object' ? (link.url || link.href || '') : '';

                this.doc.roundedRect(this.PREMIUM.PAGE.MARGIN, yPos,
                    this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN), 28, 3)
                    .fill('#FAFAFA');

                this.doc.fontSize(10)
                    .fillColor('#333333')
                    .text(platform, this.PREMIUM.PAGE.MARGIN + 15, yPos + 8, { width: 200 });

                if (url) {
                    this.doc.fontSize(9)
                        .fillColor('#1976D2')
                        .text(url, this.PREMIUM.PAGE.MARGIN + 230, yPos + 8, {
                            width: 250
                        });
                }

                yPos += 32;

                if (yPos > 700) {
                    this.doc.addPage();
                    yPos = 80;
                }
            });
        }

        // Plain English
        if (yPos > 600) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'Managing Your Online Reputation',
            `Reviews are one of the top local ranking factors. Focus on three pillars: generating new reviews ` +
            `from happy customers, responding promptly to all reviews (especially negative ones), and showcasing ` +
            `your best reviews on your website. Add AggregateRating schema to display star ratings in search results. ` +
            `Businesses that actively manage reviews see 35% more clicks from local search results.`,
            yPos
        );
    }

    /**
     * Add review analysis section
     */
    addReviewAnalysisSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Review Analysis', 'Customer reviews and reputation management');

        let yPos = 130;
        const reviews = data.reviews || {};

        // Review overview
        const avgRating = reviews.averageRating || 0;
        const totalReviews = reviews.count || reviews.total || 0;

        // Large rating display
        this.doc.roundedRect(this.PREMIUM.PAGE.MARGIN, yPos,
            this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN), 100, 8)
            .fill('#FAFAFA');

        // Rating number
        this.doc.fontSize(48)
            .fillColor(avgRating >= 4 ? '#212121' : avgRating >= 3 ? '#FF9800' : '#F44336')
            .text(avgRating > 0 ? avgRating.toFixed(1) : 'N/A',
                this.PREMIUM.PAGE.MARGIN + 30, yPos + 22);

        // Stars
        const stars = `${avgRating.toFixed(1)}/5`;
        this.doc.fontSize(18)
            .fillColor('#FFC107')
            .text(stars, this.PREMIUM.PAGE.MARGIN + 120, yPos + 35);

        // Review count
        this.doc.fontSize(12)
            .fillColor('#666666')
            .text(`Based on ${totalReviews} reviews`, this.PREMIUM.PAGE.MARGIN + 120, yPos + 65);

        // Rating distribution
        this.doc.fontSize(11)
            .fillColor('#333333')
            .text('Rating Distribution', this.PREMIUM.PAGE.MARGIN + 320, yPos + 15);

        if (reviews.distribution) {
            [5, 4, 3, 2, 1].forEach((rating, index) => {
                const count = reviews.distribution[rating] || 0;
                const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                this._drawRatingBar(this.PREMIUM.PAGE.MARGIN + 320, yPos + 35 + (index * 14), rating, percentage);
            });
        }

        yPos += 120;

        // Review insights
        this._addSubsectionTitle('Review Insights', yPos);
        yPos += 30;

        const insights = [
            {
                metric: 'Response Rate',
                value: reviews.responseRate ? `${reviews.responseRate}%` : 'Unknown',
                status: (reviews.responseRate || 0) >= 80 ? 'good' : 'warning',
                tip: 'Respond to all reviews, especially negative ones'
            },
            {
                metric: 'Recent Reviews',
                value: reviews.recentCount?.toString() || '0',
                status: (reviews.recentCount || 0) >= 5 ? 'good' : 'warning',
                tip: 'Aim for 2-4 new reviews per month'
            },
            {
                metric: 'Review Velocity',
                value: reviews.velocity || 'Unknown',
                status: 'neutral',
                tip: 'Consistent review flow signals active business'
            }
        ];

        insights.forEach(insight => {
            this._drawInsightRow(yPos, insight);
            yPos += 50;
        });

        // Plain English
        if (yPos > 600) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'The Business Impact of Reviews',
            `Reviews directly impact whether customers choose you or your competitors. ` +
            `88% of consumers trust online reviews as much as personal recommendations. ` +
            `Businesses with 4+ star ratings get significantly more clicks in local search. ` +
            `Focus on delivering great service, then make it easy for happy customers to leave reviews. ` +
            `Always respond professionally to negative reviews - 45% of consumers say they're more ` +
            `likely to visit a business that responds to negative reviews.`,
            yPos
        );
    }

    _drawRatingBar(x, y, rating, percentage) {
        // Rating label
        this.doc.fontSize(8)
            .fillColor('#666666')
            .text(`${rating}/5`, x, y);

        // Bar background
        this.doc.roundedRect(x + 25, y, 100, 8, 4)
            .fill('#E0E0E0');

        // Bar fill
        if (percentage > 0) {
            this.doc.roundedRect(x + 25, y, Math.max(percentage, 4), 8, 4)
                .fill('#FFC107');
        }
    }

    _drawInsightRow(y, insight) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        this.doc.roundedRect(x, y, width, 42, 4)
            .fill('#FAFAFA');

        // Metric name
        this.doc.fontSize(11)
            .fillColor('#333333')
            .text(insight.metric, x + 15, y + 8);

        // Value
        const valueColor = insight.status === 'good' ? '#212121' :
                          insight.status === 'warning' ? '#FF9800' : '#666666';
        this.doc.fontSize(14)
            .fillColor(valueColor)
            .text(insight.value, x + 150, y + 6);

        // Tip
        this.doc.fontSize(9)
            .fillColor('#666666')
            .text(insight.tip, x + 15, y + 26);
    }

    /**
     * Add local content section
     */
    addLocalContentSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Local Content', 'Location-specific content optimization');

        let yPos = 130;
        const localContent = data.localContent || {};

        // Local keywords
        this._addSubsectionTitle('Local Keyword Presence', yPos);
        yPos += 30;

        const localElements = [
            { name: 'City/Town Name in Title', present: localContent.cityInTitle },
            { name: 'Region/State in Content', present: localContent.regionInContent },
            { name: 'Local Landmarks Referenced', present: localContent.landmarks },
            { name: 'Service Area Defined', present: localContent.serviceArea },
            { name: 'Local Phone Number (Area Code)', present: localContent.localPhone },
            { name: 'Physical Address on Site', present: localContent.addressDisplayed }
        ];

        localElements.forEach(element => {
            this._drawLocalElementRow(yPos, element);
            yPos += 32;
        });

        yPos += 20;

        // Location pages
        this._addSubsectionTitle('Location Pages', yPos);
        yPos += 25;

        const locationPages = localContent.locationPages || [];
        if (locationPages.length > 0) {
            locationPages.slice(0, 5).forEach(page => {
                this._drawLocationPageRow(yPos, page);
                yPos += 35;
            });
        } else {
            this.doc.roundedRect(this.PREMIUM.PAGE.MARGIN, yPos,
                this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN), 50, 4)
                .fill('#FFF3E0');

            this.doc.fontSize(11)
                .fillColor('#E65100')
                .text('No dedicated location pages found',
                    this.PREMIUM.PAGE.MARGIN + 15, yPos + 18);
            yPos += 70;
        }

        // Plain English
        if (yPos > 600) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'Local Content Strategy',
            `Local content helps search engines understand where you operate and who you serve. ` +
            `Include your city name in page titles and headings. Create content about local events, ` +
            `partnerships, or community involvement. If you serve multiple locations, create dedicated ` +
            `pages for each with unique content - avoid just changing the city name. ` +
            `Local content also builds trust with visitors who see you're truly part of their community.`,
            yPos
        );
    }

    _drawLocalElementRow(y, element) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        this.doc.roundedRect(x, y, width, 28, 3)
            .fill('#FAFAFA');

        // Status
        this.doc.fontSize(12)
            .fillColor(element.present ? '#212121' : '#9E9E9E')
            .text(element.present ? 'YES' : '-', x + 15, y + 7);

        // Element name
        this.doc.fontSize(10)
            .fillColor(element.present ? '#333333' : '#9E9E9E')
            .text(element.name, x + 40, y + 8);
    }

    _drawLocationPageRow(y, page) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        this.doc.roundedRect(x, y, width, 30, 3)
            .fill('#E3F2FD');

        this.doc.fontSize(10)
            .fillColor('#1976D2')
            .text(page.title || page.url || page, x + 15, y + 9, { width: width - 30 });
    }

    /**
     * Add local schema section
     */
    addLocalSchemaSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Local Business Schema', 'Structured data for local search');

        let yPos = 130;
        const schema = data.schema || {};

        // Schema status
        const hasLocalSchema = schema.localBusiness || schema.hasLocalBusiness;

        this.doc.roundedRect(this.PREMIUM.PAGE.MARGIN, yPos,
            this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN), 70, 5)
            .fill(hasLocalSchema ? '#F5F5F5' : '#FFEBEE');

        this.doc.fontSize(14)
            .fillColor(hasLocalSchema ? '#212121' : '#F44336')
            .text(hasLocalSchema ? 'LocalBusiness Schema Detected' : 'LocalBusiness Schema Missing',
                this.PREMIUM.PAGE.MARGIN + 20, yPos + 25);

        yPos += 90;

        // Schema properties
        this._addSubsectionTitle('Schema Properties', yPos);
        yPos += 25;

        const schemaProperties = [
            { name: '@type (LocalBusiness)', present: hasLocalSchema },
            { name: 'name', present: schema.hasName },
            { name: 'address', present: schema.hasAddress },
            { name: 'telephone', present: schema.hasPhone || schema.hasTelephone },
            { name: 'openingHours', present: schema.hasHours },
            { name: 'geo (latitude/longitude)', present: schema.hasGeo },
            { name: 'priceRange', present: schema.hasPriceRange },
            { name: 'aggregateRating', present: schema.hasRating }
        ];

        schemaProperties.forEach(prop => {
            this._drawSchemaPropertyRow(yPos, prop);
            yPos += 28;
        });

        yPos += 30;

        // Schema code example
        this._addSubsectionTitle('Recommended Schema Example', yPos);
        yPos += 25;

        this._drawCodeExample(yPos, `{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Your Business Name",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main St",
    "addressLocality": "City",
    "addressRegion": "State",
    "postalCode": "12345"
  },
  "telephone": "+1-555-123-4567",
  "openingHours": "Mo-Fr 09:00-17:00"
}`);

        yPos += 180;

        // Plain English
        if (yPos > 650) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'Why Schema Matters for GEO SEO',
            `Structured data (schema) helps Google understand your business information precisely. ` +
            `It can enable rich results like your business hours, rating, and address appearing ` +
            `directly in search results. LocalBusiness schema is essential for local SEO and takes ` +
            `about 30 minutes to implement. It's one of the highest-impact technical optimizations.`,
            yPos
        );
    }

    _drawSchemaPropertyRow(y, property) {
        const x = this.PREMIUM.PAGE.MARGIN;

        this.doc.circle(x + 10, y + 5, 4)
            .fill(property.present ? '#212121' : '#E0E0E0');

        this.doc.fontSize(10)
            .fillColor(property.present ? '#333333' : '#9E9E9E')
            .text(property.name, x + 25, y + 1);

        this.doc.fontSize(9)
            .fillColor(property.present ? '#212121' : '#9E9E9E')
            .text(property.present ? 'Present' : 'Missing', x + 350, y + 2);
    }

    _drawCodeExample(y, code) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        this.doc.roundedRect(x, y, width, 150, 5)
            .fill('#263238');

        this.doc.fontSize(8)
            .fillColor('#B0BEC5')
            .text(code, x + 15, y + 15, { width: width - 30 });
    }

    /**
     * Add GEO SEO checklist
     */
    addGeoSeoChecklist(data, score) {
        this.doc.addPage();
        this._addSectionHeader('GEO SEO Checklist', 'Complete geographic optimization guide');

        let yPos = 130;

        const checklistSections = [
            {
                category: 'Google Business Profile',
                items: [
                    { text: 'Profile claimed and verified', checked: data.googleBusinessProfile?.claimed },
                    { text: 'All information complete', checked: data.googleBusinessProfile?.complete },
                    { text: 'Photos uploaded', checked: data.googleBusinessProfile?.hasPhotos },
                    { text: 'Regular posts/updates', checked: data.googleBusinessProfile?.hasPosts }
                ]
            },
            {
                category: 'Citations & Directories',
                items: [
                    { text: 'Listed on major directories', checked: (data.citations?.count || 0) >= 10 },
                    { text: 'NAP consistent everywhere', checked: data.nap?.consistent },
                    { text: 'Industry directories covered', checked: data.citations?.industrySpecific },
                    { text: 'Duplicate listings removed', checked: data.citations?.noDuplicates },
                    { text: 'Directory badges displayed', checked: data.citations?.hasDirectoryBadges }
                ]
            },
            {
                category: 'Multi-Location & Geo Pages',
                items: [
                    { text: 'Dedicated location pages', checked: (data.multiLocation?.locationPages || []).length > 0 },
                    { text: 'ServiceArea schema implemented', checked: data.multiLocation?.hasServiceAreaSchema },
                    { text: 'Store locator available', checked: data.multiLocation?.hasStoreLocator },
                    { text: 'Geo-specific content on pages', checked: data.multiLocation?.hasGeoContent },
                    { text: 'Hreflang tags for international', checked: (data.multiLocation?.hreflangCount || 0) > 0 }
                ]
            },
            {
                category: 'Reviews & Reputation',
                items: [
                    { text: 'Average rating 4+ stars', checked: (data.reviews?.averageRating || 0) >= 4 },
                    { text: 'Recent reviews (last 30 days)', checked: data.reviews?.hasRecent },
                    { text: 'Responding to reviews', checked: data.reviews?.responding },
                    { text: 'Review generation process', checked: data.reviews?.hasProcess },
                    { text: 'Testimonials section on site', checked: data.reviews?.hasTestimonials || data.reviewsReputation?.hasTestimonialsSection },
                    { text: 'Star widgets displayed', checked: data.reviews?.hasStarWidgets || data.reviewsReputation?.hasStarWidgets }
                ]
            },
            {
                category: 'On-Site Local SEO',
                items: [
                    { text: 'LocalBusiness schema', checked: data.schema?.localBusiness },
                    { text: 'Local keywords in titles', checked: data.localContent?.cityInTitle },
                    { text: 'Address on website', checked: data.localContent?.addressDisplayed },
                    { text: 'Embedded Google Map', checked: data.localContent?.hasMap }
                ]
            }
        ];

        checklistSections.forEach(section => {
            this._drawGeoChecklistSection(yPos, section);
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

        this._drawGeoSeoScoreCard(yPos, score);
    }

    _drawGeoChecklistSection(y, section) {
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

    _drawGeoSeoScoreCard(y, score) {
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
            .text('GEO SEO Score', x + 160, y + 25);

        const summary = score >= 80 ? 'Excellent geographic visibility' :
                       score >= 60 ? 'Good local presence, room for growth' :
                       score >= 40 ? 'GEO SEO needs attention' :
                       'Critical geographic SEO gaps';

        this.doc.fontSize(11)
            .fillColor('rgba(255,255,255,0.9)')
            .text(summary, x + 160, y + 50);

        this.doc.fontSize(9)
            .fillColor('rgba(255,255,255,0.7)')
            .text(`Report generated: ${(() => { const d = new Date(); return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' \u2022 ' + d.getUTCHours().toString().padStart(2, '0') + ':' + d.getUTCMinutes().toString().padStart(2, '0') + ' GMT'; })()}`, x + 160, y + 75);
    }
}

module.exports = GeoSeoPremiumPdfGenerator;
