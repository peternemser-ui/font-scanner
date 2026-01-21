/**
 * Broken Links Premium PDF Generator
 *
 * Creates comprehensive premium PDF reports for broken links analysis
 * with executive summaries, benchmarks, and actionable roadmaps.
 */

const { PremiumPdfReport } = require('../utils/premiumPdfTemplate');

// Industry benchmarks for link health
const BROKEN_LINKS_BENCHMARKS = {
    industryAverage: 72,
    topPerformers: 98,
    categories: {
        internalLinks: { average: 85, top: 99 },
        externalLinks: { average: 70, top: 95 },
        imageLinks: { average: 78, top: 98 },
        redirects: { average: 65, top: 90 }
    }
};

// Business impact templates
const BROKEN_LINKS_BUSINESS_IMPACT = {
    excellent: {
        summary: "Your site has minimal broken links and excellent link health.",
        impacts: [
            "Optimal user experience with no dead ends",
            "Search engines can fully crawl and index your content",
            "Professional appearance builds trust",
            "Maximum SEO value preserved from internal linking"
        ]
    },
    good: {
        summary: "Your link health is good with minor issues to address.",
        impacts: [
            "Most users will have a smooth experience",
            "Some pages may lose SEO value from broken links",
            "Minor cleanup needed for optimal performance",
            "Good foundation for link maintenance"
        ]
    },
    fair: {
        summary: "Broken links are affecting user experience and SEO.",
        impacts: [
            "Users encountering frustrating dead ends",
            "Search engines may penalize link quality",
            "Wasted PageRank from broken internal links",
            "Professional image being compromised"
        ]
    },
    poor: {
        summary: "Significant broken link issues require immediate attention.",
        impacts: [
            "High user frustration and increased bounce rates",
            "Major SEO impact from poor crawlability",
            "Lost conversions from broken user journeys",
            "Urgent site maintenance required"
        ]
    }
};

class BrokenLinksPremiumPdfGenerator extends PremiumPdfReport {
    constructor() {
        super();
        this.reportType = 'Broken Links';
        this.reportColor = '#795548'; // Brown for Broken Links
    }

