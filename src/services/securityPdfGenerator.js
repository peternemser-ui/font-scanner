const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const { resolveReportId } = require('../utils/resolveReportId');
const {
  initializePdfGeneration,
  finalizePdfGeneration,
  addPdfHeader,
  addMaterialSectionHeader,
  checkPageBreakNeeded,
  ensureFreshPage,
  heightCalculators,
  getScoreColor,
  getGrade,
  drawScoreSummaryCard,
  drawMetricGrid,
  drawCard
} = require('../utils/pdfHelpers');

const {
  COLORS,
  drawGaugeChart,
  drawBarChart,
  drawPieChart,
  drawComparisonChart,
  drawProgressBar
} = require('../utils/pdfCharts');

const logger = createLogger('SecurityPdfGenerator');

/**
 * Security PDF Report Generator - Material Design Edition
 * Creates professional, visually-rich PDF reports for Security analysis
 */
class SecurityPdfGenerator {
  constructor() {
    this.reportsDir = path.join(__dirname, '../../reports');
    this.ensureReportsDir();
  }

  ensureReportsDir() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Generate comprehensive Security PDF report with Material Design
   */
  async generateReport(securityResults) {
    // Use helper to initialize PDF generation
    const { doc, filepath, reportId, stream, filename } = initializePdfGeneration(
      securityResults,
      'security',
      { reportsDir: this.reportsDir }
    );

    try {
      // Material Design header
      addPdfHeader(
        doc,
        'Security Analysis Report',
        securityResults.url,
        'Comprehensive security and vulnerability analysis',
        { accentColor: COLORS.error } // Red accent for security
      );

      // Generate report sections with Material Design and charts
      this.addExecutiveSummary(doc, securityResults);
      this.addSSLAnalysis(doc, securityResults.ssl);
      this.addSecurityHeaders(doc, securityResults.headers);
      this.addVulnerabilities(doc, securityResults.vulnerabilities);
      this.addOWASPCompliance(doc, securityResults.owasp);
      this.addDesktopMobileComparison(doc, securityResults);
      this.addRecommendations(doc, securityResults.recommendations);

      // Use helper to finalize PDF generation
      return finalizePdfGeneration(doc, stream, filename, filepath, reportId);
    } catch (error) {
      logger.error('Error creating Security PDF:', error);
      throw error;
    }
  }

