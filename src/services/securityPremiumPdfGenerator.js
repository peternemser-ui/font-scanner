/**
 * Security Premium PDF Report Generator
 *
 * Creates a high-value, professionally designed Security report worth $10+
 * Extends the PremiumPdfReport base class with security-specific content:
 * - Executive Summary with security posture assessment
 * - Industry security benchmarks comparison
 * - Prioritized security action roadmap
 * - Detailed analysis sections with risk explanations
 *
 * @module services/securityPremiumPdfGenerator
 */

const { PremiumPdfReport, PREMIUM } = require('../utils/premiumPdfTemplate');
const {
  drawGaugeChart,
  drawBarChart,
  drawPieChart,
  drawProgressBar,
  drawComparisonChart,
  getScoreColor,
  COLORS
} = require('../utils/pdfCharts');
const { createLogger } = require('../utils/logger');
const { checkPageBreakNeeded, drawCard } = require('../utils/pdfHelpers');

const logger = createLogger('SecurityPremiumPdfGenerator');

// Security-specific benchmarks
const SECURITY_BENCHMARKS = {
  industryAverage: 58,
  topPerformers: 92,
  competitorsAverage: 64,
  // Component benchmarks
  ssl: { average: 75, top: 98 },
  headers: { average: 45, top: 85 },
  vulnerabilities: { average: 60, top: 95 },
  owasp: { average: 55, top: 90 }
};

// Security business impact templates
const SECURITY_BUSINESS_IMPACT = {
  excellent: {
    summary: 'Your security posture is excellent. You have robust protections against common attacks and vulnerabilities, significantly reducing breach risk.',
    metrics: [
      'Strong security reduces breach probability by 70%+',
      'Customer trust increases with visible security measures',
      'Compliance requirements are likely being met'
    ]
  },
  good: {
    summary: 'Your security is above average but has gaps. Addressing these could prevent potential breaches and improve customer confidence.',
    metrics: [
      'Each security header prevents specific attack vectors',
      'SSL/TLS protects data in transit from interception',
      'Regular security audits maintain your defense posture'
    ]
  },
  fair: {
    summary: 'Your security has notable vulnerabilities. Without action, you face increased risk of data breaches, attacks, and compliance issues.',
    metrics: [
      'Missing security headers expose you to XSS, clickjacking',
      'Weak SSL can allow man-in-the-middle attacks',
      'Compliance violations could result in fines'
    ]
  },
  poor: {
    summary: 'Critical security issues put your site at immediate risk. Attackers actively exploit these vulnerabilities. Immediate action is essential.',
    metrics: [
      'High risk of successful cyber attacks',
      'Customer data may be exposed to theft',
      'Regulatory fines and legal liability possible'
    ]
  }
};

/**
 * Security Premium PDF Generator
 * Extends PremiumPdfReport with security-specific content and insights
 */
class SecurityPremiumPdfGenerator extends PremiumPdfReport {
  constructor() {
    super({
      reportType: 'Security',
      reportTitle: 'Security Analysis Report',
      reportSubtitle: 'Comprehensive Security Assessment',
      accentColor: '#C62828' // Material Red for Security
    });
  }

  /**
   * Generate the complete Security premium report
   */
  async generateReport(securityResults) {
    try {
      this.initializeDocument(securityResults);

      // Page 1: Cover
      this.addCoverPage(securityResults);

      // Page 2: Executive Summary
      this.addExecutiveSummary(securityResults, {
        componentScores: this._extractComponentScores(securityResults),
        keyFindings: this._extractKeyFindings(securityResults),
        businessImpact: this._getBusinessImpact(securityResults.overallScore || 0)
      });

      // Page 3: Industry Benchmarks
      this.addBenchmarkComparison(securityResults, SECURITY_BENCHMARKS);

      // Page 4: Threat Landscape Overview
      this.addThreatLandscape(securityResults);

      // Page 5+: Action Roadmap
      this.addActionRoadmap(this._enhanceRecommendations(securityResults.recommendations || []));

      // Detailed Analysis Sections
      this.addSSLSection(securityResults.ssl);
      this.addSecurityHeadersSection(securityResults.headers);
      this.addVulnerabilitiesSection(securityResults.vulnerabilities);
      this.addOWASPSection(securityResults.owasp);

      // Final page: Security Checklist & Next Steps
      this.addSecurityChecklist(securityResults);

      return await this.finalize();
    } catch (error) {
      logger.error('Error generating Security premium PDF:', error);
      throw error;
    }
  }

