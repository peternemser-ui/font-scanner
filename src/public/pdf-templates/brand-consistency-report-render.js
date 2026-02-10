/**
 * Brand Consistency Report — PDF Renderer
 * Renders all brand consistency analysis sections into the PDF template.
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[brand-consistency-report-render] PdfReport not loaded');
    return;
  }

  var PR = window.PdfReport;

  PdfReport.register('brand-consistency', function renderBrandConsistency(data, utils) {
    var t = utils.t;
    var esc = utils.esc;
    var truncate = utils.truncate;
    var scoreClass = utils.scoreClass;

    var sectionIndex = 1;

    function _htmlToNode(htmlStr) {
      var tpl = document.createElement('template');
      tpl.innerHTML = htmlStr.trim();
      return tpl.content.firstChild;
    }

    // Resolve data sources
    var scoreBreakdown = data.scoreBreakdown || {};
    var brandElements = data.brandElements || {};
    var crossPageConsistency = data.crossPageConsistency || {};
    var colorAnalysis = data.colorAnalysis || {};
    var typographyAnalysis = data.typographyAnalysis || {};
    var contrastAnalysis = data.contrastAnalysis || {};
    var recommendations = data.recommendations || [];

    /* -----------------------------------------------------------------------
       1. Consistency Overview
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-overview .pdf-section__content');
      var score = data.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.brandConsistency.report.overview', 'Consistency Overview'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.brandConsistency.report.sectionIntros.overview', 'This section provides a high-level overview of your brand consistency across the analyzed pages. A consistent brand identity strengthens user trust and recognition. The scores below reflect how well your site maintains uniform colors, typography, and visual patterns throughout.')) + '</p>';

      // Score grid for sub-scores
      var subScoreMetrics = [];
      if (scoreBreakdown.consistency !== undefined && scoreBreakdown.consistency !== null) {
        var consColor = scoreBreakdown.consistency >= 80 ? '#10b981' : scoreBreakdown.consistency >= 50 ? '#f59e0b' : '#ef4444';
        subScoreMetrics.push({ value: scoreBreakdown.consistency, label: t('reports.brandConsistency.report.overview.consistency', 'Consistency'), color: consColor });
      }
      if (scoreBreakdown.colorAnalysis !== undefined && scoreBreakdown.colorAnalysis !== null) {
        var colColor = scoreBreakdown.colorAnalysis >= 80 ? '#10b981' : scoreBreakdown.colorAnalysis >= 50 ? '#f59e0b' : '#ef4444';
        subScoreMetrics.push({ value: scoreBreakdown.colorAnalysis, label: t('reports.brandConsistency.report.overview.colorAnalysis', 'Color Analysis'), color: colColor });
      }
      if (scoreBreakdown.typographyAnalysis !== undefined && scoreBreakdown.typographyAnalysis !== null) {
        var typoColor = scoreBreakdown.typographyAnalysis >= 80 ? '#10b981' : scoreBreakdown.typographyAnalysis >= 50 ? '#f59e0b' : '#ef4444';
        subScoreMetrics.push({ value: scoreBreakdown.typographyAnalysis, label: t('reports.brandConsistency.report.overview.typographyAnalysis', 'Typography Analysis'), color: typoColor });
      }

      if (subScoreMetrics.length > 0) {
        html += PR.renderMetrics(subScoreMetrics);
      }

      // Brand elements summary
      var logos = brandElements.logos || [];
      var colors = brandElements.colors || [];
      var fonts = brandElements.fonts || [];
      var patterns = brandElements.patterns || [];

      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.brandConsistency.report.overview.elementsHeading', 'Brand Elements Detected')) + '</h3>';

      html += PR.renderMetrics([
        { value: logos.length, label: t('reports.brandConsistency.report.overview.logos', 'Logos') },
        { value: colors.length, label: t('reports.brandConsistency.report.overview.colors', 'Colors') },
        { value: fonts.length, label: t('reports.brandConsistency.report.overview.fonts', 'Fonts') },
        { value: patterns.length, label: t('reports.brandConsistency.report.overview.patterns', 'Patterns') }
      ]);

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Color Analysis
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-colors .pdf-section__content');
      var score = colorAnalysis.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.brandConsistency.report.colorAnalysis', 'Color Analysis'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.brandConsistency.report.sectionIntros.colors', 'Color consistency is a cornerstone of brand identity. This section analyzes the color palette detected across your pages, identifies dominant colors, and flags inconsistencies. A well-defined palette with limited variation ensures your brand is instantly recognizable and visually cohesive.')) + '</p>';

      // Color palette display
      var palette = colorAnalysis.palette || [];
      if (palette.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.brandConsistency.report.colors.paletteHeading', 'Color Palette')) + '</h3>';
        var paletteRows = palette.slice(0, 20).map(function (color) {
          var colorVal = typeof color === 'string' ? color : (color.hex || color.value || '');
          var colorName = typeof color === 'object' && color.name ? color.name : '';
          var colorUsage = typeof color === 'object' && color.usage !== undefined ? String(color.usage) : '-';
          return [
            '<span style="display:inline-block;width:16px;height:16px;border-radius:3px;background:' + esc(colorVal) + ';vertical-align:middle;margin-right:6px;border:1px solid #e5e7eb;"></span>' + esc(colorVal),
            esc(colorName || '-'),
            esc(colorUsage)
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.brandConsistency.report.colors.table.color', 'Color'), width: '40%' },
            { label: t('reports.brandConsistency.report.colors.table.name', 'Name'), width: '30%' },
            { label: t('reports.brandConsistency.report.colors.table.usage', 'Usage'), width: '30%' }
          ],
          paletteRows,
          { striped: true }
        );
      }

      // Dominant colors
      var dominantColors = colorAnalysis.dominantColors || [];
      if (dominantColors.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.brandConsistency.report.colors.dominantHeading', 'Dominant Colors')) + '</h3>';
        var domRows = dominantColors.slice(0, 10).map(function (color) {
          var colorVal = typeof color === 'string' ? color : (color.hex || color.value || '');
          var pct = typeof color === 'object' && color.percentage !== undefined ? color.percentage + '%' : '-';
          return [
            '<span style="display:inline-block;width:16px;height:16px;border-radius:3px;background:' + esc(colorVal) + ';vertical-align:middle;margin-right:6px;border:1px solid #e5e7eb;"></span>' + esc(colorVal),
            esc(pct)
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.brandConsistency.report.colors.table.color', 'Color'), width: '60%' },
            { label: t('reports.brandConsistency.report.colors.table.percentage', 'Percentage'), width: '40%' }
          ],
          domRows,
          { striped: true }
        );
      }

      // Contrast info
      if (colorAnalysis.contrast !== undefined && colorAnalysis.contrast !== null) {
        html += '<div style="margin:8px 0;">' +
          PR.renderStatus(
            colorAnalysis.contrast >= 4.5 ? 'pass' : colorAnalysis.contrast >= 3 ? 'warning' : 'fail',
            t('reports.brandConsistency.report.colors.contrastRatio', 'Contrast Ratio') + ': ' + colorAnalysis.contrast
          ) +
        '</div>';
      }

      // Issues
      var colorIssues = colorAnalysis.issues || [];
      if (colorIssues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.brandConsistency.report.colors.issuesHeading', 'Color Issues')) + '</h3>';
        colorIssues.slice(0, 15).forEach(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.title || issue.description || '');
          var sev = typeof issue === 'object' ? (issue.severity || issue.priority || 'warning') : 'warning';
          html += PR.renderIssue(text, sev);
        });
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Typography Analysis
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-typography .pdf-section__content');
      var score = typographyAnalysis.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.brandConsistency.report.typographyAnalysis', 'Typography Analysis'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.brandConsistency.report.sectionIntros.typography', 'Consistent typography reinforces brand identity and improves readability. This section catalogs all fonts detected across your pages, analyzes heading and body text styles, and identifies typographic inconsistencies. Limiting your site to a well-defined type scale with consistent font families ensures a professional, cohesive appearance.')) + '</p>';

      // Fonts used table
      var fonts = typographyAnalysis.fonts || [];
      if (fonts.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.brandConsistency.report.typography.fontsHeading', 'Fonts Used')) + '</h3>';
        var fontRows = fonts.slice(0, 20).map(function (f) {
          var fontName = typeof f === 'string' ? f : (f.name || f.family || '-');
          var fontWeight = typeof f === 'object' && f.weight ? String(f.weight) : '-';
          var fontUsage = typeof f === 'object' && f.usage ? String(f.usage) : '-';
          var fontPages = typeof f === 'object' && f.pages !== undefined ? String(f.pages) : '-';
          return [
            '<strong>' + esc(fontName) + '</strong>',
            esc(fontWeight),
            esc(fontUsage),
            esc(fontPages)
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.brandConsistency.report.typography.table.font', 'Font'), width: '30%' },
            { label: t('reports.brandConsistency.report.typography.table.weight', 'Weight'), width: '20%' },
            { label: t('reports.brandConsistency.report.typography.table.usage', 'Usage'), width: '25%' },
            { label: t('reports.brandConsistency.report.typography.table.pages', 'Pages'), width: '25%' }
          ],
          fontRows,
          { striped: true }
        );
      }

      // Heading styles
      var headingStyles = typographyAnalysis.headingStyles || [];
      if (headingStyles.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.brandConsistency.report.typography.headingStylesHeading', 'Heading Styles')) + '</h3>';
        var headingRows = headingStyles.slice(0, 10).map(function (h) {
          return [
            '<strong>' + esc(h.tag || h.level || '-') + '</strong>',
            esc(h.fontFamily || h.font || '-'),
            esc(h.fontSize || h.size || '-'),
            esc(h.fontWeight || h.weight || '-')
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.brandConsistency.report.typography.table.element', 'Element'), width: '15%' },
            { label: t('reports.brandConsistency.report.typography.table.font', 'Font'), width: '35%' },
            { label: t('reports.brandConsistency.report.typography.table.size', 'Size'), width: '25%' },
            { label: t('reports.brandConsistency.report.typography.table.weight', 'Weight'), width: '25%' }
          ],
          headingRows,
          { striped: true }
        );
      }

      // Body styles
      var bodyStyles = typographyAnalysis.bodyStyles || [];
      if (bodyStyles.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.brandConsistency.report.typography.bodyStylesHeading', 'Body Styles')) + '</h3>';
        var bodyRows = bodyStyles.slice(0, 10).map(function (b) {
          return [
            esc(b.fontFamily || b.font || '-'),
            esc(b.fontSize || b.size || '-'),
            esc(b.lineHeight || '-'),
            esc(b.fontWeight || b.weight || '-')
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.brandConsistency.report.typography.table.font', 'Font'), width: '35%' },
            { label: t('reports.brandConsistency.report.typography.table.size', 'Size'), width: '20%' },
            { label: t('reports.brandConsistency.report.typography.table.lineHeight', 'Line Height'), width: '20%' },
            { label: t('reports.brandConsistency.report.typography.table.weight', 'Weight'), width: '25%' }
          ],
          bodyRows,
          { striped: true }
        );
      }

      // Issues
      var typoIssues = typographyAnalysis.issues || [];
      if (typoIssues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.brandConsistency.report.typography.issuesHeading', 'Typography Issues')) + '</h3>';
        typoIssues.slice(0, 15).forEach(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.title || issue.description || '');
          var sev = typeof issue === 'object' ? (issue.severity || issue.priority || 'warning') : 'warning';
          html += PR.renderIssue(text, sev);
        });
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. Contrast Analysis
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-contrast .pdf-section__content');
      var score = contrastAnalysis.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.brandConsistency.report.contrastAnalysis', 'Contrast Analysis'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.brandConsistency.report.sectionIntros.contrast', 'Adequate color contrast ensures your content is readable for all users, including those with visual impairments. WCAG 2.1 requires a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text. This section evaluates foreground-background color pairs across your pages and identifies pairs that fail to meet accessibility standards.')) + '</p>';

      // Contrast pairs table
      var pairs = contrastAnalysis.pairs || [];
      if (pairs.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.brandConsistency.report.contrast.pairsHeading', 'Contrast Pairs')) + '</h3>';
        var pairRows = pairs.slice(0, 20).map(function (p) {
          var fg = p.foreground || p.fg || '-';
          var bg = p.background || p.bg || '-';
          var ratio = p.ratio !== undefined ? String(p.ratio) : '-';
          var pass = p.ratio !== undefined && p.ratio >= 4.5;
          return [
            '<span style="display:inline-block;width:16px;height:16px;border-radius:3px;background:' + esc(fg) + ';vertical-align:middle;margin-right:6px;border:1px solid #e5e7eb;"></span>' + esc(fg),
            '<span style="display:inline-block;width:16px;height:16px;border-radius:3px;background:' + esc(bg) + ';vertical-align:middle;margin-right:6px;border:1px solid #e5e7eb;"></span>' + esc(bg),
            esc(ratio),
            pass ? PR.renderStatus('pass', t('reports.brandConsistency.report.contrast.pass', 'Pass')) : PR.renderStatus('fail', t('reports.brandConsistency.report.contrast.fail', 'Fail'))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.brandConsistency.report.contrast.table.foreground', 'Foreground'), width: '30%' },
            { label: t('reports.brandConsistency.report.contrast.table.background', 'Background'), width: '30%' },
            { label: t('reports.brandConsistency.report.contrast.table.ratio', 'Ratio'), width: '20%' },
            { label: t('seo.report.table.status', 'Status'), width: '20%' }
          ],
          pairRows,
          { striped: true }
        );
      }

      // Issues
      var contrastIssues = contrastAnalysis.issues || [];
      if (contrastIssues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.brandConsistency.report.contrast.issuesHeading', 'Contrast Issues')) + '</h3>';
        contrastIssues.slice(0, 15).forEach(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.title || issue.description || '');
          var sev = typeof issue === 'object' ? (issue.severity || issue.priority || 'warning') : 'warning';
          html += PR.renderIssue(text, sev);
        });
      } else if (pairs.length > 0) {
        html += PR.renderCallout(
          t('reports.brandConsistency.report.contrast.noIssuesTitle', 'Good Contrast'),
          t('reports.brandConsistency.report.contrast.noIssuesBody', 'All analyzed color pairs meet WCAG contrast requirements.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Cross-Page Consistency
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-cross-page .pdf-section__content');
      var score = crossPageConsistency.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.brandConsistency.report.crossPageConsistency', 'Cross-Page Consistency'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.brandConsistency.report.sectionIntros.crossPage', 'Cross-page consistency measures how uniform your brand elements remain as users navigate between pages. Inconsistent styling, differing color palettes, or mismatched typography across pages can undermine brand trust and create a disjointed user experience. This section compares brand elements across all analyzed pages and highlights deviations.')) + '</p>';

      // Pages analyzed
      var pages = crossPageConsistency.pages || [];
      if (pages.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.brandConsistency.report.crossPage.pagesHeading', 'Pages Analyzed')) + '</h3>';

        html += PR.renderMetrics([
          { value: pages.length, label: t('reports.brandConsistency.report.crossPage.totalPages', 'Total Pages') }
        ]);

        var pageRows = pages.slice(0, 20).map(function (page) {
          var pageUrl = typeof page === 'string' ? page : (page.url || page.path || '-');
          var pageScore = typeof page === 'object' && page.score !== undefined ? String(page.score) : '-';
          return [
            '<span class="pdf-table__truncate">' + esc(truncate(pageUrl, 60)) + '</span>',
            esc(pageScore)
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.brandConsistency.report.crossPage.table.page', 'Page'), width: '70%' },
            { label: t('reports.brandConsistency.report.crossPage.table.score', 'Score'), width: '30%' }
          ],
          pageRows,
          { striped: true }
        );
      }

      // Consistency issues
      var crossIssues = crossPageConsistency.issues || [];
      if (crossIssues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.brandConsistency.report.crossPage.issuesHeading', 'Consistency Issues')) + '</h3>';
        crossIssues.slice(0, 15).forEach(function (issue) {
          var text = typeof issue === 'string' ? issue : (issue.message || issue.title || issue.description || '');
          var sev = typeof issue === 'object' ? (issue.severity || issue.priority || 'warning') : 'warning';
          html += PR.renderIssue(text, sev);
        });
      } else {
        html += PR.renderCallout(
          t('reports.brandConsistency.report.crossPage.noIssuesTitle', 'Consistent Branding'),
          t('reports.brandConsistency.report.crossPage.noIssuesBody', 'No cross-page consistency issues were detected. Your brand elements are uniform across pages.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Recommendations
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.brandConsistency.report.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.brandConsistency.report.sectionIntros.recommendations', 'Based on the brand consistency analysis, this section provides prioritized recommendations to strengthen your visual identity. Each recommendation targets a specific area of improvement — from color palette standardization to typographic consistency. Addressing high-priority items first will yield the greatest impact on brand coherence and user trust.')) + '</p>';

      if (recommendations.length > 0) {
        var critical = recommendations.filter(function (r) { return (r.priority || r.severity) === 'critical'; });
        var high = recommendations.filter(function (r) { return (r.priority || r.severity) === 'high'; });
        var medium = recommendations.filter(function (r) { return (r.priority || r.severity) === 'medium'; });
        var low = recommendations.filter(function (r) {
          var p = r.priority || r.severity;
          return !p || p === 'low';
        });
        var groups = [
          { items: critical, label: t('common.pdf.execSummary.highPriority', 'Critical'), color: '#ef4444' },
          { items: high, label: t('common.pdf.execSummary.highPriority', 'High Priority'), color: '#f97316' },
          { items: medium, label: t('common.pdf.execSummary.mediumPriority', 'Medium Priority'), color: '#f59e0b' },
          { items: low, label: t('common.pdf.execSummary.lowPriority', 'Low Priority'), color: '#3b82f6' }
        ];

        groups.forEach(function (group) {
          if (group.items.length === 0) return;
          html += '<div class="pdf-recs-group">';
          html += '<div class="pdf-recs-group__title" style="color:' + group.color + ';">&#9679; ' + group.label + ' (' + group.items.length + ')</div>';
          group.items.forEach(function (r) {
            html += '<div class="pdf-rec" style="border-left-color:' + group.color + ';">' +
              '<div class="pdf-rec__text"><strong>' + esc(r.title || '') + '</strong>' +
              (r.description ? '<br>' + esc(r.description) : '') +
              '</div>' +
            '</div>';
          });
          html += '</div>';
        });
      } else {
        html += PR.renderCallout(
          t('reports.brandConsistency.report.recommendations.noneTitle', 'Strong Brand Consistency'),
          t('reports.brandConsistency.report.recommendations.noneBody', 'Your site maintains excellent brand consistency. Continue monitoring for visual drift as content evolves.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    // Hide empty sections
    document.querySelectorAll('.pdf-section').forEach(function (sec) {
      var content = sec.querySelector('.pdf-section__content');
      if (content && !content.innerHTML.trim()) {
        sec.style.display = 'none';
      }
    });
  });

})(window);
