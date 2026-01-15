const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const { resolveReportId } = require('../utils/resolveReportId');

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
    const reportId = resolveReportId({
      reportId: scanResults?.reportId,
      analyzerKey: scanResults?.analyzerKey || 'enhanced-fonts',
      url: scanResults?.normalizedUrl || scanResults?.url || scanResults?.baseUrl,
      startedAtISO: scanResults?.scanStartedAt || scanResults?.startedAt || scanResults?.timestamp,
    });

    if (!reportId) {
      throw new Error('Missing report identity for Font PDF generation (reportId or url+scanStartedAt+analyzerKey)');
    }
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
    await this.addDetailedFontAnalysis(doc, scanResults);
    await this.addBestPracticesAnalysis(doc, scanResults);
    await this.addPerformanceMetrics(doc, scanResults);
    await this.addMultiPageAnalysis(doc, scanResults.pages);
    await this.addDesktopMobileComparison(doc, scanResults.lighthouse);
    await this.addSecurityAndCaching(doc, scanResults);
    await this.addAccessibilityDetails(doc, scanResults);
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
    // Set page background to match website
    doc.page.margins = { top: 50, bottom: 50, left: 50, right: 50 };
    
    // Title with website-style monospace look
    doc
      .fontSize(28)
      .font('Helvetica-Bold')
      .fillColor('#0f0f14') // Dark background color similar to website
      .text('[SITE_MECHANIC]', 50, 50);

    // Subtitle with terminal-style bracket formatting
    doc
      .fontSize(16)
      .font('Helvetica')
      .fillColor('#64748b')
      .text('> web diagnostics & performance analysis', 50, 85);

    // URL with consistent styling
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#64748b')
      .text(`> target_url: ${baseUrl}`, 50, 110);

    // Date with terminal-style formatting
    doc
      .fontSize(12)
      .font('Helvetica')
      .fillColor('#64748b')
      .text(
        `> generated: ${new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        50,
        130
      );

    // Terminal-style separator line
    doc.strokeColor('#333333').lineWidth(2).moveTo(50, 160).lineTo(545, 160).stroke();

    doc.moveDown(3);
  }

  async addExecutiveSummary(doc, scanResults) {
    this.addSectionHeader(doc, '[EXECUTIVE_SUMMARY]');

    const summary = this.calculateExecutiveSummary(scanResults);

    // Overall scores box with website-style dark background
    const boxY = doc.y;
    doc.rect(50, boxY, 495, 120).fillColor('#0a0a0a').fill().strokeColor('#333333').stroke();

    doc
      .fillColor('#ffffff')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('> system_performance_metrics', 70, boxY + 20);

    const scores = [
      { label: 'font_perf', value: summary.fontScore, x: 70, icon: '⚡' },
      { label: 'desktop_lh', value: summary.desktopScore, x: 180, icon: '🖥️' },
      { label: 'mobile_lh', value: summary.mobileScore, x: 290, icon: '📱' },
      { label: 'a11y_score', value: summary.accessibilityScore, x: 400, icon: '♿' },
    ];

    scores.forEach((score) => {
      const color = this.getScoreColor(score.value);
      
      // Icon
      doc
        .fillColor('#cccccc')
        .fontSize(14)
        .text(score.icon, score.x, boxY + 45);
      
      // Score with health status styling
      doc
        .fillColor(color)
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(`${score.value}`, score.x + 20, boxY + 45);

      // Label with terminal-style formatting
      doc
        .fillColor('#888888')
        .fontSize(8)
        .font('Helvetica')
        .text(score.label.toUpperCase(), score.x, boxY + 75);
        
      // Health status indicator
      const healthIcon = score.value >= 80 ? '✓' : score.value >= 60 ? '⚠' : '✗';
      doc
        .fillColor(color)
        .fontSize(12)
        .text(healthIcon, score.x, boxY + 90);
    });

    doc.moveDown(4);

    // Key findings with terminal-style bullets
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('> critical_findings:', 50, doc.y);

    summary.keyFindings.forEach((finding, index) => {
      const bulletColor = index === 0 ? '#ff6b6b' : '#ffd93d';
      doc
        .fillColor(bulletColor)
        .fontSize(12)
        .font('Helvetica')
        .text(`[${index + 1}]`, 70, doc.y + 8);
        
      doc
        .fillColor('#cccccc')
        .fontSize(11)
        .font('Helvetica')
        .text(finding, 95, doc.y - 12);
      doc.moveDown(0.8);
    });

    doc.addPage();
  }

  async addDetailedFontAnalysis(doc, scanResults) {
    this.addSectionHeader(doc, '[FONT_ANALYSIS]');

    const fontData = scanResults.pages?.[0]?.fonts;
    if (!fontData) {
      doc.fillColor('#ff6b6b').fontSize(11).text('> error: no_font_data_available', 50, doc.y + 10);
      doc.addPage();
      return;
    }

    // Font Overview with terminal-style formatting
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('> font_system_overview', 50, doc.y + 10);
    
    // Create a dark box for font metrics
    const boxY = doc.y + 5;
    doc.rect(50, boxY, 495, 100).fillColor('#1a1a1a').fill().strokeColor('#444444').stroke();
    
    const overview = [
      `total_fonts_detected: ${fontData.totalFonts || 0}`,
      `system_fonts: ${fontData.categorizedFonts?.system?.length || 0}`,
      `web_fonts: ${fontData.categorizedFonts?.webFonts?.length || 0}`,
      `google_fonts: ${fontData.categorizedFonts?.googleFonts?.length || 0}`,
      `icon_fonts: ${fontData.categorizedFonts?.iconFonts?.length || 0}`
    ];

    overview.forEach((item, index) => {
      const yPos = boxY + 20 + (index * 15);
      doc.fillColor('#00ff41').fontSize(10).text('> ', 70, yPos);
      doc.fillColor('#cccccc').fontSize(10).text(item, 85, yPos);
    });

    doc.y = boxY + 110;

    // Font Details by Category with accordion-style headers
    if (fontData.categorizedFonts) {
      Object.entries(fontData.categorizedFonts).forEach(([category, fonts]) => {
        if (fonts && fonts.length > 0) {
          doc.fillColor('#0f0f14').fontSize(12).font('Helvetica-Bold')
             .text(`[${category.toUpperCase()}_FONTS]`, 50, doc.y + 15);
          
          // Create font preview box
          const fontBoxY = doc.y + 5;
          doc.rect(50, fontBoxY, 495, Math.min(fonts.length * 12 + 20, 80))
             .fillColor('#111111').fill().strokeColor('#333333').stroke();
          
          fonts.slice(0, 6).forEach((font, index) => {
            const fontColor = index % 2 === 0 ? '#ffffff' : '#cccccc';
            doc.fillColor('#00ff41').fontSize(9).text('• ', 70, fontBoxY + 15 + (index * 12));
            doc.fillColor(fontColor).fontSize(9).text(font, 80, fontBoxY + 15 + (index * 12));
          });
          
          if (fonts.length > 6) {
            doc.fillColor('#888888').fontSize(9)
               .text(`... and ${fonts.length - 6} more fonts`, 70, fontBoxY + 15 + (6 * 12));
          }
          
          doc.y = fontBoxY + Math.min(fonts.length * 12 + 40, 100);
        }
      });
    }

    // Font Loading Performance with status indicators
    if (fontData.fontLoading) {
      doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold')
         .text('[FONT_LOADING_PERFORMANCE]', 50, doc.y + 20);
      
      if (fontData.fontLoading.supported) {
        const loadTime = fontData.fontLoading.totalLoadTime || 0;
        const status = loadTime < 1000 ? '✓' : loadTime < 2000 ? '⚠' : '✗';
        const statusColor = loadTime < 1000 ? '#00ff41' : loadTime < 2000 ? '#ffd93d' : '#ff6b6b';
        
        doc.fillColor(statusColor).fontSize(12).text(status, 70, doc.y + 10);
        doc.fillColor('#cccccc').fontSize(10)
           .text(`total_load_time: ${loadTime.toFixed(2)}ms`, 90, doc.y - 10);
        
        if (fontData.fontLoading.fonts && fontData.fontLoading.fonts.length > 0) {
          fontData.fontLoading.fonts.slice(0, 3).forEach((font, index) => {
            const fontStatus = font.status === 'loaded' ? '✓' : '✗';
            const fontColor = font.status === 'loaded' ? '#00ff41' : '#ff6b6b';
            
            doc.fillColor(fontColor).fontSize(9).text(fontStatus, 90, doc.y + 5 + (index * 12));
            doc.fillColor('#cccccc').fontSize(9)
               .text(`${font.family}: ${(font.loadTime || 0).toFixed(2)}ms`, 105, doc.y + 5 + (index * 12));
          });
          doc.y += fontData.fontLoading.fonts.length * 12;
        }
      } else {
        doc.fillColor('#ff6b6b').fontSize(10).text('✗ font_loading_api_not_supported', 70, doc.y + 10);
      }
    }

    doc.addPage();
  }

  async addBestPracticesAnalysis(doc, scanResults) {
    this.addSectionHeader(doc, '[BEST_PRACTICES_ANALYSIS]');

    const bestPractices = scanResults.pages?.[0]?.bestPractices;
    if (!bestPractices) {
      doc.fillColor('#ff6b6b').fontSize(11).text('> error: no_best_practices_data_available', 50, doc.y + 10);
      doc.addPage();
      return;
    }

    // Overall Score with health indicator
    const overallScore = bestPractices.score || 0;
    const grade = this.getGrade(overallScore);
    const healthIcon = overallScore >= 80 ? '✓' : overallScore >= 60 ? '⚠' : '✗';
    const healthColor = this.getScoreColor(overallScore);
    
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
       .text(`> overall_best_practices_score:`, 50, doc.y + 10);
    
    doc.fillColor(healthColor).fontSize(16).font('Helvetica-Bold')
       .text(`${healthIcon} ${overallScore}/100 (${grade})`, 320, doc.y - 16);

    // Category Breakdown in accordion-style
    if (bestPractices.categories) {
      doc.fillColor('#ffffff').fontSize(12).font('Helvetica-Bold')
         .text('[CATEGORY_SCORES]', 50, doc.y + 25);

      // Create dark background box for scores
      const scoresBoxY = doc.y + 5;
      const categoryEntries = Object.entries(bestPractices.categories);
      const boxHeight = categoryEntries.length * 20 + 20;
      
      doc.rect(50, scoresBoxY, 495, boxHeight)
         .fillColor('#1a1a1a').fill().strokeColor('#444444').stroke();

      categoryEntries.forEach(([category, data], index) => {
        const score = data.percentage || data.score || 0;
        const displayName = this.formatCategoryName(category);
        const categoryIcon = score >= 80 ? '✓' : score >= 60 ? '⚠' : '✗';
        const categoryColor = this.getScoreColor(score);
        
        const yPos = scoresBoxY + 15 + (index * 20);
        
        doc.fillColor(categoryColor).fontSize(10).text(categoryIcon, 70, yPos);
        doc.fillColor('#cccccc').fontSize(10).text(displayName + ':', 90, yPos);
        doc.fillColor(categoryColor).fontSize(10).text(`${score.toFixed(1)}%`, 450, yPos);
      });
      
      doc.y = scoresBoxY + boxHeight + 10;
    }

    // Key Issues and Strengths with terminal-style formatting
    if (bestPractices.summary) {
      if (bestPractices.summary.mainIssues && bestPractices.summary.mainIssues.length > 0) {
        doc.fillColor('#ff6b6b').fontSize(12).font('Helvetica-Bold')
           .text('[CRITICAL_ISSUES]', 50, doc.y + 15);
        
        bestPractices.summary.mainIssues.forEach((issue) => {
          doc.fillColor('#ff6b6b').fontSize(10).text('✗', 70, doc.y + 8);
          doc.fillColor('#cccccc').fontSize(9).text(issue, 85, doc.y - 8);
          doc.moveDown(0.8);
        });
      }

      if (bestPractices.summary.mainStrengths && bestPractices.summary.mainStrengths.length > 0) {
        doc.fillColor('#00ff41').fontSize(12).font('Helvetica-Bold')
           .text('[STRENGTHS]', 50, doc.y + 15);
        
        bestPractices.summary.mainStrengths.forEach((strength) => {
          doc.fillColor('#00ff41').fontSize(10).text('✓', 70, doc.y + 8);
          doc.fillColor('#cccccc').fontSize(9).text(strength, 85, doc.y - 8);
          doc.moveDown(0.8);
        });
      }
    }

    doc.addPage();
  }

  async addPerformanceMetrics(doc, scanResults) {
    this.addSectionHeader(doc, 'Performance Metrics');

    const performance = scanResults.pages?.[0]?.performance;
    if (!performance) {
      doc.fillColor('#64748b').fontSize(11).text('No performance data available', 50, doc.y + 10);
      doc.addPage();
      return;
    }

    // Loading Performance
    doc.fillColor('#1e293b').fontSize(12).font('Helvetica-Bold')
       .text('Loading Performance:', 50, doc.y + 10);

    if (performance.loadTime) {
      doc.fillColor('#374151').fontSize(10)
         .text(`Page Load Time: ${performance.loadTime}ms`, 70, doc.y + 8);
      doc.moveDown(0.3);
    }

    if (performance.fontResources) {
      doc.fillColor('#374151').fontSize(10)
         .text(`Font Resources: ${performance.fontResources.length} files`, 70, doc.y + 5);
      doc.moveDown(0.3);

      // Font Resource Details
      performance.fontResources.slice(0, 5).forEach(resource => {
        doc.fillColor('#64748b').fontSize(9)
           .text(`• ${resource.url ? resource.url.substring(0, 60) + '...' : 'Unknown'}`, 90, doc.y + 3);
        if (resource.size) {
          doc.text(`  Size: ${resource.size} bytes`, 100, doc.y + 3);
        }
        doc.moveDown(0.2);
      });
    }

    // Performance Metrics
    if (performance.metrics) {
      doc.fillColor('#1e293b').fontSize(12).font('Helvetica-Bold')
         .text('Core Metrics:', 50, doc.y + 15);

      Object.entries(performance.metrics).forEach(([metric, value]) => {
        if (typeof value === 'number') {
          const displayName = metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          doc.fillColor('#374151').fontSize(10)
             .text(`• ${displayName}: ${value.toFixed(2)}`, 70, doc.y + 5);
          doc.moveDown(0.3);
        }
      });
    }

    doc.addPage();
  }

  async addSecurityAndCaching(doc, scanResults) {
    this.addSectionHeader(doc, 'Security & Caching Analysis');

    const bestPractices = scanResults.pages?.[0]?.bestPractices;
    
    // Security Analysis
    if (bestPractices?.categories?.security) {
      const security = bestPractices.categories.security;
      doc.fillColor('#1e293b').fontSize(12).font('Helvetica-Bold')
         .text('Security Analysis:', 50, doc.y + 10);
      
      doc.fillColor('#374151').fontSize(10)
         .text(`Security Score: ${(security.percentage || 0).toFixed(1)}%`, 70, doc.y + 8);
      
      if (security.good && security.good.length > 0) {
        doc.fillColor('#10b981').fontSize(10).font('Helvetica-Bold')
           .text('Security Strengths:', 70, doc.y + 15);
        security.good.forEach(item => {
          doc.fillColor('#374151').fontSize(9).text(`• ${item}`, 90, doc.y + 5);
          doc.moveDown(0.2);
        });
      }

      if (security.issues && security.issues.length > 0) {
        doc.fillColor('#ef4444').fontSize(10).font('Helvetica-Bold')
           .text('Security Issues:', 70, doc.y + 10);
        security.issues.forEach(issue => {
          doc.fillColor('#374151').fontSize(9).text(`• ${issue.message || issue}`, 90, doc.y + 5);
          doc.moveDown(0.2);
        });
      }
    }

    // Caching Analysis
    if (bestPractices?.categories?.caching) {
      const caching = bestPractices.categories.caching;
      doc.fillColor('#1e293b').fontSize(12).font('Helvetica-Bold')
         .text('Caching Analysis:', 50, doc.y + 15);
      
      doc.fillColor('#374151').fontSize(10)
         .text(`Caching Score: ${(caching.percentage || 0).toFixed(1)}%`, 70, doc.y + 8);
      
      if (caching.cacheableResources !== undefined) {
        doc.fillColor('#374151').fontSize(10)
           .text(`Cacheable Resources: ${caching.cacheableResources}`, 70, doc.y + 8);
        doc.moveDown(0.3);
      }
      
      if (caching.longTermCaching !== undefined) {
        doc.fillColor('#374151').fontSize(10)
           .text(`Long-term Cached: ${caching.longTermCaching}`, 70, doc.y + 5);
        doc.moveDown(0.3);
      }
    }

    doc.addPage();
  }

  async addAccessibilityDetails(doc, scanResults) {
    this.addSectionHeader(doc, 'Accessibility Analysis');

    const accessibility = scanResults.pages?.[0]?.bestPractices?.categories?.accessibility;
    if (!accessibility) {
      doc.fillColor('#64748b').fontSize(11).text('No accessibility data available', 50, doc.y + 10);
      doc.addPage();
      return;
    }

    // Accessibility Score
    doc.fillColor('#1e293b').fontSize(12).font('Helvetica-Bold')
       .text(`Accessibility Score: ${(accessibility.percentage || 0).toFixed(1)}%`, 50, doc.y + 10);

    // Font Size Analysis
    if (accessibility.minFontSize !== undefined) {
      doc.fillColor('#374151').fontSize(10)
         .text(`Minimum Font Size: ${accessibility.minFontSize}px`, 70, doc.y + 15);
      
      if (accessibility.minFontSize < 16) {
        doc.fillColor('#ef4444').fontSize(9)
           .text('⚠ Below recommended 16px minimum', 90, doc.y + 5);
      } else {
        doc.fillColor('#10b981').fontSize(9)
           .text('✓ Meets accessibility guidelines', 90, doc.y + 5);
      }
      doc.moveDown(0.5);
    }

    // Readability Issues
    if (accessibility.readabilityIssues && accessibility.readabilityIssues.length > 0) {
      doc.fillColor('#ef4444').fontSize(11).font('Helvetica-Bold')
         .text('Readability Issues:', 50, doc.y + 10);
      
      accessibility.readabilityIssues.slice(0, 5).forEach(issue => {
        doc.fillColor('#374151').fontSize(9).text(`• ${issue}`, 70, doc.y + 5);
        doc.moveDown(0.2);
      });
    }

    // Good Practices
    if (accessibility.goodPractices && accessibility.goodPractices.length > 0) {
      doc.fillColor('#10b981').fontSize(11).font('Helvetica-Bold')
         .text('Good Practices:', 50, doc.y + 10);
      
      accessibility.goodPractices.forEach(practice => {
        doc.fillColor('#374151').fontSize(9).text(`• ${practice}`, 70, doc.y + 5);
        doc.moveDown(0.2);
      });
    }

    doc.addPage();
  }

  async addMultiPageAnalysis(doc, pages) {
    this.addSectionHeader(doc, '[MULTI_PAGE_ANALYSIS]');

    doc
      .fillColor('#cccccc')
      .fontSize(11)
      .font('Helvetica')
      .text(`> analyzing ${pages.length} pages across the target domain`, 50, doc.y + 10);

    doc.moveDown();

    pages.forEach((page, index) => {
      if (doc.y > 700) {
        doc.addPage();
      }

      // Page title with terminal-style formatting
      doc
        .fillColor('#ffffff')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`[PAGE_${index + 1}] ${this.truncateUrl(page.url)}`, 50, doc.y + 10);

      // Create metrics table with dark background
      const metricsBoxY = doc.y + 5;
      doc.rect(50, metricsBoxY, 495, 80).fillColor('#1a1a1a').fill().strokeColor('#444444').stroke();

      const metrics = [
        ['font_count', page.fonts?.totalFonts || 0],
        ['load_time', `${page.performance?.initialLoadTime || 0}ms`],
        ['lcp_score', `${Math.round(page.lighthouse?.desktop?.metrics?.coreWebVitals?.lcp || 0)}ms`],
        ['cls_score', (page.lighthouse?.desktop?.metrics?.coreWebVitals?.cls || 0).toFixed(3)],
      ];

      metrics.forEach(([label, value], metricIndex) => {
        const yPos = metricsBoxY + 15 + (metricIndex * 15);
        doc.fillColor('#00ff41').fontSize(9).text('> ', 70, yPos);
        doc.fillColor('#888888').fontSize(9).text(label + ':', 85, yPos);
        doc.fillColor('#ffffff').fontSize(9).text(value.toString(), 200, yPos);
      });

      doc.y = metricsBoxY + 90;
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
    this.addSectionHeader(doc, '[RECOMMENDATIONS]');

    const recommendations = this.generateRecommendations(scanResults);

    recommendations.forEach((rec, index) => {
      if (doc.y > 650) {
        doc.addPage();
      }

      // Recommendation header with terminal styling
      doc
        .fillColor('#ffffff')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`[REC_${index + 1}] ${rec.title}`, 50, doc.y + 10);

      // Create recommendation box
      const recBoxY = doc.y + 5;
      const recBoxHeight = 60;
      doc.rect(50, recBoxY, 495, recBoxHeight).fillColor('#1a1a1a').fill().strokeColor('#444444').stroke();

      // Description
      doc
        .fillColor('#cccccc')
        .fontSize(10)
        .font('Helvetica')
        .text(rec.description, 70, recBoxY + 15, { width: 455 });

      // Impact with status indicator
      if (rec.impact) {
        doc
          .fillColor('#00ff41')
          .fontSize(9)
          .text('✓ ', 70, recBoxY + 45);
          
        doc
          .fillColor('#888888')
          .fontSize(9)
          .font('Helvetica-Oblique')
          .text(`expected_impact: ${rec.impact}`, 85, recBoxY + 45);
      }

      doc.y = recBoxY + recBoxHeight + 10;
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
    // Terminal-style section headers with brackets
    doc
      .fillColor('#0f0f14')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(title, 50, doc.y + 20);

    // Double line separator like website
    doc
      .strokeColor('#333333')
      .lineWidth(2)
      .moveTo(50, doc.y + 8)
      .lineTo(545, doc.y + 8)
      .stroke();
      
    doc
      .strokeColor('#666666')
      .lineWidth(1)
      .moveTo(50, doc.y + 12)
      .lineTo(545, doc.y + 12)
      .stroke();

    doc.moveDown(1.5);
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
    if (score >= 80) return '#00ff41'; // Bright green like website
    if (score >= 60) return '#ffd93d'; // Yellow for warnings
    return '#ff6b6b'; // Red for errors
  }

  getGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  formatCategoryName(category) {
    const categoryNames = {
      fontDisplay: 'Font Display',
      fontLoading: 'Font Loading',
      accessibility: 'Accessibility',
      performance: 'Performance',
      fontOptimization: 'Font Optimization',
      fallbacks: 'Font Fallbacks',
      security: 'Security',
      caching: 'Caching',
      sustainability: 'Sustainability',
      webVitals: 'Web Vitals Impact'
    };
    return categoryNames[category] || category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  truncateUrl(url) {
    if (url.length > 60) {
      return url.substring(0, 57) + '...';
    }
    return url;
  }
}

module.exports = new PDFReportGenerator();