  /**
   * Override: Extract key stats for cover page
   */
  _extractKeyStats(data) {
    const vulnCount = (data.vulnerabilities?.critical || 0) +
                      (data.vulnerabilities?.high || 0);
    const headersImplemented = data.headers?.implemented || 0;
    const headersTotal = data.headers?.total || 10;

    return [
      {
        label: 'Security Score',
        value: data.overallScore || 0,
        color: getScoreColor(data.overallScore || 0)
      },
      {
        label: 'Critical Issues',
        value: vulnCount,
        color: vulnCount > 0 ? PREMIUM.COLORS.critical : PREMIUM.COLORS.excellent
      },
      {
        label: 'Headers',
        value: `${headersImplemented}/${headersTotal}`,
        color: getScoreColor((headersImplemented / headersTotal) * 100)
      }
    ];
  }

  /**
   * Extract component scores for executive summary
   */
  _extractComponentScores(data) {
    return {
      'SSL/TLS': data.ssl?.score || 0,
      'Security Headers': data.headers?.score || 0,
      'Vulnerabilities': data.vulnerabilities?.score || 0,
      'OWASP Compliance': data.owasp?.score || 0
    };
  }

  /**
   * Extract top issues as key findings
   */
  _extractKeyFindings(data) {
    const findings = [];

    // Check for critical vulnerabilities first
    if (data.vulnerabilities?.critical > 0) {
      findings.push({
        title: `${data.vulnerabilities.critical} Critical Vulnerabilities Found`,
        description: 'Critical security vulnerabilities require immediate attention to prevent exploitation.',
        priority: 'high'
      });
    }

    // Check SSL issues
    if (data.ssl && !data.ssl.valid) {
      findings.push({
        title: 'Invalid or Expired SSL Certificate',
        description: 'Your SSL certificate is not valid, putting all data transmission at risk.',
        priority: 'high'
      });
    } else if (data.ssl?.daysUntilExpiry < 30) {
      findings.push({
        title: `SSL Certificate Expiring in ${data.ssl.daysUntilExpiry} Days`,
        description: 'Your certificate will expire soon. Plan renewal to avoid service interruption.',
        priority: 'medium'
      });
    }

    // Check security headers
    if (data.headers) {
      const missingCritical = [];
      if (!data.headers.details?.strictTransportSecurity?.implemented) {
        missingCritical.push('HSTS');
      }
      if (!data.headers.details?.contentSecurityPolicy?.implemented) {
        missingCritical.push('CSP');
      }

      if (missingCritical.length > 0) {
        findings.push({
          title: `Missing Critical Headers: ${missingCritical.join(', ')}`,
          description: 'These headers provide essential protection against common attacks.',
          priority: 'high'
        });
      }
    }

    // Add from recommendations
    const recs = data.recommendations || [];
    const highPriority = recs.filter(r => r.priority === 'high' || r.priority === 'critical');
    highPriority.slice(0, 2).forEach(rec => {
      if (findings.length < 5) {
        findings.push({
          title: rec.title || rec.message,
          description: rec.description,
          priority: 'high'
        });
      }
    });

    return findings;
  }

  /**
   * Get business impact based on score
   */
  _getBusinessImpact(score) {
    if (score >= 85) return SECURITY_BUSINESS_IMPACT.excellent;
    if (score >= 70) return SECURITY_BUSINESS_IMPACT.good;
    if (score >= 50) return SECURITY_BUSINESS_IMPACT.fair;
    return SECURITY_BUSINESS_IMPACT.poor;
  }

