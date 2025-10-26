const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../utils/logger');

const logger = createLogger('SEOPdfGenerator');

/**
 * SEO PDF Report Generator
 * Creates professional PDF reports for SEO analysis results
 */
class SEOPdfGenerator {
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
   * Generate comprehensive SEO PDF report
   */
  async generateReport(seoResults) {
    const reportId = uuidv4();
    const filename = `seo-analysis-${reportId}.pdf`;
    const filepath = path.join(this.reportsDir, filename);

    logger.info(`Generating SEO PDF report: ${filename}`);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const stream = fs.createWriteStream(filepath);
        doc.pipe(stream);

        // Generate report sections
        this.addHeader(doc, seoResults.url);
        this.addExecutiveSummary(doc, seoResults);
        this.addMetaTagsAnalysis(doc, seoResults.metaTags);
        this.addHeadingsStructure(doc, seoResults.headings);
        this.addImageAnalysis(doc, seoResults.images);
        this.addContentAnalysis(doc, seoResults.content);
        this.addTechnicalSEO(doc, seoResults.technical);
        this.addRecommendations(doc, seoResults.recommendations);

        doc.end();

        stream.on('finish', () => {
          logger.info(`SEO PDF report generated: ${filename}`);
          resolve({ filename, filepath, reportId });
        });

        stream.on('error', (error) => {
          logger.error('Error generating SEO PDF:', error);
          reject(error);
        });

      } catch (error) {
        logger.error('Error creating SEO PDF:', error);
        reject(error);
      }
    });
  }

  /**
   * Add header with branding
   */
  addHeader(doc, url) {
    doc
      .fontSize(28)
      .font('Helvetica-Bold')
      .fillColor('#1a1a1a')
      .text('[SEO_ANALYSIS_REPORT]', 50, 50);

    doc
      .fontSize(14)
      .font('Helvetica')
      .fillColor('#666666')
      .text('> comprehensive search engine optimization analysis', 50, 85);

    doc
      .fontSize(12)
      .fillColor('#666666')
      .text(`> url: ${url}`, 50, 110);

    doc
      .fontSize(12)
      .fillColor('#666666')
      .text(`> generated: ${new Date().toLocaleString()}`, 50, 130);

    doc.strokeColor('#00ff41').lineWidth(2).moveTo(50, 160).lineTo(545, 160).stroke();
    doc.moveDown(3);
  }

  /**
   * Add executive summary
   */
  addExecutiveSummary(doc, results) {
    this.addSectionHeader(doc, '[EXECUTIVE_SUMMARY]');

    const score = results.overallScore || 0;
    const scoreColor = this.getScoreColor(score);

    // Score box
    doc.rect(50, doc.y, 495, 100).fillColor('#f5f5f5').fill().stroke();
    
    doc
      .fillColor('#000000')
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('Overall SEO Score', 70, doc.y - 80);

    doc
      .fillColor(scoreColor)
      .fontSize(48)
      .text(`${score}`, 70, doc.y - 60);

    doc
      .fillColor('#666666')
      .fontSize(12)
      .text(`/100`, 130, doc.y - 40);

    // Key metrics
    const metricsY = doc.y + 20;
    doc
      .fillColor('#000000')
      .fontSize(12)
      .font('Helvetica')
      .text(`Meta Tags: ${this.getGrade(results.metaTags?.score || 0)}`, 250, metricsY - 60)
      .text(`Headings: ${this.getGrade(results.headings?.score || 0)}`, 250, metricsY - 40)
      .text(`Images: ${this.getGrade(results.images?.score || 0)}`, 250, metricsY - 20)
      .text(`Content: ${this.getGrade(results.content?.score || 0)}`, 400, metricsY - 60)
      .text(`Technical: ${this.getGrade(results.technical?.score || 0)}`, 400, metricsY - 40);

    doc.moveDown(2);
  }

  /**
   * Add meta tags analysis
   */
  addMetaTagsAnalysis(doc, metaTags) {
    this.addSectionHeader(doc, '[META_TAGS_ANALYSIS]');

    if (!metaTags || !metaTags.tags) {
      doc.text('No meta tags data available', 50, doc.y);
      return;
    }

    // Title
    if (metaTags.tags.title) {
      this.addSubSection(doc, 'Title Tag');
      doc
        .fontSize(10)
        .fillColor('#333333')
        .text(`Content: ${metaTags.tags.title.content}`, 70, doc.y)
        .text(`Length: ${metaTags.tags.title.length} characters`, 70, doc.y + 5)
        .text(`Status: ${metaTags.tags.title.status}`, 70, doc.y + 5);
      doc.moveDown();
    }

    // Description
    if (metaTags.tags.description) {
      this.addSubSection(doc, 'Meta Description');
      doc
        .fontSize(10)
        .fillColor('#333333')
        .text(`Content: ${metaTags.tags.description.content}`, 70, doc.y, { width: 475 })
        .text(`Length: ${metaTags.tags.description.length} characters`, 70, doc.y + 5)
        .text(`Status: ${metaTags.tags.description.status}`, 70, doc.y + 5);
      doc.moveDown();
    }

    // Keywords
    if (metaTags.tags.keywords) {
      this.addSubSection(doc, 'Meta Keywords');
      doc
        .fontSize(10)
        .fillColor('#333333')
        .text(`Content: ${metaTags.tags.keywords.content || 'Not set'}`, 70, doc.y, { width: 475 });
      doc.moveDown();
    }

    // Open Graph tags
    if (metaTags.openGraph && Object.keys(metaTags.openGraph).length > 0) {
      this.addSubSection(doc, 'Open Graph Tags');
      Object.entries(metaTags.openGraph).slice(0, 5).forEach(([key, value]) => {
        doc
          .fontSize(9)
          .fillColor('#333333')
          .text(`${key}: ${value}`, 70, doc.y, { width: 475 });
      });
      doc.moveDown();
    }
  }

  /**
   * Add headings structure
   */
  addHeadingsStructure(doc, headings) {
    this.checkPageBreak(doc);
    this.addSectionHeader(doc, '[HEADINGS_STRUCTURE]');

    if (!headings || !headings.hierarchy) {
      doc.text('No headings data available', 50, doc.y);
      return;
    }

    ['h1', 'h2', 'h3'].forEach(tag => {
      if (headings.hierarchy[tag] && headings.hierarchy[tag].length > 0) {
        this.addSubSection(doc, `${tag.toUpperCase()} Tags (${headings.hierarchy[tag].length})`);
        
        headings.hierarchy[tag].slice(0, 5).forEach(heading => {
          doc
            .fontSize(9)
            .fillColor('#333333')
            .text(`• ${heading.text.substring(0, 80)}${heading.text.length > 80 ? '...' : ''}`, 70, doc.y);
        });
        
        if (headings.hierarchy[tag].length > 5) {
          doc
            .fontSize(8)
            .fillColor('#999999')
            .text(`... and ${headings.hierarchy[tag].length - 5} more`, 70, doc.y);
        }
        doc.moveDown();
      }
    });
  }

  /**
   * Add image analysis
   */
  addImageAnalysis(doc, images) {
    this.checkPageBreak(doc);
    this.addSectionHeader(doc, '[IMAGE_ANALYSIS]');

    if (!images || !images.details) {
      doc.text('No image data available', 50, doc.y);
      return;
    }

    const summary = images.summary || {};
    doc
      .fontSize(10)
      .fillColor('#333333')
      .text(`Total Images: ${summary.totalImages || 0}`, 70, doc.y)
      .text(`With Alt Text: ${summary.withAltText || 0}`, 70, doc.y + 5)
      .text(`Without Alt Text: ${summary.withoutAltText || 0}`, 70, doc.y + 5)
      .text(`Oversized: ${summary.oversized || 0}`, 70, doc.y + 5);

    doc.moveDown();

    // Sample images without alt text
    const imagesWithoutAlt = images.details.filter(img => !img.alt).slice(0, 5);
    if (imagesWithoutAlt.length > 0) {
      this.addSubSection(doc, 'Images Missing Alt Text (Sample)');
      imagesWithoutAlt.forEach(img => {
        doc
          .fontSize(8)
          .fillColor('#666666')
          .text(`• ${img.src.substring(0, 70)}${img.src.length > 70 ? '...' : ''}`, 70, doc.y);
      });
      doc.moveDown();
    }
  }

  /**
   * Add content analysis
   */
  addContentAnalysis(doc, content) {
    this.checkPageBreak(doc);
    this.addSectionHeader(doc, '[CONTENT_ANALYSIS]');

    if (!content) {
      doc.text('No content data available', 50, doc.y);
      return;
    }

    doc
      .fontSize(10)
      .fillColor('#333333')
      .text(`Word Count: ${content.wordCount || 0}`, 70, doc.y)
      .text(`Reading Time: ${content.readingTime || 'N/A'}`, 70, doc.y + 5)
      .text(`Readability Score: ${content.readabilityScore || 'N/A'}`, 70, doc.y + 5);

    doc.moveDown();

    // Top keywords
    if (content.keywords && content.keywords.length > 0) {
      this.addSubSection(doc, 'Top Keywords');
      content.keywords.slice(0, 10).forEach(kw => {
        doc
          .fontSize(9)
          .fillColor('#333333')
          .text(`• ${kw.word}: ${kw.count} occurrences`, 70, doc.y);
      });
      doc.moveDown();
    }
  }

  /**
   * Add technical SEO
   */
  addTechnicalSEO(doc, technical) {
    this.checkPageBreak(doc);
    this.addSectionHeader(doc, '[TECHNICAL_SEO]');

    if (!technical) {
      doc.text('No technical SEO data available', 50, doc.y);
      return;
    }

    const items = [
      { label: 'Canonical URL', value: technical.canonical || 'Not set', status: technical.canonical ? 'Good' : 'Warning' },
      { label: 'Robots Meta', value: technical.robots || 'Not set', status: technical.robots ? 'Good' : 'Warning' },
      { label: 'Viewport Meta', value: technical.viewport ? 'Present' : 'Missing', status: technical.viewport ? 'Good' : 'Error' },
      { label: 'Language', value: technical.language || 'Not set', status: technical.language ? 'Good' : 'Warning' },
      { label: 'Charset', value: technical.charset || 'Not set', status: technical.charset ? 'Good' : 'Warning' }
    ];

    items.forEach(item => {
      const statusColor = item.status === 'Good' ? '#00ff41' : item.status === 'Warning' ? '#ffa500' : '#ff4444';
      doc
        .fontSize(10)
        .fillColor('#333333')
        .text(`${item.label}:`, 70, doc.y)
        .fillColor(statusColor)
        .text(item.value, 200, doc.y - 12)
        .moveDown(0.5);
    });

    doc.moveDown();
  }

  /**
   * Add recommendations
   */
  addRecommendations(doc, recommendations) {
    this.checkPageBreak(doc);
    this.addSectionHeader(doc, '[RECOMMENDATIONS]');

    if (!recommendations || recommendations.length === 0) {
      doc
        .fontSize(10)
        .fillColor('#00ff41')
        .text('✓ No major issues detected. Your SEO is looking good!', 50, doc.y);
      return;
    }

    recommendations.slice(0, 10).forEach((rec, index) => {
      const priorityColor = rec.priority === 'high' ? '#ff4444' : rec.priority === 'medium' ? '#ffa500' : '#00ff41';
      const priorityIcon = rec.priority === 'high' ? '🚨' : rec.priority === 'medium' ? '⚠️' : 'ℹ️';
      
      doc
        .fontSize(11)
        .fillColor(priorityColor)
        .text(`${priorityIcon} ${rec.title}`, 70, doc.y)
        .fontSize(9)
        .fillColor('#666666')
        .text(rec.description, 70, doc.y, { width: 475 });

      if (rec.actions && rec.actions.length > 0) {
        rec.actions.slice(0, 3).forEach(action => {
          doc
            .fontSize(8)
            .fillColor('#333333')
            .text(`  • ${action}`, 80, doc.y);
        });
      }

      doc.moveDown();
      this.checkPageBreak(doc);
    });
  }

  /**
   * Helper: Add section header
   */
  addSectionHeader(doc, title) {
    this.checkPageBreak(doc, 100);
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor('#1a1a1a')
      .text(title, 50, doc.y);
    doc.moveDown(0.5);
  }

  /**
   * Helper: Add subsection
   */
  addSubSection(doc, title) {
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor('#333333')
      .text(title, 70, doc.y);
    doc.moveDown(0.3);
  }

  /**
   * Helper: Check if page break needed
   */
  checkPageBreak(doc, requiredSpace = 150) {
    if (doc.y > 700) {
      doc.addPage();
    }
  }

  /**
   * Helper: Get score color
   */
  getScoreColor(score) {
    if (score >= 90) return '#00ff41';
    if (score >= 70) return '#bb86fc';
    if (score >= 50) return '#ffa500';
    return '#ff4444';
  }

  /**
   * Helper: Get grade
   */
  getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}

module.exports = new SEOPdfGenerator();