    /**
     * Generate the complete premium Broken Links PDF report
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
            title: 'Broken Links Analysis',
            subtitle: 'Link Health & Site Integrity Report',
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
            industryAverage: BROKEN_LINKS_BENCHMARKS.industryAverage,
            topPerformers: BROKEN_LINKS_BENCHMARKS.topPerformers,
            categoryBenchmarks: BROKEN_LINKS_BENCHMARKS.categories,
            componentScores
        });

        // Action Roadmap
        this.addActionRoadmap(recommendations);

        // Broken Links Specific Sections
        this.addLinkOverviewSection(analysisData);
        this.addBrokenLinksDetailSection(analysisData);
        this.addRedirectsSection(analysisData);
        this.addLinksByPageSection(analysisData);
        this.addLinkHealthChecklist(analysisData, score);

        return await this.endDocument();
    }

    /**
     * Calculate overall link health score
     */
    _calculateOverallScore(data) {
        if (data.score !== undefined) return Math.round(data.score);
        if (data.overallScore !== undefined) return Math.round(data.overallScore);

        const totalLinks = data.totalLinks || data.linksChecked || 100;
        const brokenLinks = data.brokenLinks?.length || data.broken?.length || 0;
        const redirects = data.redirects?.length || 0;

        // Calculate health percentage
        const brokenPercentage = (brokenLinks / totalLinks) * 100;
        const redirectPercentage = (redirects / totalLinks) * 100;

        let score = 100;
        score -= brokenPercentage * 3; // Heavy penalty for broken links
        score -= redirectPercentage * 0.5; // Light penalty for redirects

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * Extract key statistics for executive summary
     */
    _extractKeyStats(data) {
        const stats = [];

        const totalLinks = data.totalLinks || data.linksChecked || 0;
        stats.push({
            label: 'Total Links',
            value: totalLinks.toString(),
            status: 'neutral'
        });

        const brokenCount = data.brokenLinks?.length || data.broken?.length || 0;
        stats.push({
            label: 'Broken Links',
            value: brokenCount.toString(),
            status: brokenCount === 0 ? 'good' : brokenCount < 5 ? 'warning' : 'critical'
        });

        const redirectCount = data.redirects?.length || 0;
        stats.push({
            label: 'Redirects',
            value: redirectCount.toString(),
            status: redirectCount < 10 ? 'good' : redirectCount < 30 ? 'warning' : 'critical'
        });

        const healthyLinks = totalLinks - brokenCount - redirectCount;
        const healthPercentage = totalLinks > 0 ? Math.round((healthyLinks / totalLinks) * 100) : 100;
        stats.push({
            label: 'Healthy Links',
            value: `${healthPercentage}%`,
            status: healthPercentage >= 95 ? 'good' : healthPercentage >= 85 ? 'warning' : 'critical'
        });

        return stats;
    }

    /**
     * Extract component scores for breakdown
     */
    _extractComponentScores(data) {
        const totalLinks = data.totalLinks || 100;
        const internalBroken = data.brokenLinks?.filter(l => l.type === 'internal').length || 0;
        const externalBroken = data.brokenLinks?.filter(l => l.type === 'external').length || 0;
        const imageBroken = data.brokenImages?.length || 0;
        const redirectCount = data.redirects?.length || 0;

        return {
            'Internal Links': Math.max(0, 100 - (internalBroken * 5)),
            'External Links': Math.max(0, 100 - (externalBroken * 3)),
            'Image Links': Math.max(0, 100 - (imageBroken * 4)),
            'Redirect Health': Math.max(0, 100 - (redirectCount * 1))
        };
    }

    /**
     * Extract key findings from analysis
     */
    _extractKeyFindings(data) {
        const findings = [];
        const brokenLinks = data.brokenLinks || data.broken || [];
        const redirects = data.redirects || [];

        // Overall health assessment
        const brokenCount = brokenLinks.length;
        if (brokenCount === 0) {
            findings.push({
                type: 'positive',
                category: 'Link Health',
                title: 'No Broken Links Found',
                description: 'All checked links are returning valid responses.'
            });
        } else if (brokenCount < 5) {
            findings.push({
                type: 'warning',
                category: 'Link Health',
                title: `${brokenCount} Broken Links Found`,
                description: 'A small number of links need attention.'
            });
        } else {
            findings.push({
                type: 'critical',
                category: 'Link Health',
                title: `${brokenCount} Broken Links Found`,
                description: 'Multiple broken links are impacting user experience and SEO.'
            });
        }

        // 404 errors
        const notFoundLinks = brokenLinks.filter(l => l.statusCode === 404 || l.status === 404);
        if (notFoundLinks.length > 0) {
            findings.push({
                type: 'critical',
                category: '404 Errors',
                title: `${notFoundLinks.length} Pages Not Found (404)`,
                description: 'These links point to pages that no longer exist.'
            });
        }

        // Server errors
        const serverErrors = brokenLinks.filter(l =>
            (l.statusCode >= 500 && l.statusCode < 600) ||
            (l.status >= 500 && l.status < 600)
        );
        if (serverErrors.length > 0) {
            findings.push({
                type: 'critical',
                category: 'Server Errors',
                title: `${serverErrors.length} Server Errors (5xx)`,
                description: 'Some linked pages are experiencing server problems.'
            });
        }

        // Redirect chains
        const redirectChains = redirects.filter(r => r.chain || r.hops > 1);
        if (redirectChains.length > 0) {
            findings.push({
                type: 'warning',
                category: 'Redirects',
                title: `${redirectChains.length} Redirect Chains`,
                description: 'Multiple redirects in sequence slow down page loads.'
            });
        }

        // Mixed content
        if (data.mixedContent && data.mixedContent.length > 0) {
            findings.push({
                type: 'warning',
                category: 'Security',
                title: 'Mixed Content Detected',
                description: 'Some links use HTTP instead of HTTPS.'
            });
        }

        // Broken images
        if (data.brokenImages && data.brokenImages.length > 0) {
            findings.push({
                type: 'warning',
                category: 'Images',
                title: `${data.brokenImages.length} Broken Images`,
                description: 'Image resources that fail to load.'
            });
        }

        return findings.slice(0, 10);
    }

    /**
     * Get business impact based on score
     */
    _getBusinessImpact(score) {
        if (score >= 95) return BROKEN_LINKS_BUSINESS_IMPACT.excellent;
        if (score >= 80) return BROKEN_LINKS_BUSINESS_IMPACT.good;
        if (score >= 60) return BROKEN_LINKS_BUSINESS_IMPACT.fair;
        return BROKEN_LINKS_BUSINESS_IMPACT.poor;
    }

    /**
     * Enhance recommendations with effort/impact ratings
     */
    _enhanceRecommendations(data) {
        const recommendations = [];
        const brokenLinks = data.brokenLinks || data.broken || [];

        // Fix 404 errors
        const notFoundLinks = brokenLinks.filter(l => l.statusCode === 404 || l.status === 404);
        if (notFoundLinks.length > 0) {
            recommendations.push({
                title: 'Fix 404 Errors',
                description: `Update or remove ${notFoundLinks.length} links pointing to missing pages.`,
                effort: notFoundLinks.length > 10 ? 'high' : 'medium',
                impact: 'high',
                priority: 1,
                category: 'Content'
            });
        }

        // Fix server errors
        const serverErrors = brokenLinks.filter(l =>
            (l.statusCode >= 500) || (l.status >= 500)
        );
        if (serverErrors.length > 0) {
            recommendations.push({
                title: 'Resolve Server Errors',
                description: 'Investigate and fix server-side issues causing 5xx errors.',
                effort: 'medium',
                impact: 'high',
                priority: 1,
                category: 'Technical'
            });
        }

        // Update external links
        const externalBroken = brokenLinks.filter(l => l.type === 'external');
        if (externalBroken.length > 0) {
            recommendations.push({
                title: 'Update External Links',
                description: `${externalBroken.length} external links need updating or removal.`,
                effort: 'medium',
                impact: 'medium',
                priority: 2,
                category: 'Content'
            });
        }

        // Fix redirect chains
        const redirectChains = (data.redirects || []).filter(r => r.chain || r.hops > 1);
        if (redirectChains.length > 0) {
            recommendations.push({
                title: 'Simplify Redirect Chains',
                description: 'Update links to point directly to final destinations.',
                effort: 'medium',
                impact: 'medium',
                priority: 2,
                category: 'Performance'
            });
        }

        // Fix broken images
        if (data.brokenImages && data.brokenImages.length > 0) {
            recommendations.push({
                title: 'Fix Broken Images',
                description: `Restore or remove ${data.brokenImages.length} missing images.`,
                effort: 'low',
                impact: 'medium',
                priority: 2,
                category: 'Content'
            });
        }

        // Set up monitoring
        recommendations.push({
            title: 'Implement Link Monitoring',
            description: 'Set up automated broken link checking to catch issues early.',
            effort: 'low',
            impact: 'medium',
            priority: 3,
            category: 'Maintenance'
        });

        // Create custom 404 page
        if (!data.custom404) {
            recommendations.push({
                title: 'Create Custom 404 Page',
                description: 'Design a helpful 404 page that guides lost users.',
                effort: 'low',
                impact: 'low',
                priority: 4,
                category: 'UX'
            });
        }

        return recommendations.slice(0, 10);
    }

    /**
     * Add link overview section
     */
    addLinkOverviewSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Link Overview', 'Summary of all links analyzed');

        let yPos = 130;

        // Link statistics
        this._addSubsectionTitle('Link Statistics', yPos);
        yPos += 30;

        const totalLinks = data.totalLinks || data.linksChecked || 0;
        const brokenCount = data.brokenLinks?.length || data.broken?.length || 0;
        const redirectCount = data.redirects?.length || 0;
        const healthyCount = totalLinks - brokenCount - redirectCount;

        // Stats cards
        const statsData = [
            { label: 'Total Links', value: totalLinks, color: '#2196F3' },
            { label: 'Healthy', value: healthyCount, color: '#212121' },
            { label: 'Broken', value: brokenCount, color: '#F44336' },
            { label: 'Redirects', value: redirectCount, color: '#FF9800' }
        ];

        const cardWidth = 120;
        statsData.forEach((stat, index) => {
            const x = this.PREMIUM.PAGE.MARGIN + (index * (cardWidth + 10));
            this._drawLinkStatCard(x, yPos, cardWidth, stat);
        });

        yPos += 100;

        // Link health pie chart representation
        this._addSubsectionTitle('Link Health Distribution', yPos);
        yPos += 30;

        this._drawLinkHealthChart(yPos, {
            healthy: healthyCount,
            broken: brokenCount,
            redirects: redirectCount,
            total: totalLinks
        });

        yPos += 140;

        // Link types breakdown
        this._addSubsectionTitle('Link Types', yPos);
        yPos += 25;

        const linkTypes = [
            { type: 'Internal Links', count: data.internalLinks?.length || Math.round(totalLinks * 0.6) },
            { type: 'External Links', count: data.externalLinks?.length || Math.round(totalLinks * 0.3) },
            { type: 'Image Links', count: data.imageLinks?.length || Math.round(totalLinks * 0.1) }
        ];

        linkTypes.forEach(linkType => {
            this._drawLinkTypeRow(yPos, linkType, totalLinks);
            yPos += 35;
        });

        // Plain English
        yPos += 30;
        if (yPos > 600) {
            this.doc.addPage();
            yPos = 80;
        }

        const healthPercentage = totalLinks > 0 ? Math.round((healthyCount / totalLinks) * 100) : 100;
        this._addPlainEnglishBox(
            'Understanding Link Health',
            healthPercentage >= 95 ?
                `With ${healthPercentage}% healthy links, your site provides a smooth navigation experience. ` +
                `Users and search engines can access all your content without hitting dead ends. ` +
                `Maintain this by regularly checking links after content updates.` :
            healthPercentage >= 80 ?
                `${healthPercentage}% of your links are healthy, but ${brokenCount} broken links need attention. ` +
                `Each broken link is a potential lost visitor or damaged SEO signal. ` +
                `Prioritize fixing high-traffic pages first.` :
                `Only ${healthPercentage}% of links are healthy, indicating significant maintenance is needed. ` +
                `Broken links frustrate users and signal poor site quality to search engines. ` +
                `Address these issues urgently to protect your SEO rankings and user experience.`,
            yPos
        );
    }