  /**
   * Executive Summary with Material Design and Charts
   */
  addExecutiveSummary(doc, results) {
    addMaterialSectionHeader(doc, 'Executive Summary', {
      description: 'Overall security posture and critical issues',
      accentColor: COLORS.error
    });

    const overallScore = results.overallScore || 0;

    // Component scores for breakdown
    const breakdown = {
      'SSL/TLS': results.ssl?.score || 0,
      'Headers': results.headers?.score || 0,
      'Vulnerabilities': results.vulnerabilities?.score || 0,
      'OWASP': results.owasp?.score || 0
    };

    // Score summary card with gauge chart
    const cardHeight = drawScoreSummaryCard(
      doc,
      overallScore,
      'Security Score',
      breakdown,
      50,
      doc.y
    );

    doc.y += cardHeight;
    doc.moveDown(1);

    // Vulnerability distribution pie chart
    if (results.vulnerabilities) {
      const vuln = results.vulnerabilities;
      const hasCritical = vuln.critical > 0;
      const hasHigh = vuln.high > 0;
      const hasMedium = vuln.medium > 0;
      const hasLow = vuln.low > 0;
      const hasVulnerabilities = hasCritical || hasHigh || hasMedium || hasLow;

      if (hasVulnerabilities) {
        checkPageBreakNeeded(doc, 280, { sectionType: 'chart' });

        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text('Vulnerability Distribution', 50, doc.y);

        doc.moveDown(0.5);

        const pieData = [];
        if (vuln.critical > 0) {
          pieData.push({
            label: 'Critical',
            value: vuln.critical,
            color: COLORS.critical
          });
        }
        if (vuln.high > 0) {
          pieData.push({
            label: 'High',
            value: vuln.high,
            color: COLORS.poor
          });
        }
        if (vuln.medium > 0) {
          pieData.push({
            label: 'Medium',
            value: vuln.medium,
            color: COLORS.warning
          });
        }
        if (vuln.low > 0) {
          pieData.push({
            label: 'Low',
            value: vuln.low,
            color: COLORS.info
          });
        }

        if (pieData.length > 0) {
          const totalVulnerabilities = pieData.reduce((sum, item) => sum + item.value, 0);

          const pieHeight = drawPieChart(
            doc,
            pieData,
            200,
            doc.y + 100,
            {
              radius: 70,
              donutWidth: 25,
              showLegend: true,
              showPercentages: true,
              centerText: totalVulnerabilities.toString(),
              centerLabel: 'Total'
            }
          );

          doc.y += pieHeight + 20;
        }
      }
    }

    // Critical issues alert card
    if (results.vulnerabilities && results.vulnerabilities.critical > 0) {
      checkPageBreakNeeded(doc, 80);

      drawCard(doc, 50, doc.y, 512, 60, {
        backgroundColor: '#FFEBEE', // Light red background
        borderColor: COLORS.error
      });

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.error)
         .text(
           `⚠️ WARNING: ${results.vulnerabilities.critical} Critical Security ${results.vulnerabilities.critical === 1 ? 'Issue' : 'Issues'} Detected`,
           70,
           doc.y + 20,
           { width: 455 }
         );

      doc.y += 70;
    }

    // Key metrics grid
    const metrics = [
      {
        label: 'SSL/TLS',
        value: `${breakdown['SSL/TLS']}/100`,
        color: getScoreColor(breakdown['SSL/TLS'])
      },
      {
        label: 'Security Headers',
        value: results.headers ? `${results.headers.implemented}/${results.headers.total}` : 'N/A',
        color: results.headers ? getScoreColor((results.headers.implemented / results.headers.total) * 100) : COLORS.textSecondary
      },
      {
        label: 'Vulnerabilities',
        value: results.vulnerabilities ?
          `${(results.vulnerabilities.critical || 0) + (results.vulnerabilities.high || 0)} High+` :
          'N/A',
        color: results.vulnerabilities && ((results.vulnerabilities.critical || 0) + (results.vulnerabilities.high || 0)) > 0 ?
          COLORS.error :
          COLORS.success
      },
      {
        label: 'Overall Grade',
        value: getGrade(overallScore),
        color: getScoreColor(overallScore)
      }
    ];

    checkPageBreakNeeded(doc, 120);

    const gridHeight = drawMetricGrid(doc, metrics, 50, doc.y, {
      columns: 4,
      spacing: 15
    });