  /**
   * Enhance recommendations with effort/impact ratings
   */
  _enhanceRecommendations(recommendations) {
    return recommendations.map(rec => {
      let effort = 'medium';
      let impact = 'high'; // Security issues generally have high impact

      const title = (rec.title || rec.message || '').toLowerCase();

      // Easy fixes
      if (title.includes('header') ||
          title.includes('hsts') ||
          title.includes('x-frame') ||
          title.includes('x-content-type')) {
        effort = 'easy';
      }

      // Hard fixes
      if (title.includes('architecture') ||
          title.includes('redesign') ||
          title.includes('csp') ||
          title.includes('encryption')) {
        effort = 'hard';
      }

      // Critical impact
      if (rec.priority === 'critical' ||
          title.includes('critical') ||
          title.includes('ssl') ||
          title.includes('injection')) {
        impact = 'high';
      }

      return {
        ...rec,
        effort,
        impact,
        fix: rec.fix || rec.solution || this._generateSecurityFix(rec)
      };
    });
  }

  /**
   * Generate a fix suggestion if none provided
   */
  _generateSecurityFix(rec) {
    const title = (rec.title || rec.message || '').toLowerCase();

    if (title.includes('hsts') || title.includes('strict-transport')) {
      return 'Add header: Strict-Transport-Security: max-age=31536000; includeSubDomains';
    }
    if (title.includes('csp') || title.includes('content-security')) {
      return 'Implement Content-Security-Policy header with appropriate directives for your site.';
    }
    if (title.includes('x-frame')) {
      return 'Add header: X-Frame-Options: DENY (or SAMEORIGIN if framing is needed)';
    }
    if (title.includes('x-content-type')) {
      return 'Add header: X-Content-Type-Options: nosniff';
    }
    if (title.includes('ssl') || title.includes('certificate')) {
      return 'Renew your SSL certificate and ensure it\'s properly installed.';
    }
    if (title.includes('xss')) {
      return 'Sanitize all user inputs and implement proper output encoding.';
    }

    return 'Address this security issue following industry best practices and OWASP guidelines.';
  }

