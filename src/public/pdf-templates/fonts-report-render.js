/**
 * Enhanced Fonts Report — PDF Renderer
 * Renders all font analysis sections into the PDF template.
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[fonts-report-render] PdfReport not loaded');
    return;
  }

  var PR = window.PdfReport;

  PdfReport.register('fonts', function renderFonts(data, utils) {
    var t = utils.t;
    var esc = utils.esc;
    var truncate = utils.truncate;
    var scoreClass = utils.scoreClass;

    var sectionIndex = 1;

    // Resolve data sources — handle deep nesting
    var families = data.families || data.fontFamilies || [];
    if (families instanceof Map) families = Array.from(families.values());
    if (typeof families === 'object' && !Array.isArray(families) && !(families instanceof Map)) {
      families = Object.values(families);
    }
    var providers = data.providers || [];
    var summary = data.summary || {};
    var fontDelivery = data.fontDelivery || {};
    var fallbackStability = data.fallbackStability || {};
    var declarations = data.declarations || [];
    var performance = data.performance || {};
    var duplicates = data.duplicates || [];
    var recommendations = data.recommendations || [];

    /* -----------------------------------------------------------------------
       1. Font Families
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-families .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('fonts.fontFamilies', 'Font Families'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('fonts.report.sectionIntros.families', 'Font families define the typographic identity of your site. This section catalogs all font families detected on your page, including their weight variants, styles, and loading sources. Using too many families increases page weight and load times. Best practice is to limit your site to 2-3 font families with only the weight variants you actually use.')) + '</p>';

      // Metrics
      html += PR.renderMetrics([
        { value: summary.totalFamilies || families.length || 0, label: t('fonts.report.families.totalLabel', 'Total Families') },
        { value: summary.totalVariants || 0, label: t('fonts.report.families.variantsLabel', 'Total Variants') },
        { value: summary.duplicateCount || duplicates.length || 0, label: t('fonts.report.families.duplicatesLabel', 'Duplicates'), color: (summary.duplicateCount || duplicates.length || 0) > 0 ? '#f59e0b' : '#10b981' }
      ]);

      // Families table
      if (families.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.families.detailsHeading', 'Detected Families')) + '</h3>';
        var famRows = families.slice(0, 20).map(function (f) {
          var variants = f.variants || [];
          var weights = variants.map(function (v) { return v.weight || '400'; }).join(', ');
          var source = (f.sources && f.sources.length > 0) ? f.sources[0] : (f.detectedFrom || '-');
          return [
            '<strong>' + esc(f.name || '-') + '</strong>',
            esc(weights || '-'),
            String(variants.length),
            '<span class="pdf-table__truncate">' + esc(truncate(source, 40)) + '</span>'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('fonts.report.families.table.name', 'Family'), width: '25%' },
            { label: t('fonts.report.families.table.weights', 'Weights'), width: '25%' },
            { label: t('fonts.report.families.table.variants', 'Variants'), width: '12%' },
            { label: t('fonts.report.families.table.source', 'Source'), width: '30%' }
          ],
          famRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Providers & Origins
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-providers .pdf-section__content');
      if (!providers || providers.length === 0) {
        sec.parentElement.style.display = 'none';
        return;
      }

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('fonts.providersOrigins', 'Providers & Origins'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('fonts.report.sectionIntros.providers', 'Font providers determine how fonts are delivered to your visitors. Third-party providers like Google Fonts and Adobe Fonts offer convenience but introduce external dependencies and potential privacy concerns. Self-hosting fonts gives you full control over delivery and eliminates third-party requests. This section identifies all font sources and their delivery methods.')) + '</p>';

      var provRows = providers.map(function (p) {
        return [
          '<strong>' + esc(p.name || '-') + '</strong>',
          esc(p.type || '-'),
          String(p.count || (p.families ? p.families.length : 0))
        ];
      });

      html += PR.renderTable(
        [
          { label: t('fonts.report.providers.table.provider', 'Provider'), width: '35%' },
          { label: t('fonts.report.providers.table.type', 'Type'), width: '25%' },
          { label: t('fonts.report.providers.table.fontsServed', 'Fonts Served'), width: '20%' }
        ],
        provRows,
        { striped: true }
      );

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Font Loading Performance
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-loading .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('fonts.fontLoadingPerformance', 'Font Loading Performance'), performance.score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('fonts.report.sectionIntros.loading', 'Font loading speed directly impacts First Contentful Paint (FCP) and overall perceived performance. Slow-loading fonts cause invisible text (FOIT) or flash of unstyled text (FOUT), degrading user experience. This section evaluates loading time, estimated bandwidth cost, and the impact on rendering performance. Using font-display: swap and preloading critical fonts are key optimization strategies.')) + '</p>';

      html += PR.renderMetrics([
        { value: performance.impact || '-', label: t('fonts.report.loading.impactLabel', 'Performance Impact') },
        { value: performance.familyCount || summary.totalFamilies || 0, label: t('fonts.report.families.totalLabel', 'Families') },
        { value: performance.estimatedKB ? performance.estimatedKB + ' KB' : '-', label: t('fonts.report.loading.estimatedSizeLabel', 'Estimated Size') }
      ]);

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. Privacy & Licensing
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-privacy .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('fonts.privacyLicensing', 'Privacy & Licensing'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('fonts.report.sectionIntros.privacy', 'Loading fonts from third-party CDNs sends visitor IP addresses and browsing data to external servers. Under GDPR and similar privacy regulations, this may require explicit user consent. Google Fonts has been the subject of GDPR enforcement actions in several EU countries. This section identifies privacy implications of your font loading strategy and highlights potential compliance risks.')) + '</p>';

      // Privacy warnings for external providers
      var hasExternalProvider = providers.some(function (p) {
        return p.name && /google|adobe|typekit/i.test(p.name);
      });

      if (hasExternalProvider) {
        html += PR.renderCallout(
          t('fonts.report.privacy.gdprWarningTitle', 'GDPR Consideration'),
          t('fonts.report.privacy.gdprWarningBody', 'External font providers send visitor data to third-party servers. Consider self-hosting fonts for GDPR compliance.'),
          'warning'
        );
      }

      if (providers.length > 0) {
        var privRows = providers.map(function (p) {
          var isExternal = /google|adobe|typekit/i.test(p.name || '');
          return [
            esc(p.name || '-'),
            isExternal
              ? PR.renderStatus('warning', t('fonts.report.privacy.externalCdn', 'External CDN'))
              : PR.renderStatus('pass', t('fonts.report.privacy.selfHosted', 'Self-Hosted')),
            isExternal
              ? t('fonts.report.privacy.consentRequired', 'May require consent')
              : t('fonts.report.privacy.noIssue', 'No privacy concern')
          ];
        });

        html += PR.renderTable(
          [
            { label: t('fonts.report.providers.table.provider', 'Provider'), width: '30%' },
            { label: t('seo.report.table.status', 'Status'), width: '25%' },
            { label: t('fonts.report.privacy.gdprLabel', 'GDPR Impact'), width: '35%' }
          ],
          privRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Font Delivery
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-delivery .pdf-section__content');
      if (!fontDelivery.totalRequests && !fontDelivery.requests) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var score = fontDelivery.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('fonts.fontDelivery', 'Font Delivery'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('fonts.report.sectionIntros.delivery', 'Font delivery optimization ensures fonts are downloaded efficiently. Using modern formats like WOFF2 reduces file sizes by 30-50% compared to older formats. This section analyzes font file requests, formats, sizes, and loading times. Implementing preconnect hints for external font servers and preloading critical font files accelerates delivery.')) + '</p>';

      // Metrics
      html += PR.renderMetrics([
        { value: fontDelivery.totalRequests || 0, label: t('fonts.report.delivery.requestsLabel', 'Font Requests') },
        { value: fontDelivery.totalBytesKB || '-', label: t('fonts.report.delivery.totalSizeLabel', 'Total Size') },
        { value: fontDelivery.modernFormatPercentage !== undefined ? fontDelivery.modernFormatPercentage + '%' : '-', label: t('fonts.report.delivery.woff2Label', 'WOFF2 Usage') }
      ]);

      // WOFF2 progress
      if (fontDelivery.formats) {
        var totalFormats = (fontDelivery.formats.woff2 || 0) + (fontDelivery.formats.woff || 0) + (fontDelivery.formats.ttf || 0) + (fontDelivery.formats.otf || 0) + (fontDelivery.formats.legacy || 0);
        if (totalFormats > 0) {
          html += PR.renderProgress(
            t('fonts.report.delivery.woff2Label', 'WOFF2 Coverage'),
            fontDelivery.formats.woff2 || 0, totalFormats
          );
        }
      }

      // Font requests table
      if (fontDelivery.requests && fontDelivery.requests.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.delivery.requestsHeading', 'Font File Requests')) + '</h3>';
        var reqRows = fontDelivery.requests.slice(0, 15).map(function (r) {
          return [
            '<span class="pdf-table__truncate">' + esc(truncate(r.url, 50)) + '</span>',
            esc(r.format || '-'),
            esc(r.sizeKB || '-'),
            r.loadTime ? r.loadTime + 'ms' : '-'
          ];
        });

        html += PR.renderTable(
          [
            { label: 'URL', width: '40%' },
            { label: t('fonts.report.delivery.table.format', 'Format'), width: '15%' },
            { label: t('fonts.report.delivery.table.size', 'Size'), width: '15%' },
            { label: t('fonts.report.delivery.table.loadTime', 'Load Time'), width: '15%' }
          ],
          reqRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Fallback & Layout Stability
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-stability .pdf-section__content');

      var score = fallbackStability.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('fonts.fallbackLayoutStability', 'Fallback & Layout Stability'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('fonts.report.sectionIntros.stability', 'Layout stability during font loading prevents jarring visual shifts that frustrate users and hurt Core Web Vitals scores. Proper fallback font stacks and font-display settings minimize Cumulative Layout Shift (CLS). This section analyzes your fallback stacks, font-display usage, and CLS risk factors. Using size-adjusted fallback fonts with metric overrides can virtually eliminate font-related layout shift.')) + '</p>';

      // CLS Risk badge
      var clsRisk = fallbackStability.clsRisk || {};
      if (clsRisk.level) {
        var riskColor = clsRisk.level === 'low' ? '#10b981' : clsRisk.level === 'medium' ? '#f59e0b' : '#ef4444';
        html += '<div style="margin:12px 0;">' +
          PR.renderStatus(clsRisk.level === 'low' ? 'pass' : clsRisk.level === 'medium' ? 'warning' : 'fail',
            t('fonts.report.stability.clsRiskLabel', 'CLS Risk') + ': ' + clsRisk.level.toUpperCase()) +
        '</div>';
      }

      // Fallback stacks table
      var stacks = fallbackStability.fallbackStacks || [];
      if (stacks.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.stability.fallbackStacksHeading', 'Fallback Stacks')) + '</h3>';
        var stackRows = stacks.slice(0, 10).map(function (s) {
          var qualityColor = s.quality === 'excellent' ? '#10b981' : s.quality === 'good' ? '#22c55e' : '#ef4444';
          return [
            '<span class="pdf-table__truncate">' + esc(truncate(s.stack, 60)) + '</span>',
            '<span style="color:' + qualityColor + ';font-weight:600;">' + esc((s.quality || '-').charAt(0).toUpperCase() + (s.quality || '-').slice(1)) + '</span>',
            s.hasGenericFallback ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No'))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('fonts.report.stability.table.stack', 'Font Stack'), width: '50%' },
            { label: t('fonts.report.stability.table.quality', 'Quality'), width: '20%' },
            { label: t('fonts.report.stability.table.genericFallback', 'Generic Fallback'), width: '20%' }
          ],
          stackRows,
          { striped: true }
        );
      }

      // Font-display summary
      var displaySummary = fallbackStability.fontDisplaySummary || {};
      if (displaySummary.optimal !== undefined) {
        html += PR.renderMetrics([
          { value: displaySummary.optimal || 0, label: t('fonts.report.stability.optimalLabel', 'Optimal (swap/optional)'), color: '#10b981' },
          { value: displaySummary.acceptable || 0, label: t('fonts.report.stability.acceptableLabel', 'Acceptable (fallback)'), color: '#f59e0b' },
          { value: displaySummary.problematic || 0, label: t('fonts.report.stability.problematicLabel', 'Problematic (block/auto)'), color: (displaySummary.problematic || 0) > 0 ? '#ef4444' : '#10b981' }
        ]);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       7. Advanced Typography
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-advanced .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('fonts.advancedTypographyAnalysis', 'Advanced Typography'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('fonts.report.sectionIntros.advanced', 'Advanced typography features like variable fonts, subsetting, and unicode-range can significantly reduce file sizes and improve performance. Variable fonts combine multiple weights and styles into a single file, reducing HTTP requests. Subsetting removes unused glyphs, and unicode-range allows the browser to download only needed character sets. This section checks for adoption of these modern optimization techniques.')) + '</p>';

      // Check for variable fonts, subsetting, unicode-range in declarations
      var hasVariableFonts = declarations.some(function (d) { return d.weight && d.weight.includes(' '); });
      var hasUnicodeRange = declarations.some(function (d) { return d.unicodeRange; });

      var advRows = [
        [t('fonts.report.advanced.variableFonts', 'Variable Fonts'), hasVariableFonts ? PR.renderStatus('pass', t('seo.report.status.detected', 'Detected')) : PR.renderStatus('na', t('seo.report.status.notDetected', 'Not Detected'))],
        [t('fonts.report.advanced.unicodeRange', 'Unicode-Range'), hasUnicodeRange ? PR.renderStatus('pass', t('seo.report.status.detected', 'Detected')) : PR.renderStatus('na', t('seo.report.status.notDetected', 'Not Detected'))],
        [t('fonts.report.advanced.metricOverrides', 'Metric Overrides'), (fallbackStability.hasMetricOverrides) ? PR.renderStatus('pass', t('seo.report.status.detected', 'Detected')) : PR.renderStatus('na', t('seo.report.status.notDetected', 'Not Detected'))]
      ];

      html += PR.renderTable(
        [
          { label: t('fonts.report.advanced.table.feature', 'Feature'), width: '50%' },
          { label: t('seo.report.table.status', 'Status'), width: '50%' }
        ],
        advRows,
        { striped: true }
      );

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       8. Recommendations
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('fonts.report.recommendationsHeading', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('fonts.report.sectionIntros.recommendations', 'Based on the font analysis, this section provides actionable recommendations to optimize your typography stack. Each recommendation targets a specific area — from reducing file sizes with modern formats to improving layout stability with proper fallback chains. Implementing these changes can improve both performance metrics and user experience across all devices.')) + '</p>';

      // Also include display issues and duplicate warnings
      var allRecs = recommendations.slice();
      if (duplicates.length > 0) {
        duplicates.forEach(function (dup) {
          allRecs.push({ priority: 'medium', title: dup.message || (dup.family + ' loaded ' + dup.instances + ' times'), description: dup.recommendation || '' });
        });
      }

      if (allRecs.length > 0) {
        var high = allRecs.filter(function (r) { return r.priority === 'high'; });
        var medium = allRecs.filter(function (r) { return r.priority === 'medium'; });
        var low = allRecs.filter(function (r) { return !r.priority || r.priority === 'low'; });
        var groups = [
          { items: high, label: t('common.pdf.execSummary.highPriority', 'High Priority'), color: '#ef4444' },
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
              (r.action ? '<br><em>' + esc(r.action) + '</em>' : '') +
              '</div>' +
            '</div>';
          });
          html += '</div>';
        });
      } else {
        html += PR.renderCallout(
          t('fonts.report.recommendationsNoneTitle', 'Well-Optimized Typography'),
          t('fonts.report.recommendationsNoneBody', 'Your font stack follows best practices. Continue monitoring for optimization opportunities.'),
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

  function _htmlToNode(html) {
    var temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.firstChild;
  }

})(window);
