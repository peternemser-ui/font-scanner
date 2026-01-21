/**
 * Brand Consistency Premium PDF Generator
 *
 * Creates comprehensive premium PDF reports for brand consistency analysis
 * with executive summaries, benchmarks, and actionable roadmaps.
 */

const { PremiumPdfReport } = require('../utils/premiumPdfTemplate');

// Industry benchmarks for brand consistency
const BRAND_BENCHMARKS = {
    industryAverage: 65,
    topPerformers: 92,
    categories: {
        colorConsistency: { average: 68, top: 95 },
        typographyConsistency: { average: 62, top: 90 },
        logoUsage: { average: 70, top: 95 },
        voiceTone: { average: 58, top: 88 }
    }
};

// Business impact templates
const BRAND_BUSINESS_IMPACT = {
    excellent: {
        summary: "Your brand presentation is highly consistent and professional.",
        impacts: [
            "Strong brand recognition and recall among visitors",
            "Professional appearance builds trust and credibility",
            "Consistent experience across all touchpoints",
            "Marketing materials maintain unified messaging"
        ]
    },
    good: {
        summary: "Your brand is mostly consistent with minor variations.",
        impacts: [
            "Generally recognizable brand presence",
            "Some inconsistencies may confuse visitors",
            "Good foundation for brand guidelines",
            "Minor adjustments needed for optimal impact"
        ]
    },
    fair: {
        summary: "Brand consistency issues are affecting perception.",
        impacts: [
            "Inconsistent experience reduces brand trust",
            "Visitors may question professionalism",
            "Marketing effectiveness diminished",
            "Brand dilution occurring across channels"
        ]
    },
    poor: {
        summary: "Significant brand inconsistencies are harming your image.",
        impacts: [
            "Brand is difficult to recognize consistently",
            "Trust and credibility significantly impacted",
            "Marketing ROI reduced by mixed messaging",
            "Urgent need for brand guidelines enforcement"
        ]
    }
};

class BrandConsistencyPremiumPdfGenerator extends PremiumPdfReport {
    constructor() {
        super();
        this.reportType = 'Brand Consistency';
        this.reportColor = '#E91E63'; // Pink for Brand
    }

