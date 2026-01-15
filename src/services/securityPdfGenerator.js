const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const { resolveReportId } = require('../utils/resolveReportId');
const {
  initializePdfGeneration,
  finalizePdfGeneration,
  addPdfHeader,
  addSectionHeader,
  checkPageBreakNeeded,
  getScoreColor,
  getGrade
} = require('../utils/pdfHelpers');

const logger = createLogger('SecurityPdfGenerator');

/**
 * Security PDF Report Generator
 * Creates professional PDF reports for Security analysis results
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
   * Generate comprehensive Security PDF report
   */
  async generateReport(securityResults) {
    // Use helper to initialize PDF generation
    const { doc, filepath, reportId, stream, filename } = initializePdfGeneration(
      securityResults,
      'security',
      { reportsDir: this.reportsDir }
    );

    try {
      // Use helper for header
      addPdfHeader(
        doc,
        '[SECURITY_ANALYSIS_REPORT]',
        securityResults.url,
        'comprehensive security and vulnerability analysis'
      );

      // Generate report sections
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

  // addHeader removed - using pdfHelpers.addPdfHeader() instead

  /**
   * Add executive summary
   */
  addExecutiveSummary(doc, results) {
    checkPageBreakNeeded(doc, 250);
    addSectionHeader(doc, '🔒 Security Audit Summary');

    const overallScore = results.overallScore || 0;
    const grade = getGrade(overallScore);
    const color = getScoreColor(overallScore);

    // Overall Score Box
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#333')
      .text('Overall Security Score:', doc.x, doc.y);
    
    doc
      .fontSize(48)
      .fillColor(color)
      .text(overallScore.toString(), doc.x + 250, doc.y - 20);
    
    doc
      .fontSize(16)
      .fillColor(color)
      .text(grade, doc.x + 250, doc.y + 5);

    doc.moveDown(3);

    // Component Scores
    const components = [
      { name: 'SSL/TLS Security', score: results.ssl?.score || 0 },
      { name: 'Security Headers', score: results.headers?.score || 0 },
      { name: 'Vulnerability Status', score: results.vulnerabilities?.score || 0 },
      { name: 'OWASP Compliance', score: results.owasp?.score || 0 }
    ];

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#333').text('Component Breakdown:');
    doc.moveDown(0.5);

    components.forEach(comp => {
      const compColor = getScoreColor(comp.score);
      const compGrade = getGrade(comp.score);
      
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#555')
        .text(comp.name, doc.x, doc.y, { continued: true })
        .fillColor(compColor)
        .text(` ${comp.score} (${compGrade})`, { align: 'left' });
      
      doc.moveDown(0.5);
    });

    // Critical Issues Summary
    if (results.vulnerabilities && results.vulnerabilities.critical > 0) {
      doc.moveDown(0.5);
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#ff4444')
        .text(`⚠️ ${results.vulnerabilities.critical} Critical Security Issues Detected`);
    }

    doc.moveDown(1);
  }

  /**
   * Add SSL/TLS Analysis section
   */
  addSSLAnalysis(doc, ssl) {
    if (!ssl) return;

    checkPageBreakNeeded(doc, 300);
    addSectionHeader(doc, '🔐 SSL/TLS Certificate Analysis');

    // Certificate Status
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#333')
      .text('Certificate Status:', { continued: true })
      .font('Helvetica')
      .fillColor(ssl.valid ? '#00ff41' : '#ff4444')
      .text(` ${ssl.valid ? 'Valid ✓' : 'Invalid ✗'}`);
    
    doc.moveDown(0.5);

    // Protocol
    if (ssl.protocol) {
      doc
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('Protocol:', { continued: true })
        .font('Helvetica')
        .fillColor('#555')
        .text(` ${ssl.protocol}`);
      
      doc.moveDown(0.5);
    }

    // Issuer
    if (ssl.issuer) {
      doc
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('Issuer:', { continued: true })
        .font('Helvetica')
        .fillColor('#555')
        .text(` ${ssl.issuer}`);
      
      doc.moveDown(0.5);
    }

    // Valid From/To
    if (ssl.validFrom && ssl.validTo) {
      doc
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('Valid Period:');
      
      doc
        .font('Helvetica')
        .fillColor('#555')
        .text(`From: ${ssl.validFrom}`, { indent: 20 })
        .text(`To: ${ssl.validTo}`, { indent: 20 });
      
      doc.moveDown(0.5);
    }

    // Days Until Expiry
    if (ssl.daysUntilExpiry !== undefined) {
      const expiryColor = ssl.daysUntilExpiry < 30 ? '#ff4444' : 
                         ssl.daysUntilExpiry < 90 ? '#ffa500' : '#00ff41';
      
      doc
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('Days Until Expiry:', { continued: true })
        .font('Helvetica')
        .fillColor(expiryColor)
        .text(` ${ssl.daysUntilExpiry} days`);
      
      doc.moveDown(0.5);
    }

    // Certificate Chain
    if (ssl.chain && ssl.chain.length > 0) {
      doc
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('Certificate Chain:');
      
      doc
        .font('Helvetica')
        .fillColor('#555')
        .text(`${ssl.chain.length} certificates in chain`, { indent: 20 });
      
      doc.moveDown(0.5);
    }

    // SSL Issues
    if (ssl.issues && ssl.issues.length > 0) {
      doc.moveDown(0.5);
      doc
        .font('Helvetica-Bold')
        .fillColor('#ff8800')
        .text('⚠️ SSL/TLS Issues:');
      
      doc.moveDown(0.5);

      ssl.issues.forEach(issue => {
        doc
          .font('Helvetica')
          .fillColor('#555')
          .text(`• ${issue}`, { indent: 20 });
        doc.moveDown(0.3);
      });
    }

    doc.moveDown(1);
  }

  /**
   * Add Security Headers section
   */
  addSecurityHeaders(doc, headers) {
    if (!headers) return;

    checkPageBreakNeeded(doc, 300);
    addSectionHeader(doc, '🛡️ Security Headers Analysis');

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#333')
      .text(`Implementation Status: ${headers.implemented}/${headers.total} headers`);
    
    doc.moveDown(1);

    const headerDetails = [
      { name: 'Strict-Transport-Security (HSTS)', key: 'strictTransportSecurity', description: 'Enforces HTTPS connections' },
      { name: 'Content-Security-Policy (CSP)', key: 'contentSecurityPolicy', description: 'Prevents XSS and code injection' },
      { name: 'X-Frame-Options', key: 'xFrameOptions', description: 'Prevents clickjacking attacks' },
      { name: 'X-Content-Type-Options', key: 'xContentTypeOptions', description: 'Prevents MIME-type sniffing' },
      { name: 'X-XSS-Protection', key: 'xXSSProtection', description: 'Enables XSS filter' },
      { name: 'Referrer-Policy', key: 'referrerPolicy', description: 'Controls referrer information' },
      { name: 'Permissions-Policy', key: 'permissionsPolicy', description: 'Controls browser features' },
      { name: 'Cross-Origin-Embedder-Policy', key: 'crossOriginEmbedderPolicy', description: 'Isolates cross-origin resources' },
      { name: 'Cross-Origin-Opener-Policy', key: 'crossOriginOpenerPolicy', description: 'Isolates browsing context' },
      { name: 'Cross-Origin-Resource-Policy', key: 'crossOriginResourcePolicy', description: 'Controls resource loading' }
    ];

    headerDetails.forEach(header => {
      checkPageBreakNeeded(doc, 70);
      
      const status = headers.details && headers.details[header.key];
      const implemented = status && status.implemented;
      const statusColor = implemented ? '#00ff41' : '#ff4444';
      const statusText = implemented ? '✓ Implemented' : '✗ Missing';

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(statusColor)
        .text(statusText, { continued: true })
        .fillColor('#333')
        .text(` ${header.name}`);
      
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#666')
        .text(header.description, { indent: 20 });
      
      if (implemented && status.value) {
        doc
          .fillColor('#999')
          .text(`Value: ${status.value.substring(0, 80)}${status.value.length > 80 ? '...' : ''}`, { indent: 20 });
      }

      doc.moveDown(0.5);
    });

    doc.moveDown(1);
  }

  /**
   * Add Vulnerabilities section
   */
  addVulnerabilities(doc, vulnerabilities) {
    if (!vulnerabilities) return;

    checkPageBreakNeeded(doc, 250);
    addSectionHeader(doc, '🚨 Vulnerability Assessment');

    // Summary
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#333')
      .text('Vulnerability Summary:');
    
    doc.moveDown(0.5);

    const vulnSummary = [
      { severity: 'Critical', count: vulnerabilities.critical || 0, color: '#ff4444' },
      { severity: 'High', count: vulnerabilities.high || 0, color: '#ff8800' },
      { severity: 'Medium', count: vulnerabilities.medium || 0, color: '#ffaa00' },
      { severity: 'Low', count: vulnerabilities.low || 0, color: '#00ccff' }
    ];

    vulnSummary.forEach(vuln => {
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(vuln.color)
        .text(`• ${vuln.severity}: ${vuln.count} issue${vuln.count !== 1 ? 's' : ''}`, { indent: 20 });
      doc.moveDown(0.3);
    });

    doc.moveDown(1);

    // Detailed Vulnerabilities
    if (vulnerabilities.details && vulnerabilities.details.length > 0) {
      doc
        .font('Helvetica-Bold')
        .fillColor('#333')
        .text('Identified Vulnerabilities:');
      
      doc.moveDown(0.5);

      vulnerabilities.details.slice(0, 10).forEach((vuln, index) => {
        checkPageBreakNeeded(doc, 100);
        
        const severityColor = this.getSeverityColor(vuln.severity);
        
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor(severityColor)
          .text(`${index + 1}. [${vuln.severity?.toUpperCase()}] `, { continued: true })
          .fillColor('#333')
          .text(vuln.title || vuln.description);
        
        if (vuln.description && vuln.title) {
          doc
            .font('Helvetica')
            .fillColor('#555')
            .text(vuln.description, { indent: 20 });
        }

        if (vuln.cve) {
          doc
            .fillColor('#999')
            .text(`CVE: ${vuln.cve}`, { indent: 20 });
        }

        if (vuln.solution) {
          doc
            .fillColor('#666')
            .text(`Solution: ${vuln.solution}`, { indent: 20 });
        }

        doc.moveDown(0.5);
      });

      if (vulnerabilities.details.length > 10) {
        doc
          .fillColor('#999')
          .text(`... and ${vulnerabilities.details.length - 10} more vulnerabilities`);
      }
    }

    doc.moveDown(1);
  }

  /**
   * Add OWASP Compliance section
   */
  addOWASPCompliance(doc, owasp) {
    if (!owasp) return;

    checkPageBreakNeeded(doc, 300);
    addSectionHeader(doc, '⚔️ OWASP Top 10 Compliance');

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#555')
      .text('Assessment against OWASP Top 10 most critical web application security risks.');
    
    doc.moveDown(1);

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

    owaspTop10.forEach(item => {
      const statusColor = item.status === 'pass' ? '#00ff41' : 
                         item.status === 'fail' ? '#ff4444' : '#ffaa00';
      const statusText = item.status === 'pass' ? '✓ Pass' : 
                        item.status === 'fail' ? '✗ Fail' : '⚠ Warning';

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(statusColor)
        .text(statusText, { continued: true })
        .fillColor('#333')
        .text(` ${item.id}: ${item.name}`);
      
      doc.moveDown(0.5);
    });

    doc.moveDown(1);
  }

  /**
   * Add Desktop vs Mobile Comparison
   */
  addDesktopMobileComparison(doc, results) {
    if (!results.desktop || !results.mobile) {
      return;
    }

    checkPageBreakNeeded(doc, 200);
    addSectionHeader(doc, '📱 Desktop vs Mobile Security');

    const metrics = [
      { name: 'Security Score', desktop: results.desktop.overallScore, mobile: results.mobile.overallScore },
      { name: 'SSL/TLS Score', desktop: results.desktop.ssl?.score, mobile: results.mobile.ssl?.score },
      { name: 'Headers Score', desktop: results.desktop.headers?.score, mobile: results.mobile.headers?.score },
      { name: 'Critical Issues', desktop: results.desktop.vulnerabilities?.critical, mobile: results.mobile.vulnerabilities?.critical }
    ];

    doc.fontSize(10).font('Helvetica');

    metrics.forEach(metric => {
      if (metric.desktop !== undefined || metric.mobile !== undefined) {
        doc
          .font('Helvetica-Bold')
          .fillColor('#333')
          .text(metric.name, 50, doc.y, { width: 180, continued: true })
          .font('Helvetica')
          .fillColor('#555')
          .text(`Desktop: ${metric.desktop || 'N/A'}`, { width: 150, continued: true })
          .text(`Mobile: ${metric.mobile || 'N/A'}`, { width: 150 });
        
        doc.moveDown(0.5);
      }
    });

    doc.moveDown(1);
  }

  /**
   * Add recommendations section
   */
  addRecommendations(doc, recommendations) {
    if (!recommendations || recommendations.length === 0) {
      return;
    }

    checkPageBreakNeeded(doc, 200);
    addSectionHeader(doc, '💡 Security Recommendations');

    // Group by priority
    const critical = recommendations.filter(r => r.priority === 'critical');
    const high = recommendations.filter(r => r.priority === 'high');
    const medium = recommendations.filter(r => r.priority === 'medium');

    // Critical Priority
    if (critical.length > 0) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#ff4444')
        .text('🔴 CRITICAL - Fix Immediately');
      
      doc.moveDown(0.5);

      critical.forEach((rec, index) => {
        checkPageBreakNeeded(doc, 100);
        
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#333')
          .text(`${index + 1}. ${rec.title}`);
        
        doc
          .font('Helvetica')
          .fillColor('#555')
          .text(rec.description, { indent: 20 });
        
        if (rec.solution) {
          doc
            .fillColor('#666')
            .text(`Solution: ${rec.solution}`, { indent: 20 });
        }

        if (rec.owaspRef) {
          doc
            .fillColor('#999')
            .text(`OWASP: ${rec.owaspRef}`, { indent: 20 });
        }

        doc.moveDown(0.5);
      });

      doc.moveDown(1);
    }

    // High Priority
    if (high.length > 0) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#ff8800')
        .text('🟠 HIGH PRIORITY');
      
      doc.moveDown(0.5);

      high.slice(0, 5).forEach((rec, index) => {
        checkPageBreakNeeded(doc, 80);
        
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#333')
          .text(`${index + 1}. ${rec.title}`);
        
        doc
          .font('Helvetica')
          .fillColor('#555')
          .text(rec.description, { indent: 20 });

        doc.moveDown(0.5);
      });

      if (high.length > 5) {
        doc
          .fillColor('#999')
          .text(`... and ${high.length - 5} more high priority recommendations`);
      }

      doc.moveDown(1);
    }

    // Medium Priority
    if (medium.length > 0) {
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#ffaa00')
        .text(`🟡 MEDIUM PRIORITY: ${medium.length} recommendations`);
      
      doc.moveDown(1);
    }
  }

  // Helper methods removed - now using pdfHelpers utilities
  // - addSectionHeader → pdfHelpers.addSectionHeader()
  // - checkPageBreak → pdfHelpers.checkPageBreakNeeded()
  // - getScoreColor → pdfHelpers.getScoreColor()
  // - getGrade → pdfHelpers.getGrade()

  /**
   * Get severity color (Security-specific helper)
   */
  getSeverityColor(severity) {
    const sev = (severity || '').toLowerCase();
    if (sev === 'critical') return '#ff4444';
    if (sev === 'high') return '#ff8800';
    if (sev === 'medium') return '#ffaa00';
    if (sev === 'low') return '#00ccff';
    return '#999';
  }
}

// Export singleton
module.exports = new SecurityPdfGenerator();