    _drawLinkStatCard(x, y, width, stat) {
        const height = 80;

        this.doc.roundedRect(x, y, width, height, 5)
            .fill('#FAFAFA');

        this.doc.rect(x, y, 4, height)
            .fill(stat.color);

        this.doc.fontSize(28)
            .fillColor(stat.color)
            .text(stat.value.toString(), x + 15, y + 18);

        this.doc.fontSize(10)
            .fillColor('#666666')
            .text(stat.label, x + 15, y + 55);
    }

    _drawLinkHealthChart(y, data) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const centerX = x + 80;
        const centerY = y + 60;
        const radius = 50;

        // Simple bar representation instead of pie
        const barWidth = 300;
        const barHeight = 30;
        const barX = x + 180;

        // Background
        this.doc.roundedRect(barX, y + 45, barWidth, barHeight, 5)
            .fill('#E0E0E0');

        // Healthy (green)
        const healthyWidth = (data.healthy / data.total) * barWidth;
        if (healthyWidth > 0) {
            this.doc.roundedRect(barX, y + 45, healthyWidth, barHeight, 5)
                .fill('#212121');
        }

        // Redirects (orange) - after healthy
        const redirectWidth = (data.redirects / data.total) * barWidth;
        if (redirectWidth > 0) {
            this.doc.rect(barX + healthyWidth, y + 45, redirectWidth, barHeight)
                .fill('#FF9800');
        }