  /**
   * Add Threat Landscape page
   */
  addThreatLandscape(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Threat Landscape', {
      subtitle: 'Understanding your attack surface'
    });

    const doc = this.doc;

    // Vulnerability distribution pie chart
    const vuln = data.vulnerabilities || {};
    const hasCritical = vuln.critical > 0;
    const hasHigh = vuln.high > 0;
    const hasMedium = vuln.medium > 0;
    const hasLow = vuln.low > 0;
    const hasVulnerabilities = hasCritical || hasHigh || hasMedium || hasLow;

    if (hasVulnerabilities) {
      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text('Vulnerability Distribution', 50, doc.y);

      doc.moveDown(1);

      const pieData = [];
      if (vuln.critical > 0) {
        pieData.push({ label: 'Critical', value: vuln.critical, color: COLORS.critical });
      }
      if (vuln.high > 0) {
        pieData.push({ label: 'High', value: vuln.high, color: COLORS.poor });
      }
      if (vuln.medium > 0) {
        pieData.push({ label: 'Medium', value: vuln.medium, color: COLORS.warning });
      }
      if (vuln.low > 0) {
        pieData.push({ label: 'Low', value: vuln.low, color: COLORS.info });
      }

      const total = pieData.reduce((sum, item) => sum + item.value, 0);

      const pieHeight = drawPieChart(doc, pieData, 180, doc.y + 80, {
        radius: 60,
        donutWidth: 20,
        showLegend: true,
        showPercentages: true,
        centerText: total.toString(),
        centerLabel: 'Total'
      });

      doc.y += pieHeight + 20;
    } else {
      // No vulnerabilities - show success message
      this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 80, {
        backgroundColor: '#F5F5F5',
        borderColor: PREMIUM.COLORS.excellent
      });

      doc.fontSize(PREMIUM.SIZES.sectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.excellent)
         .text('No vulnerabilities detected', 70, doc.y + 30);

      doc.y += 100;
    }

    // Attack surface summary
    doc.moveDown(1);

    this._addPlainEnglishBox(
      'What Attackers Are Looking For',
      this._getThreatExplanation(data)
    );

    // Risk level indicator
    doc.moveDown(1);

    const riskLevel = this._calculateRiskLevel(data);

    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 80, {
      backgroundColor: riskLevel.bg,
      borderColor: riskLevel.color
    });

    const riskY = doc.y;

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(riskLevel.color)
       .text(`Overall Risk Level: ${riskLevel.level}`, 70, riskY + 20);

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(riskLevel.description, 70, riskY + 45, { width: 470 });

    this._addPageNumber();
  }

  /**
   * Add detailed SSL/TLS section
   */
  addSSLSection(ssl) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('SSL/TLS Security', {
      subtitle: 'Certificate and encryption analysis'
    });

    const doc = this.doc;

    if (!ssl) {
      this._addPlainEnglishBox(
        'No SSL Data',
        'SSL/TLS information could not be retrieved. This may indicate the site does not use HTTPS.'
      );
      this._addPageNumber();
      return;
    }

    // SSL Status card
    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 150, {
      backgroundColor: ssl.valid ? '#F5F5F5' : '#FFEBEE',
      borderColor: ssl.valid ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical
    });

    const cardY = doc.y;

    // Certificate status
    doc.fontSize(PREMIUM.SIZES.sectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(ssl.valid ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical)
       .text(ssl.valid ? 'Valid Certificate' : 'Invalid Certificate', 70, cardY + 20);

    // Score gauge
    drawGaugeChart(doc, ssl.score || 0, '', 490, cardY + 75, {
      radius: 45,
      width: 8,
      showValue: true,
      showLabel: false
    });

    // Details
    let detailY = cardY + 50;

    if (ssl.protocol) {
      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text('Protocol:', 70, detailY);
      doc.font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(ssl.protocol, 160, detailY);
      detailY += 18;
    }

    if (ssl.issuer) {
      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text('Issuer:', 70, detailY);
      doc.font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(ssl.issuer.substring(0, 40) + (ssl.issuer.length > 40 ? '...' : ''), 160, detailY, { width: 280 });
      detailY += 18;
    }

    if (ssl.daysUntilExpiry !== undefined) {
      const expiryColor = ssl.daysUntilExpiry < 30 ? PREMIUM.COLORS.critical :
                          ssl.daysUntilExpiry < 90 ? PREMIUM.COLORS.fair :
                          PREMIUM.COLORS.excellent;

      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text('Expires In:', 70, detailY);
      doc.font(PREMIUM.FONTS.heading)
         .fillColor(expiryColor)
         .text(`${ssl.daysUntilExpiry} days`, 160, detailY);
    }

    doc.y = cardY + 170;

    // SSL Issues
    if (ssl.issues && ssl.issues.length > 0) {
      doc.moveDown(0.5);

      doc.fontSize(PREMIUM.SIZES.subsectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.priorityMedium)
         .text('SSL/TLS Issues Found', 50, doc.y);

      doc.moveDown(0.5);

      ssl.issues.forEach(issue => {
        doc.fontSize(PREMIUM.SIZES.body)
           .font(PREMIUM.FONTS.body)
           .fillColor(PREMIUM.COLORS.textSecondary)
           .text(`• ${issue}`, 60, doc.y, { width: 490 });
        doc.moveDown(0.5);
      });
    }

    doc.moveDown(1);

    // Plain English explanation
    this._addPlainEnglishBox(
      'Why SSL/TLS Matters',
      this._getSSLExplanation(ssl)
    );

    this._addPageNumber();
  }

  /**
   * Add Security Headers section
   */
  addSecurityHeadersSection(headers) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Security Headers', {
      subtitle: 'HTTP security header implementation'
    });

    const doc = this.doc;

    if (!headers) {
      this._addPlainEnglishBox(
        'No Headers Data',
        'Security header information could not be retrieved for this site.'
      );
      this._addPageNumber();
      return;
    }

    // Implementation progress
    const implementationPercent = (headers.implemented / headers.total) * 100;

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Implementation Progress', 50, doc.y);

    doc.moveDown(0.5);

    drawProgressBar(doc, implementationPercent, `${headers.implemented}/${headers.total} headers implemented`, 50, doc.y, {
      width: PREMIUM.PAGE.contentWidth,
      height: 30,
      showPercentage: true,
      color: getScoreColor(implementationPercent)
    });

    doc.y += 50;

    // Header checklist
    const criticalHeaders = [
      { name: 'Strict-Transport-Security (HSTS)', key: 'strictTransportSecurity', critical: true, explanation: 'Forces HTTPS connections, preventing downgrade attacks' },
      { name: 'Content-Security-Policy (CSP)', key: 'contentSecurityPolicy', critical: true, explanation: 'Prevents XSS and data injection attacks' },
      { name: 'X-Frame-Options', key: 'xFrameOptions', critical: true, explanation: 'Prevents clickjacking attacks' },
      { name: 'X-Content-Type-Options', key: 'xContentTypeOptions', critical: false, explanation: 'Prevents MIME-type sniffing' },
      { name: 'X-XSS-Protection', key: 'xXSSProtection', critical: false, explanation: 'Enables browser XSS filter (legacy)' },
      { name: 'Referrer-Policy', key: 'referrerPolicy', critical: false, explanation: 'Controls referrer information sharing' }
    ];

    criticalHeaders.forEach(header => {
      const status = headers.details?.[header.key];
      const implemented = status?.implemented;

      this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 55, {
        backgroundColor: implemented ? '#F5F5F5' : (header.critical ? '#FFEBEE' : '#FFF3E0'),
        borderColor: implemented ? PREMIUM.COLORS.excellent : (header.critical ? PREMIUM.COLORS.critical : PREMIUM.COLORS.fair)
      });

      const cardY = doc.y;

      // Status icon - draw colored circle
      doc.circle(72, cardY + 24, 6)
         .fillColor(implemented ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical)
         .fill();

      // Header name
      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text(header.name, 90, cardY + 15, { width: 280 });

      // Critical badge
      if (header.critical && !implemented) {
        doc.fontSize(PREMIUM.SIZES.tiny)
           .font(PREMIUM.FONTS.heading)
           .fillColor(PREMIUM.COLORS.critical)
           .text('CRITICAL', 380, cardY + 16);
      }

      // Explanation
      doc.fontSize(PREMIUM.SIZES.small)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(header.explanation, 90, cardY + 33, { width: 450 });

      doc.y = cardY + 63;
    });

    // Plain English explanation
    doc.moveDown(0.5);

    this._addPlainEnglishBox(
      'Understanding Security Headers',
      'Security headers tell browsers how to behave when handling your site. Missing headers leave doors open for attackers. The critical headers (HSTS, CSP, X-Frame-Options) protect against the most common web attacks and should be implemented immediately.'
    );

    this._addPageNumber();
  }

  /**
   * Add Vulnerabilities section
   */
  addVulnerabilitiesSection(vulnerabilities) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Vulnerabilities', {
      subtitle: 'Identified security weaknesses'
    });

    const doc = this.doc;

    if (!vulnerabilities || (!vulnerabilities.critical && !vulnerabilities.high && !vulnerabilities.medium && !vulnerabilities.low)) {
      this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 80, {
        backgroundColor: '#F5F5F5',
        borderColor: PREMIUM.COLORS.excellent
      });

      doc.fontSize(PREMIUM.SIZES.sectionTitle)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.excellent)
         .text('No vulnerabilities detected', 70, doc.y + 30);

      doc.y += 100;

      this._addPlainEnglishBox(
        'Great News!',
        'Our scan did not detect any known vulnerabilities. Continue monitoring regularly as new vulnerabilities are discovered daily.'
      );

      this._addPageNumber();
      return;
    }

    // Vulnerability summary cards
    const categories = [
      { label: 'Critical', count: vulnerabilities.critical || 0, color: COLORS.critical, bg: '#FFEBEE' },
      { label: 'High', count: vulnerabilities.high || 0, color: COLORS.poor, bg: '#FFF3E0' },
      { label: 'Medium', count: vulnerabilities.medium || 0, color: COLORS.warning, bg: '#FFFDE7' },
      { label: 'Low', count: vulnerabilities.low || 0, color: COLORS.info, bg: '#E3F2FD' }
    ];

    const cardWidth = 120;
    let cardX = 50;

    categories.forEach(cat => {
      this._drawPremiumCard(cardX, doc.y, cardWidth, 70, {
        backgroundColor: cat.count > 0 ? cat.bg : '#F5F5F5'
      });

      doc.fontSize(28)
         .font(PREMIUM.FONTS.heading)
         .fillColor(cat.count > 0 ? cat.color : PREMIUM.COLORS.textMuted)
         .text(cat.count.toString(), cardX, doc.y + 15, { width: cardWidth, align: 'center' });

      doc.fontSize(PREMIUM.SIZES.small)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(cat.label, cardX, doc.y + 50, { width: cardWidth, align: 'center' });

      cardX += cardWidth + 10;
    });

    doc.y += 90;

    // Detailed vulnerabilities
    if (vulnerabilities.details && vulnerabilities.details.length > 0) {
      const criticalAndHigh = vulnerabilities.details
        .filter(v => v.severity === 'critical' || v.severity === 'high')
        .slice(0, 8);

      if (criticalAndHigh.length > 0) {
        doc.fontSize(PREMIUM.SIZES.subsectionTitle)
           .font(PREMIUM.FONTS.heading)
           .fillColor(PREMIUM.COLORS.textPrimary)
           .text('Critical & High Severity Details', 50, doc.y);

        doc.moveDown(0.5);

        criticalAndHigh.forEach((vuln, index) => {
          const severityColor = vuln.severity === 'critical' ? COLORS.critical : COLORS.poor;

          checkPageBreakNeeded(doc, 80);

          this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 70, {
            backgroundColor: vuln.severity === 'critical' ? '#FFEBEE' : '#FFF3E0',
            borderColor: severityColor
          });

          const cardY = doc.y;

          // Severity badge
          doc.fontSize(PREMIUM.SIZES.tiny)
             .font(PREMIUM.FONTS.heading)
             .fillColor(severityColor)
             .text((vuln.severity || 'unknown').toUpperCase(), 70, cardY + 12);

          // Title
          doc.fontSize(PREMIUM.SIZES.body)
             .font(PREMIUM.FONTS.heading)
             .fillColor(PREMIUM.COLORS.textPrimary)
             .text(vuln.title || vuln.description || 'Unknown vulnerability', 140, cardY + 10, { width: 400 });

          // Description
          if (vuln.description && vuln.title) {
            doc.fontSize(PREMIUM.SIZES.small)
               .font(PREMIUM.FONTS.body)
               .fillColor(PREMIUM.COLORS.textSecondary)
               .text(vuln.description.substring(0, 100) + '...', 70, cardY + 30, { width: 470 });
          }

          // CVE reference
          if (vuln.cve) {
            doc.fontSize(PREMIUM.SIZES.caption)
               .fillColor(PREMIUM.COLORS.textMuted)
               .text(`CVE: ${vuln.cve}`, 70, cardY + 50);
          }

          doc.y = cardY + 78;
        });
      }
    }

    this._addPageNumber();
  }

  /**
   * Add OWASP Compliance section
   */
  addOWASPSection(owasp) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('OWASP Top 10', {
      subtitle: 'Compliance with security best practices',
      icon: '📋'
    });

    const doc = this.doc;

    if (!owasp) {
      this._addPlainEnglishBox(
        'No OWASP Data',
        'OWASP compliance data is not available for this scan.'
      );
      this._addPageNumber();
      return;
    }

    const owaspItems = [
      { id: 'A01', name: 'Broken Access Control', key: 'a01' },
      { id: 'A02', name: 'Cryptographic Failures', key: 'a02' },
      { id: 'A03', name: 'Injection', key: 'a03' },
      { id: 'A04', name: 'Insecure Design', key: 'a04' },
      { id: 'A05', name: 'Security Misconfiguration', key: 'a05' },
      { id: 'A06', name: 'Vulnerable Components', key: 'a06' },
      { id: 'A07', name: 'Authentication Failures', key: 'a07' },
      { id: 'A08', name: 'Data Integrity Failures', key: 'a08' },
      { id: 'A09', name: 'Logging Failures', key: 'a09' },
      { id: 'A10', name: 'Server-Side Request Forgery', key: 'a10' }
    ];

    // Calculate compliance rate
    const passCount = owaspItems.filter(item => owasp[item.key] === 'pass').length;
    const complianceRate = Math.round((passCount / owaspItems.length) * 100);

    // Compliance summary
    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 70, {
      backgroundColor: PREMIUM.SECTIONS.executive
    });

    doc.fontSize(PREMIUM.SIZES.sectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(getScoreColor(complianceRate))
       .text(`${complianceRate}% Compliant`, 70, doc.y + 15);

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(`${passCount} of ${owaspItems.length} OWASP Top 10 checks passed`, 70, doc.y + 40);

    doc.y += 85;

    // OWASP items list
    owaspItems.forEach(item => {
      const status = owasp[item.key];
      const passed = status === 'pass';
      const failed = status === 'fail';

      this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 35, {
        backgroundColor: passed ? '#F5F5F5' : failed ? '#FFEBEE' : '#FFF8E1',
        borderColor: passed ? PREMIUM.COLORS.excellent : failed ? PREMIUM.COLORS.critical : PREMIUM.COLORS.fair
      });

      const cardY = doc.y;

      // Status icon - draw colored circle
      doc.circle(70, cardY + 17, 5)
         .fillColor(passed ? PREMIUM.COLORS.excellent : failed ? PREMIUM.COLORS.critical : PREMIUM.COLORS.fair)
         .fill();

      // ID badge
      doc.fontSize(PREMIUM.SIZES.small)
         .font(PREMIUM.FONTS.heading)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text(item.id, 90, cardY + 10);

      // Name
      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textPrimary)
         .text(item.name, 130, cardY + 10, { width: 380 });

      doc.y = cardY + 42;
    });

    // Explanation
    doc.moveDown(0.5);

    this._addPlainEnglishBox(
      'What is OWASP Top 10?',
      'OWASP Top 10 is the industry standard for web application security risks. It represents the most critical security concerns that developers and organizations should address. A high compliance rate indicates your site follows security best practices.'
    );

    this._addPageNumber();
  }

  /**
   * Add Security Checklist page
   */
  addSecurityChecklist(data) {
    this.doc.addPage();
    this.currentPage++;

    this._addSectionHeader('Security Checklist', {
      subtitle: 'Your security improvement roadmap'
    });

    const doc = this.doc;
    const score = data.overallScore || 0;

    // Summary card
    this._drawPremiumCard(50, doc.y, PREMIUM.PAGE.contentWidth, 100, {
      backgroundColor: PREMIUM.SECTIONS.executive,
      shadow: true
    });

    const cardY = doc.y;

    doc.fontSize(PREMIUM.SIZES.sectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Security Posture Summary', 70, cardY + 20);

    const posture = score >= 85 ? 'Strong' : score >= 70 ? 'Moderate' : score >= 50 ? 'Needs Improvement' : 'At Risk';

    doc.fontSize(PREMIUM.SIZES.body)
       .font(PREMIUM.FONTS.body)
       .fillColor(PREMIUM.COLORS.textSecondary)
       .text(
         `Your current security posture is ${posture} with a score of ${score}/100. ` +
         'Follow the checklist below to strengthen your defenses.',
         70, cardY + 45, { width: 470 }
       );

    doc.y = cardY + 120;

    // Priority checklist
    const checklist = [
      { text: 'Implement HSTS header', done: data.headers?.details?.strictTransportSecurity?.implemented },
      { text: 'Add Content-Security-Policy', done: data.headers?.details?.contentSecurityPolicy?.implemented },
      { text: 'Enable X-Frame-Options', done: data.headers?.details?.xFrameOptions?.implemented },
      { text: 'Valid SSL certificate', done: data.ssl?.valid },
      { text: 'No critical vulnerabilities', done: (data.vulnerabilities?.critical || 0) === 0 },
      { text: 'No high vulnerabilities', done: (data.vulnerabilities?.high || 0) === 0 }
    ];

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Priority Checklist', 50, doc.y);

    doc.moveDown(0.5);

    checklist.forEach(item => {
      // Draw status circle
      doc.circle(67, doc.y + 5, 5)
         .fillColor(item.done ? PREMIUM.COLORS.excellent : PREMIUM.COLORS.critical)
         .fill();

      doc.fontSize(PREMIUM.SIZES.body)
         .font(PREMIUM.FONTS.body)
         .fillColor(item.done ? PREMIUM.COLORS.textSecondary : PREMIUM.COLORS.textPrimary)
         .text(item.text, 85, doc.y);

      doc.moveDown(0.7);
    });

    // Resources section
    doc.moveDown(1);

    doc.fontSize(PREMIUM.SIZES.subsectionTitle)
       .font(PREMIUM.FONTS.heading)
       .fillColor(PREMIUM.COLORS.textPrimary)
       .text('Security Resources', 50, doc.y);

    doc.moveDown(0.5);

    const resources = [
      'OWASP Foundation - owasp.org',
      'Mozilla Observatory - observatory.mozilla.org',
      'SSL Labs Server Test - ssllabs.com/ssltest',
      'Security Headers - securityheaders.com'
    ];

    resources.forEach(resource => {
      doc.fontSize(PREMIUM.SIZES.small)
         .font(PREMIUM.FONTS.body)
         .fillColor(PREMIUM.COLORS.textSecondary)
         .text(`• ${resource}`, 60, doc.y);
      doc.moveDown(0.4);
    });

    // Footer
    doc.moveDown(2);

    doc.fontSize(PREMIUM.SIZES.caption)
       .font(PREMIUM.FONTS.emphasis)
       .fillColor(PREMIUM.COLORS.textMuted)
       .text(
         'Security is an ongoing process. Regular scans and updates are essential to maintain protection.',
         50, doc.y,
         { width: PREMIUM.PAGE.contentWidth, align: 'center' }
       );

    this._addPageNumber();
  }

  // ========== HELPER METHODS ==========

  _getThreatExplanation(data) {
    const criticalCount = data.vulnerabilities?.critical || 0;
    const highCount = data.vulnerabilities?.high || 0;
    const missingHeaders = (data.headers?.total || 10) - (data.headers?.implemented || 0);

    if (criticalCount > 0) {
      return `Your site has ${criticalCount} critical vulnerabilities that attackers actively scan for. These could allow unauthorized access, data theft, or complete site compromise. Immediate remediation is essential.`;
    }

    if (highCount > 0) {
      return `${highCount} high-severity issues make your site an attractive target. While not immediately exploitable, these weaknesses could be chained together for a successful attack.`;
    }

    if (missingHeaders > 5) {
      return `Missing ${missingHeaders} security headers leaves multiple attack vectors open. Attackers use automated tools to find and exploit sites without proper header protection.`;
    }

    return 'Your security profile is relatively strong. Continue monitoring for new vulnerabilities and keep security headers updated as browser requirements evolve.';
  }

  _calculateRiskLevel(data) {
    const score = data.overallScore || 0;
    const criticalVulns = data.vulnerabilities?.critical || 0;
    const highVulns = data.vulnerabilities?.high || 0;

    if (criticalVulns > 0 || score < 30) {
      return {
        level: 'CRITICAL',
        color: PREMIUM.COLORS.critical,
        bg: '#FFEBEE',
        description: 'Your site is at immediate risk of attack. Critical issues must be addressed urgently.'
      };
    }

    if (highVulns > 2 || score < 50) {
      return {
        level: 'HIGH',
        color: PREMIUM.COLORS.priorityHigh,
        bg: '#FFF3E0',
        description: 'Significant security gaps exist. Attackers may exploit these vulnerabilities.'
      };
    }

    if (score < 70) {
      return {
        level: 'MODERATE',
        color: PREMIUM.COLORS.fair,
        bg: '#FFFDE7',
        description: 'Some security improvements are needed. Address issues to strengthen your defenses.'
      };
    }

    return {
      level: 'LOW',
      color: PREMIUM.COLORS.excellent,
      bg: '#F5F5F5',
      description: 'Good security posture. Continue monitoring and maintain your current practices.'
    };
  }

  _getSSLExplanation(ssl) {
    if (!ssl.valid) {
      return 'Your SSL certificate is invalid or expired. This means data between your visitors and your site is NOT encrypted. Browsers will show security warnings, destroying user trust. This is your most urgent security priority.';
    }

    if (ssl.daysUntilExpiry < 30) {
      return `Your certificate expires in ${ssl.daysUntilExpiry} days. Set a calendar reminder to renew before expiration. Expired certificates cause browser warnings and can disrupt your business.`;
    }

    if (ssl.score >= 90) {
      return 'Your SSL/TLS configuration is excellent. Data between your visitors and server is well-protected. Modern encryption protocols prevent eavesdropping and man-in-the-middle attacks.';
    }

    return 'Your SSL certificate is valid but there may be configuration improvements. Modern TLS settings provide better security and performance.';
  }
}

module.exports = SecurityPremiumPdfGenerator;
