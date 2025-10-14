const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PDFReportGenerator');

class PDFReportGenerator {
  constructor() {
    this.reportsDir = path.join(__dirname, '../../reports');
    this.ensureReportsDir();
  }

  async ensureReportsDir() {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      logger.error('Error creating reports directory:', error);
    }
  }

  async generateComprehensiveReport(scanResults) {
    const reportId = uuidv4();
    const filename = `font-analysis-${reportId}.pdf`;
    const filepath = path.join(this.reportsDir, filename);

    logger.info(`Generating PDF report: ${filename}`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Pipe to file
    const stream = fsSync.createWriteStream(filepath);
    doc.pipe(stream);

    // Generate report content
    await this.addHeader(doc, scanResults.baseUrl);
    await this.addExecutiveSummary(doc, scanResults);
    await this.addMultiPageAnalysis(doc, scanResults.pages);
    await this.addDesktopMobileComparison(doc, scanResults.lighthouse);
    await this.addWeaknessAnalysis(doc, scanResults);
    await this.addRecommendations(doc, scanResults);
    await this.addAppendix(doc, scanResults);

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        resolve({
          filename,
          filepath,
          reportId,
          size: doc._pageSize,
        });
      });
      stream.on('error', reject);
    });
  }

  async addHeader(doc, baseUrl) {
    // Title
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .fillColor('#2563eb')
      .text('Comprehensive Font & Performance Analysis', 50, 50);

    // URL
    doc.fontSize(14).font('Helvetica').fillColor('#64748b').text(`Website: ${baseUrl}`, 50, 85);

    // Date
    doc.text(
      `Generated: ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      50,
      105
    );

    // Line separator
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, 135).lineTo(545, 135).stroke();

    doc.moveDown(2);
  }

  async addExecutiveSummary(doc, scanResults) {
    this.addSectionHeader(doc, 'Executive Summary');

    const summary = this.calculateExecutiveSummary(scanResults);

    // Overall scores box
    const boxY = doc.y;
    doc.rect(50, boxY, 495, 100).fillColor('#f8fafc').fill().strokeColor('#e2e8f0').stroke();

    doc
      .fillColor('#1e293b')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Overall Performance Scores', 70, boxY + 20);

    const scores = [
      { label: 'Font Performance', value: summary.fontScore, x: 70 },
      { label: 'Desktop Lighthouse', value: summary.desktopScore, x: 200 },
      { label: 'Mobile Lighthouse', value: summary.mobileScore, x: 330 },
      { label: 'Accessibility', value: summary.accessibilityScore, x: 460 },
    ];

    scores.forEach((score) => {
      const color = this.getScoreColor(score.value);
      doc
        .fillColor(color)
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(`${score.value}`, score.x, boxY + 45);

      doc
        .fillColor('#64748b')
        .fontSize(9)
        .font('Helvetica')
        .text(score.label, score.x, boxY + 70);
    });

    doc.moveDown(3);

    // Key findings
    doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text('Key Findings:', 50, doc.y);

    summary.keyFindings.forEach((finding) => {
      doc
        .fillColor('#374151')
        .fontSize(11)
        .font('Helvetica')
        .text(`• ${finding}`, 70, doc.y + 5);
      doc.moveDown(0.5);
    });

    doc.addPage();
  }

  async addMultiPageAnalysis(doc, pages) {
    this.addSectionHeader(doc, 'Multi-Page Analysis');

    doc
      .fillColor('#374151')
      .fontSize(11)
      .font('Helvetica')
      .text(`Analyzed ${pages.length} pages across the website:`, 50, doc.y + 10);

    doc.moveDown();

    pages.forEach((page, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      // Page title
      doc
        .fillColor('#1e293b')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`${index + 1}. ${this.truncateUrl(page.url)}`, 50, doc.y + 10);

      // Metrics table
      const metrics = [
        ['Font Count', page.fonts?.totalFonts || 0],
        ['Load Time', `${page.performance?.initialLoadTime || 0}ms`],
        ['LCP', `${Math.round(page.lighthouse?.desktop?.metrics?.coreWebVitals?.lcp || 0)}ms`],
        ['CLS', (page.lighthouse?.desktop?.metrics?.coreWebVitals?.cls || 0).toFixed(3)],
      ];

      let tableY = doc.y + 5;
      metrics.forEach(([label, value]) => {
        doc.fillColor('#64748b').fontSize(10).font('Helvetica').text(label, 70, tableY);

        doc.fillColor('#1e293b').text(value.toString(), 200, tableY);

        tableY += 15;
      });

      doc.moveDown(0.5);
    });

    doc.addPage();
  }

  async addDesktopMobileComparison(doc, lighthouse) {
    this.addSectionHeader(doc, 'Desktop vs Mobile Performance');

    if (!lighthouse || !lighthouse.desktop || !lighthouse.mobile) {
      doc.text('Lighthouse analysis not available', 50, doc.y + 10);
      return;
    }

    // Comparison table
    const comparisons = [
      ['Metric', 'Desktop', 'Mobile', 'Difference'],
      [
        'Performance Score',
        lighthouse.desktop.score,
        lighthouse.mobile.score,
        lighthouse.desktop.score - lighthouse.mobile.score,
      ],
      [
        'First Contentful Paint',
        `${Math.round(lighthouse.desktop.metrics?.firstContentfulPaint || 0)}ms`,
        `${Math.round(lighthouse.mobile.metrics?.firstContentfulPaint || 0)}ms`,
        `${Math.round(
          (lighthouse.desktop.metrics?.firstContentfulPaint || 0) -
            (lighthouse.mobile.metrics?.firstContentfulPaint || 0)
        )}ms`,
      ],
      [
        'Largest Contentful Paint',
        `${Math.round(lighthouse.desktop.metrics?.coreWebVitals?.lcp || 0)}ms`,
        `${Math.round(lighthouse.mobile.metrics?.coreWebVitals?.lcp || 0)}ms`,
        `${Math.round(
          (lighthouse.desktop.metrics?.coreWebVitals?.lcp || 0) -
            (lighthouse.mobile.metrics?.coreWebVitals?.lcp || 0)
        )}ms`,
      ],
      [
        'Cumulative Layout Shift',
        (lighthouse.desktop.metrics?.coreWebVitals?.cls || 0).toFixed(3),
        (lighthouse.mobile.metrics?.coreWebVitals?.cls || 0).toFixed(3),
        (
          (lighthouse.desktop.metrics?.coreWebVitals?.cls || 0) -
          (lighthouse.mobile.metrics?.coreWebVitals?.cls || 0)
        ).toFixed(3),
      ],
    ];

    let tableY = doc.y + 20;
    const colX = [50, 200, 300, 400];

    comparisons.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const isHeader = rowIndex === 0;
        doc
          .fillColor(isHeader ? '#1e293b' : '#374151')
          .fontSize(isHeader ? 11 : 10)
          .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
          .text(cell.toString(), colX[colIndex], tableY);
      });
      tableY += 20;
    });

    doc.addPage();
  }

  async addWeaknessAnalysis(doc, scanResults) {
    this.addSectionHeader(doc, 'Comprehensive Weakness Analysis');

    const weaknesses = this.aggregateWeaknesses(scanResults);

    // Critical issues
    if (weaknesses.critical.length > 0) {
      doc
        .fillColor('#dc2626')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('🚨 Critical Issues', 50, doc.y + 10);

      weaknesses.critical.forEach((issue) => {
        doc
          .fillColor('#374151')
          .fontSize(10)
          .font('Helvetica')
          .text(`• ${issue}`, 70, doc.y + 5);
        doc.moveDown(0.3);
      });
    }

    // High priority issues
    if (weaknesses.high.length > 0) {
      doc
        .fillColor('#f59e0b')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('⚠️ High Priority Issues', 50, doc.y + 15);

      weaknesses.high.forEach((issue) => {
        doc
          .fillColor('#374151')
          .fontSize(10)
          .font('Helvetica')
          .text(`• ${issue}`, 70, doc.y + 5);
        doc.moveDown(0.3);
      });
    }

    // Medium priority issues
    if (weaknesses.medium.length > 0) {
      doc
        .fillColor('#10b981')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('💡 Medium Priority Issues', 50, doc.y + 15);

      weaknesses.medium.forEach((issue) => {
        doc
          .fillColor('#374151')
          .fontSize(10)
          .font('Helvetica')
          .text(`• ${issue}`, 70, doc.y + 5);
        doc.moveDown(0.3);
      });
    }

    doc.addPage();
  }

  async addRecommendations(doc, scanResults) {
    this.addSectionHeader(doc, 'Actionable Recommendations');

    const recommendations = this.generateRecommendations(scanResults);

    recommendations.forEach((rec, index) => {
      if (doc.y > 650) {
        doc.addPage();
      }

      doc
        .fillColor('#1e293b')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`${index + 1}. ${rec.title}`, 50, doc.y + 10);

      doc
        .fillColor('#374151')
        .fontSize(10)
        .font('Helvetica')
        .text(rec.description, 70, doc.y + 5, { width: 475 });

      if (rec.impact) {
        doc
          .fillColor('#64748b')
          .fontSize(9)
          .font('Helvetica-Oblique')
          .text(`Expected Impact: ${rec.impact}`, 70, doc.y + 5);
      }

      doc.moveDown(0.8);
    });
  }

  async addAppendix(doc, scanResults) {
    doc.addPage();
    this.addSectionHeader(doc, 'Technical Appendix');

    // Font inventory
    doc
      .fillColor('#1e293b')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('Font Inventory', 50, doc.y + 10);

    if (scanResults.pages && scanResults.pages[0]?.fonts) {
      const fonts = scanResults.pages[0].fonts;

      ['System Fonts', 'Web Fonts', 'Google Fonts'].forEach((category) => {
        const categoryKey = category.toLowerCase().replace(' ', '');
        const fontList = fonts.categorizedFonts?.[categoryKey] || [];

        if (fontList.length > 0) {
          doc
            .fillColor('#64748b')
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(`${category}:`, 70, doc.y + 10);

          fontList.forEach((font) => {
            doc
              .fillColor('#374151')
              .fontSize(9)
              .font('Helvetica')
              .text(`• ${font}`, 90, doc.y + 3);
            doc.moveDown(0.2);
          });
        }
      });
    }
  }

  addSectionHeader(doc, title) {
    doc
      .fillColor('#2563eb')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(title, 50, doc.y + 20);

    doc
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .moveTo(50, doc.y + 5)
      .lineTo(545, doc.y + 5)
      .stroke();

    doc.moveDown();
  }

  calculateExecutiveSummary(scanResults) {
    const summary = {
      fontScore: 50,
      desktopScore: 0,
      mobileScore: 0,
      accessibilityScore: 0,
      keyFindings: [],
    };

    if (scanResults.pages && scanResults.pages.length > 0) {
      const mainPage = scanResults.pages[0];
      summary.fontScore = mainPage.bestPractices?.score || 50;
    }

    if (scanResults.lighthouse) {
      summary.desktopScore = scanResults.lighthouse.desktop?.score || 0;
      summary.mobileScore = scanResults.lighthouse.mobile?.score || 0;
      summary.accessibilityScore = scanResults.lighthouse.desktop?.accessibility?.score || 0;
    }

    // Generate key findings
    if (summary.fontScore < 60) {
      summary.keyFindings.push('Font optimization needs significant improvement');
    }
    if (summary.desktopScore - summary.mobileScore > 20) {
      summary.keyFindings.push('Large performance gap between desktop and mobile');
    }
    if (summary.accessibilityScore < 80) {
      summary.keyFindings.push('Accessibility issues require attention');
    }

    return summary;
  }

  aggregateWeaknesses(scanResults) {
    const weaknesses = { critical: [], high: [], medium: [] };

    // Analyze all pages for weaknesses
    if (scanResults.pages) {
      scanResults.pages.forEach((page) => {
        if (page.lighthouse) {
          // Add Lighthouse issues
          if (page.lighthouse.desktop?.accessibility?.issues) {
            page.lighthouse.desktop.accessibility.issues.forEach((issue) => {
              if (issue.impact === 'high') {
                weaknesses.critical.push(`${issue.title} (Desktop)`);
              } else if (issue.impact === 'medium') {
                weaknesses.high.push(`${issue.title} (Desktop)`);
              }
            });
          }
        }
      });
    }

    return weaknesses;
  }

  generateRecommendations(scanResults) {
    const recommendations = [];

    // Font-specific recommendations
    recommendations.push({
      title: 'Optimize Font Loading Strategy',
      description:
        'Implement font-display: swap for all custom fonts to prevent invisible text during font loading. Consider using preload for critical fonts.',
      impact: 'Reduced First Contentful Paint by 200-500ms',
    });

    recommendations.push({
      title: 'Reduce Font Requests',
      description:
        'Consolidate font variations and consider using variable fonts to reduce the number of font requests.',
      impact: 'Improved loading performance by 15-25%',
    });

    if (scanResults.lighthouse?.desktop?.score < 70) {
      recommendations.push({
        title: 'Improve Core Web Vitals',
        description:
          'Focus on optimizing Largest Contentful Paint and Cumulative Layout Shift through better resource prioritization.',
        impact: 'Better search engine rankings and user experience',
      });
    }

    return recommendations;
  }

  getScoreColor(score) {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#dc2626';
  }

  truncateUrl(url) {
    if (url.length > 60) {
      return url.substring(0, 57) + '...';
    }
    return url;
  }
}

module.exports = new PDFReportGenerator();