    doc.y += gridHeight + 20;
    doc.moveDown(1);
  }

  /**
   * SSL/TLS Analysis with Progress Bar
   */
  addSSLAnalysis(doc, ssl) {
    if (!ssl) return;

    checkPageBreakNeeded(doc, 350);
    addMaterialSectionHeader(doc, 'SSL/TLS Certificate Analysis', {
      description: 'Certificate validity and encryption strength'
    });

    // SSL Information Card
    drawCard(doc, 50, doc.y, 512, 180);

    let cardY = doc.y + 20;

    // Certificate Status
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(COLORS.textPrimary)
       .text('Certificate Status:', 70, cardY);

    const statusColor = ssl.valid ? COLORS.success : COLORS.error;
    const statusText = ssl.valid ? 'Valid ✓' : 'Invalid ✗';

    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor(statusColor)
       .text(statusText, 220, cardY);

    cardY += 25;

    // Protocol
    if (ssl.protocol) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('Protocol:', 70, cardY);

      doc.font('Helvetica')
         .fillColor(COLORS.textSecondary)
         .text(ssl.protocol, 220, cardY);

      cardY += 20;
    }

    // Issuer
    if (ssl.issuer) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('Issuer:', 70, cardY);

      doc.font('Helvetica')
         .fillColor(COLORS.textSecondary)
         .text(ssl.issuer.substring(0, 50) + (ssl.issuer.length > 50 ? '...' : ''), 220, cardY);

      cardY += 20;
    }

    // Valid Period
    if (ssl.validFrom && ssl.validTo) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('Valid Period:', 70, cardY);

      doc.font('Helvetica')
         .fontSize(9)
         .fillColor(COLORS.textSecondary)
         .text(`${ssl.validFrom} to ${ssl.validTo}`, 220, cardY, { width: 300 });

      cardY += 25;
    }

    // Days Until Expiry with color indicator
    if (ssl.daysUntilExpiry !== undefined) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('Days Until Expiry:', 70, cardY);

      const expiryColor = ssl.daysUntilExpiry < 30 ? COLORS.error :
                         ssl.daysUntilExpiry < 90 ? COLORS.warning :
                         COLORS.success;

      doc.font('Helvetica-Bold')
         .fillColor(expiryColor)
         .text(`${ssl.daysUntilExpiry} days`, 220, cardY);

      cardY += 20;
    }

    // Certificate Chain
    if (ssl.chain && ssl.chain.length > 0) {
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('Certificate Chain:', 70, cardY);

      doc.font('Helvetica')
         .fillColor(COLORS.textSecondary)
         .text(`${ssl.chain.length} certificates`, 220, cardY);
    }

    doc.y += 200;

    // SSL Strength Progress Bar
    if (ssl.score !== undefined) {
      checkPageBreakNeeded(doc, 80);

      const progressHeight = drawProgressBar(
        doc,
        ssl.score,
        'SSL/TLS Strength',
        50,
        doc.y,
        {
          width: 512,
          height: 30,
          showPercentage: true,
          color: getScoreColor(ssl.score)
        }
      );

      doc.y += progressHeight + 10;
    }

    // SSL Issues
    if (ssl.issues && ssl.issues.length > 0) {
      checkPageBreakNeeded(doc, 100 + ssl.issues.length * 20);

      doc.moveDown(0.5);

      drawCard(doc, 50, doc.y, 512, 60 + ssl.issues.length * 15, {
        backgroundColor: '#FFF3E0', // Light orange
        borderColor: COLORS.warning
      });

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.warning)
         .text('⚠️ SSL/TLS Issues:', 70, doc.y + 15);

      let issueY = doc.y + 40;

      ssl.issues.forEach(issue => {
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor(COLORS.textSecondary)
           .text(`• ${issue}`, 80, issueY, { width: 445 });

        issueY += 15;
      });

      doc.y += 70 + ssl.issues.length * 15;
    }

    doc.moveDown(1);
  }

  /**
   * Security Headers with Progress Bar and Checklist
   */
  addSecurityHeaders(doc, headers) {
    if (!headers) return;

    checkPageBreakNeeded(doc, 400);
    addMaterialSectionHeader(doc, 'Security Headers Analysis', {
      description: 'HTTP security header implementation status'
    });

    // Implementation progress bar
    const implementationPercentage = (headers.implemented / headers.total) * 100;

    const progressHeight = drawProgressBar(
      doc,
      implementationPercentage,
      `Security Headers: ${headers.implemented}/${headers.total} implemented`,
      50,
      doc.y,
      {
        width: 512,
        height: 35,
        showPercentage: true,
        color: getScoreColor(implementationPercentage)
      }
    );

    doc.y += progressHeight + 20;

    // Comparison chart: Implemented vs Missing
    checkPageBreakNeeded(doc, 150);

    const comparisonData = [
      {
        label: 'Headers Status',
        value1: headers.implemented,
        value2: headers.total - headers.implemented
      }
    ];

    const comparisonHeight = drawComparisonChart(
      doc,
      comparisonData,
      50,
      doc.y,
      {
        width: 512,
        height: 80,
        labels: ['Implemented', 'Missing'],
        colors: [COLORS.success, COLORS.error]
      }
    );

    doc.y += comparisonHeight + 30;

    // Detailed header checklist
    checkPageBreakNeeded(doc, 150);

    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(COLORS.textPrimary)
       .text('Header Details', 50, doc.y);

    doc.moveDown(0.5);

    const headerDetails = [
      { name: 'Strict-Transport-Security', key: 'strictTransportSecurity', description: 'Enforces HTTPS connections' },
      { name: 'Content-Security-Policy', key: 'contentSecurityPolicy', description: 'Prevents XSS attacks' },
      { name: 'X-Frame-Options', key: 'xFrameOptions', description: 'Prevents clickjacking' },
      { name: 'X-Content-Type-Options', key: 'xContentTypeOptions', description: 'Prevents MIME sniffing' },
      { name: 'X-XSS-Protection', key: 'xXSSProtection', description: 'Enables XSS filter' },
      { name: 'Referrer-Policy', key: 'referrerPolicy', description: 'Controls referrer info' },
      { name: 'Permissions-Policy', key: 'permissionsPolicy', description: 'Controls browser features' },
      { name: 'Cross-Origin-Embedder-Policy', key: 'crossOriginEmbedderPolicy', description: 'Isolates resources' },
      { name: 'Cross-Origin-Opener-Policy', key: 'crossOriginOpenerPolicy', description: 'Isolates context' },
      { name: 'Cross-Origin-Resource-Policy', key: 'crossOriginResourcePolicy', description: 'Controls loading' }
    ];

    headerDetails.forEach(header => {
      checkPageBreakNeeded(doc, 65);

      const status = headers.details && headers.details[header.key];
      const implemented = status && status.implemented;
      const statusColor = implemented ? COLORS.success : COLORS.error;
      const statusIcon = implemented ? '✓' : '✗';

      // Status badge
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(statusColor)
         .text(statusIcon, 60, doc.y);

      // Header name
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text(header.name, 80, doc.y - 1);

      // Description
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor(COLORS.textSecondary)
         .text(header.description, 80, doc.y + 3);

      // Value (if implemented)
      if (implemented && status.value) {
        const displayValue = status.value.substring(0, 60) + (status.value.length > 60 ? '...' : '');
        doc.fontSize(8)
           .fillColor(COLORS.textDisabled)
           .text(`Value: ${displayValue}`, 80, doc.y + 3);
      }

      doc.moveDown(0.8);
    });

    doc.moveDown(1);
  }

  /**
   * Vulnerabilities with Donut Chart
   */
  addVulnerabilities(doc, vulnerabilities) {
    if (!vulnerabilities) return;

    checkPageBreakNeeded(doc, 350);
    addMaterialSectionHeader(doc, 'Vulnerability Assessment', {
      description: 'Identified security vulnerabilities by severity',
      accentColor: COLORS.error
    });

    // Vulnerability donut chart
    const hasCritical = vulnerabilities.critical > 0;
    const hasHigh = vulnerabilities.high > 0;
    const hasMedium = vulnerabilities.medium > 0;
    const hasLow = vulnerabilities.low > 0;
    const hasVulnerabilities = hasCritical || hasHigh || hasMedium || hasLow;

    if (hasVulnerabilities) {
      const pieData = [];
      if (vulnerabilities.critical > 0) {
        pieData.push({
          label: 'Critical',
          value: vulnerabilities.critical,
          color: COLORS.critical
        });
      }
      if (vulnerabilities.high > 0) {
        pieData.push({
          label: 'High',
          value: vulnerabilities.high,
          color: COLORS.poor
        });
      }
      if (vulnerabilities.medium > 0) {
        pieData.push({
          label: 'Medium',
          value: vulnerabilities.medium,
          color: COLORS.warning
        });
      }
      if (vulnerabilities.low > 0) {
        pieData.push({
          label: 'Low',
          value: vulnerabilities.low,
          color: COLORS.info
        });
      }

      const totalVulnerabilities = pieData.reduce((sum, item) => sum + item.value, 0);

      const pieHeight = drawPieChart(
        doc,
        pieData,
        200,
        doc.y + 100,
        {
          radius: 70,
          donutWidth: 25,
          showLegend: true,
          showPercentages: true,
          centerText: totalVulnerabilities.toString(),
          centerLabel: 'Total'
        }
      );

      doc.y += pieHeight + 30;
    } else {
      // No vulnerabilities found
      drawCard(doc, 50, doc.y, 512, 60, {
        backgroundColor: '#E8F5E9', // Light green
        borderColor: COLORS.success
      });

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.success)
         .text('✓ No vulnerabilities detected', 70, doc.y + 20);

      doc.y += 70;
    }

    // Detailed Vulnerabilities (Critical and High only)
    if (vulnerabilities.details && vulnerabilities.details.length > 0) {
      const criticalAndHigh = vulnerabilities.details
        .filter(v => v.severity === 'critical' || v.severity === 'high')
        .slice(0, 10);

      if (criticalAndHigh.length > 0) {
        checkPageBreakNeeded(doc, 150);

        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text('Critical & High Severity Issues', 50, doc.y);

        doc.moveDown(0.5);

        criticalAndHigh.forEach((vuln, index) => {
          checkPageBreakNeeded(doc, 120);

          const severityColor = this.getSeverityColor(vuln.severity);

          // Vulnerability card
          drawCard(doc, 50, doc.y, 512, 90, {
            backgroundColor: vuln.severity === 'critical' ? '#FFEBEE' : '#FFF3E0',
            borderColor: severityColor
          });

          // Severity badge
          doc.fontSize(9)
             .font('Helvetica-Bold')
             .fillColor(severityColor)
             .text(`[${(vuln.severity || 'unknown').toUpperCase()}]`, 70, doc.y + 15);

          // Title
          doc.fontSize(10)
             .font('Helvetica-Bold')
             .fillColor(COLORS.textPrimary)
             .text(vuln.title || vuln.description || 'Unknown vulnerability', 150, doc.y - 1, { width: 365 });

          // Description
          if (vuln.description && vuln.title) {
            doc.fontSize(9)
               .font('Helvetica')
               .fillColor(COLORS.textSecondary)
               .text(vuln.description.substring(0, 100) + (vuln.description.length > 100 ? '...' : ''), 70, doc.y + 8, { width: 445 });
          }

          // CVE
          if (vuln.cve) {
            doc.fontSize(8)
               .fillColor(COLORS.textDisabled)
               .text(`CVE: ${vuln.cve}`, 70, doc.y + 3);
          }

          // Solution
          if (vuln.solution) {
            doc.fontSize(8)
               .fillColor(COLORS.info)
               .text(`Solution: ${vuln.solution.substring(0, 80)}${vuln.solution.length > 80 ? '...' : ''}`, 70, doc.y + 3, { width: 445 });
          }

          doc.y += 100;
        });

        if (vulnerabilities.details.length > 10) {
          doc.fontSize(9)
             .fillColor(COLORS.textSecondary)
             .text(`... and ${vulnerabilities.details.length - 10} more vulnerabilities`, 50, doc.y);

          doc.moveDown(1);
        }
      }
    }

    doc.moveDown(1);
  }

  /**
   * OWASP Compliance with Bar Chart
   */
  addOWASPCompliance(doc, owasp) {
    if (!owasp) return;

    checkPageBreakNeeded(doc, 450, { sectionType: 'chart' });
    addMaterialSectionHeader(doc, 'OWASP Top 10 Compliance', {
      description: 'Assessment against OWASP Top 10 security risks'
    });

    const owaspTop10 = [
      { id: 'A01', name: 'Broken Access Control', status: owasp.a01 },
      { id: 'A02', name: 'Cryptographic Failures', status: owasp.a02 },
      { id: 'A03', name: 'Injection', status: owasp.a03 },
      { id: 'A04', name: 'Insecure Design', status: owasp.a04 },
      { id: 'A05', name: 'Security Misconfiguration', status: owasp.a05 },
      { id: 'A06', name: 'Vulnerable Components', status: owasp.a06 },
      { id: 'A07', name: 'Authentication Failures', status: owasp.a07 },
      { id: 'A08', name: 'Data Integrity Failures', status: owasp.a08 },
      { id: 'A09', name: 'Logging Failures', status: owasp.a09 },
      { id: 'A10', name: 'Server-Side Request Forgery', status: owasp.a10 }
    ];

    // Calculate pass rate
    const passCount = owaspTop10.filter(item => item.status === 'pass').length;
    const passRate = (passCount / owaspTop10.length) * 100;

    // Pass rate card
    drawCard(doc, 50, doc.y, 512, 60);

    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(COLORS.textPrimary)
       .text('OWASP Compliance Rate', 70, doc.y + 15);

    const rateColor = getScoreColor(passRate);
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor(rateColor)
       .text(`${Math.round(passRate)}%`, 350, doc.y - 8);

    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(COLORS.textSecondary)
       .text(`${passCount}/${owaspTop10.length} checks passed`, 350, doc.y + 2);

    doc.y += 70;
    doc.moveDown(0.5);

    // Bar chart for OWASP items
    checkPageBreakNeeded(doc, 350);

    const chartData = owaspTop10.map(item => ({
      label: `${item.id}: ${item.name.substring(0, 25)}${item.name.length > 25 ? '...' : ''}`,
      value: item.status === 'pass' ? 100 : item.status === 'fail' ? 0 : 50,
      color: item.status === 'pass' ? COLORS.success :
             item.status === 'fail' ? COLORS.error :
             COLORS.warning
    }));

    const chartHeight = drawBarChart(
      doc,
      chartData,
      50,
      doc.y,
      {
        width: 512,
        barHeight: 22,
        showValues: false,
        colorScheme: 'custom', // Use custom colors from data
        maxValue: 100
      }
    );

    doc.y += chartHeight + 10;
    doc.moveDown(1);
  }

  /**
   * Desktop vs Mobile Comparison with Charts
   */
  addDesktopMobileComparison(doc, results) {
    if (!results.desktop || !results.mobile) {
      return;
    }

    // Gauge charts + comparison chart need significant space (~450px)
    // If we're past halfway down the page, start fresh
    if (doc.y > 350) {
      doc.addPage();
    }
    addMaterialSectionHeader(doc, 'Desktop vs Mobile Security', {
      description: 'Comparison of security metrics across device types'
    });

    // Dual gauge charts
    const desktopScore = results.desktop.overallScore || 0;
    const mobileScore = results.mobile.overallScore || 0;

    // Desktop gauge
    drawGaugeChart(doc, desktopScore, 'Desktop', 150, doc.y + 80, {
      radius: 60,
      width: 12,
      showValue: true,
      showLabel: true
    });

    // Mobile gauge
    drawGaugeChart(doc, mobileScore, 'Mobile', 400, doc.y - 80, {
      radius: 60,
      width: 12,
      showValue: true,
      showLabel: true
    });

    doc.y += 100;
    doc.moveDown(1);

    // Comparison chart for detailed metrics
    const metrics = [
      {
        label: 'Overall Score',
        value1: desktopScore,
        value2: mobileScore
      },
      {
        label: 'SSL/TLS Score',
        value1: results.desktop.ssl?.score || 0,
        value2: results.mobile.ssl?.score || 0
      },
      {
        label: 'Headers Score',
        value1: results.desktop.headers?.score || 0,
        value2: results.mobile.headers?.score || 0
      },
      {
        label: 'Vulnerability Score',
        value1: results.desktop.vulnerabilities?.score || 0,
        value2: results.mobile.vulnerabilities?.score || 0
      }
    ];

    checkPageBreakNeeded(doc, 200);

    const comparisonHeight = drawComparisonChart(
      doc,
      metrics,
      50,
      doc.y,
      {
        width: 512,
        height: 180,
        labels: ['Desktop', 'Mobile'],
        colors: [COLORS.primary, COLORS.secondary]
      }
    );

    doc.y += comparisonHeight + 10;

    // Critical issues comparison
    const desktopCritical = results.desktop.vulnerabilities?.critical || 0;
    const mobileCritical = results.mobile.vulnerabilities?.critical || 0;

    if (desktopCritical > 0 || mobileCritical > 0) {
      doc.moveDown(0.5);

      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textPrimary)
         .text('Critical Issues:', 50, doc.y);

      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(COLORS.error)
         .text(`Desktop: ${desktopCritical} | Mobile: ${mobileCritical}`, 160, doc.y - 1);
    }

    doc.moveDown(1);
  }

  /**
   * Recommendations with Priority Cards - Full content with fixes
   */
  addRecommendations(doc, recommendations) {
    if (!recommendations || recommendations.length === 0) {
      return;
    }

    // Start recommendations on new page for clean layout
    doc.addPage();
    addMaterialSectionHeader(doc, 'Security Recommendations', {
      description: 'Prioritized actions to improve security posture'
    });

    // Group by priority - show all recommendations
    const critical = recommendations.filter(r => r.priority === 'critical');
    const high = recommendations.filter(r => r.priority === 'high');
    const medium = recommendations.filter(r => r.priority === 'medium');
    const low = recommendations.filter(r => r.priority === 'low');

    // Critical Priority
    if (critical.length > 0) {
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.critical)
         .text('🔴 Critical - Fix Immediately', 50, doc.y);

      doc.moveDown(0.5);

      critical.forEach((rec, index) => {
        // Calculate card height based on content
        const descLines = Math.ceil((rec.description || '').length / 60);
        const solutionLines = rec.solution ? Math.ceil(rec.solution.length / 60) : 0;
        const cardHeight = 55 + (descLines * 12) + (solutionLines * 12) + (rec.owaspRef ? 15 : 0) + (rec.fix ? 25 : 0);
        
        checkPageBreakNeeded(doc, cardHeight + 20);

        drawCard(doc, 50, doc.y, 512, cardHeight, {
          backgroundColor: '#FFEBEE',
          borderColor: COLORS.critical
        });

        const cardStartY = doc.y;

        // Priority badge
        doc.fontSize(8)
           .font('Helvetica-Bold')
           .fillColor(COLORS.critical)
           .text('CRITICAL', 70, cardStartY + 12);

        // Title
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text(`${index + 1}. ${rec.title}`, 140, cardStartY + 10, { width: 375 });

        let currentY = cardStartY + 28;

        // Full Description
        if (rec.description) {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(rec.description, 70, currentY, { width: 445 });
          currentY = doc.y + 6;
        }

        // Full Solution
        if (rec.solution) {
          doc.fontSize(8)
             .font('Helvetica-Bold')
             .fillColor(COLORS.info)
             .text('Solution:', 70, currentY);
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor(COLORS.info)
             .text(rec.solution, 120, currentY, { width: 395 });
          currentY = doc.y + 6;
        }

        // Fix/How to fix
        if (rec.fix) {
          doc.fontSize(8)
             .font('Helvetica-Bold')
             .fillColor(COLORS.success)
             .text('How to Fix:', 70, currentY);
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor(COLORS.success)
             .text(rec.fix, 130, currentY, { width: 385 });
          currentY = doc.y + 6;
        }

        // OWASP Reference
        if (rec.owaspRef) {
          doc.fontSize(8)
             .fillColor(COLORS.textDisabled)
             .text(`OWASP: ${rec.owaspRef}`, 70, currentY);
        }

        doc.y = cardStartY + cardHeight + 10;
      });

      doc.moveDown(1);
    }

    // High Priority
    if (high.length > 0) {
      checkPageBreakNeeded(doc, 120);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.poor)
         .text('🟠 High Priority', 50, doc.y);

      doc.moveDown(0.5);

      high.forEach((rec, index) => {
        const descLines = Math.ceil((rec.description || '').length / 60);
        const solutionLines = rec.solution ? Math.ceil(rec.solution.length / 60) : 0;
        const cardHeight = 50 + (descLines * 12) + (solutionLines * 12) + (rec.fix ? 25 : 0);

        checkPageBreakNeeded(doc, cardHeight + 15);

        drawCard(doc, 50, doc.y, 512, cardHeight, {
          backgroundColor: '#FFF3E0',
          borderColor: COLORS.warning
        });

        const cardStartY = doc.y;

        doc.fontSize(8)
           .font('Helvetica-Bold')
           .fillColor(COLORS.poor)
           .text('HIGH', 70, cardStartY + 10);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text(`${index + 1}. ${rec.title}`, 120, cardStartY + 8, { width: 395 });

        let currentY = cardStartY + 25;

        if (rec.description) {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(rec.description, 70, currentY, { width: 445 });
          currentY = doc.y + 5;
        }

        if (rec.solution) {
          doc.fontSize(8)
             .fillColor(COLORS.info)
             .text(`Solution: ${rec.solution}`, 70, currentY, { width: 445 });
          currentY = doc.y + 5;
        }

        if (rec.fix) {
          doc.fontSize(8)
             .font('Helvetica-Bold')
             .fillColor(COLORS.success)
             .text('Fix:', 70, currentY);
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor(COLORS.success)
             .text(rec.fix, 95, currentY, { width: 420 });
        }

        doc.y = cardStartY + cardHeight + 8;
      });

      doc.moveDown(1);
    }

    // Medium Priority - Show details instead of just summary
    if (medium.length > 0) {
      checkPageBreakNeeded(doc, 120);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.info)
         .text('🟡 Medium Priority', 50, doc.y);

      doc.moveDown(0.5);

      medium.forEach((rec, index) => {
        const descLines = Math.ceil((rec.description || '').length / 70);
        const neededSpace = 40 + (descLines * 12) + (rec.solution ? 20 : 0);
        
        checkPageBreakNeeded(doc, neededSpace);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(COLORS.textPrimary)
           .text(`${index + 1}. ${rec.title}`, 70, doc.y);

        if (rec.description) {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor(COLORS.textSecondary)
             .text(rec.description, 80, doc.y + 3, { width: 445 });
        }

        if (rec.solution) {
          doc.fontSize(8)
             .fillColor(COLORS.info)
             .text(`→ ${rec.solution}`, 85, doc.y + 3, { width: 440 });
        }

        doc.moveDown(1);
      });
    }

    // Low Priority
    if (low.length > 0) {
      checkPageBreakNeeded(doc, 80);

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor(COLORS.textSecondary)
         .text('🔵 Low Priority', 50, doc.y);

      doc.moveDown(0.5);

      low.forEach((rec, index) => {
        checkPageBreakNeeded(doc, 30);
        
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor(COLORS.textSecondary)
           .text(`${index + 1}. ${rec.title}`, 70, doc.y, { width: 475 });

        doc.moveDown(0.5);
      });
    }
  }

  /**
   * Get severity color (Security-specific helper)
   */
  getSeverityColor(severity) {
    const sev = (severity || '').toLowerCase();
    if (sev === 'critical') return COLORS.critical;
    if (sev === 'high') return COLORS.poor;
    if (sev === 'medium') return COLORS.warning;
    if (sev === 'low') return COLORS.info;
    return COLORS.textDisabled;
  }
}

// Export singleton
module.exports = new SecurityPdfGenerator();