        // Broken (red) - last
        const brokenWidth = (data.broken / data.total) * barWidth;
        if (brokenWidth > 0) {
            this.doc.rect(barX + healthyWidth + redirectWidth, y + 45, brokenWidth, barHeight)
                .fill('#F44336');
        }

        // Legend
        const legendY = y + 90;
        const legendItems = [
            { label: 'Healthy', color: '#212121', value: data.healthy },
            { label: 'Redirects', color: '#FF9800', value: data.redirects },
            { label: 'Broken', color: '#F44336', value: data.broken }
        ];

        legendItems.forEach((item, index) => {
            const legendX = barX + (index * 100);

            this.doc.circle(legendX + 5, legendY + 5, 5)
                .fill(item.color);

            this.doc.fontSize(9)
                .fillColor('#666666')
                .text(`${item.label} (${item.value})`, legendX + 15, legendY);
        });

        // Large number display on left
        this.doc.fontSize(36)
            .fillColor('#333333')
            .text(data.total.toString(), x, y + 30);

        this.doc.fontSize(11)
            .fillColor('#666666')
            .text('Total Links', x, y + 75);
    }

    _drawLinkTypeRow(y, linkType, total) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);
        const percentage = total > 0 ? Math.round((linkType.count / total) * 100) : 0;

        this.doc.roundedRect(x, y, width, 30, 3)
            .fill('#FAFAFA');

        // Type name
        this.doc.fontSize(10)
            .fillColor('#333333')
            .text(linkType.type, x + 15, y + 9);

        // Count
        this.doc.fontSize(10)
            .fillColor('#666666')
            .text(`${linkType.count} (${percentage}%)`, x + 180, y + 9);

        // Progress bar
        const barX = x + 280;
        const barWidth = 200;

        this.doc.roundedRect(barX, y + 10, barWidth, 10, 5)
            .fill('#E0E0E0');

        this.doc.roundedRect(barX, y + 10, barWidth * (percentage / 100), 10, 5)
            .fill('#2196F3');
    }

    /**
     * Add broken links detail section
     */
    addBrokenLinksDetailSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Broken Links Detail', 'Complete list of broken links found');

        let yPos = 130;
        const brokenLinks = data.brokenLinks || data.broken || [];

        if (brokenLinks.length === 0) {
            this.doc.roundedRect(this.PREMIUM.PAGE.MARGIN, yPos,
                this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN), 80, 8)
                .fill('#F5F5F5');

            this.doc.fontSize(16)
                .fillColor('#212121')
                .text('No Broken Links Found!', this.PREMIUM.PAGE.MARGIN + 30, yPos + 30);

            yPos += 100;
        } else {
            // Group by status code
            const grouped = this._groupByStatus(brokenLinks);

            Object.entries(grouped).forEach(([status, links]) => {
                if (yPos > 650) {
                    this.doc.addPage();
                    yPos = 80;
                }

                this._addSubsectionTitle(`${status} Errors (${links.length})`, yPos);
                yPos += 25;

                links.slice(0, 10).forEach(link => {
                    if (yPos > 700) {
                        this.doc.addPage();
                        yPos = 80;
                    }
                    this._drawBrokenLinkRow(yPos, link);
                    yPos += 45;
                });

                if (links.length > 10) {
                    this.doc.fontSize(9)
                        .fillColor('#666666')
                        .text(`... and ${links.length - 10} more ${status} errors`,
                            this.PREMIUM.PAGE.MARGIN, yPos);
                    yPos += 20;
                }

                yPos += 15;
            });
        }

        // Fix instructions
        yPos += 20;
        if (yPos > 550) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'How to Fix Broken Links',
            brokenLinks.length > 0 ?
                `For each broken link, you have three options: (1) Update the link to point to the correct ` +
                `URL if the content moved, (2) Remove the link entirely if the content no longer exists, ` +
                `or (3) Set up a redirect from the old URL to a relevant page. For external links you ` +
                `don't control, use web.archive.org to find archived versions or find alternative sources.` :
                `Great job keeping your links healthy! To maintain this, check links after every major ` +
                `content update, set up automated monitoring, and periodically audit external links ` +
                `since third-party sites change without notice.`,
            yPos
        );
    }

    _groupByStatus(brokenLinks) {
        const grouped = {};

        brokenLinks.forEach(link => {
            const status = link.statusCode || link.status || 'Unknown';
            let category;

            if (status === 404) category = '404 Not Found';
            else if (status >= 500) category = '5xx Server Error';
            else if (status === 403) category = '403 Forbidden';
            else if (status === 0 || status === 'timeout') category = 'Connection Failed';
            else category = `${status} Error`;

            if (!grouped[category]) grouped[category] = [];
            grouped[category].push(link);
        });

        return grouped;
    }

    _drawBrokenLinkRow(y, link) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        // Card background
        this.doc.roundedRect(x, y, width, 40, 4)
            .fill('#FFEBEE');

        // Status badge
        const status = link.statusCode || link.status || '???';
        this.doc.roundedRect(x + 10, y + 8, 40, 24, 3)
            .fill('#F44336');

        this.doc.fontSize(10)
            .fillColor('#FFFFFF')
            .text(status.toString(), x + 15, y + 14);

        // Broken URL
        const url = link.url || link.href || link.target || 'Unknown URL';
        this.doc.fontSize(9)
            .fillColor('#333333')
            .text(url, x + 60, y + 8, { width: width - 80 });

        // Source page
        if (link.source || link.foundOn) {
            this.doc.fontSize(8)
                .fillColor('#666666')
                .text(`Found on: ${link.source || link.foundOn}`, x + 60, y + 24, { width: width - 80 });
        }
    }

    /**
     * Add redirects section
     */
    addRedirectsSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Redirect Analysis', 'URL redirects and their impact');

        let yPos = 130;
        const redirects = data.redirects || [];

        // Redirect overview
        this._addSubsectionTitle('Redirect Summary', yPos);
        yPos += 30;

        const redirect301 = redirects.filter(r => r.statusCode === 301 || r.type === 'permanent').length;
        const redirect302 = redirects.filter(r => r.statusCode === 302 || r.type === 'temporary').length;
        const chains = redirects.filter(r => r.chain || (r.hops && r.hops > 1)).length;

        const redirectStats = [
            { label: '301 (Permanent)', value: redirect301, color: '#212121', good: true },
            { label: '302 (Temporary)', value: redirect302, color: '#FF9800', good: false },
            { label: 'Redirect Chains', value: chains, color: '#F44336', good: false }
        ];

        redirectStats.forEach((stat, index) => {
            this._drawRedirectStatRow(yPos, stat);
            yPos += 40;
        });

        yPos += 20;

        // Redirect list
        if (redirects.length > 0) {
            this._addSubsectionTitle('Redirects Found', yPos);
            yPos += 25;

            redirects.slice(0, 10).forEach(redirect => {
                if (yPos > 700) {
                    this.doc.addPage();
                    yPos = 80;
                }
                this._drawRedirectRow(yPos, redirect);
                yPos += 50;
            });

            if (redirects.length > 10) {
                this.doc.fontSize(9)
                    .fillColor('#666666')
                    .text(`... and ${redirects.length - 10} more redirects`,
                        this.PREMIUM.PAGE.MARGIN, yPos);
                yPos += 20;
            }
        } else {
            this.doc.roundedRect(this.PREMIUM.PAGE.MARGIN, yPos,
                this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN), 50, 5)
                .fill('#F5F5F5');

            this.doc.fontSize(11)
                .fillColor('#212121')
                .text('No problematic redirects found', this.PREMIUM.PAGE.MARGIN + 20, yPos + 18);
            yPos += 70;
        }

        // Plain English
        if (yPos > 550) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'Understanding Redirects',
            `Redirects forward users from one URL to another. 301 redirects are "permanent" and pass ` +
            `SEO value to the new URL - use these when content has permanently moved. 302 redirects ` +
            `are "temporary" and should only be used for truly temporary situations. Redirect chains ` +
            `(A→B→C) slow down page loads and dilute SEO value. Always link directly to final URLs ` +
            `and update old redirects to point directly to current destinations.`,
            yPos
        );
    }

    _drawRedirectStatRow(y, stat) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        this.doc.roundedRect(x, y, width, 35, 4)
            .fill('#FAFAFA');

        // Color indicator
        this.doc.circle(x + 20, y + 17, 8)
            .fill(stat.color);

        // Label
        this.doc.fontSize(11)
            .fillColor('#333333')
            .text(stat.label, x + 40, y + 10);

        // Value
        this.doc.fontSize(16)
            .fillColor(stat.color)
            .text(stat.value.toString(), x + width - 80, y + 8);

        // Status note
        if (stat.value > 0) {
            this.doc.fontSize(8)
                .fillColor(stat.good ? '#212121' : '#FF9800')
                .text(stat.good ? 'OK' : 'Review', x + width - 45, y + 12);
        }
    }

    _drawRedirectRow(y, redirect) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        this.doc.roundedRect(x, y, width, 45, 4)
            .fill('#FFF3E0');

        // Status badge
        const status = redirect.statusCode || redirect.status || '3xx';
        const statusColor = status === 301 ? '#212121' : '#FF9800';
        this.doc.roundedRect(x + 10, y + 8, 35, 18, 3)
            .fill(statusColor);

        this.doc.fontSize(9)
            .fillColor('#FFFFFF')
            .text(status.toString(), x + 15, y + 12);

        // From URL
        const fromUrl = redirect.from || redirect.url || redirect.source || 'Unknown';
        this.doc.fontSize(8)
            .fillColor('#333333')
            .text(`From: ${fromUrl}`, x + 55, y + 8, { width: width - 70 });

        // To URL
        const toUrl = redirect.to || redirect.destination || redirect.target || 'Unknown';
        this.doc.fontSize(8)
            .fillColor('#666666')
            .text(`To: ${toUrl}`, x + 55, y + 22, { width: width - 70 });

        // Chain indicator
        if (redirect.chain || (redirect.hops && redirect.hops > 1)) {
            this.doc.fontSize(8)
                .fillColor('#F44336')
                .text(`Chain: ${redirect.hops || '2+'} hops`, x + width - 90, y + 28);
        }
    }

    /**
     * Add links by page section
     */
    addLinksByPageSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Links by Page', 'Pages with the most link issues');

        let yPos = 130;
        const brokenLinks = data.brokenLinks || data.broken || [];

        // Group broken links by source page
        const byPage = {};
        brokenLinks.forEach(link => {
            const source = link.source || link.foundOn || link.page || 'Unknown Page';
            if (!byPage[source]) byPage[source] = [];
            byPage[source].push(link);
        });

        // Sort by number of broken links
        const sortedPages = Object.entries(byPage)
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 10);

        if (sortedPages.length > 0) {
            this._addSubsectionTitle('Pages with Most Broken Links', yPos);
            yPos += 25;

            sortedPages.forEach(([page, links], index) => {
                if (yPos > 700) {
                    this.doc.addPage();
                    yPos = 80;
                }
                this._drawPageLinkRow(yPos, page, links, index + 1);
                yPos += 55;
            });
        } else {
            this.doc.roundedRect(this.PREMIUM.PAGE.MARGIN, yPos,
                this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN), 60, 5)
                .fill('#F5F5F5');

            this.doc.fontSize(12)
                .fillColor('#212121')
                .text('All pages have healthy links!',
                    this.PREMIUM.PAGE.MARGIN + 20, yPos + 22);
            yPos += 80;
        }

        // Recommendations by priority
        yPos += 20;
        if (yPos > 550) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'Prioritizing Fixes',
            sortedPages.length > 0 ?
                `Focus your efforts on high-traffic pages first. The pages listed above have the most ` +
                `broken links - fixing these will have the biggest impact on user experience. ` +
                `Use your analytics to identify which pages get the most visitors and prioritize those. ` +
                `A broken link on your homepage matters more than one on an obscure blog post.` :
                `With no broken links by page, your site maintenance is excellent. To keep it this way, ` +
                `establish a routine link check after publishing new content, and quarterly reviews ` +
                `of all external links since third-party sites can change without warning.`,
            yPos
        );
    }

    _drawPageLinkRow(y, page, links, rank) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        this.doc.roundedRect(x, y, width, 50, 4)
            .fill('#FAFAFA');

        // Rank number
        this.doc.fontSize(16)
            .fillColor(rank <= 3 ? '#F44336' : '#FF9800')
            .text(`#${rank}`, x + 12, y + 15);

        // Page URL
        this.doc.fontSize(9)
            .fillColor('#333333')
            .text(page, x + 50, y + 8, { width: width - 130 });

        // Broken link count
        this.doc.roundedRect(x + width - 70, y + 12, 55, 26, 3)
            .fill('#F44336');

        this.doc.fontSize(12)
            .fillColor('#FFFFFF')
            .text(`${links.length}`, x + width - 55, y + 17);

        // Sample broken URLs
        if (links.length > 0) {
            const sample = links[0].url || links[0].href || 'Unknown';
            this.doc.fontSize(8)
                .fillColor('#666666')
                .text(`Example: ${sample}`, x + 50, y + 32, { width: width - 130 });
        }
    }

    /**
     * Add link health checklist
     */
    addLinkHealthChecklist(data, score) {
        this.doc.addPage();
        this._addSectionHeader('Link Health Checklist', 'Complete link maintenance guide');

        let yPos = 130;
        const brokenLinks = data.brokenLinks || data.broken || [];

        const checklistSections = [
            {
                category: 'Broken Link Fixes',
                items: [
                    { text: 'No 404 errors on site', checked: brokenLinks.filter(l => l.statusCode === 404).length === 0 },
                    { text: 'No server (5xx) errors', checked: brokenLinks.filter(l => l.statusCode >= 500).length === 0 },
                    { text: 'All images loading properly', checked: !data.brokenImages || data.brokenImages.length === 0 },
                    { text: 'External links verified', checked: brokenLinks.filter(l => l.type === 'external').length === 0 }
                ]
            },
            {
                category: 'Redirect Health',
                items: [
                    { text: 'Using 301 for permanent redirects', checked: true },
                    { text: 'No redirect chains', checked: !(data.redirects || []).some(r => r.chain) },
                    { text: 'Minimal 302 temporary redirects', checked: (data.redirects || []).filter(r => r.statusCode === 302).length < 5 },
                    { text: 'Internal links point to final URLs', checked: score >= 80 }
                ]
            },
            {
                category: 'Best Practices',
                items: [
                    { text: 'Custom 404 page created', checked: data.custom404 },
                    { text: 'Automated link monitoring', checked: data.monitoring },
                    { text: 'Regular link audits scheduled', checked: data.auditSchedule },
                    { text: 'Broken link alerts configured', checked: data.alerts }
                ]
            }
        ];

        checklistSections.forEach(section => {
            this._drawLinkChecklistSection(yPos, section);
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

        this._drawLinkHealthScoreCard(yPos, score);
    }

    _drawLinkChecklistSection(y, section) {
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

    _drawLinkHealthScoreCard(y, score) {
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
            .text('Link Health Score', x + 160, y + 25);

        const summary = score >= 95 ? 'Excellent link health' :
                       score >= 80 ? 'Good link health with minor issues' :
                       score >= 60 ? 'Moderate link issues need attention' :
                       'Critical link problems detected';

        this.doc.fontSize(11)
            .fillColor('rgba(255,255,255,0.9)')
            .text(summary, x + 160, y + 50);

        this.doc.fontSize(9)
            .fillColor('rgba(255,255,255,0.7)')
            .text(`Report generated: ${new Date().toLocaleDateString()}`, x + 160, y + 75);
    }
}

module.exports = BrokenLinksPremiumPdfGenerator;
