/**
 * Hosting Report — PDF Renderer
 * Renders all hosting analysis sections into the PDF template.
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[hosting-report-render] PdfReport not loaded');
    return;
  }

  const PR = window.PdfReport;

  PdfReport.register('hosting', function renderHosting(data, utils) {
    const t = utils.t;
    const esc = utils.esc;
    const truncate = utils.truncate;
    const scoreClass = utils.scoreClass;

    let sectionIndex = 1;

    // Resolve data sources
    const hosting = data.hosting || {};
    const cmsDetected = data.cmsDetected || {};
    const recommendations = data.recommendations || [];

    function _htmlToNode(htmlStr) {
      const tpl = document.createElement('template');
      tpl.innerHTML = htmlStr.trim();
      return tpl.content.firstChild;
    }

    /* -----------------------------------------------------------------------
       1. Hosting Provider
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-provider .pdf-section__content');
      const score = data.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.hosting.report.provider', 'Hosting Provider'), score)),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.hosting.report.sectionIntros.provider', 'Your hosting provider forms the foundation of your website\'s performance, security, and reliability. This section identifies the detected hosting provider, its service tier, and available features. Understanding your hosting infrastructure helps identify opportunities for optimization and ensures your provider meets your site\'s requirements.')) + '</p>';

      // Provider overview table
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.hosting.report.provider.overviewHeading', 'Provider Details')) + '</h3>';

      const rows = [];
      rows.push([
        esc(t('reports.hosting.report.provider.rows.name', 'Provider')),
        '<strong>' + esc(hosting.detectedProvider || '-') + '</strong>'
      ]);
      rows.push([
        esc(t('reports.hosting.report.provider.rows.category', 'Category')),
        esc(hosting.category || '-')
      ]);
      rows.push([
        esc(t('reports.hosting.report.provider.rows.tier', 'Tier')),
        esc(hosting.tier || '-')
      ]);

      html += PR.renderTable(
        [
          { label: t('seo.report.table.property', 'Property'), width: '35%' },
          { label: t('seo.report.table.value', 'Value'), width: '65%' }
        ],
        rows,
        { striped: true }
      );

      // Metrics
      html += PR.renderMetrics([
        { value: hosting.detectedProvider || '-', label: t('reports.hosting.report.provider.rows.name', 'Provider') },
        { value: hosting.category || '-', label: t('reports.hosting.report.provider.rows.category', 'Category') },
        { value: hosting.tier || '-', label: t('reports.hosting.report.provider.rows.tier', 'Tier') }
      ]);

      // Features table
      const features = hosting.features || [];
      if (features.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.hosting.report.provider.featuresHeading', 'Included Features')) + '</h3>';
        const featureRows = features.map(function (f) {
          return [
            esc(f),
            PR.renderStatus('pass', t('seo.report.status.yes', 'Yes'))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.hosting.report.provider.table.feature', 'Feature'), width: '70%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          featureRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Server Infrastructure
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-infrastructure .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.hosting.report.infrastructure', 'Server Infrastructure'))),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.hosting.report.sectionIntros.infrastructure', 'Server infrastructure encompasses the hardware, software, and network configuration that deliver your website to visitors. This section examines your server\'s IP address, response headers, and technical configuration. Properly configured server infrastructure ensures fast, reliable content delivery and reduces security vulnerabilities.')) + '</p>';

      // Server info table
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.hosting.report.infrastructure.serverHeading', 'Server Information')) + '</h3>';

      const serverRows = [];
      if (hosting.ipAddress) {
        serverRows.push([
          esc(t('reports.hosting.report.infrastructure.rows.ip', 'IP Address')),
          esc(hosting.ipAddress)
        ]);
      }
      if (hosting.detectedProvider) {
        serverRows.push([
          esc(t('reports.hosting.report.infrastructure.rows.provider', 'Provider')),
          esc(hosting.detectedProvider)
        ]);
      }

      if (serverRows.length > 0) {
        html += PR.renderTable(
          [
            { label: t('seo.report.table.property', 'Property'), width: '35%' },
            { label: t('seo.report.table.value', 'Value'), width: '65%' }
          ],
          serverRows,
          { striped: true }
        );
      }

      // Response headers table
      const responseHeaders = hosting.responseHeaders || {};
      const headerKeys = Object.keys(responseHeaders);
      if (headerKeys.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.hosting.report.infrastructure.headersHeading', 'Response Headers')) + '</h3>';
        const headerRows = headerKeys.slice(0, 20).map(function (key) {
          return [
            '<strong>' + esc(key) + '</strong>',
            '<span class="pdf-table__truncate">' + esc(truncate(String(responseHeaders[key]), 80)) + '</span>'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.hosting.report.infrastructure.table.header', 'Header'), width: '30%' },
            { label: t('seo.report.table.value', 'Value'), width: '70%' }
          ],
          headerRows,
          { striped: true }
        );

        if (headerKeys.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: headerKeys.length - 20 }) + '</p>';
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. CMS & Technology
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-cms .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.hosting.report.cms', 'CMS & Technology'))),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.hosting.report.sectionIntros.cms', 'Content Management Systems and web technologies determine how your site is built and maintained. This section identifies the CMS platform, its version, and additional technologies detected on your site. Keeping your CMS and its dependencies up to date is critical for security and performance.')) + '</p>';

      // CMS detection results
      if (cmsDetected.name) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.hosting.report.cms.detectionHeading', 'CMS Detection')) + '</h3>';

        const cmsRows = [];
        cmsRows.push([
          esc(t('reports.hosting.report.cms.rows.platform', 'Platform')),
          '<strong>' + esc(cmsDetected.name) + '</strong>'
        ]);
        if (cmsDetected.version) {
          cmsRows.push([
            esc(t('reports.hosting.report.cms.rows.version', 'Version')),
            esc(cmsDetected.version)
          ]);
        }
        if (cmsDetected.confidence !== undefined && cmsDetected.confidence !== null) {
          cmsRows.push([
            esc(t('reports.hosting.report.cms.rows.confidence', 'Confidence')),
            '<span style="font-weight:600;">' + esc(String(cmsDetected.confidence)) + '%</span>'
          ]);
        }

        html += PR.renderTable(
          [
            { label: t('seo.report.table.property', 'Property'), width: '35%' },
            { label: t('seo.report.table.value', 'Value'), width: '65%' }
          ],
          cmsRows,
          { striped: true }
        );

        // CMS metrics
        html += PR.renderMetrics([
          { value: cmsDetected.name || '-', label: t('reports.hosting.report.cms.rows.platform', 'Platform') },
          { value: cmsDetected.version || '-', label: t('reports.hosting.report.cms.rows.version', 'Version') },
          { value: cmsDetected.confidence !== undefined && cmsDetected.confidence !== null ? cmsDetected.confidence + '%' : '-', label: t('reports.hosting.report.cms.rows.confidence', 'Confidence') }
        ]);
      } else {
        html += PR.renderCallout(
          t('reports.hosting.report.cms.noneTitle', 'No CMS Detected'),
          t('reports.hosting.report.cms.noneBody', 'No content management system was detected. The site may use a custom-built solution or a static site generator.'),
          'info'
        );
      }

      // Technologies list
      const technologies = hosting.technologies || [];
      if (technologies.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.hosting.report.cms.technologiesHeading', 'Detected Technologies')) + '</h3>';
        const techRows = technologies.slice(0, 25).map(function (tech) {
          const techName = typeof tech === 'string' ? tech : (tech.name || '-');
          const techCategory = typeof tech === 'object' && tech.category ? tech.category : '-';
          return [
            '<strong>' + esc(techName) + '</strong>',
            esc(techCategory),
            PR.renderStatus('found', t('seo.report.status.detected', 'Detected'))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.hosting.report.cms.table.technology', 'Technology'), width: '40%' },
            { label: t('reports.hosting.report.cms.table.category', 'Category'), width: '30%' },
            { label: t('seo.report.table.status', 'Status'), width: '20%' }
          ],
          techRows,
          { striped: true }
        );

        if (technologies.length > 25) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: technologies.length - 25 }) + '</p>';
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. Hosting Performance
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-performance .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.hosting.report.performance', 'Hosting Performance'))),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.hosting.report.sectionIntros.performance', 'Hosting performance directly impacts your site\'s loading speed and user experience. This section measures server response time and Time to First Byte (TTFB), which indicate how quickly your server processes and begins delivering requests. Fast server response times are essential for good Core Web Vitals scores.')) + '</p>';

      // Performance metrics
      const perfMetrics = [];
      if (hosting.responseTime !== undefined && hosting.responseTime !== null) {
        const rtColor = hosting.responseTime <= 200 ? '#10b981' : hosting.responseTime <= 500 ? '#f59e0b' : '#ef4444';
        perfMetrics.push({ value: hosting.responseTime + 'ms', label: t('reports.hosting.report.performance.responseTime', 'Response Time'), color: rtColor });
      }
      if (hosting.ttfb !== undefined && hosting.ttfb !== null) {
        const ttfbColor = hosting.ttfb <= 200 ? '#10b981' : hosting.ttfb <= 600 ? '#f59e0b' : '#ef4444';
        perfMetrics.push({ value: hosting.ttfb + 'ms', label: t('reports.hosting.report.performance.ttfb', 'TTFB'), color: ttfbColor });
      }
      if (perfMetrics.length > 0) {
        html += PR.renderMetrics(perfMetrics);
      }

      // Performance details table
      const perfRows = [];
      if (hosting.responseTime !== undefined && hosting.responseTime !== null) {
        perfRows.push([
          esc(t('reports.hosting.report.performance.responseTime', 'Response Time')),
          '<strong>' + esc(hosting.responseTime + 'ms') + '</strong>',
          hosting.responseTime <= 200
            ? PR.renderStatus('pass', t('performance.report.cwv.good', 'Good'))
            : hosting.responseTime <= 500
              ? PR.renderStatus('warning', t('performance.report.cwv.needsImprovement', 'Needs Improvement'))
              : PR.renderStatus('fail', t('performance.report.cwv.poor', 'Poor'))
        ]);
      }
      if (hosting.ttfb !== undefined && hosting.ttfb !== null) {
        perfRows.push([
          esc(t('reports.hosting.report.performance.ttfb', 'TTFB')),
          '<strong>' + esc(hosting.ttfb + 'ms') + '</strong>',
          hosting.ttfb <= 200
            ? PR.renderStatus('pass', t('performance.report.cwv.good', 'Good'))
            : hosting.ttfb <= 600
              ? PR.renderStatus('warning', t('performance.report.cwv.needsImprovement', 'Needs Improvement'))
              : PR.renderStatus('fail', t('performance.report.cwv.poor', 'Poor'))
        ]);
      }

      if (perfRows.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.hosting.report.performance.detailsHeading', 'Performance Details')) + '</h3>';
        html += PR.renderTable(
          [
            { label: t('seo.report.table.metric', 'Metric'), width: '30%' },
            { label: t('seo.report.table.value', 'Value'), width: '30%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          perfRows,
          { striped: true }
        );
      }

      // Grade display
      if (data.grade) {
        html += '<div style="margin:8px 0;">' +
          PR.renderStatus(data.grade === 'A' || data.grade === 'B' ? 'pass' : 'warning',
            t('common.grade', 'Grade') + ': ' + data.grade) +
        '</div>';
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Pricing Overview
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-pricing .pdf-section__content');
      const priceComparison = data.priceComparison || {};
      const recommendedHosts = data.recommendedHosts || [];
      const savingsOpportunities = data.savingsOpportunities || [];

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.hosting.report.pricing', 'Pricing Overview'))),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.hosting.report.sectionIntros.pricing', 'This section provides a pricing overview of hosting providers that match your site\'s requirements, including price ranges, recommended hosts, and potential savings opportunities.')) + '</p>';

      // Price comparison metrics
      const priceMetrics = [];
      if (priceComparison.lowestPrice !== undefined && priceComparison.lowestPrice !== null) {
        priceMetrics.push({ value: '$' + priceComparison.lowestPrice + '/mo', label: t('reports.hosting.lowestPrice', 'Lowest Price'), color: '#10b981' });
      }
      if (priceComparison.averagePrice !== undefined && priceComparison.averagePrice !== null) {
        priceMetrics.push({ value: '$' + priceComparison.averagePrice + '/mo', label: t('reports.hosting.averagePrice', 'Average Price'), color: '#f59e0b' });
      }
      if (priceComparison.highestPrice !== undefined && priceComparison.highestPrice !== null) {
        priceMetrics.push({ value: '$' + priceComparison.highestPrice + '/mo', label: t('reports.hosting.premiumPrice', 'Premium Price'), color: '#8b5cf6' });
      }
      if (priceComparison.budgetOptions !== undefined && priceComparison.budgetOptions !== null) {
        priceMetrics.push({ value: String(priceComparison.budgetOptions), label: t('reports.hosting.budgetOptions', 'Budget Options') });
      }
      if (priceMetrics.length > 0) {
        html += PR.renderMetrics(priceMetrics);
      }

      // Recommended hosts table
      if (recommendedHosts.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.hosting.topRecommendedHosts', 'Top Recommended Hosts')) + '</h3>';
        var hostRows = recommendedHosts.slice(0, 10).map(function (host) {
          var price = host.cheapestPlan && host.cheapestPlan.price !== undefined ? '$' + host.cheapestPlan.price + '/mo' : '-';
          var rating = host.rating !== undefined ? String(host.rating) : '-';
          var uptime = host.uptime || '-';
          var matchScore = host.matchScore ? Math.round(host.matchScore) + '%' : '-';
          return [
            '<strong>' + esc(host.name || '-') + '</strong>',
            esc(host.category || '-'),
            esc(rating),
            esc(uptime),
            esc(price),
            esc(matchScore)
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.hosting.table.provider', 'Provider'), width: '22%' },
            { label: t('reports.hosting.table.category', 'Category'), width: '16%' },
            { label: t('reports.hosting.table.rating', 'Rating'), width: '12%' },
            { label: t('reports.hosting.table.uptime', 'Uptime'), width: '14%' },
            { label: t('reports.hosting.table.priceRange', 'Price'), width: '16%' },
            { label: t('reports.hosting.table.match', 'Match'), width: '12%' }
          ],
          hostRows,
          { striped: true }
        );

        if (recommendedHosts.length > 10) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: recommendedHosts.length - 10 }) + '</p>';
        }
      }

      // Savings opportunities
      if (savingsOpportunities.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.hosting.potentialSavings', 'Potential Savings Opportunities')) + '</h3>';
        var savingsRows = savingsOpportunities.slice(0, 10).map(function (opp) {
          return [
            '<strong>' + esc(opp.provider || '-') + '</strong>',
            esc(opp.currentPrice !== undefined ? '$' + opp.currentPrice + '/mo' : '-'),
            esc(opp.newPrice !== undefined ? '$' + opp.newPrice + '/mo' : '-'),
            '<strong style="color:#10b981;">' + esc(opp.savingsPercent !== undefined ? '-' + opp.savingsPercent + '%' : '-') + '</strong>',
            esc(opp.annualSavings !== undefined ? '$' + opp.annualSavings + '/yr' : '-')
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.hosting.table.provider', 'Provider'), width: '25%' },
            { label: t('reports.hosting.report.pricing.currentPrice', 'Current'), width: '15%' },
            { label: t('reports.hosting.report.pricing.newPrice', 'New Price'), width: '15%' },
            { label: t('reports.hosting.report.pricing.savings', 'Savings'), width: '15%' },
            { label: t('reports.hosting.report.pricing.annualSavings', 'Annual'), width: '15%' }
          ],
          savingsRows,
          { striped: true }
        );
      }

      // Fallback if no pricing data at all
      if (priceMetrics.length === 0 && recommendedHosts.length === 0 && savingsOpportunities.length === 0) {
        html += PR.renderCallout(
          t('reports.hosting.report.pricing.noneTitle', 'No Pricing Data Available'),
          t('reports.hosting.report.pricing.noneBody', 'Pricing comparison data was not available for this analysis. This may occur if the hosting provider or CMS could not be reliably detected.'),
          'info'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Recommendations
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.hosting.report.recommendations', 'Recommendations'))),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.hosting.report.sectionIntros.recommendations', 'Based on the hosting analysis, these recommendations prioritize the most impactful improvements for your server infrastructure, performance, and configuration.')) + '</p>';

      if (recommendations.length > 0) {
        const critical = recommendations.filter(function (r) { return (r.priority || r.severity) === 'critical'; });
        const high = recommendations.filter(function (r) { return (r.priority || r.severity) === 'high'; });
        const medium = recommendations.filter(function (r) { return (r.priority || r.severity) === 'medium'; });
        const low = recommendations.filter(function (r) {
          const p = r.priority || r.severity;
          return !p || p === 'low';
        });
        const groups = [
          { items: critical, label: t('common.pdf.execSummary.highPriority', 'High Priority'), color: '#ef4444' },
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
          t('reports.hosting.report.recommendations.noneTitle', 'Solid Hosting Setup'),
          t('reports.hosting.report.recommendations.noneBody', 'Your hosting configuration follows best practices. Continue monitoring for performance changes.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    // Hide empty sections
    document.querySelectorAll('.pdf-section').forEach(function (sec) {
      const content = sec.querySelector('.pdf-section__content');
      if (content && !content.innerHTML.trim()) {
        sec.style.display = 'none';
      }
    });
  });

})(window);
