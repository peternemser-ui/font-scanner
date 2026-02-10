/**
 * SEO Report — PDF Renderer
 * Renders all SEO analysis sections into the PDF template.
 * Registered with PdfReport.register() for the shared engine to invoke.
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[seo-report-render] PdfReport not loaded');
    return;
  }

  var PR = window.PdfReport;

  PdfReport.register('seo', function renderSEO(data, utils) {
    var t = utils.t;
    var esc = utils.esc;
    var truncate = utils.truncate;
    var scoreClass = utils.scoreClass;

    var sectionIndex = 1;

    /* -----------------------------------------------------------------------
       1. Meta Tags
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-meta-tags .pdf-section__content');
      var d = data.metaTags || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('seo.sections.metaTags', 'Meta Tags'), score)),
        sec
      );

      var html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('seo.report.sectionIntros.metaTags', 'Meta tags are the foundation of how search engines and social platforms understand your page. They control how your content appears in search results, social shares, and browser tabs. This section evaluates your title tag, meta description, Open Graph, Twitter Card, viewport, and canonical URL configurations. Properly optimized meta tags can significantly improve click-through rates and prevent duplicate content issues.')) + '</p>';

      // Overview table
      html += '<h3 class="pdf-subsection__title">' + esc(t('seo.report.metaTags.overviewHeading', 'Meta Tags Overview')) + '</h3>';

      var rows = [];

      // Title
      var titleStatus = d.title ? (d.titleLength >= 50 && d.titleLength <= 60 ? 'optimal' : 'review') : 'missing';
      rows.push([
        esc(t('seo.report.metaTags.rows.title', 'Title')),
        '<div class="pdf-table__value">' + esc(truncate(d.title || '-', 80)) + '</div>',
        d.titleLength ? d.titleLength + ' ' + t('seo.report.units.chars', 'chars') : '-',
        PR.renderStatus(titleStatus, t('seo.report.status.' + titleStatus, titleStatus)),
        esc(t('seo.report.metaTags.bestPractice.title', '50-60 chars, include primary keyword near start'))
      ]);

      // Description
      var descStatus = d.description ? (d.descriptionLength >= 150 && d.descriptionLength <= 160 ? 'optimal' : 'review') : 'missing';
      rows.push([
        esc(t('seo.report.metaTags.rows.description', 'Description')),
        '<div class="pdf-table__value">' + esc(truncate(d.description || '-', 120)) + '</div>',
        d.descriptionLength ? d.descriptionLength + ' ' + t('seo.report.units.chars', 'chars') : '-',
        PR.renderStatus(descStatus, t('seo.report.status.' + descStatus, descStatus)),
        esc(t('seo.report.metaTags.bestPractice.description', '150-160 chars, compelling CTA, unique per page'))
      ]);

      // Open Graph
      var ogPresent = d.ogTitle || d.ogDescription || d.ogImage;
      rows.push([
        esc(t('seo.report.metaTags.rows.openGraph', 'Open Graph')),
        '<div class="pdf-table__value">' + esc(truncate(d.ogTitle || '-', 60)) + '</div>',
        '-',
        PR.renderStatus(ogPresent ? 'configured' : 'missing', t('seo.report.status.' + (ogPresent ? 'configured' : 'missing'), ogPresent ? 'Configured' : 'Missing')),
        esc(t('seo.report.metaTags.bestPractice.openGraph', 'og:title, og:description, og:image (1200x630px)'))
      ]);

      // Twitter Card
      var twPresent = d.twitterCard || d.twitterTitle;
      rows.push([
        esc(t('seo.report.metaTags.rows.twitterCard', 'Twitter Card')),
        '<div class="pdf-table__value">' + esc(d.twitterCard || '-') + '</div>',
        '-',
        PR.renderStatus(twPresent ? 'configured' : 'missing', t('seo.report.status.' + (twPresent ? 'configured' : 'missing'), twPresent ? 'Configured' : 'Missing')),
        esc(t('seo.report.metaTags.bestPractice.twitterCard', 'summary_large_image, twitter:title, twitter:image'))
      ]);

      // Viewport
      rows.push([
        esc(t('seo.report.metaTags.rows.viewport', 'Viewport')),
        '<div class="pdf-table__value">' + esc(truncate(d.viewport || '-', 60)) + '</div>',
        '-',
        PR.renderStatus(d.viewport ? 'set' : 'missing', t('seo.report.status.' + (d.viewport ? 'set' : 'missing'), d.viewport ? 'Set' : 'Missing')),
        esc(t('seo.report.metaTags.bestPractice.viewport', 'width=device-width, initial-scale=1'))
      ]);

      // Canonical
      rows.push([
        esc(t('seo.report.metaTags.rows.canonical', 'Canonical')),
        '<div class="pdf-table__value">' + esc(truncate(d.canonical || '-', 60)) + '</div>',
        '-',
        PR.renderStatus(d.canonical ? 'set' : 'missing', t('seo.report.status.' + (d.canonical ? 'set' : 'missing'), d.canonical ? 'Set' : 'Missing')),
        esc(t('seo.report.metaTags.bestPractice.canonical', 'Prevents duplicate content, use absolute URLs'))
      ]);

      html += PR.renderTable(
        [
          { label: t('seo.report.table.property', 'Property'), width: '12%' },
          { label: t('seo.report.table.value', 'Value'), width: '28%' },
          { label: t('seo.report.table.length', 'Length'), width: '10%' },
          { label: t('seo.report.table.status', 'Status'), width: '12%' },
          { label: t('seo.report.table.bestPractice', 'Best Practice'), width: '28%' }
        ],
        rows,
        { striped: true }
      );

      // Issues
      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Headings
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-headings .pdf-section__content');
      var d = data.headingStructure || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('seo.sections.headings', 'Headings'), score)),
        sec
      );

      var html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('seo.report.sectionIntros.headings', 'A well-structured heading hierarchy helps both users and search engines navigate your content. Headings create a semantic outline that communicates topic relationships and content importance. This section analyzes the distribution and proper nesting of H1 through H6 tags on your page. Best practice is to have exactly one H1 tag and use subsequent levels in logical order without skipping levels.')) + '</p>';

      // Distribution table
      html += '<h3 class="pdf-subsection__title">' + esc(t('seo.report.headings.distributionHeading', 'Heading Distribution')) + '</h3>';

      var headingLevels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      var distRows = headingLevels.map(function (level) {
        var items = d[level] || [];
        var first = items.length > 0 ? truncate(items[0], 80) : '-';
        return [
          '<strong>' + level.toUpperCase() + '</strong>',
          String(items.length),
          esc(first)
        ];
      });

      html += PR.renderTable(
        [
          { label: t('seo.report.headings.table.level', 'Level'), width: '15%' },
          { label: t('seo.report.headings.table.count', 'Count'), width: '15%' },
          { label: t('seo.report.headings.table.firstInstance', 'First Instance'), width: '70%' }
        ],
        distRows,
        { striped: true }
      );

      // Metrics
      var h1Count = (d.h1 || []).length;
      html += PR.renderMetrics([
        { value: d.total || 0, label: t('seo.report.headings.totalHeadingsLabel', 'Total Headings') },
        { value: h1Count, label: t('seo.report.headings.primaryH1Label', 'H1 Tags'), color: h1Count === 1 ? '#10b981' : '#ef4444' }
      ]);

      // Hierarchy preview
      if (d.hierarchy && d.hierarchy.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('seo.report.headings.hierarchyHeading', 'Heading Hierarchy')) + '</h3>';
        html += '<div style="font-size:0.8rem;line-height:1.8;font-family:monospace;">';
        d.hierarchy.slice(0, 15).forEach(function (h) {
          var indent = (parseInt(h.level.replace('h', '')) - 1) * 16;
          html += '<div style="padding-left:' + indent + 'px;">' +
            '<span style="color:#dd3838;font-weight:600;">' + h.level.toUpperCase() + '</span> ' +
            esc(truncate(h.text, 80)) +
          '</div>';
        });
        if (d.hierarchy.length > 15) {
          html += '<div class="pdf-text-muted pdf-text-small">... ' + t('seo.report.common.moreCount', '{{count}} more', { count: d.hierarchy.length - 15 }) + '</div>';
        }
        html += '</div>';
      }

      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Content Analysis
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-content .pdf-section__content');
      var d = data.contentAnalysis || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('seo.sections.content', 'Content'), score)),
        sec
      );

      var html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('seo.report.sectionIntros.content', 'Content quality directly impacts search rankings and user engagement. Search engines favor pages with substantial, well-written content that thoroughly covers a topic. This section examines word count, readability, text-to-HTML ratio, and sentence structure to assess your page\'s content depth. Pages with fewer than 300 words are generally considered thin content and may struggle to rank competitively.')) + '</p>';

      html += '<h3 class="pdf-subsection__title">' + esc(t('seo.report.content.qualityMetricsHeading', 'Content Quality Metrics')) + '</h3>';

      html += PR.renderMetrics([
        { value: d.wordCount || 0, label: t('seo.report.content.metrics.wordCount', 'Word Count') },
        { value: d.paragraphCount || 0, label: t('seo.report.content.metrics.paragraphs', 'Paragraphs') },
        { value: d.textToHTMLRatio ? Math.round(d.textToHTMLRatio * 100) + '%' : '-', label: t('seo.report.content.metrics.textRatio', 'Text Ratio') },
        { value: d.averageWordsPerSentence ? Math.round(d.averageWordsPerSentence) : '-', label: t('seo.report.content.avgWordsPerSentenceLineLabel', 'Avg Words/Sentence') }
      ]);

      // Content table
      var contentRows = [
        [t('seo.report.content.wordCountLineLabel', 'Word Count'), String(d.wordCount || 0), d.wordCount >= 300 ? 'pass' : 'warning'],
        [t('seo.report.content.sentencesLineLabel', 'Sentences'), String(d.sentenceCount || 0), 'info'],
        [t('seo.report.content.avgWordsPerSentenceLineLabel', 'Avg Words/Sentence'), d.averageWordsPerSentence ? d.averageWordsPerSentence.toFixed(1) : '-', d.averageWordsPerSentence && d.averageWordsPerSentence <= 20 ? 'pass' : 'warning'],
        [t('seo.report.content.metrics.textRatio', 'Text-to-HTML Ratio'), d.textToHTMLRatio ? (d.textToHTMLRatio * 100).toFixed(1) + '%' : '-', d.textToHTMLRatio && d.textToHTMLRatio >= 0.1 ? 'pass' : 'warning']
      ];

      html += PR.renderTable(
        [
          { label: t('seo.report.table.metric', 'Metric'), width: '40%' },
          { label: t('seo.report.table.value', 'Value'), width: '30%' },
          { label: t('seo.report.table.status', 'Status'), width: '30%' }
        ],
        contentRows.map(function (r) {
          return [esc(r[0]), esc(r[1]), PR.renderStatus(r[2], r[2])];
        }),
        { striped: true }
      );

      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. Images
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-images .pdf-section__content');
      var d = data.imageAnalysis || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('seo.sections.images', 'Images'), score)),
        sec
      );

      var html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('seo.report.sectionIntros.images', 'Images enhance user experience but can hurt SEO if not properly optimized. Missing alt text reduces accessibility for screen reader users and eliminates a key ranking signal for image search. This section checks alt text coverage, image dimensions, and file references to ensure your images are accessible and search-friendly. Properly optimized images with descriptive alt attributes can drive significant traffic through Google Image Search.')) + '</p>';

      html += PR.renderCallout(
        t('seo.report.images.calloutTitle', 'Image SEO: Alt Text is Critical'),
        t('seo.report.images.calloutBody', 'Alt text helps search engines understand images and improves accessibility. Google Image Search drives 20-30% of web traffic for many sites.'),
        'tip'
      );

      if (d.total === 0) {
        html += '<p class="pdf-text-muted">' + esc(t('seo.report.images.noImagesFound', 'No images found on this page')) + '</p>';
      } else {
        // Stats
        var altPct = d.total > 0 ? Math.round((d.withAlt / d.total) * 100) : 0;
        html += PR.renderMetrics([
          { value: d.total || 0, label: t('seo.report.images.radial.imagesFound', 'Images Found') },
          { value: d.withAlt || 0, label: t('seo.report.images.chart.withAlt', 'With Alt') },
          { value: d.withoutAlt || 0, label: t('seo.report.images.chart.missingAlt', 'Missing Alt'), color: d.withoutAlt > 0 ? '#ef4444' : '#10b981' },
          { value: altPct + '%', label: t('seo.report.images.radial.altCoverage', 'Alt Text Coverage'), color: altPct >= 80 ? '#10b981' : '#f59e0b' }
        ]);

        // Alt coverage progress bar
        html += PR.renderProgress(
          t('seo.report.images.radial.altCoverage', 'Alt Text Coverage'),
          d.withAlt || 0, d.total || 0
        );

        // Image details table (first 20)
        if (d.images && d.images.length > 0) {
          html += '<h3 class="pdf-subsection__title">' + esc(t('seo.report.images.detailsHeading', 'Image Details')) + '</h3>';
          var imgRows = d.images.slice(0, 20).map(function (img) {
            var altStatus = img.alt ? 'pass' : 'fail';
            return [
              '<span class="pdf-table__truncate">' + esc(truncate(img.src, 50)) + '</span>',
              (img.width && img.height) ? img.width + 'x' + img.height : '-',
              '<div class="pdf-table__value">' + esc(truncate(img.alt || '-', 60)) + '</div>',
              PR.renderStatus(altStatus, t('seo.report.status.' + altStatus, altStatus))
            ];
          });

          html += PR.renderTable(
            [
              { label: t('seo.report.images.table.imageUrl', 'Image URL'), width: '30%' },
              { label: t('seo.report.images.table.dimensions', 'Dimensions'), width: '15%' },
              { label: t('seo.report.images.table.altText', 'Alt Text'), width: '35%' },
              { label: t('seo.report.table.status', 'Status'), width: '12%' }
            ],
            imgRows,
            { striped: true }
          );

          if (d.images.length > 20) {
            html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: d.images.length - 20 }) + '</p>';
          }
        }
      }

      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Links
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-links .pdf-section__content');
      var d = data.linkAnalysis || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('seo.sections.links', 'Links'), score)),
        sec
      );

      var html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('seo.report.sectionIntros.links', 'Internal and external links form the connective tissue of the web and are a primary way search engines discover and rank pages. A healthy link profile includes a strong internal linking structure that distributes page authority and helps users navigate your site. This section evaluates the balance of internal vs. external links, nofollow usage, and any broken link patterns. Broken or malformed links can waste crawl budget and create poor user experiences.')) + '</p>';

      html += '<h3 class="pdf-subsection__title">' + esc(t('seo.report.links.healthSummaryHeading', 'Link Health Summary')) + '</h3>';

      html += PR.renderMetrics([
        { value: d.total || 0, label: t('seo.report.links.totalLinksLabel', 'Total Links') },
        { value: d.internal || 0, label: t('seo.report.links.internalLinksLabel', 'Internal Links') },
        { value: d.external || 0, label: t('seo.report.links.externalLinksLabel', 'External Links') },
        { value: d.noFollow || 0, label: t('seo.report.links.nofollowLinksLabel', 'Nofollow Links') }
      ]);

      // Broken links metric
      if (d.brokenFormat > 0) {
        html += PR.renderIssue(
          t('seo.report.links.brokenFormatLabel', 'Broken Format') + ': ' + d.brokenFormat + ' ' + t('common.pdf.execSummary.issuesFound', 'issues found'),
          'warning'
        );
      }

      // Link progress bars
      if (d.total > 0) {
        html += PR.renderProgress(t('seo.report.links.internalLinksLabel', 'Internal Links'), d.internal || 0, d.total);
        html += PR.renderProgress(t('seo.report.links.externalLinksLabel', 'External Links'), d.external || 0, d.total);
      }

      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Mobile Responsiveness
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-mobile .pdf-section__content');
      var d = data.mobileResponsive || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('seo.sections.mobile', 'Mobile'), score)),
        sec
      );

      var html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('seo.report.sectionIntros.mobile', 'With mobile-first indexing, Google prioritizes the mobile version of your site for ranking and indexing. Over 60% of web traffic now comes from mobile devices, making responsive design essential for reaching your audience. This section tests viewport configuration, font readability, tap target sizing, and horizontal scroll issues across device sizes. Pages that fail mobile usability checks may see reduced visibility in mobile search results.')) + '</p>';

      html += PR.renderCallout(
        t('seo.report.mobile.calloutTitle', 'Mobile-First Indexing'),
        t('seo.report.mobile.calloutBody', 'Google now uses the mobile version of your site for indexing and ranking. Mobile responsiveness is critical for SEO.'),
        'tip'
      );

      if (d.viewports && d.viewports.length > 0) {
        var mobileRows = d.viewports.map(function (vp) {
          return [
            esc(vp.viewport || '-'),
            PR.renderStatus(vp.hasViewportMeta ? 'pass' : 'fail', t('seo.report.status.' + (vp.hasViewportMeta ? 'yes' : 'no'))),
            PR.renderStatus(vp.fontSizeReadable ? 'pass' : 'fail', t('seo.report.status.' + (vp.fontSizeReadable ? 'yes' : 'no'))),
            PR.renderStatus(!vp.hasHorizontalScroll ? 'pass' : 'fail', t('seo.report.status.' + (!vp.hasHorizontalScroll ? 'yes' : 'no')))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('seo.report.mobile.table.deviceType', 'Device Type'), width: '25%' },
            { label: t('seo.report.mobile.table.viewportMeta', 'Viewport Meta'), width: '25%' },
            { label: t('seo.report.mobile.table.readableFontSize', 'Readable Font'), width: '25%' },
            { label: t('seo.report.mobile.table.noHorizontalScroll', 'No H. Scroll'), width: '25%' }
          ],
          mobileRows,
          { striped: true }
        );
      }

      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       7. Structured Data
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-structured-data .pdf-section__content');
      var d = data.structuredData || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('seo.sections.structuredData', 'Structured Data'), score)),
        sec
      );

      var html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('seo.report.sectionIntros.structuredData', 'Structured data helps search engines understand your content and enables rich results such as star ratings, FAQs, and product cards in search results. Pages with rich results typically see 20-30% higher click-through rates compared to standard listings. This section checks for JSON-LD and Microdata markup, including the schema types implemented on your page. Google recommends JSON-LD as the preferred format for structured data implementation.')) + '</p>';

      html += PR.renderMetrics([
        { value: d.hasStructuredData ? t('seo.report.status.detected', 'Detected') : t('seo.report.status.notDetected', 'Not Detected'), label: 'Structured Data', color: d.hasStructuredData ? '#10b981' : '#ef4444' },
        { value: d.jsonLdCount || 0, label: 'JSON-LD' },
        { value: d.microdataCount || 0, label: 'Microdata' },
        { value: d.count || 0, label: t('seo.report.headings.table.count', 'Total') }
      ]);

      if (d.types && d.types.length > 0) {
        html += '<h3 class="pdf-subsection__title">Schema Types</h3>';
        var typeRows = d.types.map(function (type) {
          return [esc(type), PR.renderStatus('found', t('seo.report.status.found', 'Found'))];
        });
        html += PR.renderTable(
          [
            { label: 'Type', width: '70%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          typeRows,
          { striped: true }
        );
      }

      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       8. Additional Checks
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-additional .pdf-section__content');
      var d = data.additionalChecks || {};
      var score = d.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('seo.sections.additional', 'Additional Checks'), score)),
        sec
      );

      var html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('seo.report.sectionIntros.additional', 'Beyond core SEO factors, several technical elements contribute to overall search health and user trust. A complete technical foundation includes proper browser identification, crawl directives, and tracking infrastructure. This section verifies the presence of a favicon, robots.txt, XML sitemap, analytics tracking, and social media links. Missing any of these elements can indicate an incomplete SEO setup and reduce your site\'s professional appearance.')) + '</p>';

      var checkRows = [
        ['Favicon', d.hasFavicon],
        ['Robots.txt', d.hasRobotsTxt],
        ['Sitemap', d.hasSitemap],
        ['Google Analytics', d.googleAnalytics]
      ];

      // Social links
      if (d.socialLinks) {
        ['facebook', 'twitter', 'linkedin', 'instagram'].forEach(function (platform) {
          checkRows.push([platform.charAt(0).toUpperCase() + platform.slice(1), d.socialLinks[platform]]);
        });
      }

      html += PR.renderTable(
        [
          { label: t('seo.report.table.check', 'Check'), width: '50%' },
          { label: t('seo.report.table.status', 'Status'), width: '50%' }
        ],
        checkRows.map(function (r) {
          var status = r[1] ? 'found' : 'notFound';
          return [esc(r[0]), PR.renderStatus(status, t('seo.report.status.' + status, r[1] ? 'Found' : 'Not found'))];
        }),
        { striped: true }
      );

      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       9. Fix Code + Recommendations
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('seo.sections.fixCode', 'Fix Code + Recommendations'))),
        sec
      );

      var html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('seo.report.sectionIntros.recommendations', 'Based on the complete analysis, this section provides actionable code fixes and step-by-step implementation guides. Recommendations are organized by impact level so you can prioritize the changes that will deliver the greatest SEO improvements first. Each recommendation includes both the problematic pattern and the recommended solution with copy-ready code snippets. Implementing these fixes in order of severity will help you systematically improve your site\'s search performance.')) + '</p>';

      // Build rich fix cards (same logic as buildFixCards in seo-script.js)
      var fixCards = _buildFixCards(data, t, esc);

      if (fixCards.length > 0) {
        html += '<p class="pdf-text-muted" style="margin-bottom:16px;">' +
          t('seo.fixes.title', 'SEO Fixes') + ' — ' +
          t('seo.fixes.improvementsFound', '{{count}} improvements found', { count: fixCards.length }) +
        '</p>';

        // Render each fix card
        fixCards.forEach(function (fix) {
          html += _renderFixCard(fix, t, esc);
        });
      }

      // Also gather per-section issues and recommendations as a summary
      var allRecs = [];
      var sectionKeys = ['metaTags', 'headingStructure', 'contentAnalysis', 'imageAnalysis',
                         'linkAnalysis', 'mobileResponsive',
                         'structuredData', 'additionalChecks'];

      var sectionNames = {
        metaTags: t('seo.sections.metaTags', 'Meta Tags'),
        headingStructure: t('seo.sections.headings', 'Headings'),
        contentAnalysis: t('seo.sections.content', 'Content'),
        imageAnalysis: t('seo.sections.images', 'Images'),
        linkAnalysis: t('seo.sections.links', 'Links'),
        mobileResponsive: t('seo.sections.mobile', 'Mobile'),
        structuredData: t('seo.sections.structuredData', 'Structured Data'),
        additionalChecks: t('seo.sections.additional', 'Additional Checks')
      };

      sectionKeys.forEach(function (key) {
        var section = data[key];
        if (!section) return;
        var sectionName = sectionNames[key] || key;
        if (section.recommendations) {
          section.recommendations.forEach(function (rec) {
            allRecs.push({ text: rec, section: sectionName, severity: section.passed ? 'low' : 'medium' });
          });
        }
        if (section.issues) {
          section.issues.forEach(function (issue) {
            allRecs.push({ text: issue, section: sectionName, severity: section.score < 50 ? 'high' : 'medium' });
          });
        }
      });

      // Additional issues/recommendations summary
      if (allRecs.length > 0) {
        html += '<h3 class="pdf-subsection__title" style="margin-top:24px;">' +
          t('common.pdf.execSummary.keyFindings', 'Additional Findings') +
        '</h3>';

        // Group by severity
        var high = allRecs.filter(function (r) { return r.severity === 'high'; });
        var medium = allRecs.filter(function (r) { return r.severity === 'medium'; });
        var low = allRecs.filter(function (r) { return r.severity === 'low'; });

        if (high.length > 0) {
          html += '<div class="pdf-recs-group">';
          html += '<div class="pdf-recs-group__title" style="color:#ef4444;">&#9679; ' + t('common.pdf.execSummary.highPriority', 'High Priority') + ' (' + high.length + ')</div>';
          high.forEach(function (r) {
            html += '<div class="pdf-rec" style="border-left-color:#ef4444;">' +
              '<div class="pdf-rec__text"><strong>' + esc(r.section) + ':</strong> ' + esc(r.text) + '</div>' +
            '</div>';
          });
          html += '</div>';
        }

        if (medium.length > 0) {
          html += '<div class="pdf-recs-group">';
          html += '<div class="pdf-recs-group__title" style="color:#f59e0b;">&#9679; ' + t('common.pdf.execSummary.mediumPriority', 'Medium Priority') + ' (' + medium.length + ')</div>';
          medium.forEach(function (r) {
            html += '<div class="pdf-rec" style="border-left-color:#f59e0b;">' +
              '<div class="pdf-rec__text"><strong>' + esc(r.section) + ':</strong> ' + esc(r.text) + '</div>' +
            '</div>';
          });
          html += '</div>';
        }

        if (low.length > 0) {
          html += '<div class="pdf-recs-group">';
          html += '<div class="pdf-recs-group__title" style="color:#3b82f6;">&#9679; ' + t('common.pdf.execSummary.lowPriority', 'Low Priority') + ' (' + low.length + ')</div>';
          low.forEach(function (r) {
            html += '<div class="pdf-rec" style="border-left-color:#3b82f6;">' +
              '<div class="pdf-rec__text"><strong>' + esc(r.section) + ':</strong> ' + esc(r.text) + '</div>' +
            '</div>';
          });
          html += '</div>';
        }
      }

      if (fixCards.length === 0 && allRecs.length === 0) {
        html += '<div class="pdf-callout pdf-callout--tip">' +
          '<div class="pdf-callout__title">' + esc(t('seo.fixes.excellentSeo', 'Excellent SEO!')) + '</div>' +
          '<div class="pdf-callout__body">' + esc(t('seo.fixes.excellentSeoDesc', 'Your site follows SEO best practices. Keep monitoring for continued success.')) + '</div>' +
        '</div>';
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       Helper: remove empty sections (hide if data is missing)
       ----------------------------------------------------------------------- */
    document.querySelectorAll('.pdf-section').forEach(function (sec) {
      var content = sec.querySelector('.pdf-section__content');
      if (content && !content.innerHTML.trim()) {
        sec.style.display = 'none';
      }
    });
  });

  /* =========================================================================
     Shared Utilities
     ========================================================================= */

  /** Convert HTML string to DOM node */
  function _htmlToNode(html) {
    var temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.firstChild;
  }

  /** Render issues list for a section */
  function _renderIssuesList(issues, t) {
    if (!issues || issues.length === 0) return '';
    var html = '<div class="pdf-issues" style="margin-top:12px;">';
    html += '<h4 class="pdf-subsection__title">' + (t('common.pdf.execSummary.issuesFound', 'Issues Found') || 'Issues') + '</h4>';
    issues.forEach(function (issue) {
      html += '<div class="pdf-issue pdf-issue--warning">' +
        '<span class="pdf-issue__text">' + PdfReport.helpers.esc(issue) + '</span>' +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  /** Extract domain from report data */
  function _getAnalyzedDomain(data) {
    var rawUrl = data && data.url ? String(data.url) : '';
    try {
      var parsed = new URL(rawUrl);
      return parsed.hostname || 'example.com';
    } catch (e) {
      return 'example.com';
    }
  }

  /**
   * Build 6 fix card objects from the SEO analysis data.
   * Mirrors buildFixCards() in seo-script.js.
   */
  function _buildFixCards(data, t, esc) {
    var analyzedDomain = _getAnalyzedDomain(data);
    var cards = [];
    var meta = data.metaTags || {};
    var structured = data.structuredData || {};

    // 1. Title tag
    cards.push({
      title: t('seo.fixCards.title.title', 'Tune your title tag'),
      severity: 'High',
      category: t('seo.fixCards.categories.metaTags', 'Meta Tags'),
      impact: t('seo.fixCards.title.impact', 'Improves CTR in SERPs by 15-30%'),
      description: meta.title
        ? t('seo.fixCards.title.descriptionAdjust', 'Adjust title length to 50-60 chars and front-load the keyword.')
        : t('seo.fixCards.title.descriptionAdd', 'Add a clear, unique <title> for this page.'),
      problematicCode: meta.title
        ? '<!-- ' + t('seo.fixCards.comments.currentTitle', 'Current title') + ': ' + (meta.titleLength || 0) + ' ' + t('seo.fixCards.comments.characters', 'characters') + ' -->\n<title>' + (meta.title || '') + '</title>\n\n<!-- ' + t('seo.fixCards.comments.issues', 'Issues') + ': -->\n<!-- ' + (meta.titleLength < 50 ? t('seo.fixCards.comments.tooShort', '\u2717 Too short - missing keyword opportunity') : meta.titleLength > 60 ? t('seo.fixCards.comments.tooLong', '\u2717 Too long - will be truncated in SERPs') : t('seo.fixCards.comments.couldBeOptimized', '~ Could be optimized')) + ' -->'
        : '<!-- ' + t('seo.fixCards.comments.noTitleFound', 'No title tag found') + ' -->\n<head>\n  <!-- ' + t('seo.fixCards.comments.missingTitle', '\u2717 Missing <title> tag') + ' -->\n</head>',
      snippet: '<title>' + (meta.title || t('seo.fixCards.snippets.titlePlaceholder', 'Primary Keyword | Brand Name')) + '</title>\n\n<!-- ' + t('seo.fixCards.comments.bestPractices', 'Best practices') + ': -->\n<!-- ' + t('seo.fixCards.comments.title50to60', '\u2713 50-60 characters') + ' -->\n<!-- ' + t('seo.fixCards.comments.keywordNearStart', '\u2713 Primary keyword near the start') + ' -->\n<!-- ' + t('seo.fixCards.comments.brandAtEnd', '\u2713 Brand name at the end') + ' -->',
      steps: [
        t('seo.fixes.steps.title.step1', 'Keep title between 50-60 characters'),
        t('seo.fixes.steps.title.step2', 'Place primary keyword near the beginning'),
        t('seo.fixes.steps.title.step3', 'Make it compelling and unique for each page')
      ]
    });

    // 2. Meta description
    cards.push({
      title: t('seo.fixCards.description.title', 'Write a compelling meta description'),
      severity: 'Medium',
      category: t('seo.fixCards.categories.metaTags', 'Meta Tags'),
      impact: t('seo.fixCards.description.impact', 'Higher click-through and relevance signals'),
      description: t('seo.fixCards.description.description', 'Keep 150-160 chars, include a CTA, and ensure uniqueness.'),
      problematicCode: meta.description
        ? '<!-- ' + t('seo.fixCards.comments.current', 'Current') + ': ' + (meta.descriptionLength || 0) + ' ' + t('seo.fixCards.comments.characters', 'characters') + ' -->\n<meta name="description" content="' + (meta.description ? meta.description.substring(0, 80) : '') + '..." />\n\n<!-- ' + t('seo.fixCards.comments.issues', 'Issues') + ': -->\n<!-- ' + (meta.descriptionLength < 150 ? t('seo.fixCards.comments.descTooShort', '\u2717 Too short - not fully utilizing SERP space') : meta.descriptionLength > 160 ? t('seo.fixCards.comments.descTooLong', '\u2717 Too long - will be truncated') : t('seo.fixCards.comments.reviewForCta', '~ Review for CTA')) + ' -->'
        : '<!-- ' + t('seo.fixCards.comments.noDescriptionFound', 'No meta description found') + ' -->\n<head>\n  <!-- ' + t('seo.fixCards.comments.missingDescription', '\u2717 Missing meta description') + ' -->\n</head>',
      snippet: '<meta name="description" content="' + t('seo.fixCards.snippets.descriptionPlaceholder', 'Describe the main value proposition in 150-160 characters. Include a clear call to action.') + '" />\n\n<!-- ' + t('seo.fixCards.comments.bestPractices', 'Best practices') + ': -->\n<!-- ' + t('seo.fixCards.comments.desc150to160', '\u2713 150-160 characters') + ' -->\n<!-- ' + t('seo.fixCards.comments.includeCta', '\u2713 Include call-to-action') + ' -->\n<!-- ' + t('seo.fixCards.comments.uniquePerPage', '\u2713 Unique for each page') + ' -->',
      steps: [
        t('seo.fixes.steps.description.step1', 'Write 150-160 characters that summarize page content'),
        t('seo.fixes.steps.description.step2', 'Include a clear call-to-action'),
        t('seo.fixes.steps.description.step3', 'Ensure uniqueness across all pages')
      ]
    });

    // 3. Canonical + sitemap
    cards.push({
      title: t('seo.fixCards.canonical.title', 'Add canonical + sitemap refs'),
      severity: 'Medium',
      category: t('seo.fixCards.categories.technicalSeo', 'Technical SEO'),
      impact: t('seo.fixCards.canonical.impact', 'Prevents duplicate indexing issues'),
      description: t('seo.fixCards.canonical.description', 'Declare the preferred URL and list all discoverable URLs.'),
      problematicCode: '<!-- ' + t('seo.fixCards.comments.commonIssues', 'Common issues') + ': -->\n<!-- ' + t('seo.fixCards.comments.noCanonical', '\u2717 No canonical URL declared') + ' -->\n<!-- ' + t('seo.fixCards.comments.multipleVersions', '\u2717 Multiple versions indexed (www, non-www, http, https)') + ' -->\n<!-- ' + t('seo.fixCards.comments.sitemapNotReferenced', '\u2717 Sitemap not referenced') + ' -->\n\n<head>\n  <!-- ' + t('seo.fixCards.comments.missingCanonicalSitemap', 'Missing canonical and sitemap links') + ' -->\n</head>',
      snippet: '<link rel="canonical" href="https://' + analyzedDomain + '/" />\n<link rel="sitemap" type="application/xml" title="Sitemap" href="https://' + analyzedDomain + '/sitemap.xml" />\n\n<!-- ' + t('seo.fixCards.comments.inRobotsTxt', 'In robots.txt') + ': -->\nSitemap: https://' + analyzedDomain + '/sitemap.xml',
      steps: [
        t('seo.fixes.steps.canonical.step1', 'Add canonical link pointing to preferred URL'),
        t('seo.fixes.steps.canonical.step2', 'Create and submit XML sitemap to search engines'),
        t('seo.fixes.steps.canonical.step3', 'Reference sitemap in robots.txt')
      ]
    });

    // 4. JSON-LD structured data
    var structuredTypes = (structured.types && structured.types.length > 0) ? structured.types.join(', ') : t('seo.fixCards.comments.unknown', 'Unknown');
    cards.push({
      title: t('seo.fixCards.jsonld.title', 'Add JSON-LD (Article/Product)'),
      severity: 'High',
      category: t('seo.fixCards.categories.structuredData', 'Structured Data'),
      impact: t('seo.fixCards.jsonld.impact', 'Rich results eligibility - up to 30% more visibility'),
      description: t('seo.fixCards.jsonld.description', 'Provide structured data for the primary page type.'),
      problematicCode: structured.hasStructuredData
        ? '<!-- ' + t('seo.fixCards.comments.structuredDataFound', 'Structured data found but may need enhancement') + ' -->\n<!-- ' + t('seo.fixCards.comments.currentTypes', 'Current types') + ': ' + structuredTypes + ' -->\n\n<!-- ' + t('seo.fixCards.comments.checkFor', 'Check for') + ': -->\n<!-- ' + t('seo.fixCards.comments.requiredProperties', '~ Required properties') + ' -->\n<!-- ' + t('seo.fixCards.comments.recommendedProperties', '~ Recommended properties') + ' -->\n<!-- ' + t('seo.fixCards.comments.validJsonLd', '~ Valid JSON-LD syntax') + ' -->'
        : '<!-- ' + t('seo.fixCards.comments.noStructuredData', 'No structured data found') + ' -->\n<head>\n  <!-- ' + t('seo.fixCards.comments.missingJsonLd', '\u2717 Missing JSON-LD structured data') + ' -->\n  <!-- ' + t('seo.fixCards.comments.notEligible', '\u2717 Not eligible for rich results') + ' -->\n</head>',
      snippet: '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebPage",\n  "name": "' + (meta.title || t('seo.fixCards.snippets.pageTitle', 'Page Title')) + '",\n  "description": "' + (meta.description || t('seo.fixCards.snippets.pageDescription', 'Page description')) + '",\n  "url": "https://' + analyzedDomain + '/"\n}\n</script>',
      steps: [
        t('seo.fixes.steps.jsonld.step1', 'Identify the primary content type (Article, Product, etc.)'),
        t('seo.fixes.steps.jsonld.step2', 'Add JSON-LD script with required properties'),
        t('seo.fixes.steps.jsonld.step3', 'Test with Google Rich Results Test')
      ]
    });

    // 5. Preload critical assets
    cards.push({
      title: t('seo.fixCards.preload.title', 'Preload critical assets'),
      severity: 'Medium',
      category: t('seo.fixCards.categories.performance', 'Performance'),
      impact: t('seo.fixCards.preload.impact', 'Faster LCP and render - improves Core Web Vitals'),
      description: t('seo.fixCards.preload.description', 'Preload hero image, main font, and critical CSS.'),
      problematicCode: '<!-- ' + t('seo.fixCards.comments.commonIssues', 'Common issues') + ': -->\n<!-- ' + t('seo.fixCards.comments.heroNotPreloaded', '\u2717 Hero image not preloaded') + ' -->\n<!-- ' + t('seo.fixCards.comments.fontsCauseShift', '\u2717 Web fonts cause layout shift') + ' -->\n<!-- ' + t('seo.fixCards.comments.cssNotPrioritized', '\u2717 Critical CSS not prioritized') + ' -->\n\n<head>\n  <!-- ' + t('seo.fixCards.comments.noPreloadHints', 'No preload hints') + ' -->\n  <link rel="stylesheet" href="/styles.css">\n</head>',
      snippet: '<link rel="preload" as="image" href="/hero.webp" />\n<link rel="preload" as="style" href="/critical.css" />\n<link rel="preload" as="font" type="font/woff2" href="/fonts/main.woff2" crossorigin />\n\n<!-- ' + t('seo.fixCards.comments.bestPractices', 'Best practices') + ': -->\n<!-- ' + t('seo.fixCards.comments.preloadLcpImage', '\u2713 Preload LCP image') + ' -->\n<!-- ' + t('seo.fixCards.comments.preloadCriticalFonts', '\u2713 Preload critical fonts') + ' -->\n<!-- ' + t('seo.fixCards.comments.useCrossorigin', '\u2713 Use crossorigin for fonts') + ' -->',
      steps: [
        t('seo.fixes.steps.preload.step1', 'Identify above-the-fold critical resources'),
        t('seo.fixes.steps.preload.step2', 'Add preload hints for hero image and fonts'),
        t('seo.fixes.steps.preload.step3', 'Verify with browser DevTools Network panel')
      ]
    });

    // 6. Defer non-critical JS
    cards.push({
      title: t('seo.fixCards.defer.title', 'Defer non-critical JS'),
      severity: 'Low',
      category: t('seo.fixCards.categories.performance', 'Performance'),
      impact: t('seo.fixCards.defer.impact', 'Reduces blocking time - faster interactivity'),
      description: t('seo.fixCards.defer.description', 'Use defer for scripts that can wait until DOM is parsed.'),
      problematicCode: '<!-- ' + t('seo.fixCards.comments.commonIssues', 'Common issues') + ': -->\n<!-- ' + t('seo.fixCards.comments.scriptsBlocking', '\u2717 Scripts blocking page render') + ' -->\n<!-- ' + t('seo.fixCards.comments.analyticsSync', '\u2717 Analytics loading synchronously') + ' -->\n\n<head>\n  <script src="/app.js"><\/script>\n  <script src="/analytics.js"><\/script>\n</head>',
      snippet: '<head>\n  <!-- ' + t('seo.fixCards.comments.deferNonEssential', 'Defer non-essential scripts') + ' -->\n  <script src="/app.js" defer><\/script>\n  <script src="/analytics.js" defer><\/script>\n</head>\n\n<!-- ' + t('seo.fixCards.comments.orLoadAtEnd', 'Or load at end of body') + ': -->\n<body>\n  <!-- ' + t('seo.fixCards.comments.content', 'content') + ' -->\n  <script src="/app.js"><\/script>\n</body>',
      steps: [
        t('seo.fixes.steps.defer.step1', 'Add defer attribute to non-essential scripts'),
        t('seo.fixes.steps.defer.step2', 'Move analytics to async loading'),
        t('seo.fixes.steps.defer.step3', 'Test that functionality still works correctly')
      ]
    });

    return cards;
  }

  /**
   * Render a single fix card as HTML.
   * Produces a styled card with header (severity, title, category),
   * description, impact, code comparison, and step-by-step guide.
   */
  function _renderFixCard(fix, t, esc) {
    var severityLower = (fix.severity || 'medium').toLowerCase();

    var html = '<div class="pdf-fix-card">';

    // Header
    html += '<div class="pdf-fix-card__header">';
    html += '<span class="pdf-fix-card__severity pdf-fix-card__severity--' + severityLower + '">' + esc(fix.severity) + '</span>';
    html += '<span class="pdf-fix-card__title">' + esc(fix.title) + '</span>';
    html += '<span class="pdf-fix-card__category">' + esc(fix.category) + '</span>';
    html += '</div>';

    // Body
    html += '<div class="pdf-fix-card__body">';

    // Description
    html += '<div class="pdf-fix-card__description">' + esc(fix.description) + '</div>';

    // Impact
    if (fix.impact) {
      html += '<div class="pdf-fix-card__impact">';
      html += '<strong>' + t('seo.fixCards.impactLabel', 'Impact') + ':</strong> ' + esc(fix.impact);
      html += '</div>';
    }

    // Code comparison grid
    if (fix.problematicCode || fix.snippet) {
      html += '<div class="pdf-fix-card__code-grid">';

      if (fix.problematicCode) {
        html += '<div class="pdf-fix-card__code-block">';
        html += '<div class="pdf-fix-card__code-label pdf-fix-card__code-label--bad">' +
          t('seo.fixCards.codeLabels.problematic', 'Problematic Code') + '</div>';
        html += '<pre class="pdf-fix-card__code-pre">' + esc(fix.problematicCode) + '</pre>';
        html += '</div>';
      }

      if (fix.snippet) {
        html += '<div class="pdf-fix-card__code-block">';
        html += '<div class="pdf-fix-card__code-label pdf-fix-card__code-label--good">' +
          t('seo.fixCards.codeLabels.recommended', 'Recommended Code') + '</div>';
        html += '<pre class="pdf-fix-card__code-pre">' + esc(fix.snippet) + '</pre>';
        html += '</div>';
      }

      html += '</div>'; // end code-grid
    }

    // Step-by-step guide
    if (fix.steps && fix.steps.length > 0) {
      html += '<div class="pdf-fix-card__steps">';
      html += '<div class="pdf-fix-card__steps-title">' +
        t('seo.fixCards.stepsTitle', 'Step-by-Step Fix Guide') + '</div>';
      fix.steps.forEach(function (step, idx) {
        html += '<div class="pdf-fix-card__step">';
        html += '<span class="pdf-fix-card__step-num">' + (idx + 1) + '</span>';
        html += '<span>' + esc(step) + '</span>';
        html += '</div>';
      });
      html += '</div>'; // end steps
    }

    html += '</div>'; // end body
    html += '</div>'; // end fix-card

    return html;
  }

})(window);
