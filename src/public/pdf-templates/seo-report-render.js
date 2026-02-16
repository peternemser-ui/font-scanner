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

    /* -------------------------------------------------------------------
       Normalize lightweight-mode data shapes to match the full-analyzer
       field names that this renderer expects.  The lightweight SEO
       analyzer returns slightly different keys (e.g. totalHeadings vs
       total, totalImages vs total, totalLinks vs total, broken vs
       brokenFormat, schemaCount vs count).  Normalizing here avoids
       zero/NaN display bugs when a PDF is exported from lightweight
       results.
       ------------------------------------------------------------------- */
    (function _normalizeLightweight() {
      var hs = data.headingStructure;
      if (hs) {
        if (hs.total === undefined && hs.totalHeadings !== undefined) {
          hs.total = hs.totalHeadings;
        }
      }

      var ia = data.imageAnalysis;
      if (ia) {
        if (ia.total === undefined && ia.totalImages !== undefined) {
          ia.total = ia.totalImages;
        }
      }

      var la = data.linkAnalysis;
      if (la) {
        if (la.total === undefined && la.totalLinks !== undefined) {
          la.total = la.totalLinks;
        }
        if (la.brokenFormat === undefined && la.broken !== undefined) {
          la.brokenFormat = la.broken;
        }
      }

      var sd = data.structuredData;
      if (sd) {
        if (sd.count === undefined && sd.schemaCount !== undefined) {
          sd.count = sd.schemaCount;
        }
      }
    })();

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

      // Callout (mirrors web UI)
      html += PR.renderCallout(
        t('seo.report.metaTags.calloutTitle', '🏷️ Meta Tags are Your First Impression'),
        t('seo.report.metaTags.calloutBody', 'These tags control how your site appears in search results and social media. Optimizing them can increase click-through rates by 30-50%.'),
        'tip'
      );

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

      // Meta Tags Health — per-metric score bars (mirrors web UI heatmap)
      html += '<h3 class="pdf-subsection__title">' + esc(t('seo.report.metaTags.healthHeading', 'Meta Tags Health')) + '</h3>';

      var titleScore = d.title ? (d.titleLength >= 50 && d.titleLength <= 60 ? 100 : 70) : 0;
      var descScore  = d.description ? (d.descriptionLength >= 150 && d.descriptionLength <= 160 ? 100 : 70) : 0;
      var ogScore    = (d.ogTitle || d.ogDescription || d.ogImage) ? 100 : 0;
      var twScore    = d.twitterCard ? 100 : 0;
      var vpScore    = d.viewport ? 100 : 0;
      var canonScore = d.canonical ? 100 : 0;

      var healthItems = [
        { label: t('seo.report.metaTags.rows.title', 'Title'), score: titleScore },
        { label: t('seo.report.metaTags.rows.description', 'Description'), score: descScore },
        { label: t('seo.report.metaTags.rows.ogTags', 'OG Tags'), score: ogScore },
        { label: t('seo.report.metaTags.rows.twitter', 'Twitter'), score: twScore },
        { label: t('seo.report.metaTags.rows.viewport', 'Viewport'), score: vpScore },
        { label: t('seo.report.metaTags.rows.canonical', 'Canonical'), score: canonScore }
      ];

      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;">';
      healthItems.forEach(function (item) {
        var clr = utils.scoreColor(item.score);
        html += '<div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;">' +
          '<span style="min-width:80px;color:#555;">' + esc(item.label) + '</span>' +
          '<div style="flex:1;height:8px;background:#eee;border-radius:4px;overflow:hidden;">' +
            '<div style="width:' + item.score + '%;height:100%;background:' + clr + ';border-radius:4px;"></div>' +
          '</div>' +
          '<span style="min-width:30px;text-align:right;font-weight:600;color:' + clr + ';">' + item.score + '</span>' +
        '</div>';
      });
      html += '</div>';

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
        { value: d.total || 0, label: t('seo.report.headings.totalHeadingsLabel', 'total_headings') },
        { value: h1Count, label: t('seo.report.headings.primaryH1Label', 'primary_h1'), color: h1Count === 1 ? '#10b981' : '#ef4444' }
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
          html += '<div class="pdf-text-muted pdf-text-small">... ' + t('seo.report.common.moreCount', '... {{count}} more', { count: d.hierarchy.length - 15 }) + '</div>';
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
        { value: d.averageWordsPerSentence ? Math.round(d.averageWordsPerSentence) : '-', label: t('seo.report.content.avgWordsPerSentenceLineLabel', 'avg_words_per_sentence') }
      ]);

      // Content quality progress bars (mirrors web UI)
      var wordPct = Math.min(Math.round(((d.wordCount || 0) / 1000) * 100), 100);
      var readabilityPct = Math.min(100, Math.max(0, Math.round(100 - ((d.averageWordsPerSentence || 15) - 15) * 5)));
      var textRatioPct = Math.round((d.textToHTMLRatio || 0) * 100);
      var paraPct = Math.min(Math.round(((d.paragraphCount || 0) / 10) * 100), 100);

      html += PR.renderProgress(
        t('seo.report.content.wordCountLabel', 'Word Count: {{count}}', { count: d.wordCount || 0 }),
        d.wordCount || 0, 1000
      );
      html += PR.renderProgress(
        t('seo.report.content.readabilityScoreLabel', 'Readability Score'),
        readabilityPct, 100
      );
      html += PR.renderProgress(
        t('seo.report.content.textToHtmlLabel', 'Text-to-HTML: {{percent}}%', { percent: (d.textToHTMLRatio ? (d.textToHTMLRatio * 100).toFixed(1) : '0') }),
        textRatioPct, 100
      );
      html += PR.renderProgress(
        t('seo.report.content.paragraphsLabel', 'Paragraphs: {{count}}', { count: d.paragraphCount || 0 }),
        d.paragraphCount || 0, 10
      );

      // Content table with target thresholds
      var contentRows = [
        [t('seo.report.content.wordCountLineLabel', 'word_count'), String(d.wordCount || 0), d.wordCount >= 600 ? 'pass' : d.wordCount >= 300 ? 'warning' : 'fail', t('seo.report.content.target.wordCount', '600+ recommended')],
        [t('seo.report.content.sentencesLineLabel', 'sentences'), String(d.sentenceCount || 0), 'info', '-'],
        [t('seo.report.content.avgWordsPerSentenceLineLabel', 'avg_words_per_sentence'), d.averageWordsPerSentence ? d.averageWordsPerSentence.toFixed(1) : '-', d.averageWordsPerSentence && d.averageWordsPerSentence <= 20 ? 'pass' : 'warning', t('seo.report.content.target.avgWords', '15-20 words')],
        [t('seo.report.content.metrics.textRatio', 'Text Ratio'), d.textToHTMLRatio ? (d.textToHTMLRatio * 100).toFixed(1) + '%' : '-', d.textToHTMLRatio && d.textToHTMLRatio >= 0.15 ? 'pass' : 'warning', t('seo.report.content.target.textRatio', '15%+ recommended')],
        [t('seo.report.content.metrics.paragraphs', 'Paragraphs'), String(d.paragraphCount || 0), d.paragraphCount >= 5 ? 'pass' : d.paragraphCount >= 3 ? 'warning' : 'fail', t('seo.report.content.target.paragraphs', '5+ recommended')]
      ];

      html += PR.renderTable(
        [
          { label: t('seo.report.table.metric', 'Metric'), width: '30%' },
          { label: t('seo.report.table.value', 'Value'), width: '20%' },
          { label: t('seo.report.table.status', 'Status'), width: '20%' },
          { label: t('seo.report.table.target', 'Target'), width: '30%' }
        ],
        contentRows.map(function (r) {
          return [esc(r[0]), esc(r[1]), PR.renderStatus(r[2], r[2]), esc(r[3])];
        }),
        { striped: true }
      );

      // Content Health — per-dimension scores (mirrors web UI heatmap)
      html += '<h3 class="pdf-subsection__title">' + esc(t('seo.report.content.healthHeading', 'Content Health')) + '</h3>';

      var cWordScore = (d.wordCount || 0) >= 600 ? 100 : (d.wordCount || 0) >= 300 ? 70 : 40;
      var cReadScore = (d.averageWordsPerSentence || 0) <= 20 ? 100 : (d.averageWordsPerSentence || 0) <= 25 ? 70 : 40;
      var cRatioScore = (d.textToHTMLRatio || 0) >= 0.25 ? 100 : (d.textToHTMLRatio || 0) >= 0.15 ? 70 : 40;
      var cParaScore = (d.paragraphCount || 0) >= 5 ? 100 : (d.paragraphCount || 0) >= 3 ? 70 : 40;

      var cHealthItems = [
        { label: t('seo.report.content.metrics.wordCount', 'Word Count'), score: cWordScore },
        { label: t('seo.report.content.metrics.readability', 'Readability'), score: cReadScore },
        { label: t('seo.report.content.metrics.textRatio', 'Text Ratio'), score: cRatioScore },
        { label: t('seo.report.content.metrics.paragraphs', 'Paragraphs'), score: cParaScore }
      ];

      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;">';
      cHealthItems.forEach(function (item) {
        var clr = utils.scoreColor(item.score);
        html += '<div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;">' +
          '<span style="min-width:80px;color:#555;">' + esc(item.label) + '</span>' +
          '<div style="flex:1;height:8px;background:#eee;border-radius:4px;overflow:hidden;">' +
            '<div style="width:' + item.score + '%;height:100%;background:' + clr + ';border-radius:4px;"></div>' +
          '</div>' +
          '<span style="min-width:30px;text-align:right;font-weight:600;color:' + clr + ';">' + item.score + '</span>' +
        '</div>';
      });
      html += '</div>';

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
        t('seo.report.images.calloutTitle', 'I Image SEO: Alt Text is Critical'),
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
          { value: altPct + '%', label: t('seo.report.images.radial.altCoverage', 'Alt Text Coverage'), color: altPct >= 80 ? '#10b981' : '#f59e0b' },
          { value: (score || 0) + '/100', label: t('seo.report.images.radial.overallScore', 'Overall Score'), color: utils.scoreColor(score || 0) }
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
            var recommendation = img.alt
              ? t('seo.report.images.recommendation.pass', 'Descriptive, helps SEO and accessibility')
              : t('seo.report.images.recommendation.fail', 'Add descriptive alt text for SEO + screen readers');
            return [
              '<span class="pdf-table__truncate">' + esc(truncate(img.src, 50)) + '</span>',
              (img.width && img.height) ? img.width + 'x' + img.height : '-',
              '<div class="pdf-table__value">' + esc(truncate(img.alt || '-', 60)) + '</div>',
              PR.renderStatus(altStatus, t('seo.report.status.' + altStatus, altStatus)),
              '<span style="font-size:0.78rem;color:#555;">' + esc(recommendation) + '</span>'
            ];
          });

          html += PR.renderTable(
            [
              { label: t('seo.report.images.table.imageUrl', 'Image URL'), width: '24%' },
              { label: t('seo.report.images.table.dimensions', 'Dimensions'), width: '12%' },
              { label: t('seo.report.images.table.altText', 'Alt Text'), width: '26%' },
              { label: t('seo.report.table.status', 'Status'), width: '10%' },
              { label: t('seo.report.table.recommendation', 'Recommendation'), width: '28%' }
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

      var linkTotal = d.total || 0;
      var internalPct = linkTotal > 0 ? ((d.internal || 0) / linkTotal * 100).toFixed(1) : '0';
      var externalPct = linkTotal > 0 ? ((d.external || 0) / linkTotal * 100).toFixed(1) : '0';

      html += PR.renderMetrics([
        { value: linkTotal, label: t('seo.report.links.totalLinksLabel', 'total_links') },
        { value: (d.internal || 0) + ' (' + internalPct + '%)', label: t('seo.report.links.internalLinksLabel', 'internal_links') },
        { value: (d.external || 0) + ' (' + externalPct + '%)', label: t('seo.report.links.externalLinksLabel', 'external_links') },
        { value: d.noFollow || 0, label: t('seo.report.links.nofollowLinksLabel', 'nofollow_links') }
      ]);

      // Broken links metric
      var brokenCount = d.brokenFormat || 0;
      if (brokenCount > 0) {
        html += PR.renderIssue(
          t('seo.report.links.brokenFormatLabel', 'broken_format') + ': ' + brokenCount + ' ' + t('common.pdf.execSummary.issuesFound', 'Issues Found'),
          'warning'
        );
      }

      // Link distribution table (mirrors web UI detail)
      html += PR.renderTable(
        [
          { label: t('seo.report.table.metric', 'Metric'), width: '30%' },
          { label: t('seo.report.table.value', 'Value'), width: '20%' },
          { label: t('seo.report.links.table.percentage', 'Percentage'), width: '20%' },
          { label: t('seo.report.table.status', 'Status'), width: '30%' }
        ],
        [
          [
            esc(t('seo.report.links.internalLinksLabel', 'internal_links')),
            String(d.internal || 0),
            internalPct + '%',
            PR.renderStatus(d.internal > 0 ? 'pass' : 'warning', d.internal > 0 ? 'pass' : 'warning')
          ],
          [
            esc(t('seo.report.links.externalLinksLabel', 'external_links')),
            String(d.external || 0),
            externalPct + '%',
            PR.renderStatus('info', 'info')
          ],
          [
            esc(t('seo.report.links.nofollowLinksLabel', 'nofollow_links')),
            String(d.noFollow || 0),
            linkTotal > 0 ? ((d.noFollow || 0) / linkTotal * 100).toFixed(1) + '%' : '0%',
            PR.renderStatus('info', 'info')
          ],
          [
            esc(t('seo.report.links.brokenFormatLabel', 'broken_format')),
            String(brokenCount),
            linkTotal > 0 ? (brokenCount / linkTotal * 100).toFixed(1) + '%' : '0%',
            PR.renderStatus(brokenCount === 0 ? 'pass' : 'warning', brokenCount === 0 ? 'pass' : 'warning')
          ]
        ],
        { striped: true }
      );

      // Link progress bars
      if (linkTotal > 0) {
        html += PR.renderProgress(t('seo.report.links.internalLinksLabel', 'internal_links'), d.internal || 0, linkTotal);
        html += PR.renderProgress(t('seo.report.links.externalLinksLabel', 'external_links'), d.external || 0, linkTotal);
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
        t('seo.report.mobile.calloutTitle', 'M Mobile-First Indexing'),
        t('seo.report.mobile.calloutBody', 'Google now uses the mobile version of your site for indexing and ranking. Mobile responsiveness is critical for SEO.'),
        'tip'
      );

      if (d.viewports && d.viewports.length > 0) {
        var mobileRows = d.viewports.map(function (vp) {
          var deviceName = vp.viewport || '-';
          var rec = deviceName === 'Mobile'
            ? t('seo.report.mobile.recommendations.mobile', '≥ 16px fonts, no horizontal scroll')
            : deviceName === 'Tablet'
              ? t('seo.report.mobile.recommendations.tablet', 'Responsive layout, touch-friendly')
              : t('seo.report.mobile.recommendations.desktop', 'Desktop fallback');
          return [
            '<strong>' + esc(deviceName) + '</strong>',
            vp.width ? vp.width + 'px' : '-',
            PR.renderStatus(!vp.hasHorizontalScroll ? 'pass' : 'fail', t('seo.report.status.' + (!vp.hasHorizontalScroll ? 'yes' : 'no'))),
            PR.renderStatus(vp.hasViewportMeta ? 'pass' : 'fail', t('seo.report.status.' + (vp.hasViewportMeta ? 'yes' : 'no'))),
            PR.renderStatus(vp.fontSizeReadable ? 'pass' : 'fail', t('seo.report.status.' + (vp.fontSizeReadable ? 'yes' : 'no'))),
            '<span style="font-size:0.78rem;color:#555;">' + esc(rec) + '</span>'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('seo.report.mobile.table.deviceType', 'Device Type'), width: '14%' },
            { label: t('seo.report.mobile.table.width', 'Width'), width: '10%' },
            { label: t('seo.report.mobile.table.noHorizontalScroll', 'No Horizontal Scroll'), width: '14%' },
            { label: t('seo.report.mobile.table.viewportMeta', 'Viewport Meta'), width: '14%' },
            { label: t('seo.report.mobile.table.readableFontSize', 'Readable Font Size'), width: '14%' },
            { label: t('seo.report.table.recommended', 'Recommended'), width: '34%' }
          ],
          mobileRows,
          { striped: true }
        );

        // Summary metric cards (mirrors web UI grid cards)
        var noScrollAll = d.viewports.every(function (vp) { return !vp.hasHorizontalScroll; });
        var vpMetaAll   = d.viewports.every(function (vp) { return vp.hasViewportMeta; });
        var readableCount = d.viewports.filter(function (vp) { return vp.fontSizeReadable; }).length;
        var readableAll = readableCount === d.viewports.length;

        html += PR.renderMetrics([
          {
            value: noScrollAll
              ? t('seo.report.mobile.cards.none', 'None')
              : t('seo.report.mobile.cards.detected', 'Detected'),
            label: t('seo.report.mobile.cards.horizontalScroll', 'Horizontal Scroll'),
            color: noScrollAll ? '#10b981' : '#ef4444'
          },
          {
            value: vpMetaAll
              ? t('seo.report.status.present', 'Present')
              : t('seo.report.status.missing', 'Missing'),
            label: t('seo.report.mobile.cards.viewportMetaTag', 'Viewport Meta Tag'),
            color: vpMetaAll ? '#10b981' : '#f59e0b'
          },
          {
            value: t('seo.report.mobile.cards.devicesFraction', '{{count}}/{{total}} Devices', { count: readableCount, total: d.viewports.length }),
            label: t('seo.report.mobile.cards.fontReadability', 'Font Readability'),
            color: readableAll ? '#10b981' : '#f59e0b'
          }
        ]);
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

      // Common schema types lookup (mirrors seo-script.js)
      var commonSchemas = {
        Organization:        { desc: t('seo.report.structuredData.schemas.Organization.desc', 'Company/Brand information'), benefit: t('seo.report.structuredData.schemas.Organization.benefit', 'Establishes brand identity in Knowledge Graph'), fields: ['name', 'logo', 'url', 'contactPoint', 'sameAs'] },
        Person:              { desc: t('seo.report.structuredData.schemas.Person.desc', 'Individual profile data'), benefit: t('seo.report.structuredData.schemas.Person.benefit', 'Powers author rich snippets and Knowledge Panel'), fields: ['name', 'image', 'jobTitle', 'worksFor', 'sameAs'] },
        Product:             { desc: t('seo.report.structuredData.schemas.Product.desc', 'Product listings & details'), benefit: t('seo.report.structuredData.schemas.Product.benefit', 'Shows price, availability, and reviews in search'), fields: ['name', 'image', 'description', 'sku', 'offers', 'aggregateRating'] },
        Article:             { desc: t('seo.report.structuredData.schemas.Article.desc', 'Blog posts & articles'), benefit: t('seo.report.structuredData.schemas.Article.benefit', 'Enables article snippets with author and publish date'), fields: ['headline', 'author', 'datePublished', 'image'] },
        WebSite:             { desc: t('seo.report.structuredData.schemas.WebSite.desc', 'Website metadata'), benefit: t('seo.report.structuredData.schemas.WebSite.benefit', 'Enables sitelinks search box in Google'), fields: ['name', 'url', 'potentialAction'] },
        BreadcrumbList:      { desc: t('seo.report.structuredData.schemas.BreadcrumbList.desc', 'Navigation breadcrumbs'), benefit: t('seo.report.structuredData.schemas.BreadcrumbList.benefit', 'Shows breadcrumb trail in search results'), fields: ['itemListElement', 'position', 'name', 'item'] },
        LocalBusiness:       { desc: t('seo.report.structuredData.schemas.LocalBusiness.desc', 'Local business info'), benefit: t('seo.report.structuredData.schemas.LocalBusiness.benefit', 'Appears in local search and Google Maps'), fields: ['name', 'address', 'telephone', 'openingHours', 'geo'] },
        Event:               { desc: t('seo.report.structuredData.schemas.Event.desc', 'Event information'), benefit: t('seo.report.structuredData.schemas.Event.benefit', 'Shows event details in search with "Add to Calendar"'), fields: ['name', 'startDate', 'location', 'description', 'offers'] },
        Recipe:              { desc: t('seo.report.structuredData.schemas.Recipe.desc', 'Recipe content'), benefit: t('seo.report.structuredData.schemas.Recipe.benefit', 'Rich recipe cards with ratings, cook time, calories'), fields: ['name', 'image', 'author', 'recipeIngredient', 'recipeInstructions'] },
        Review:              { desc: t('seo.report.structuredData.schemas.Review.desc', 'User reviews'), benefit: t('seo.report.structuredData.schemas.Review.benefit', 'Display star ratings directly in search results'), fields: ['itemReviewed', 'reviewRating', 'author', 'reviewBody'] },
        VideoObject:         { desc: t('seo.report.structuredData.schemas.VideoObject.desc', 'Video content'), benefit: t('seo.report.structuredData.schemas.VideoObject.benefit', 'Video snippets with thumbnails and key moments'), fields: ['name', 'description', 'thumbnailUrl', 'uploadDate', 'duration'] },
        FAQPage:             { desc: t('seo.report.structuredData.schemas.FAQPage.desc', 'FAQ content'), benefit: t('seo.report.structuredData.schemas.FAQPage.benefit', 'Expandable FAQ sections in search results'), fields: ['mainEntity', 'name', 'acceptedAnswer'] },
        HowTo:               { desc: t('seo.report.structuredData.schemas.HowTo.desc', 'Step-by-step guides'), benefit: t('seo.report.structuredData.schemas.HowTo.benefit', 'Numbered steps with images in search'), fields: ['name', 'step', 'totalTime', 'tool', 'supply'] },
        SoftwareApplication: { desc: t('seo.report.structuredData.schemas.SoftwareApplication.desc', 'Software/app details'), benefit: t('seo.report.structuredData.schemas.SoftwareApplication.benefit', 'App install buttons and ratings in search'), fields: ['name', 'operatingSystem', 'applicationCategory', 'offers', 'aggregateRating'] },
        JobPosting:          { desc: t('seo.report.structuredData.schemas.JobPosting.desc', 'Job listings'), benefit: t('seo.report.structuredData.schemas.JobPosting.benefit', 'Appears in Google for Jobs with salary and location'), fields: ['title', 'description', 'datePosted', 'employmentType', 'hiringOrganization'] }
      };

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('seo.report.sectionIntros.structuredData', 'Structured data helps search engines understand your content and enables rich results such as star ratings, FAQs, and product cards in search results. Pages with rich results typically see 20-30% higher click-through rates compared to standard listings. This section checks for JSON-LD and Microdata markup, including the schema types implemented on your page. Google recommends JSON-LD as the preferred format for structured data implementation.')) + '</p>';

      // Info callout with benefit cards
      html += PR.renderCallout(
        t('seo.report.structuredData.info.title', 'ⓘ What is Structured Data Schema?'),
        t('seo.report.structuredData.info.body', 'Structured data (also called schema markup) is code that helps search engines understand your content better, enabling <strong style="color: #00ff41;">rich search results</strong> like star ratings, product prices, event dates, FAQ dropdowns, and more. It uses the <strong style="color: #00ccff;">Schema.org</strong> vocabulary in JSON-LD, Microdata, or RDFa formats.'),
        'info'
      );

      // Benefit mini-cards (mirrors web UI structured data info cards)
      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:12px 0;">';
      var sdBenefits = [
        { title: t('seo.report.structuredData.info.cards.ctr.title', 'U Improved CTR'), body: t('seo.report.structuredData.info.cards.ctr.body', 'Rich results stand out and attract more clicks') },
        { title: t('seo.report.structuredData.info.cards.targeting.title', 'T Better Targeting'), body: t('seo.report.structuredData.info.cards.targeting.body', 'Helps search engines understand your niche') },
        { title: t('seo.report.structuredData.info.cards.advantage.title', 'W SEO Advantage'), body: t('seo.report.structuredData.info.cards.advantage.body', 'Competitive edge in search results') }
      ];
      sdBenefits.forEach(function (b) {
        html += '<div style="padding:10px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;">' +
          '<div style="font-weight:600;font-size:0.82rem;color:#0369a1;margin-bottom:3px;">' + esc(b.title) + '</div>' +
          '<div style="font-size:0.75rem;color:#555;">' + esc(b.body) + '</div>' +
        '</div>';
      });
      html += '</div>';

      // Top-level metrics
      // API returns `count` (number of JSON-LD schemas found) but not separate
      // `jsonLdCount` / `microdataCount` fields.  Derive them so the metrics
      // display correctly for both full and lightweight analyzer responses.
      var jsonLdCount = d.jsonLdCount !== undefined ? d.jsonLdCount : (d.count || 0);
      var microdataCount = d.microdataCount !== undefined ? d.microdataCount : 0;

      html += PR.renderMetrics([
        { value: d.hasStructuredData ? t('seo.report.status.detected', 'Detected') : t('seo.report.status.notDetected', 'Not detected'), label: t('seo.structuredData', 'Structured Data'), color: d.hasStructuredData ? '#10b981' : '#ef4444' },
        { value: jsonLdCount, label: 'JSON-LD' },
        { value: microdataCount, label: t('seo.report.structuredData.microdataLabel', 'Microdata') },
        { value: d.count || 0, label: t('seo.report.headings.table.count', 'Count') }
      ]);

      // Summary table
      html += '<h3 class="pdf-subsection__title">' + esc(t('seo.report.structuredData.summary.heading', 'Summary')) + '</h3>';

      var summaryTypesImpact = (d.count || 0) >= 3
        ? t('seo.report.structuredData.summary.rows.types.impact.great', 'Great coverage')
        : (d.count || 0) >= 1
          ? t('seo.report.structuredData.summary.rows.types.impact.good', 'Good start')
          : t('seo.report.structuredData.summary.rows.types.impact.none', 'None implemented');

      var summaryScoreImpact = (d.score || 0) >= 80
        ? t('seo.report.structuredData.summary.rows.score.impact.excellent', 'Excellent implementation')
        : (d.score || 0) >= 60
          ? t('seo.report.structuredData.summary.rows.score.impact.room', 'Room for improvement')
          : t('seo.report.structuredData.summary.rows.score.impact.critical', 'Critical gap');

      html += PR.renderTable(
        [
          { label: t('seo.report.table.metric', 'Metric'), width: '25%' },
          { label: t('seo.report.table.status', 'Status'), width: '12%' },
          { label: t('seo.report.table.value', 'Value'), width: '25%' },
          { label: t('seo.report.structuredData.summary.table.impact', 'Impact'), width: '38%' }
        ],
        [
          [
            esc(t('seo.report.structuredData.summary.rows.found.metric', 'Structured Data Found')),
            PR.renderStatus(d.hasStructuredData ? 'pass' : 'fail', d.hasStructuredData ? '✓' : '✗'),
            '<strong>' + esc(d.hasStructuredData ? t('seo.report.status.detected', 'Detected') : t('seo.report.status.notFound', 'Not found')) + '</strong>',
            esc(d.hasStructuredData
              ? t('seo.report.structuredData.summary.rows.found.impact.detected', 'Enables rich search results')
              : t('seo.report.structuredData.summary.rows.found.impact.notFound', 'Missing enhanced search appearances'))
          ],
          [
            esc(t('seo.report.structuredData.summary.rows.types.metric', 'Schema Types Implemented')),
            PR.renderStatus('info', String(d.count || 0)),
            '<strong>' + (d.count || 0) + ' ' + ((d.count || 0) === 1
              ? esc(t('seo.report.structuredData.summary.rows.types.value.singular', 'Type'))
              : esc(t('seo.report.structuredData.summary.rows.types.value.plural', 'Types'))) + '</strong>',
            esc(summaryTypesImpact)
          ],
          [
            esc(t('seo.report.structuredData.summary.rows.score.metric', 'Overall Score')),
            PR.renderStatus('info', String(d.score || 0)),
            '<strong>' + (d.score || 0) + '/100</strong>',
            esc(summaryScoreImpact)
          ]
        ],
        { striped: true }
      );

      // Branch: data found vs not found
      if (d.hasStructuredData) {
        // Detected schema types table
        if (d.types && d.types.length > 0) {
          html += '<h3 class="pdf-subsection__title">' + esc(t('seo.report.structuredData.detected.heading', 'Detected Schema Types')) + '</h3>';
          var schemaRows = d.types.map(function (type) {
            var schema = commonSchemas[type] || {
              desc: t('seo.report.structuredData.detected.unknown.desc', 'Schema markup'),
              benefit: t('seo.report.structuredData.detected.unknown.benefit', 'Structured data implementation'),
              fields: []
            };
            var fieldsHtml = schema.fields.slice(0, 3).map(function (f) {
              return '<code style="background:#e0f2fe;color:#0369a1;padding:1px 4px;border-radius:3px;font-size:0.75rem;">' + esc(f) + '</code>';
            }).join(' ');
            if (schema.fields.length > 3) {
              fieldsHtml += ' <span style="color:#888;font-size:0.75rem;">+' + (schema.fields.length - 3) + '</span>';
            }
            return [
              '<strong>' + esc(type) + '</strong><br/><span style="font-size:0.75rem;color:#888;">' + esc(schema.desc) + '</span>',
              esc(schema.benefit),
              fieldsHtml || '-'
            ];
          });

          html += PR.renderTable(
            [
              { label: t('seo.report.structuredData.detected.table.schemaType', 'Schema Type'), width: '30%' },
              { label: t('seo.report.structuredData.detected.table.seoBenefit', 'SEO Benefit'), width: '45%' },
              { label: t('seo.report.structuredData.detected.table.keyFields', 'Key Fields'), width: '25%' }
            ],
            schemaRows,
            { striped: true }
          );
        }

        // Validation tip
        html += PR.renderCallout(
          t('seo.report.structuredData.validation.title', '✓ Next Step: Validate Your Schema'),
          t('seo.report.structuredData.validation.body.beforeLink', 'Use') + ' ' +
            t('seo.report.structuredData.validation.body.linkText', "Google's Rich Results Test") +
            ' (search.google.com/test/rich-results) ' +
            t('seo.report.structuredData.validation.body.afterLink', 'to ensure your structured data is error-free and eligible for rich snippets. Monitor Search Console for structured data errors.'),
          'tip'
        );
      } else {
        // Missing structured data — show opportunity
        html += '<h3 class="pdf-subsection__title" style="color:#ef4444;">' + esc(t('seo.report.structuredData.missing.heading', 'Missing Critical SEO Opportunity')) + '</h3>';

        html += PR.renderCallout(
          t('seo.report.structuredData.missing.card.title', 'No Structured Data Detected'),
          t('seo.report.structuredData.missing.card.body', "You're missing enhanced search appearances that boost visibility and click-through rates"),
          'warning'
        );

        // Rich results impact table
        html += PR.renderTable(
          [
            { label: t('seo.report.structuredData.missing.table.richResultType', 'Rich Result Type'), width: '25%' },
            { label: t('seo.report.structuredData.missing.table.whatMissing', "What You're Missing"), width: '50%' },
            { label: t('seo.report.structuredData.missing.table.ctrImpact', 'CTR Impact'), width: '25%' }
          ],
          [
            [
              '<strong>' + esc(t('seo.report.structuredData.missing.rows.starRatings.title', 'Star Ratings')) + '</strong>',
              esc(t('seo.report.structuredData.missing.rows.starRatings.body', 'Display review stars and ratings directly in search results')),
              '<strong style="color:#10b981;">+35%</strong>'
            ],
            [
              '<strong>' + esc(t('seo.report.structuredData.missing.rows.productInfo.title', 'Product Info')) + '</strong>',
              esc(t('seo.report.structuredData.missing.rows.productInfo.body', 'Show prices, availability, and special offers inline')),
              '<strong style="color:#10b981;">+25%</strong>'
            ],
            [
              '<strong>' + esc(t('seo.report.structuredData.missing.rows.eventDetails.title', 'Event Details')) + '</strong>',
              esc(t('seo.report.structuredData.missing.rows.eventDetails.body', 'Event dates, locations, and ticket info with calendar integration')),
              '<strong style="color:#f59e0b;">+20%</strong>'
            ],
            [
              '<strong>' + esc(t('seo.report.structuredData.missing.rows.richMedia.title', 'Rich Media')) + '</strong>',
              esc(t('seo.report.structuredData.missing.rows.richMedia.body', 'Enhanced thumbnails, carousels, and video snippets')),
              '<strong style="color:#f59e0b;">+18%</strong>'
            ],
            [
              '<strong>' + esc(t('seo.report.structuredData.missing.rows.faq.title', 'FAQ Dropdowns')) + '</strong>',
              esc(t('seo.report.structuredData.missing.rows.faq.body', 'Expandable Q&A sections directly in search results')),
              '<strong style="color:#f59e0b;">+15%</strong>'
            ]
          ],
          { striped: true }
        );

        // Recommended schemas
        html += '<h3 class="pdf-subsection__title">' + esc(t('seo.report.structuredData.recommended.heading', 'Recommended Schema Types to Implement')) + '</h3>';

        html += PR.renderCallout(
          t('seo.report.structuredData.recommended.box.title', 'Start with these foundational schemas'),
          t('seo.report.structuredData.recommended.box.body', 'that work for almost every website. You can add more specific schemas based on your content type later.'),
          'info'
        );

        var recSchemas = [
          { type: 'Organization', priority: t('seo.report.structuredData.priority.high', 'HIGH'), severity: 'high' },
          { type: 'WebSite', priority: t('seo.report.structuredData.priority.high', 'HIGH'), severity: 'high' },
          { type: 'BreadcrumbList', priority: t('seo.report.structuredData.priority.medium', 'MEDIUM'), severity: 'medium' },
          { type: 'Article', priority: t('seo.report.structuredData.priority.medium', 'MEDIUM'), severity: 'medium' }
        ];

        var recRows = recSchemas.map(function (item) {
          var schema = commonSchemas[item.type];
          var fieldsHtml = schema.fields.slice(0, 4).map(function (f) {
            return '<code style="background:#e0f2fe;color:#0369a1;padding:1px 4px;border-radius:3px;font-size:0.75rem;">' + esc(f) + '</code>';
          }).join(' ');
          return [
            '<strong>' + esc(item.type) + '</strong><br/><span style="font-size:0.75rem;color:#888;">' + esc(schema.desc) + '</span>',
            PR.renderStatus(item.severity, item.priority),
            esc(schema.benefit),
            fieldsHtml
          ];
        });

        html += PR.renderTable(
          [
            { label: t('seo.report.structuredData.recommended.table.schemaType', 'Schema Type'), width: '22%' },
            { label: t('seo.report.structuredData.recommended.table.priority', 'Priority'), width: '12%' },
            { label: t('seo.report.structuredData.recommended.table.seoBenefit', 'SEO Benefit'), width: '38%' },
            { label: t('seo.report.structuredData.recommended.table.requiredFields', 'Required Fields'), width: '28%' }
          ],
          recRows,
          { striped: true }
        );

        // Pro Tip callout (mirrors web UI)
        html += PR.renderCallout(
          t('seo.report.structuredData.proTip.label', 'ⓘ Pro Tip:'),
          t('seo.report.structuredData.proTip.body', 'Rich results can increase click-through rates by 15-35% according to Google research. Start with the foundational schemas below to unlock these benefits.'),
          'tip'
        );
      }

      // Implementation Formats subsection (shown for both cases)
      html += '<h3 class="pdf-subsection__title">' + esc(t('seo.report.structuredData.formats.heading', 'Implementation Formats')) + '</h3>';

      html += PR.renderTable(
        [
          { label: t('seo.report.structuredData.formats.table.format', 'Format'), width: '18%' },
          { label: t('seo.report.table.status', 'Status'), width: '14%' },
          { label: t('seo.report.structuredData.formats.table.description', 'Description'), width: '40%' },
          { label: t('seo.report.structuredData.formats.table.example', 'Example'), width: '28%' }
        ],
        [
          [
            '<strong>JSON-LD</strong>',
            PR.renderStatus('pass', t('seo.report.structuredData.formats.jsonld.badge', 'RECOMMENDED')),
            esc(t('seo.report.structuredData.formats.jsonld.body', "JavaScript Object Notation for Linked Data. Google's preferred format - clean, separate from HTML, easy to maintain.")),
            '<code style="font-size:0.7rem;">&lt;script type="application/ld+json"&gt;{...}&lt;/script&gt;</code>'
          ],
          [
            '<strong>Microdata</strong>',
            PR.renderStatus('info', t('seo.report.structuredData.formats.microdata.subtitle', 'HTML Attributes')),
            esc(t('seo.report.structuredData.formats.microdata.body', 'Embedded directly in HTML tags. More complex to maintain but tightly couples markup with content.')),
            '<code style="font-size:0.7rem;">&lt;div itemscope itemtype="..."&gt;</code>'
          ],
          [
            '<strong>RDFa</strong>',
            PR.renderStatus('info', t('seo.report.structuredData.formats.rdfa.subtitle', 'Resource Description')),
            esc(t('seo.report.structuredData.formats.rdfa.body', 'Resource Description Framework in Attributes. Similar to Microdata, uses different attribute names.')),
            '<code style="font-size:0.7rem;">&lt;div vocab="..." typeof="..."&gt;</code>'
          ]
        ],
        { striped: true }
      );

      // Essential Resources & Tools
      html += '<h3 class="pdf-subsection__title">' + esc(t('seo.report.structuredData.resources.heading', 'Essential Resources & Tools')) + '</h3>';

      html += PR.renderTable(
        [
          { label: t('seo.report.structuredData.resources.table.tool', 'Tool'), width: '22%' },
          { label: t('seo.report.table.purpose', 'Purpose'), width: '55%' },
          { label: t('seo.report.structuredData.resources.table.link', 'Link'), width: '23%' }
        ],
        [
          [
            '<strong>' + esc(t('seo.report.structuredData.resources.rows.schemaDocs.title', 'Schema.org Docs')) + '</strong>',
            esc(t('seo.report.structuredData.resources.rows.schemaDocs.purpose', 'Official vocabulary reference with complete documentation for all schema types and properties')),
            esc(t('seo.report.structuredData.resources.rows.schemaDocs.linkText', 'schema.org →'))
          ],
          [
            '<strong>' + esc(t('seo.report.structuredData.resources.rows.richResultsTest.title', 'Rich Results Test')) + '</strong>',
            esc(t('seo.report.structuredData.resources.rows.richResultsTest.purpose', 'Test your structured data markup and see which Google rich results can be generated from it')),
            esc(t('seo.report.structuredData.resources.rows.richResultsTest.linkText', 'Test Markup →'))
          ],
          [
            '<strong>' + esc(t('seo.report.structuredData.resources.rows.validator.title', 'Schema Validator')) + '</strong>',
            esc(t('seo.report.structuredData.resources.rows.validator.purpose', 'Comprehensive validation tool for all structured data formats including JSON-LD, Microdata, and RDFa')),
            esc(t('seo.report.structuredData.resources.rows.validator.linkText', 'Validate →'))
          ],
          [
            '<strong>' + esc(t('seo.report.structuredData.resources.rows.googleGuide.title', 'Google Guide')) + '</strong>',
            esc(t('seo.report.structuredData.resources.rows.googleGuide.purpose', 'Step-by-step guide from Google on implementing structured data with code examples and best practices')),
            esc(t('seo.report.structuredData.resources.rows.googleGuide.linkText', 'Read Guide →'))
          ],
          [
            '<strong>' + esc(t('seo.report.structuredData.resources.rows.generator.title', 'Markup Generator')) + '</strong>',
            esc(t('seo.report.structuredData.resources.rows.generator.purpose', 'Free tool to generate JSON-LD structured data markup for various schema types quickly and easily')),
            esc(t('seo.report.structuredData.resources.rows.generator.linkText', 'Generate →'))
          ]
        ],
        { striped: true }
      );

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

      // Technical SEO Essentials callout
      html += PR.renderCallout(
        t('seo.report.additional.calloutTitle', '🔧 Technical SEO Essentials'),
        t('seo.report.additional.calloutBody', 'These technical elements help search engines crawl, index, and understand your site. Missing items can significantly impact discoverability.'),
        'tip'
      );

      // Status labels
      var found = t('seo.report.status.found', 'Found');
      var notFound = t('seo.report.status.notFound', 'Not found');
      var present = t('seo.report.status.present', 'Present');
      var missingLbl = t('seo.report.status.missing', 'Missing');
      var detectedLbl = t('seo.report.status.detected', 'Detected');
      var notDetectedLbl = t('seo.report.status.notDetected', 'Not detected');

      // Technical SEO table (5 columns)
      html += '<h3 class="pdf-subsection__title">' + esc(t('seo.report.additional.technicalHeading', 'Technical SEO')) + '</h3>';

      var techRows = [
        [
          'robots.txt',
          PR.renderStatus(d.hasRobotsTxt ? 'pass' : 'warning', d.hasRobotsTxt ? '✓ ' + found : '~ ' + notFound),
          esc(t('seo.report.additional.purpose.robots', 'Controls search engine crawling')),
          esc(d.hasRobotsTxt
            ? t('seo.report.additional.details.robotsPresent', 'File is present and accessible')
            : t('seo.report.additional.details.robotsMissing', 'Missing - create /robots.txt')),
          esc(t('seo.report.additional.bestPractice.robots', 'Allow crawlers, disallow admin/private pages'))
        ],
        [
          esc(t('seo.report.additional.checks.sitemap', 'XML Sitemap')),
          PR.renderStatus(d.hasSitemap ? 'pass' : 'warning', d.hasSitemap ? '✓ ' + found : '~ ' + notFound),
          esc(t('seo.report.additional.purpose.sitemap', 'Helps search engines discover pages')),
          esc(d.hasSitemap
            ? t('seo.report.additional.details.sitemapDetected', 'Sitemap detected')
            : t('seo.report.additional.details.sitemapMissing', 'Missing - improves indexing')),
          esc(t('seo.report.additional.bestPractice.sitemap', 'Submit to Google Search Console, update weekly'))
        ],
        [
          esc(t('seo.report.additional.checks.favicon', 'Favicon')),
          PR.renderStatus(d.hasFavicon ? 'pass' : 'warning', d.hasFavicon ? '✓ ' + present : '~ ' + missingLbl),
          esc(t('seo.report.additional.purpose.favicon', 'Browser tab icon')),
          esc(d.hasFavicon
            ? t('seo.report.status.configured', 'Configured')
            : t('seo.report.additional.details.faviconMissing', 'No favicon found')),
          esc(t('seo.report.additional.bestPractice.favicon', '32x32 PNG or ICO, helps brand recognition'))
        ],
        [
          esc(t('seo.report.additional.checks.googleAnalytics', 'Google Analytics')),
          PR.renderStatus(d.googleAnalytics ? 'pass' : 'warning', d.googleAnalytics ? '✓ ' + detectedLbl : '~ ' + notDetectedLbl),
          esc(t('seo.report.additional.purpose.analytics', 'Traffic tracking')),
          esc(d.googleAnalytics
            ? t('seo.report.additional.details.analyticsEnabled', 'Analytics tracking enabled')
            : t('seo.report.additional.details.analyticsMissing', 'No analytics detected')),
          esc(t('seo.report.additional.bestPractice.analytics', 'GA4 recommended, track user behavior for SEO insights'))
        ]
      ];

      html += PR.renderTable(
        [
          { label: t('seo.report.table.check', 'Check'), width: '14%' },
          { label: t('seo.report.table.status', 'Status'), width: '16%' },
          { label: t('seo.report.table.purpose', 'Purpose'), width: '22%' },
          { label: t('seo.report.table.details', 'Details'), width: '22%' },
          { label: t('seo.report.table.bestPractice', 'Best Practice'), width: '26%' }
        ],
        techRows,
        { striped: true }
      );

      // Social Signals callout
      html += PR.renderCallout(
        t('seo.report.additional.social.calloutTitle', 'M Social Signals & SEO'),
        t('seo.report.additional.social.calloutBody', 'While not direct ranking factors, social links increase brand visibility, drive traffic, and improve Open Graph previews when content is shared.'),
        'info'
      );

      // Social Media Presence table (5 columns)
      html += '<h3 class="pdf-subsection__title">' + esc(t('seo.report.additional.social.heading', 'Social Media Presence')) + '</h3>';

      var socialLinks = d.socialLinks || {};
      var socialRows = [
        [
          'Facebook',
          PR.renderStatus(socialLinks.facebook ? 'pass' : 'fail', socialLinks.facebook ? '✓' : '✗'),
          esc(t('seo.report.additional.social.value.openGraph', 'Meta Open Graph tags')),
          esc(socialLinks.facebook
            ? t('seo.report.additional.social.details.linkPresent', 'Link present')
            : t('seo.report.additional.social.details.facebookMissing', 'No Facebook link found')),
          esc(t('seo.report.additional.social.tip.openGraph', 'Add og:image, og:title, og:description tags'))
        ],
        [
          'Twitter/X',
          PR.renderStatus(socialLinks.twitter ? 'pass' : 'fail', socialLinks.twitter ? '✓' : '✗'),
          esc(t('seo.report.additional.social.value.twitterCard', 'Twitter Card tags')),
          esc(socialLinks.twitter
            ? t('seo.report.additional.social.details.linkPresent', 'Link present')
            : t('seo.report.additional.social.details.twitterMissing', 'No Twitter link found')),
          esc(t('seo.report.additional.social.tip.twitterCard', 'Add twitter:card, twitter:image meta tags'))
        ],
        [
          'LinkedIn',
          PR.renderStatus(socialLinks.linkedin ? 'pass' : 'fail', socialLinks.linkedin ? '✓' : '✗'),
          esc(t('seo.report.additional.social.value.professional', 'Professional network')),
          esc(socialLinks.linkedin
            ? t('seo.report.additional.social.details.linkPresent', 'Link present')
            : t('seo.report.additional.social.details.linkedinMissing', 'No LinkedIn link found')),
          esc(t('seo.report.additional.social.tip.linkedin', 'Add to company footer, improves B2B credibility'))
        ],
        [
          'Instagram',
          PR.renderStatus(socialLinks.instagram ? 'pass' : 'fail', socialLinks.instagram ? '✓' : '✗'),
          esc(t('seo.report.additional.social.value.visual', 'Visual content')),
          esc(socialLinks.instagram
            ? t('seo.report.additional.social.details.linkPresent', 'Link present')
            : t('seo.report.additional.social.details.instagramMissing', 'No Instagram link found')),
          esc(t('seo.report.additional.social.tip.instagram', 'Link to business profile, helps visual branding'))
        ]
      ];

      // YouTube — only show if the API actually detects it (not present in current analyzer)
      if (socialLinks.youtube !== undefined) {
        socialRows.push([
          'YouTube',
          PR.renderStatus(socialLinks.youtube ? 'pass' : 'fail', socialLinks.youtube ? '✓' : '✗'),
          esc(t('seo.report.additional.social.value.video', 'Video content & SEO')),
          esc(socialLinks.youtube
            ? t('seo.report.additional.social.details.linkPresent', 'Link present')
            : t('seo.report.additional.social.details.youtubeMissing', 'No YouTube link found')),
          esc(t('seo.report.additional.social.tip.youtube', 'Video content boosts engagement and dwell time'))
        ]);
      }

      html += PR.renderTable(
        [
          { label: t('seo.report.table.platform', 'Platform'), width: '14%' },
          { label: t('seo.report.table.status', 'Status'), width: '10%' },
          { label: t('seo.report.table.seoValue', 'SEO Value'), width: '22%' },
          { label: t('seo.report.table.details', 'Details'), width: '24%' },
          { label: t('seo.report.table.implementationTip', 'Implementation Tip'), width: '30%' }
        ],
        socialRows,
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
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('seo.sections.fixCode', 'Recommendations'))),
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
            allRecs.push({ text: _translateIssue(rec, t), section: sectionName, severity: section.passed ? 'low' : 'medium' });
          });
        }
        if (section.issues) {
          section.issues.forEach(function (issue) {
            allRecs.push({ text: _translateIssue(issue, t), section: sectionName, severity: section.score < 50 ? 'high' : 'medium' });
          });
        }
      });

      // Additional issues/recommendations summary
      if (allRecs.length > 0) {
        html += '<h3 class="pdf-subsection__title" style="margin-top:24px;">' +
          t('common.pdf.execSummary.keyFindings', 'Key Findings') +
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
        '<span class="pdf-issue__text">' + PdfReport.helpers.esc(_translateIssue(issue, t)) + '</span>' +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  /**
   * Translate server-generated issue/recommendation strings via i18n.
   * Maps known English patterns from seoAnalyzer.js to i18n keys.
   */
  function _translateIssue(text, t) {
    // Exact-match translations
    var exactMap = {
      'Missing page title': t('seo.analyzer.issues.missingTitle', 'Missing page title'),
      'Missing meta description': t('seo.analyzer.issues.missingDescription', 'Missing meta description'),
      'Missing viewport meta tag (affects mobile usability)': t('seo.analyzer.issues.missingViewport', 'Missing viewport meta tag (affects mobile usability)'),
      'No H1 heading found': t('seo.analyzer.issues.noH1', 'No H1 heading found'),
      'No headings found on page': t('seo.analyzer.issues.noHeadings', 'No headings found on page'),
      'Horizontal scrolling detected on mobile viewport': t('seo.analyzer.issues.horizontalScroll', 'Horizontal scrolling detected on mobile viewport'),
      'Missing viewport meta tag (critical for mobile responsiveness)': t('seo.analyzer.issues.missingViewportMobile', 'Missing viewport meta tag (critical for mobile responsiveness)'),
      'Site not using HTTPS (critical for security and SEO)': t('seo.analyzer.issues.noHttps', 'Site not using HTTPS (critical for security and SEO)'),
      'Add Open Graph tags for better social media sharing': t('seo.analyzer.recs.addOpenGraph', 'Add Open Graph tags for better social media sharing'),
      'Add Twitter Card tags for better Twitter sharing': t('seo.analyzer.recs.addTwitterCard', 'Add Twitter Card tags for better Twitter sharing'),
      'Add language attribute to <html> tag': t('seo.analyzer.recs.addLangAttr', 'Add language attribute to <html> tag'),
      'Consider adding more headings for better content structure': t('seo.analyzer.recs.addHeadings', 'Consider adding more headings for better content structure'),
      'Heading hierarchy has gaps (e.g., H1 → H3). Use sequential heading levels': t('seo.analyzer.recs.headingGaps', 'Heading hierarchy has gaps (e.g., H1 → H3). Use sequential heading levels'),
      'Consider adding more content. Pages with 600+ words tend to rank better': t('seo.analyzer.recs.addContent', 'Consider adding more content. Pages with 600+ words tend to rank better'),
      'Long sentences detected. Consider shorter sentences for better readability': t('seo.analyzer.recs.longSentences', 'Long sentences detected. Consider shorter sentences for better readability'),
      'Low text-to-HTML ratio. Too much code relative to content': t('seo.analyzer.recs.lowTextRatio', 'Low text-to-HTML ratio. Too much code relative to content'),
      'Consider using lazy loading for images below the fold': t('seo.analyzer.recs.lazyLoading', 'Consider using lazy loading for images below the fold'),
      'Font size may be too small on mobile devices': t('seo.analyzer.recs.smallFontSize', 'Font size may be too small on mobile devices'),
      'Page load time could be improved': t('seo.analyzer.recs.improveLoadTime', 'Page load time could be improved'),
      'Add Strict-Transport-Security header (HSTS)': t('seo.analyzer.recs.addHsts', 'Add Strict-Transport-Security header (HSTS)'),
      'Add Content-Security-Policy header': t('seo.analyzer.recs.addCsp', 'Add Content-Security-Policy header'),
      'Add X-Frame-Options header (prevents clickjacking)': t('seo.analyzer.recs.addXFrameOptions', 'Add X-Frame-Options header (prevents clickjacking)'),
      'Add X-Content-Type-Options header': t('seo.analyzer.recs.addXContentType', 'Add X-Content-Type-Options header'),
      'Add structured data (Schema.org/JSON-LD) for rich search results': t('seo.analyzer.recs.addStructuredData', 'Add structured data (Schema.org/JSON-LD) for rich search results'),
      'Add robots.txt file for better crawl control': t('seo.analyzer.recs.addRobotsTxt', 'Add robots.txt file for better crawl control'),
      'Add XML sitemap for better indexing': t('seo.analyzer.recs.addSitemap', 'Add XML sitemap for better indexing'),
      'Add favicon for better branding': t('seo.analyzer.recs.addFavicon', 'Add favicon for better branding'),
      'Consider adding Google Analytics for traffic insights': t('seo.analyzer.recs.addAnalytics', 'Consider adding Google Analytics for traffic insights'),
      'Title is too short (< 30 chars). Recommended: 50-60 chars': t('seo.analyzer.recs.titleTooShort', 'Title is too short (< 30 chars). Recommended: 50-60 chars'),
      'Title is too long (> 60 chars). It may be truncated in search results': t('seo.analyzer.recs.titleTooLong', 'Title is too long (> 60 chars). It may be truncated in search results'),
      'Meta description is too short (< 120 chars). Recommended: 150-160 chars': t('seo.analyzer.recs.descTooShort', 'Meta description is too short (< 120 chars). Recommended: 150-160 chars'),
      'Meta description is too long (> 160 chars). It may be truncated': t('seo.analyzer.recs.descTooLong', 'Meta description is too long (> 160 chars). It may be truncated'),
      'Low word count (< 300 words). Search engines prefer content-rich pages': t('seo.analyzer.issues.lowWordCount', 'Low word count (< 300 words). Search engines prefer content-rich pages')
    };

    if (exactMap[text]) return exactMap[text];

    // Pattern-match translations for strings with dynamic values
    var patterns = [
      { re: /^Multiple H1 headings found \((\d+)\)\. Use only one H1 per page$/, fn: function (m) { return t('seo.analyzer.issues.multipleH1', 'Multiple H1 headings found ({{count}}). Use only one H1 per page', { count: m[1] }); } },
      { re: /^(\d+) image\(s\) missing alt text \(affects accessibility and SEO\)$/, fn: function (m) { return t('seo.analyzer.issues.missingAlt', '{{count}} image(s) missing alt text (affects accessibility and SEO)', { count: m[1] }); } },
      { re: /^(\d+) external link\(s\) opening in new tab should have rel="noopener noreferrer"$/, fn: function (m) { return t('seo.analyzer.recs.unsafeExternalLinks', '{{count}} external link(s) opening in new tab should have rel="noopener noreferrer"', { count: m[1] }); } },
      { re: /^(\d+) link\(s\) with empty anchor text$/, fn: function (m) { return t('seo.analyzer.issues.emptyAnchors', '{{count}} link(s) with empty anchor text', { count: m[1] }); } },
      { re: /^(\d+) link\(s\) with potentially broken format/, fn: function (m) { return t('seo.analyzer.recs.brokenLinks', '{{count}} link(s) with potentially broken format (href="#" or javascript:)', { count: m[1] }); } },
      { re: /^Slow page load time \((.+?)\)\. Target: < 3s$/, fn: function (m) { return t('seo.analyzer.issues.slowLoad', 'Slow page load time ({{time}}). Target: < 3s', { time: m[1] }); } },
      { re: /^Large page size \((.+?)\)\. Optimize images and resources$/, fn: function (m) { return t('seo.analyzer.issues.largePageSize', 'Large page size ({{size}}). Optimize images and resources', { size: m[1] }); } },
      { re: /^Large DOM size \((\d+) nodes\)\. Consider simplifying$/, fn: function (m) { return t('seo.analyzer.recs.largeDom', 'Large DOM size ({{count}} nodes). Consider simplifying', { count: m[1] }); } },
      { re: /^Many resources loaded \((\d+)\)\. Consider bundling\/minification$/, fn: function (m) { return t('seo.analyzer.recs.manyResources', 'Many resources loaded ({{count}}). Consider bundling/minification', { count: m[1] }); } },
      { re: /^(\d+) large image\(s\) detected\. Consider optimizing image sizes$/, fn: function (m) { return t('seo.analyzer.recs.largeImages', '{{count}} large image(s) detected. Consider optimizing image sizes', { count: m[1] }); } },
      { re: /^(\d+) invalid structured data schema\(s\) found$/, fn: function (m) { return t('seo.analyzer.issues.invalidSchemas', '{{count}} invalid structured data schema(s) found', { count: m[1] }); } }
    ];

    for (var i = 0; i < patterns.length; i++) {
      var match = text.match(patterns[i].re);
      if (match) return patterns[i].fn(match);
    }

    // No match — return original text
    return text;
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
   * Build conditional fix card objects from the SEO analysis data.
   * Mirrors buildFixCards() in seo-script.js — only shows cards when issues are detected.
   */
  function _buildFixCards(data, t, esc) {
    var analyzedDomain = _getAnalyzedDomain(data);
    var cards = [];
    var meta = data.metaTags || {};
    var structured = data.structuredData || {};
    var performance = data.performanceMetrics || {};
    var images = data.imageAnalysis || {};
    var headings = data.headingStructure || {};
    var content = data.contentAnalysis || {};
    var links = data.linkAnalysis || {};

    // --- 1. Title tag (only if actually problematic) ---
    var titleLen = meta.titleLength || 0;
    var titleNeeds = !meta.title || titleLen < 30 || titleLen > 60;
    if (titleNeeds) {
    var titleIssueDetail = !meta.title
      ? t('seo.fixCards.title.missingDetail', 'The page has no <title> tag at all. Search engines use the title as the primary clickable headline in results. Without one, Google will auto-generate a title from page content, which is almost always worse than a well-crafted one.')
      : titleLen < 30
        ? t('seo.fixCards.title.tooShortDetail', 'Your title is only {{len}} characters. Titles under 30 characters waste valuable SERP real estate and miss keyword opportunities. Google displays up to ~60 characters, so you have room to add descriptive, keyword-rich phrasing that improves click-through rate.', { len: titleLen })
        : t('seo.fixCards.title.tooLongDetail', 'Your title is {{len}} characters. Google truncates titles beyond ~60 characters with an ellipsis, hiding your brand name or call-to-action. Shortening it ensures the full title is visible and compelling in search results.', { len: titleLen });
    cards.push({
      title: t('seo.fixCards.title.title', 'Tune your title tag'),
      severity: !meta.title ? 'High' : 'Medium',
      category: t('seo.fixCards.categories.metaTags', 'Meta Tags'),
      impact: t('seo.fixCards.title.impact', 'Improves CTR in SERPs by 15-30%'),
      description: titleIssueDetail,
      problematicCode: meta.title
        ? '<!-- ' + t('seo.fixCards.comments.currentTitle', 'Current title') + ': ' + titleLen + ' ' + t('seo.fixCards.comments.characters', 'characters') + ' -->\n<title>' + (meta.title || '') + '</title>\n\n<!-- ' + t('seo.fixCards.comments.issues', 'Issues') + ': -->\n<!-- ' + (titleLen < 30 ? t('seo.fixCards.comments.tooShort', '✗ Too short - missing keyword opportunity') : t('seo.fixCards.comments.tooLong', '✗ Too long - will be truncated in SERPs')) + ' -->'
        : '<!-- ' + t('seo.fixCards.comments.noTitleFound', 'No title tag found') + ' -->\n<head>\n  <!-- ' + t('seo.fixCards.comments.missingTitle', '✗ Missing <title> tag') + ' -->\n</head>',
      snippet: '<title>' + (meta.title ? meta.title.substring(0, 50) + ' | Brand' : t('seo.fixCards.snippets.titlePlaceholder', 'Primary Keyword | Brand Name')) + '</title>\n\n<!-- ' + t('seo.fixCards.comments.bestPractices', 'Best practices') + ': -->\n<!-- ' + t('seo.fixCards.comments.title50to60', '✓ 50-60 characters') + ' -->\n<!-- ' + t('seo.fixCards.comments.keywordNearStart', '✓ Primary keyword near the start') + ' -->\n<!-- ' + t('seo.fixCards.comments.brandAtEnd', '✓ Brand name at the end') + ' -->',
      steps: [
        t('seo.fixes.steps.title.step1', 'Keep title between 50-60 characters'),
        t('seo.fixes.steps.title.step2', 'Place primary keyword near the beginning'),
        t('seo.fixes.steps.title.step3', 'Make it compelling and unique for each page'),
        t('seo.fixes.steps.title.step4', 'Append your brand name after a pipe separator (e.g. "Topic | Brand")'),
        t('seo.fixes.steps.title.step5', 'Test in Google SERP preview tool to verify it displays correctly')
      ]
    });
    }

    // --- 2. Meta description (only if problematic) ---
    var descLen = meta.descriptionLength || 0;
    var descNeeds = !meta.description || descLen < 120 || descLen > 160;
    if (descNeeds) {
    var descIssueDetail = !meta.description
      ? t('seo.fixCards.description.missingDetail', 'No meta description was found. Without one, search engines pull a random snippet from your page, which often reads poorly and hurts click-through rate. A well-written description acts as ad copy for your page in search results.')
      : descLen < 120
        ? t('seo.fixCards.description.tooShortDetail', 'Your description is {{len}} characters. Google displays up to ~160 characters in search results. A short description wastes this free advertising space and signals less relevance to searchers.', { len: descLen })
        : t('seo.fixCards.description.tooLongDetail', 'Your description is {{len}} characters and will be truncated in search results. The trailing text, which often includes a call-to-action, will be hidden behind an ellipsis.', { len: descLen });
    cards.push({
      title: t('seo.fixCards.description.title', 'Write a compelling meta description'),
      severity: !meta.description ? 'High' : 'Medium',
      category: t('seo.fixCards.categories.metaTags', 'Meta Tags'),
      impact: t('seo.fixCards.description.impact', 'Higher click-through and relevance signals'),
      description: descIssueDetail,
      problematicCode: meta.description
        ? '<!-- ' + t('seo.fixCards.comments.current', 'Current') + ': ' + descLen + ' ' + t('seo.fixCards.comments.characters', 'characters') + ' -->\n<meta name="description" content="' + (meta.description ? meta.description.substring(0, 80) : '') + '..." />\n\n<!-- ' + t('seo.fixCards.comments.issues', 'Issues') + ': -->\n<!-- ' + (descLen < 120 ? t('seo.fixCards.comments.descTooShort', '✗ Too short - not fully utilizing SERP space') : t('seo.fixCards.comments.descTooLong', '✗ Too long - will be truncated')) + ' -->'
        : '<!-- ' + t('seo.fixCards.comments.noDescriptionFound', 'No meta description found') + ' -->\n<head>\n  <!-- ' + t('seo.fixCards.comments.missingDescription', '✗ Missing meta description') + ' -->\n</head>',
      snippet: '<meta name="description" content="' + t('seo.fixCards.snippets.descriptionPlaceholder', 'Describe the main value proposition in 150-160 characters. Include a clear call to action.') + '" />\n\n<!-- ' + t('seo.fixCards.comments.bestPractices', 'Best practices') + ': -->\n<!-- ' + t('seo.fixCards.comments.desc150to160', '✓ 150-160 characters') + ' -->\n<!-- ' + t('seo.fixCards.comments.includeCta', '✓ Include call-to-action') + ' -->\n<!-- ' + t('seo.fixCards.comments.uniquePerPage', '✓ Unique for each page') + ' -->',
      steps: [
        t('seo.fixes.steps.description.step1', 'Write 150-160 characters that summarize page content'),
        t('seo.fixes.steps.description.step2', 'Include a clear call-to-action (e.g. "Learn more", "Get started")'),
        t('seo.fixes.steps.description.step3', 'Ensure uniqueness across all pages'),
        t('seo.fixes.steps.description.step4', 'Front-load the most important information in the first 120 characters'),
        t('seo.fixes.steps.description.step5', 'Avoid duplicating the title tag - use the description to add detail')
      ]
    });
    }

    // --- 3. Open Graph tags (only if missing) ---
    var ogMissing = !meta.ogTitle && !meta.ogDescription;
    var twitterMissing = !meta.twitterCard;
    if (ogMissing || twitterMissing) {
    var socialIssues = [];
    if (ogMissing) socialIssues.push('<!-- ' + t('seo.fixCards.comments.missingOg', '✗ Missing Open Graph tags (og:title, og:description, og:image)') + ' -->');
    if (twitterMissing) socialIssues.push('<!-- ' + t('seo.fixCards.comments.missingTwitter', '✗ Missing Twitter Card tags') + ' -->');
    cards.push({
      title: t('seo.fixCards.openGraph.title', 'Add Open Graph & social meta tags'),
      severity: 'Medium',
      category: t('seo.fixCards.categories.socialSeo', 'Social & Sharing'),
      impact: t('seo.fixCards.openGraph.impact', 'Rich previews on social platforms drive 2-3x more engagement'),
      description: t('seo.fixCards.openGraph.description', 'When your page is shared on Facebook, LinkedIn, Twitter/X, or messaging apps, the platform looks for Open Graph and Twitter Card meta tags to build a rich preview card. Without them, shares show a plain URL or an auto-selected image that often looks wrong. Adding these tags takes minutes and dramatically improves how your content appears when shared.'),
      problematicCode: '<!-- ' + t('seo.fixCards.comments.commonIssues', 'Common issues') + ': -->\n' + socialIssues.join('\n') + '\n\n<head>\n  <!-- ' + t('seo.fixCards.comments.noSocialTags', 'No social sharing meta tags found') + ' -->\n</head>',
      snippet: '<!-- Open Graph -->\n<meta property="og:type" content="website" />\n<meta property="og:title" content="' + (meta.title || t('seo.fixCards.snippets.pageTitle', 'Page Title')) + '" />\n<meta property="og:description" content="' + (meta.description || t('seo.fixCards.snippets.pageDescription', 'Page description')) + '" />\n<meta property="og:image" content="https://' + analyzedDomain + '/og-image.jpg" />\n\n<!-- Twitter Card -->\n<meta name="twitter:card" content="summary_large_image" />',
      steps: [
        t('seo.fixes.steps.openGraph.step1', 'Create a 1200x630 px share image for your page'),
        t('seo.fixes.steps.openGraph.step2', 'Add og:title, og:description, og:image, and og:url meta tags'),
        t('seo.fixes.steps.openGraph.step3', 'Add twitter:card, twitter:title, twitter:description, and twitter:image'),
        t('seo.fixes.steps.openGraph.step4', 'Test with Facebook Sharing Debugger and Twitter Card Validator'),
        t('seo.fixes.steps.openGraph.step5', 'Ensure each page has its own unique OG tags - do not reuse the same image everywhere')
      ]
    });
    }

    // --- 4. Image alt text (only if images are missing alt) ---
    var missingAlt = images.withoutAlt || 0;
    var totalImages = images.total || 0;
    if (missingAlt > 0) {
    cards.push({
      title: t('seo.fixCards.images.title', 'Add missing image alt text'),
      severity: missingAlt > 5 ? 'High' : 'Medium',
      category: t('seo.fixCards.categories.accessibility', 'Accessibility & Images'),
      impact: t('seo.fixCards.images.impact', 'Improves accessibility, image search rankings, and overall SEO score'),
      description: t('seo.fixCards.images.description', '{{count}} of {{total}} images are missing alt attributes. Alt text serves three purposes: it describes the image to screen-reader users (required for WCAG compliance), it appears when the image fails to load, and search engines use it to understand image content for Google Image Search rankings. Missing alt text is one of the most common SEO and accessibility issues.', { count: missingAlt, total: totalImages }),
      problematicCode: '<!-- ' + t('seo.fixCards.comments.imagesNoAlt', '✗ {{count}} images missing alt text', { count: missingAlt }) + ' -->\n<img src="hero.jpg" />\n<img src="product.png" />',
      snippet: '<img src="hero.jpg" alt="' + t('seo.fixCards.snippets.altExample1', 'Team collaborating around a whiteboard in a modern office') + '" />\n<img src="product.png" alt="' + t('seo.fixCards.snippets.altExample2', 'Blue wireless headphones with noise-cancelling feature') + '" />\n\n<!-- ' + t('seo.fixCards.comments.decorativeImages', 'For purely decorative images, use empty alt') + ': -->\n<img src="divider.svg" alt="" role="presentation" />',
      steps: [
        t('seo.fixes.steps.images.step1', 'Audit all images: run "img:not([alt])" in DevTools Console to find them'),
        t('seo.fixes.steps.images.step2', 'Write concise, descriptive alt text (under 125 characters) for each image'),
        t('seo.fixes.steps.images.step3', 'For decorative images (borders, spacers), use alt="" with role="presentation"'),
        t('seo.fixes.steps.images.step4', 'Avoid phrases like "image of" or "picture of" - describe the content directly'),
        t('seo.fixes.steps.images.step5', 'Test with a screen reader or browser accessibility inspector to verify')
      ]
    });
    }

    // --- 5. Heading structure (only if issues found) ---
    var h1Count = headings.h1 ? headings.h1.length : 0;
    var headingIssue = h1Count === 0 || h1Count > 1 || (headings.total || 0) < 3;
    if (headingIssue) {
    var headingIssueDetail = h1Count === 0
      ? t('seo.fixCards.headings.missingH1Detail', 'Your page is missing an H1 heading. The H1 is the primary heading that tells both search engines and users what the page is about. It carries the most weight of any heading tag and should contain your primary target keyword. Every page should have exactly one H1.')
      : h1Count > 1
        ? t('seo.fixCards.headings.multipleH1Detail', 'Your page has {{count}} H1 headings. Multiple H1 tags dilute the primary keyword signal and confuse search engines about the page topic. Keep one H1 as the main heading and demote others to H2 or H3.', { count: h1Count })
        : t('seo.fixCards.headings.lowHeadingsDetail', 'Your page has very few headings ({{count}} total). Headings create a scannable outline for users and help search engines understand content hierarchy. Well-structured headings improve both readability and SEO.', { count: headings.total || 0 });
    var headingProblems = [];
    if (h1Count === 0) headingProblems.push('<!-- ' + t('seo.fixCards.comments.noH1', '✗ No H1 heading found') + ' -->');
    if (h1Count > 1) headingProblems.push('<!-- ' + t('seo.fixCards.comments.multipleH1', '✗ Multiple H1 headings ({{count}}) - use exactly one', { count: h1Count }) + ' -->');
    if ((headings.total || 0) < 3) headingProblems.push('<!-- ' + t('seo.fixCards.comments.fewHeadings', '✗ Only {{count}} headings total - page lacks structure', { count: headings.total || 0 }) + ' -->');
    cards.push({
      title: t('seo.fixCards.headings.title', 'Fix heading structure'),
      severity: h1Count === 0 ? 'High' : 'Medium',
      category: t('seo.fixCards.categories.contentStructure', 'Content Structure'),
      impact: t('seo.fixCards.headings.impact', 'Clearer page structure improves crawlability and user engagement'),
      description: headingIssueDetail,
      problematicCode: '<!-- ' + t('seo.fixCards.comments.currentHeadings', 'Current heading structure') + ': -->\n<!-- H1: ' + h1Count + ' | H2: ' + ((headings.h2 || []).length) + ' | H3: ' + ((headings.h3 || []).length) + ' -->\n' + headingProblems.join('\n'),
      snippet: '<h1>' + (meta.title ? meta.title.substring(0, 50) : t('seo.fixCards.snippets.h1Placeholder', 'Primary Page Topic with Keyword')) + '</h1>\n\n  <h2>' + t('seo.fixCards.snippets.h2Placeholder1', 'Key Section About Subtopic A') + '</h2>\n    <h3>' + t('seo.fixCards.snippets.h3Placeholder', 'Supporting Detail') + '</h3>\n\n  <h2>' + t('seo.fixCards.snippets.h2Placeholder2', 'Key Section About Subtopic B') + '</h2>',
      steps: [
        t('seo.fixes.steps.headings.step1', 'Ensure exactly one H1 tag exists - it should be the main page title'),
        t('seo.fixes.steps.headings.step2', 'Use H2 tags for major sections and H3 for subsections within them'),
        t('seo.fixes.steps.headings.step3', 'Never skip heading levels (e.g. H1 directly to H3)'),
        t('seo.fixes.steps.headings.step4', 'Write headings that describe the content below - avoid generic text'),
        t('seo.fixes.steps.headings.step5', 'Use Chrome DevTools "Elements" panel to audit all heading tags on the page')
      ]
    });
    }

    // --- 6. Content quality (only if thin content) ---
    var wordCount = content.wordCount || 0;
    if (wordCount < 600) {
    cards.push({
      title: t('seo.fixCards.content.title', 'Improve content depth'),
      severity: wordCount < 300 ? 'High' : 'Medium',
      category: t('seo.fixCards.categories.contentQuality', 'Content Quality'),
      impact: t('seo.fixCards.content.impact', 'Pages with 600+ words rank higher on average and earn more backlinks'),
      description: wordCount < 300
        ? t('seo.fixCards.content.veryThinDetail', 'Your page has only {{count}} words. Search engines consider this "thin content," which rarely ranks well. Pages competing in search typically have 800-2000+ words. Thin content also increases bounce rate because visitors find insufficient information and leave.', { count: wordCount })
        : t('seo.fixCards.content.thinDetail', 'Your page has {{count}} words. While not critically thin, pages with 600+ words tend to rank better because they provide more value, answer more user questions, and naturally include more relevant keywords. Consider expanding key sections.', { count: wordCount }),
      problematicCode: '<!-- ' + t('seo.fixCards.comments.wordCount', 'Word count') + ': ' + wordCount + ' -->\n<!-- ' + t('seo.fixCards.comments.paragraphs', 'Paragraphs') + ': ' + (content.paragraphCount || 0) + ' -->\n<!-- ' + t('seo.fixCards.comments.thinContentWarning', '✗ Content is below recommended threshold for competitive ranking') + ' -->',
      snippet: '<h1>' + t('seo.fixCards.snippets.contentH1', 'Main Topic (with primary keyword)') + '</h1>\n<p>' + t('seo.fixCards.snippets.contentIntro', 'Introduction paragraph (50-100 words) - hook the reader') + '</p>\n\n<h2>' + t('seo.fixCards.snippets.contentH2a', 'What / Why Section') + '</h2>\n<p>' + t('seo.fixCards.snippets.contentBody1', '150-200 words explaining the topic in depth') + '</p>\n\n<h2>' + t('seo.fixCards.snippets.contentH2b', 'How-To / Details Section') + '</h2>',
      steps: [
        t('seo.fixes.steps.content.step1', 'Research what competitors cover for the same topic and identify gaps'),
        t('seo.fixes.steps.content.step2', 'Add an FAQ section answering 3-5 common questions (helps win featured snippets)'),
        t('seo.fixes.steps.content.step3', 'Expand existing sections with examples, data, or step-by-step instructions'),
        t('seo.fixes.steps.content.step4', 'Break content into scannable sections with descriptive H2/H3 headings'),
        t('seo.fixes.steps.content.step5', 'Aim for at least 800 words while keeping every sentence valuable - avoid filler')
      ]
    });
    }

    // --- 7. Canonical URL (only if missing) ---
    if (!meta.canonical) {
    cards.push({
      title: t('seo.fixCards.canonical.title', 'Add canonical + sitemap refs'),
      severity: 'Medium',
      category: t('seo.fixCards.categories.technicalSeo', 'Technical SEO'),
      impact: t('seo.fixCards.canonical.impact', 'Prevents duplicate indexing issues'),
      description: t('seo.fixCards.canonical.fullDescription', 'No canonical URL was detected. Without a canonical tag, search engines may index multiple versions of the same page (www vs non-www, HTTP vs HTTPS, with/without trailing slash) and split your ranking power between them. A canonical tag declares the single preferred URL for each page.'),
      problematicCode: '<!-- ' + t('seo.fixCards.comments.commonIssues', 'Common issues') + ': -->\n<!-- ' + t('seo.fixCards.comments.noCanonical', '✗ No canonical URL declared') + ' -->\n<!-- ' + t('seo.fixCards.comments.multipleVersions', '✗ Multiple versions indexed (www, non-www, http, https)') + ' -->\n<!-- ' + t('seo.fixCards.comments.sitemapNotReferenced', '✗ Sitemap not referenced') + ' -->\n\n<head>\n  <!-- ' + t('seo.fixCards.comments.missingCanonicalSitemap', 'Missing canonical and sitemap links') + ' -->\n</head>',
      snippet: '<link rel="canonical" href="https://' + analyzedDomain + '/" />\n<link rel="sitemap" type="application/xml" title="Sitemap" href="https://' + analyzedDomain + '/sitemap.xml" />\n\n<!-- ' + t('seo.fixCards.comments.inRobotsTxt', 'In robots.txt') + ': -->\nSitemap: https://' + analyzedDomain + '/sitemap.xml',
      steps: [
        t('seo.fixes.steps.canonical.step1', 'Add canonical link pointing to preferred URL'),
        t('seo.fixes.steps.canonical.step2', 'Create and submit XML sitemap to search engines'),
        t('seo.fixes.steps.canonical.step3', 'Reference sitemap in robots.txt'),
        t('seo.fixes.steps.canonical.step4', 'Ensure every page has a self-referencing canonical tag'),
        t('seo.fixes.steps.canonical.step5', 'Use Google Search Console to monitor indexing and duplicate issues')
      ]
    });
    }

    // --- 8. Structured data (only if missing) ---
    if (!structured.hasStructuredData) {
    cards.push({
      title: t('seo.fixCards.jsonld.title', 'Add JSON-LD (Article/Product)'),
      severity: 'High',
      category: t('seo.fixCards.categories.structuredData', 'Structured Data'),
      impact: t('seo.fixCards.jsonld.impact', 'Rich results eligibility - up to 30% more visibility'),
      description: t('seo.fixCards.jsonld.fullDescription', 'No structured data was found on this page. Structured data (JSON-LD) helps search engines understand your content type and enables rich results like star ratings, FAQ dropdowns, product prices, and breadcrumbs directly in search results. Pages with rich results get significantly higher click-through rates.'),
      problematicCode: '<!-- ' + t('seo.fixCards.comments.noStructuredData', 'No structured data found') + ' -->\n<head>\n  <!-- ' + t('seo.fixCards.comments.missingJsonLd', '✗ Missing JSON-LD structured data') + ' -->\n  <!-- ' + t('seo.fixCards.comments.notEligible', '✗ Not eligible for rich results') + ' -->\n</head>',
      snippet: '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebPage",\n  "name": "' + (meta.title || t('seo.fixCards.snippets.pageTitle', 'Page Title')) + '",\n  "description": "' + (meta.description || t('seo.fixCards.snippets.pageDescription', 'Page description')) + '",\n  "url": "https://' + analyzedDomain + '/"\n}\n<\/script>',
      steps: [
        t('seo.fixes.steps.jsonld.step1', 'Identify the primary content type (Article, Product, etc.)'),
        t('seo.fixes.steps.jsonld.step2', 'Add JSON-LD script with required properties'),
        t('seo.fixes.steps.jsonld.step3', 'Test with Google Rich Results Test'),
        t('seo.fixes.steps.jsonld.step4', 'Add Organization schema to your homepage for brand knowledge panel'),
        t('seo.fixes.steps.jsonld.step5', 'Add BreadcrumbList schema for breadcrumb-style search results')
      ]
    });
    }

    // --- 9. Link security (only if unsafe external links found) ---
    var linksList = links.links || [];
    var unsafeLinks = 0;
    var emptyAnchors = 0;
    for (var li = 0; li < linksList.length; li++) {
      var lnk = linksList[li];
      if (lnk.isExternal && lnk.target === '_blank' && (!lnk.hasNoOpener || !lnk.hasNoReferrer)) unsafeLinks++;
      if (!lnk.text || lnk.text.length === 0) emptyAnchors++;
    }
    if (unsafeLinks > 0 || emptyAnchors > 0) {
    var linkProblems = [];
    if (unsafeLinks > 0) linkProblems.push('<!-- ' + t('seo.fixCards.comments.unsafeExternalLinks', '✗ {{count}} external links open in new tab without rel="noopener noreferrer"', { count: unsafeLinks }) + ' -->');
    if (emptyAnchors > 0) linkProblems.push('<!-- ' + t('seo.fixCards.comments.emptyAnchorText', '✗ {{count}} links have empty anchor text (bad for SEO and accessibility)', { count: emptyAnchors }) + ' -->');
    cards.push({
      title: t('seo.fixCards.links.title', 'Fix link security & anchor text'),
      severity: unsafeLinks > 3 ? 'Medium' : 'Low',
      category: t('seo.fixCards.categories.linkHealth', 'Link Health'),
      impact: t('seo.fixCards.links.impact', 'Prevents security vulnerabilities and improves link equity signals'),
      description: t('seo.fixCards.links.description', 'External links that open in a new tab without rel="noopener noreferrer" expose your site to reverse tabnapping attacks, where the opened page can use the window.opener API to redirect your original tab to a phishing site. This is a well-documented security vulnerability that can trick users into entering credentials on a fake version of your site without realizing they have been redirected. Additionally, links with empty or missing anchor text waste valuable link equity because search engines use anchor text to understand the context and relevance of the linked page. Screen reader users also rely on anchor text to understand where a link leads before activating it, so empty anchors create a confusing and inaccessible experience. Both issues are simple to fix and should be resolved across all external and internal links.'),
      problematicCode: '<!-- ' + t('seo.fixCards.comments.linkIssuesFound', 'Link issues found') + ': -->\n' + linkProblems.join('\n'),
      snippet: '<a href="https://external.com"\n   target="_blank"\n   rel="noopener noreferrer">' + t('seo.fixCards.snippets.descriptiveAnchor', 'Descriptive anchor text') + '</a>\n\n<a href="/pricing">' + t('seo.fixCards.snippets.pricingAnchor', 'View pricing plans') + '</a>',
      steps: [
        t('seo.fixes.steps.links.step1', 'Add rel="noopener noreferrer" to all external links with target="_blank"'),
        t('seo.fixes.steps.links.step2', 'Replace empty anchor text with descriptive text that explains the link destination'),
        t('seo.fixes.steps.links.step3', 'Avoid generic anchor text like "click here" or "read more"'),
        t('seo.fixes.steps.links.step4', 'Use DevTools Console: document.querySelectorAll(\'a[target="_blank"]:not([rel*="noopener"])\') to find issues'),
        t('seo.fixes.steps.links.step5', 'Consider adding rel="nofollow" to paid or sponsored external links')
      ]
    });
    }

    // --- 10. Preload critical assets (only if perf score < 80) ---
    // Note: If no performance data exists, default to 0 (not 100) to ensure
    // performance fix cards appear when they should. This matches web UI behavior.
    var perfScore = performance.score || 0;
    if (perfScore < 80) {
    cards.push({
      title: t('seo.fixCards.preload.title', 'Preload critical assets'),
      severity: perfScore < 50 ? 'High' : 'Medium',
      category: t('seo.fixCards.categories.performance', 'Performance'),
      impact: t('seo.fixCards.preload.impact', 'Faster LCP and render - improves Core Web Vitals'),
      description: t('seo.fixCards.preload.fullDescription', 'Page performance scored {{score}}/100. Preloading tells the browser to fetch critical resources (hero image, fonts, CSS) as soon as possible, before it discovers them in the HTML. This can shave 200-500ms off your Largest Contentful Paint (LCP) and eliminate layout shift from late-loading fonts.', { score: perfScore }),
      problematicCode: '<!-- ' + t('seo.fixCards.comments.commonIssues', 'Common issues') + ': -->\n<!-- ' + t('seo.fixCards.comments.heroNotPreloaded', '✗ Hero image not preloaded') + ' -->\n<!-- ' + t('seo.fixCards.comments.fontsCauseShift', '✗ Web fonts cause layout shift') + ' -->\n<!-- ' + t('seo.fixCards.comments.cssNotPrioritized', '✗ Critical CSS not prioritized') + ' -->\n<!-- ' + t('seo.fixCards.comments.perfScore', 'Performance score') + ': ' + perfScore + '/100 -->\n\n<head>\n  <!-- ' + t('seo.fixCards.comments.noPreloadHints', 'No preload hints') + ' -->\n  <link rel="stylesheet" href="/styles.css">\n</head>',
      snippet: '<link rel="preload" as="image" href="/hero.webp" />\n<link rel="preload" as="style" href="/critical.css" />\n<link rel="preload" as="font" type="font/woff2" href="/fonts/main.woff2" crossorigin />\n\n<!-- ' + t('seo.fixCards.comments.bestPractices', 'Best practices') + ': -->\n<!-- ' + t('seo.fixCards.comments.preloadLcpImage', '✓ Preload LCP image') + ' -->\n<!-- ' + t('seo.fixCards.comments.preloadCriticalFonts', '✓ Preload critical fonts') + ' -->\n<!-- ' + t('seo.fixCards.comments.useCrossorigin', '✓ Use crossorigin for fonts') + ' -->',
      steps: [
        t('seo.fixes.steps.preload.step1', 'Identify above-the-fold critical resources'),
        t('seo.fixes.steps.preload.step2', 'Add preload hints for hero image and fonts'),
        t('seo.fixes.steps.preload.step3', 'Verify with browser DevTools Network panel'),
        t('seo.fixes.steps.preload.step4', 'Add fetchpriority="high" to the LCP image element itself'),
        t('seo.fixes.steps.preload.step5', 'Do not over-preload - only 2-4 critical resources, or the browser delays everything')
      ]
    });
    }

    // --- 11. Defer non-critical JS (only if perf score < 70) ---
    if (perfScore < 70) {
    cards.push({
      title: t('seo.fixCards.defer.title', 'Defer non-critical JS'),
      severity: 'Low',
      category: t('seo.fixCards.categories.performance', 'Performance'),
      impact: t('seo.fixCards.defer.impact', 'Reduces blocking time - faster interactivity'),
      description: t('seo.fixCards.defer.fullDescription', 'Synchronous scripts in the <head> block the browser from rendering any content until they finish downloading and executing. Moving non-essential scripts to defer or async allows the page to paint first, improving perceived load speed and Core Web Vitals scores (especially FID/INP).'),
      problematicCode: '<!-- ' + t('seo.fixCards.comments.commonIssues', 'Common issues') + ': -->\n<!-- ' + t('seo.fixCards.comments.scriptsBlocking', '✗ Scripts blocking page render') + ' -->\n<!-- ' + t('seo.fixCards.comments.analyticsSync', '✗ Analytics loading synchronously') + ' -->\n\n<head>\n  <script src="/app.js"><\/script>\n  <script src="/analytics.js"><\/script>\n</head>',
      snippet: '<head>\n  <!-- ' + t('seo.fixCards.comments.deferNonEssential', 'Defer non-essential scripts') + ' -->\n  <script src="/app.js" defer><\/script>\n  <script src="/analytics.js" defer><\/script>\n</head>\n\n<!-- ' + t('seo.fixCards.comments.orLoadAtEnd', 'Or load at end of body') + ': -->\n<body>\n  <!-- ' + t('seo.fixCards.comments.content', 'content') + ' -->\n  <script src="/app.js"><\/script>\n</body>',
      steps: [
        t('seo.fixes.steps.defer.step1', 'Add defer attribute to non-essential scripts'),
        t('seo.fixes.steps.defer.step2', 'Move analytics to async loading'),
        t('seo.fixes.steps.defer.step3', 'Test that functionality still works correctly'),
        t('seo.fixes.steps.defer.step4', 'Use Chrome DevTools Coverage tab to find unused JS you can remove entirely'),
        t('seo.fixes.steps.defer.step5', 'Consider lazy-loading third-party widgets (chat, social embeds) on user interaction')
      ]
    });
    }

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
    var severityLabel = { high: t('seo.fixes.severity.high', 'High'), medium: t('seo.fixes.severity.medium', 'Medium'), low: t('seo.fixes.severity.low', 'Low') }[severityLower] || fix.severity;
    html += '<span class="pdf-fix-card__severity pdf-fix-card__severity--' + severityLower + '">' + esc(severityLabel) + '</span>';
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