    /**
     * Generate the complete premium Brand Consistency PDF report
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
            title: 'Brand Consistency Analysis',
            subtitle: 'Visual Identity & Brand Guidelines Assessment',
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
            industryAverage: BRAND_BENCHMARKS.industryAverage,
            topPerformers: BRAND_BENCHMARKS.topPerformers,
            categoryBenchmarks: BRAND_BENCHMARKS.categories,
            componentScores
        });

        // Action Roadmap
        this.addActionRoadmap(recommendations);

        // Brand Specific Sections
        this.addColorAnalysisSection(analysisData);
        this.addTypographySection(analysisData);
        this.addLogoUsageSection(analysisData);
        this.addVisualHierarchySection(analysisData);
        this.addBrandChecklist(analysisData, score);

        return await this.endDocument();
    }

    /**
     * Calculate overall brand consistency score
     */
    _calculateOverallScore(data) {
        if (data.score !== undefined) return Math.round(data.score);
        if (data.overallScore !== undefined) return Math.round(data.overallScore);

        let score = 70; // Base score

        // Color consistency
        if (data.colors?.consistency >= 90) score += 10;
        else if (data.colors?.consistency >= 70) score += 5;

        // Typography consistency
        if (data.typography?.consistency >= 90) score += 10;
        else if (data.typography?.consistency >= 70) score += 5;

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

        const colorCount = data.colors?.unique || data.colorCount || 0;
        stats.push({
            label: 'Unique Colors',
            value: colorCount.toString(),
            status: colorCount <= 10 ? 'good' : colorCount <= 20 ? 'warning' : 'critical'
        });

        const fontCount = data.typography?.fontCount || data.fonts?.length || 0;
        stats.push({
            label: 'Font Families',
            value: fontCount.toString(),
            status: fontCount <= 3 ? 'good' : fontCount <= 5 ? 'warning' : 'critical'
        });

        const consistency = data.consistency || data.overallConsistency || 0;
        stats.push({
            label: 'Consistency',
            value: `${Math.round(consistency)}%`,
            status: consistency >= 80 ? 'good' : consistency >= 60 ? 'warning' : 'critical'
        });

        const issues = data.issues?.length || 0;
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
            'Color Consistency': data.colors?.consistency || data.colorScore || 70,
            'Typography': data.typography?.consistency || data.typographyScore || 68,
            'Logo Usage': data.logo?.score || 75,
            'Visual Hierarchy': data.hierarchy?.score || data.visualScore || 72
        };
    }

    /**
     * Extract key findings from analysis
     */
    _extractKeyFindings(data) {
        const findings = [];

        // Color findings
        const colorCount = data.colors?.unique || data.colorCount || 0;
        if (colorCount > 15) {
            findings.push({
                type: 'warning',
                category: 'Colors',
                title: 'Too Many Colors',
                description: `${colorCount} unique colors detected. Brand guidelines typically recommend 3-5 primary colors.`
            });
        } else if (colorCount <= 5) {
            findings.push({
                type: 'positive',
                category: 'Colors',
                title: 'Good Color Discipline',
                description: 'Color palette is focused and consistent with best practices.'
            });
        }

        // Typography findings
        const fontCount = data.typography?.fontCount || data.fonts?.length || 0;
        if (fontCount > 4) {
            findings.push({
                type: 'warning',
                category: 'Typography',
                title: 'Too Many Fonts',
                description: `${fontCount} font families detected. Limit to 2-3 for consistency.`
            });
        } else if (fontCount <= 2) {
            findings.push({
                type: 'positive',
                category: 'Typography',
                title: 'Consistent Typography',
                description: 'Font usage follows brand consistency best practices.'
            });
        }

        // Logo findings
        if (data.logo?.detected) {
            if (data.logo?.consistent) {
                findings.push({
                    type: 'positive',
                    category: 'Logo',
                    title: 'Logo Properly Implemented',
                    description: 'Logo appears consistently across the site.'
                });
            } else {
                findings.push({
                    type: 'warning',
                    category: 'Logo',
                    title: 'Logo Inconsistencies',
                    description: 'Logo usage varies across different pages or contexts.'
                });
            }
        }

        // Add from existing issues
        if (data.issues) {
            data.issues.slice(0, 5).forEach(issue => {
                findings.push({
                    type: issue.severity || 'warning',
                    category: issue.category || 'Brand',
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
        if (score >= 85) return BRAND_BUSINESS_IMPACT.excellent;
        if (score >= 70) return BRAND_BUSINESS_IMPACT.good;
        if (score >= 50) return BRAND_BUSINESS_IMPACT.fair;
        return BRAND_BUSINESS_IMPACT.poor;
    }

    /**
     * Enhance recommendations with effort/impact ratings
     */
    _enhanceRecommendations(data) {
        const recommendations = [];

        // Color recommendations
        const colorCount = data.colors?.unique || data.colorCount || 0;
        if (colorCount > 10) {
            recommendations.push({
                title: 'Consolidate Color Palette',
                description: 'Define and enforce a 5-color brand palette.',
                effort: 'medium',
                impact: 'high',
                priority: 1,
                category: 'Colors'
            });
        }

        // Typography recommendations
        const fontCount = data.typography?.fontCount || data.fonts?.length || 0;
        if (fontCount > 3) {
            recommendations.push({
                title: 'Standardize Typography',
                description: 'Limit fonts to 2-3 families: heading, body, and accent.',
                effort: 'medium',
                impact: 'high',
                priority: 1,
                category: 'Typography'
            });
        }

        // Brand guidelines
        if (!data.guidelinesDetected) {
            recommendations.push({
                title: 'Create Brand Style Guide',
                description: 'Document color codes, typography, and usage rules.',
                effort: 'high',
                impact: 'high',
                priority: 2,
                category: 'Documentation'
            });
        }

        // CSS variables
        if (!data.cssVariables) {
            recommendations.push({
                title: 'Implement CSS Variables',
                description: 'Use CSS custom properties for consistent theming.',
                effort: 'medium',
                impact: 'medium',
                priority: 3,
                category: 'Technical'
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
                        category: rec.category || 'General'
                    });
                }
            });
        }

        return recommendations.slice(0, 10);
    }

    /**
     * Add color analysis section
     */
    addColorAnalysisSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Color Analysis', 'Assessment of your brand color usage');

        let yPos = 130;
        const colors = data.colors || {};

        // Primary colors
        this._addSubsectionTitle('Detected Color Palette', yPos);
        yPos += 30;

        const palette = colors.palette || data.palette || [];
        if (palette.length > 0) {
            this._drawColorPalette(yPos, palette);
            yPos += 100;
        }

        // Color consistency analysis
        this._addSubsectionTitle('Color Consistency', yPos);
        yPos += 30;

        const consistencyScore = colors.consistency || 70;
        this._drawConsistencyGauge(yPos, consistencyScore, 'Color');
        yPos += 100;

        // Color issues
        if (colors.issues && colors.issues.length > 0) {
            this._addSubsectionTitle('Color Issues', yPos);
            yPos += 25;

            colors.issues.slice(0, 5).forEach(issue => {
                if (yPos > 700) {
                    this.doc.addPage();
                    yPos = 80;
                }
                this._drawColorIssue(yPos, issue);
                yPos += 35;
            });
        }

        // Plain English explanation
        yPos += 30;
        if (yPos > 650) {
            this.doc.addPage();
            yPos = 80;
        }

        const colorCount = colors.unique || palette.length || 0;
        this._addPlainEnglishBox(
            'Understanding Color Consistency',
            colorCount <= 5 ?
                `Your site uses ${colorCount} main colors, which is within best practices. ` +
                `A focused color palette makes your brand more recognizable and professional. ` +
                `Ensure these colors are defined in your brand guidelines and consistently applied.` :
            colorCount <= 10 ?
                `With ${colorCount} colors, your palette is slightly expanded but manageable. ` +
                `Consider identifying your 3-5 primary brand colors and using the others as accents. ` +
                `Document these in a style guide to maintain consistency.` :
                `${colorCount} unique colors creates visual inconsistency and dilutes brand recognition. ` +
                `Studies show consistent brand presentation increases revenue by up to 23%. ` +
                `Consolidate to a 5-color palette: primary, secondary, accent, and two neutrals.`,
            yPos
        );
    }

    _drawColorPalette(y, palette) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const swatchSize = 50;
        const spacing = 10;
        let currentX = x;

        palette.slice(0, 8).forEach((color, index) => {
            if (index > 0 && index % 8 === 0) {
                y += swatchSize + spacing + 20;
                currentX = x;
            }

            // Color swatch
            const colorValue = typeof color === 'string' ? color : color.hex || color.value;
            try {
                this.doc.roundedRect(currentX, y, swatchSize, swatchSize, 5)
                    .fill(colorValue);
            } catch (e) {
                this.doc.roundedRect(currentX, y, swatchSize, swatchSize, 5)
                    .fill('#CCCCCC');
            }

            // Color value
            this.doc.fontSize(7)
                .fillColor('#666666')
                .text(colorValue || 'N/A', currentX, y + swatchSize + 5, { width: swatchSize, align: 'center' });

            currentX += swatchSize + spacing;
        });
    }

    _drawConsistencyGauge(y, score, label) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = 300;
        const height = 20;

        // Background
        this.doc.roundedRect(x, y, width, height, 10)
            .fill('#E0E0E0');

        // Fill
        const fillColor = score >= 80 ? '#212121' : score >= 60 ? '#FF9800' : '#F44336';
        this.doc.roundedRect(x, y, width * (score / 100), height, 10)
            .fill(fillColor);

        // Score label
        this.doc.fontSize(12)
            .fillColor('#333333')
            .text(`${label} Consistency: ${Math.round(score)}%`, x + width + 20, y + 3);
    }

    _drawColorIssue(y, issue) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        this.doc.roundedRect(x, y, width, 30, 3)
            .fill('#FFF3E0');

        this.doc.fontSize(10)
            .fillColor('#E65100')
            .text('!', x + 10, y + 8);

        this.doc.fontSize(10)
            .fillColor('#333333')
            .text(issue.message || issue.title || issue, x + 30, y + 8, { width: width - 50 });
    }

    /**
     * Add typography section
     */
    addTypographySection(data) {
        this.doc.addPage();
        this._addSectionHeader('Typography Analysis', 'Font usage and consistency assessment');

        let yPos = 130;
        const typography = data.typography || {};

        // Font families detected
        this._addSubsectionTitle('Detected Fonts', yPos);
        yPos += 30;

        const fonts = typography.fonts || data.fonts || [];
        if (fonts.length > 0) {
            fonts.slice(0, 6).forEach(font => {
                this._drawFontCard(yPos, font);
                yPos += 70;

                if (yPos > 700) {
                    this.doc.addPage();
                    yPos = 80;
                }
            });
        } else {
            this.doc.fontSize(11)
                .fillColor('#666666')
                .text('No specific font data available.', this.PREMIUM.PAGE.MARGIN, yPos);
            yPos += 30;
        }

        // Typography consistency score
        yPos += 20;
        const typoScore = typography.consistency || typography.score || 70;
        this._drawConsistencyGauge(yPos, typoScore, 'Typography');
        yPos += 50;

        // Font size hierarchy
        this._addSubsectionTitle('Size Hierarchy', yPos);
        yPos += 30;

        const sizes = typography.sizes || data.fontSizes || [];
        if (sizes.length > 0) {
            this._drawSizeHierarchy(yPos, sizes);
            yPos += 120;
        }

        // Plain English explanation
        if (yPos > 600) {
            this.doc.addPage();
            yPos = 80;
        }

        const fontCount = fonts.length;
        this._addPlainEnglishBox(
            'Typography Best Practices',
            fontCount <= 2 ?
                `Using ${fontCount} font ${fontCount === 1 ? 'family' : 'families'} is ideal for brand consistency. ` +
                `Maintain a clear hierarchy with consistent sizing for headings, body text, and captions. ` +
                `This creates a professional, cohesive reading experience.` :
            fontCount <= 4 ?
                `With ${fontCount} fonts, ensure each has a specific purpose (heading, body, accent). ` +
                `Too many typefaces can make your site feel disjointed. Consider consolidating ` +
                `to 2-3 carefully chosen fonts that work well together.` :
                `${fontCount} different fonts creates visual chaos and hurts readability. ` +
                `Typography experts recommend using no more than 2-3 font families. ` +
                `Choose one for headings, one for body text, and optionally one for special elements.`,
            yPos
        );
    }

    _drawFontCard(y, font) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);
        const height = 60;

        // Card background
        this.doc.roundedRect(x, y, width, height, 5)
            .fill('#FAFAFA');

        // Font name
        const fontName = typeof font === 'string' ? font : font.family || font.name || 'Unknown';
        this.doc.fontSize(14)
            .fillColor('#333333')
            .text(fontName, x + 15, y + 12);

        // Usage info
        const usage = font.usage || font.purpose || 'General';
        this.doc.fontSize(9)
            .fillColor('#666666')
            .text(`Usage: ${usage}`, x + 15, y + 35);

        // Weight info
        if (font.weights) {
            this.doc.fontSize(9)
                .fillColor('#666666')
                .text(`Weights: ${font.weights.join(', ')}`, x + 200, y + 35);
        }

        // Occurrence count
        if (font.occurrences || font.count) {
            this.doc.fontSize(10)
                .fillColor(this.reportColor)
                .text(`${font.occurrences || font.count}x`, x + width - 60, y + 22);
        }
    }

    _drawSizeHierarchy(y, sizes) {
        const x = this.PREMIUM.PAGE.MARGIN;

        const hierarchy = [
            { label: 'H1', size: sizes[0] || 32 },
            { label: 'H2', size: sizes[1] || 24 },
            { label: 'H3', size: sizes[2] || 20 },
            { label: 'Body', size: sizes[3] || 16 },
            { label: 'Small', size: sizes[4] || 14 }
        ];

        hierarchy.forEach((level, index) => {
            // Label
            this.doc.fontSize(10)
                .fillColor('#666666')
                .text(level.label, x, y + (index * 22) + 2);

            // Size bar
            const barWidth = Math.min(level.size * 5, 200);
            this.doc.roundedRect(x + 60, y + (index * 22), barWidth, 16, 3)
                .fill(this.reportColor);

            // Size value
            this.doc.fontSize(9)
                .fillColor('#FFFFFF')
                .text(`${level.size}px`, x + 65, y + (index * 22) + 3);
        });
    }

    /**
     * Add logo usage section
     */
    addLogoUsageSection(data) {
        this.doc.addPage();
        this._addSectionHeader('Logo Usage', 'Logo implementation and consistency analysis');

        let yPos = 130;
        const logo = data.logo || {};

        // Logo detection status
        this._addSubsectionTitle('Logo Detection', yPos);
        yPos += 30;

        const logoDetected = logo.detected !== false;
        this.doc.roundedRect(this.PREMIUM.PAGE.MARGIN, yPos,
            this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN), 60, 5)
            .fill(logoDetected ? '#F5F5F5' : '#FFF3E0');

        this.doc.fontSize(14)
            .fillColor(logoDetected ? '#212121' : '#FF9800')
            .text(logoDetected ? 'Logo Detected' : 'Logo Not Detected',
                this.PREMIUM.PAGE.MARGIN + 20, yPos + 20);

        if (logo.location) {
            this.doc.fontSize(10)
                .fillColor('#666666')
                .text(`Location: ${logo.location}`, this.PREMIUM.PAGE.MARGIN + 20, yPos + 40);
        }

        yPos += 80;

        // Logo guidelines checklist
        this._addSubsectionTitle('Logo Implementation Checklist', yPos);
        yPos += 25;

        const checkItems = [
            { text: 'Logo in header/navigation', status: logo.inHeader !== false },
            { text: 'Consistent sizing across pages', status: logo.consistentSize !== false },
            { text: 'Proper clear space maintained', status: logo.clearSpace },
            { text: 'High-resolution/SVG format used', status: logo.highRes || logo.svg },
            { text: 'Alt text properly set', status: logo.altText },
            { text: 'Links to homepage', status: logo.linksHome !== false }
        ];

        checkItems.forEach(item => {
            this._drawCheckItem(yPos, item);
            yPos += 28;
        });

        yPos += 30;

        // Plain English explanation
        if (yPos > 600) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'Logo Best Practices',
            `Your logo is the most recognizable element of your brand. It should appear consistently ` +
            `in the same position (typically top-left header) across all pages. Use SVG format for ` +
            `crisp display at any size, maintain adequate clear space around it, and ensure it links ` +
            `to your homepage. Consistency in logo presentation builds brand trust and recognition.`,
            yPos
        );
    }

    _drawCheckItem(y, item) {
        const x = this.PREMIUM.PAGE.MARGIN;

        // Checkbox
        this.doc.roundedRect(x, y, 16, 16, 2)
            .lineWidth(1)
            .stroke(item.status ? '#212121' : '#BDBDBD');

        if (item.status) {
            this.doc.fontSize(11)
                .fillColor('#212121')
                .text('*', x + 3, y + 1);
        }

        // Text
        this.doc.fontSize(10)
            .fillColor(item.status ? '#333333' : '#9E9E9E')
            .text(item.text, x + 26, y + 2);
    }

    /**
     * Add visual hierarchy section
     */
    addVisualHierarchySection(data) {
        this.doc.addPage();
        this._addSectionHeader('Visual Hierarchy', 'Layout and design consistency assessment');

        let yPos = 130;
        const hierarchy = data.hierarchy || data.visualHierarchy || {};

        // Hierarchy score breakdown
        this._addSubsectionTitle('Visual Elements Consistency', yPos);
        yPos += 30;

        const elements = [
            { name: 'Heading Styles', score: hierarchy.headings || 75 },
            { name: 'Button Styles', score: hierarchy.buttons || 70 },
            { name: 'Spacing/Margins', score: hierarchy.spacing || 72 },
            { name: 'Border Styles', score: hierarchy.borders || 68 },
            { name: 'Shadow Effects', score: hierarchy.shadows || 65 }
        ];

        elements.forEach(element => {
            this._drawElementScore(yPos, element);
            yPos += 45;
        });

        yPos += 20;

        // Component consistency
        this._addSubsectionTitle('Component Patterns', yPos);
        yPos += 30;

        const patterns = hierarchy.patterns || [];
        if (patterns.length > 0) {
            patterns.slice(0, 5).forEach(pattern => {
                this._drawPatternRow(yPos, pattern);
                yPos += 35;
            });
        } else {
            const defaultPatterns = [
                { name: 'Navigation', consistent: true },
                { name: 'Footer', consistent: true },
                { name: 'Cards/Containers', consistent: hierarchy.cardsConsistent },
                { name: 'Forms', consistent: hierarchy.formsConsistent },
                { name: 'Icons', consistent: hierarchy.iconsConsistent }
            ];

            defaultPatterns.forEach(pattern => {
                this._drawPatternRow(yPos, pattern);
                yPos += 35;
            });
        }

        // Plain English explanation
        yPos += 30;
        if (yPos > 600) {
            this.doc.addPage();
            yPos = 80;
        }

        this._addPlainEnglishBox(
            'Visual Hierarchy Explained',
            `Visual hierarchy guides visitors through your content by creating clear relationships ` +
            `between elements. Consistent heading sizes, button styles, and spacing create a ` +
            `predictable, professional experience. When users don't have to "learn" your interface ` +
            `on each page, they can focus on your content and are more likely to convert.`,
            yPos
        );
    }

    _drawElementScore(y, element) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        // Background
        this.doc.roundedRect(x, y, width, 38, 4)
            .fill('#FAFAFA');

        // Element name
        this.doc.fontSize(11)
            .fillColor('#333333')
            .text(element.name, x + 15, y + 12);

        // Score bar
        const barX = x + 180;
        const barWidth = 200;
        const barHeight = 12;

        this.doc.roundedRect(barX, y + 13, barWidth, barHeight, 6)
            .fill('#E0E0E0');

        const scoreColor = element.score >= 80 ? '#212121' :
                          element.score >= 60 ? '#FF9800' : '#F44336';
        this.doc.roundedRect(barX, y + 13, barWidth * (element.score / 100), barHeight, 6)
            .fill(scoreColor);

        // Score value
        this.doc.fontSize(10)
            .fillColor(scoreColor)
            .text(`${element.score}%`, barX + barWidth + 15, y + 12);
    }

    _drawPatternRow(y, pattern) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);

        this.doc.roundedRect(x, y, width, 30, 3)
            .fill('#FFFFFF')
            .roundedRect(x, y, width, 30, 3)
            .stroke('#E0E0E0');

        // Pattern name
        this.doc.fontSize(10)
            .fillColor('#333333')
            .text(pattern.name, x + 15, y + 8);

        // Status
        const isConsistent = pattern.consistent !== false;
        this.doc.fontSize(10)
            .fillColor(isConsistent ? '#212121' : '#FF9800')
            .text(isConsistent ? 'Consistent' : 'Varies', x + width - 100, y + 8);
    }

    /**
     * Add brand checklist
     */
    addBrandChecklist(data, score) {
        this.doc.addPage();
        this._addSectionHeader('Brand Consistency Checklist', 'Complete brand implementation guide');

        let yPos = 130;

        const checklistSections = [
            {
                category: 'Color System',
                items: [
                    { text: 'Primary brand colors defined', checked: data.colors?.primary },
                    { text: 'Secondary/accent colors defined', checked: data.colors?.secondary },
                    { text: 'Colors consistently applied', checked: (data.colors?.consistency || 0) >= 80 },
                    { text: 'CSS variables for colors', checked: data.cssVariables?.colors }
                ]
            },
            {
                category: 'Typography',
                items: [
                    { text: 'Heading font selected', checked: data.typography?.headingFont },
                    { text: 'Body font selected', checked: data.typography?.bodyFont },
                    { text: 'Font sizes follow hierarchy', checked: data.typography?.hierarchy },
                    { text: 'Web fonts properly loaded', checked: data.typography?.webFonts }
                ]
            },
            {
                category: 'Logo & Identity',
                items: [
                    { text: 'Logo properly implemented', checked: data.logo?.detected },
                    { text: 'Favicon matches brand', checked: data.favicon?.matches },
                    { text: 'Social media images consistent', checked: data.social?.imagesConsistent },
                    { text: 'Brand assets documented', checked: data.guidelinesDetected }
                ]
            },
            {
                category: 'UI Components',
                items: [
                    { text: 'Button styles consistent', checked: data.hierarchy?.buttons >= 80 },
                    { text: 'Form styles consistent', checked: data.hierarchy?.formsConsistent },
                    { text: 'Card/container styles uniform', checked: data.hierarchy?.cardsConsistent },
                    { text: 'Icon style consistent', checked: data.hierarchy?.iconsConsistent }
                ]
            }
        ];

        checklistSections.forEach(section => {
            this._drawBrandChecklistSection(yPos, section);
            yPos += 30 + (section.items.length * 26);

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

        this._drawBrandScoreCard(yPos, score);
    }

    _drawBrandChecklistSection(y, section) {
        const x = this.PREMIUM.PAGE.MARGIN;

        // Section header
        this.doc.fontSize(12)
            .fillColor(this.reportColor)
            .text(section.category, x, y);

        y += 22;

        section.items.forEach(item => {
            // Checkbox
            this.doc.roundedRect(x, y, 14, 14, 2)
                .lineWidth(1)
                .stroke(item.checked ? '#212121' : '#BDBDBD');

            if (item.checked) {
                this.doc.fontSize(10)
                    .fillColor('#212121')
                    .text('*', x + 2, y);
            }

            // Item text
            this.doc.fontSize(10)
                .fillColor(item.checked ? '#333333' : '#9E9E9E')
                .text(item.text, x + 24, y + 1);

            y += 26;
        });
    }

    _drawBrandScoreCard(y, score) {
        const x = this.PREMIUM.PAGE.MARGIN;
        const width = this.PREMIUM.PAGE.WIDTH - (2 * this.PREMIUM.PAGE.MARGIN);
        const height = 100;

        // Card background
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
            .text('Brand Consistency Score', x + 160, y + 25);

        const summary = score >= 85 ? 'Excellent brand consistency' :
                       score >= 70 ? 'Good consistency, minor improvements needed' :
                       score >= 50 ? 'Moderate inconsistencies found' :
                       'Significant brand work required';

        this.doc.fontSize(11)
            .fillColor('rgba(255,255,255,0.9)')
            .text(summary, x + 160, y + 50);

        // Generation date
        this.doc.fontSize(9)
            .fillColor('rgba(255,255,255,0.7)')
            .text(`Report generated: ${new Date().toLocaleDateString()}`, x + 160, y + 75);
    }
}

module.exports = BrandConsistencyPremiumPdfGenerator;
