/**
 * GEO SEO Report — PDF Renderer
 * Renders all GEO SEO analysis sections into the PDF template.
 * Registered with PdfReport.register() for the shared engine to invoke.
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[geo-seo-report-render] PdfReport not loaded');
    return;
  }

  const PR = window.PdfReport;

  PdfReport.register('geo-seo', function renderGeoSEO(data, utils) {
    const t = utils.t;
    const esc = utils.esc;
    const truncate = utils.truncate;
    const scoreClass = utils.scoreClass;

    let sectionIndex = 1;

    // Resolve data sources
    const analysis = data.analysis || {};
    const scores = data.scores || {};
    const recommendations = data.recommendations || [];

    function _htmlToNode(htmlStr) {
      const tpl = document.createElement('template');
      tpl.innerHTML = htmlStr.trim();
      return tpl.content.firstChild;
    }

    /* -----------------------------------------------------------------------
       1. NAP Consistency
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-nap .pdf-section__content');
      const d = analysis.nap || {};
      const score = scores.nap;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.geoSeo.report.nap', 'NAP Consistency'), score)),
        sec
      );

      let html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('reports.geoSeo.report.sectionIntros.nap', 'NAP (Name, Address, Phone) consistency is a fundamental local SEO ranking factor. Search engines cross-reference your business information across the web to verify legitimacy. Inconsistent NAP data can confuse search engines and reduce your local search visibility. This section checks for NAP presence and consistency issues.')) + '</p>';

      // NAP details table
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.geoSeo.report.nap.detailsHeading', 'Business Information')) + '</h3>';

      const napRows = [];
      napRows.push([
        esc(t('reports.geoSeo.report.nap.rows.name', 'Business Name')),
        '<strong>' + esc(d.name || '-') + '</strong>'
      ]);
      napRows.push([
        esc(t('reports.geoSeo.report.nap.rows.address', 'Address')),
        esc(d.address || '-')
      ]);
      napRows.push([
        esc(t('reports.geoSeo.report.nap.rows.phone', 'Phone')),
        esc(d.phone || '-')
      ]);
      napRows.push([
        esc(t('reports.geoSeo.report.nap.rows.consistency', 'Consistency')),
        d.consistency
          ? PR.renderStatus('pass', t('reports.geoSeo.report.status.consistent', 'Consistent'))
          : PR.renderStatus('fail', t('reports.geoSeo.report.status.inconsistent', 'Inconsistent'))
      ]);

      html += PR.renderTable(
        [
          { label: t('seo.report.table.property', 'Property'), width: '35%' },
          { label: t('seo.report.table.value', 'Value'), width: '65%' }
        ],
        napRows,
        { striped: true }
      );

      // Metrics
      html += PR.renderMetrics([
        { value: d.name ? t('seo.report.status.found', 'Found') : t('seo.report.status.notFound', 'Not found'), label: t('reports.geoSeo.report.nap.rows.name', 'Business Name'), color: d.name ? '#10b981' : '#ef4444' },
        { value: d.address ? t('seo.report.status.found', 'Found') : t('seo.report.status.notFound', 'Not found'), label: t('reports.geoSeo.report.nap.rows.address', 'Address'), color: d.address ? '#10b981' : '#ef4444' },
        { value: d.phone ? t('seo.report.status.found', 'Found') : t('seo.report.status.notFound', 'Not found'), label: t('reports.geoSeo.report.nap.rows.phone', 'Phone'), color: d.phone ? '#10b981' : '#ef4444' }
      ]);

      // Issues table
      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Schema Markup
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-schema .pdf-section__content');
      const d = analysis.schema || {};
      const score = scores.schema;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.geoSeo.report.schema', 'Schema Markup'), score)),
        sec
      );

      let html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('reports.geoSeo.report.sectionIntros.schema', 'Local business schema markup helps search engines understand your business details and display rich results. Proper schema implementation can earn you enhanced search listings with ratings, hours, and contact information. This section evaluates your structured data for local business relevance.')) + '</p>';

      // Schema status metrics
      html += PR.renderMetrics([
        { value: d.found ? t('seo.report.status.detected', 'Detected') : t('seo.report.status.notDetected', 'Not detected'), label: t('reports.geoSeo.report.schema.statusLabel', 'Schema Status'), color: d.found ? '#10b981' : '#ef4444' },
        { value: (d.types || []).length, label: t('reports.geoSeo.report.schema.typesCountLabel', 'Schema Types Found') }
      ]);

      // Schema types table
      if (d.types && d.types.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.geoSeo.report.schema.typesHeading', 'Detected Schema Types')) + '</h3>';
        const typeRows = d.types.map(function (type) {
          return [
            '<strong>' + esc(type) + '</strong>',
            PR.renderStatus('found', t('seo.report.status.found', 'Found'))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.geoSeo.report.schema.table.type', 'Schema Type'), width: '60%' },
            { label: t('seo.report.table.status', 'Status'), width: '40%' }
          ],
          typeRows,
          { striped: true }
        );
      } else {
        html += PR.renderCallout(
          t('reports.geoSeo.report.schema.noneTitle', 'No Schema Markup Found'),
          t('reports.geoSeo.report.schema.noneBody', 'Adding LocalBusiness or Organization schema markup can significantly improve your local search visibility and enable rich results.'),
          'warning'
        );
      }

      // Markup preview
      if (d.markup) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.geoSeo.report.schema.markupHeading', 'Markup Preview')) + '</h3>';
        html += '<pre class="pdf-fix-card__code-pre" style="max-height:180px;overflow:auto;">' + esc(truncate(d.markup, 500)) + '</pre>';
      }

      // Issues
      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Local Keywords
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-keywords .pdf-section__content');
      const d = analysis.keywords || {};
      const score = scores.keywords;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.geoSeo.report.keywords', 'Local Keywords'), score)),
        sec
      );

      let html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('reports.geoSeo.report.sectionIntros.keywords', 'Local keywords signal geographic relevance to search engines. This section analyzes your content for location-specific terms, service area keywords, and local intent signals. Proper use of local keywords helps your pages rank for geographically targeted searches.')) + '</p>';

      // Keyword density metric
      html += PR.renderMetrics([
        { value: (d.local || []).length, label: t('reports.geoSeo.report.keywords.foundLabel', 'Local Keywords Found') },
        { value: d.density !== undefined && d.density !== null ? (d.density * 100).toFixed(1) + '%' : '-', label: t('reports.geoSeo.report.keywords.densityLabel', 'Local Keyword Density') }
      ]);

      // Local keywords found table
      if (d.local && d.local.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.geoSeo.report.keywords.foundHeading', 'Local Keywords Detected')) + '</h3>';
        const kwRows = d.local.slice(0, 20).map(function (kw, idx) {
          return [
            String(idx + 1),
            '<strong>' + esc(typeof kw === 'string' ? kw : (kw.term || kw.keyword || '-')) + '</strong>',
            PR.renderStatus('found', t('seo.report.status.found', 'Found'))
          ];
        });

        html += PR.renderTable(
          [
            { label: '#', width: '10%' },
            { label: t('reports.geoSeo.report.keywords.table.keyword', 'Keyword'), width: '60%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          kwRows,
          { striped: true }
        );

        if (d.local.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: d.local.length - 20 }) + '</p>';
        }
      }

      // Keyword density progress bar
      if (d.density !== undefined && d.density !== null) {
        const densityPct = Math.min(d.density * 100, 100);
        html += PR.renderProgress(
          t('reports.geoSeo.report.keywords.densityLabel', 'Local Keyword Density'),
          Math.round(densityPct), 100
        );
      }

      // Suggestions table
      if (d.suggestions && d.suggestions.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.geoSeo.report.keywords.suggestionsHeading', 'Keyword Suggestions')) + '</h3>';

        html += PR.renderCallout(
          t('reports.geoSeo.report.keywords.suggestionsCalloutTitle', 'Expand Your Local Reach'),
          t('reports.geoSeo.report.keywords.suggestionsCalloutBody', 'Consider incorporating these additional local keywords into your content to broaden your geographic search visibility.'),
          'tip'
        );

        const sugRows = d.suggestions.slice(0, 15).map(function (sug, idx) {
          return [
            String(idx + 1),
            '<strong>' + esc(typeof sug === 'string' ? sug : (sug.term || sug.keyword || '-')) + '</strong>'
          ];
        });

        html += PR.renderTable(
          [
            { label: '#', width: '10%' },
            { label: t('reports.geoSeo.report.keywords.table.suggestion', 'Suggested Keyword'), width: '90%' }
          ],
          sugRows,
          { striped: true }
        );

        if (d.suggestions.length > 15) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: d.suggestions.length - 15 }) + '</p>';
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. Local Presence
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-presence .pdf-section__content');
      const d = analysis.localPresence || {};
      const score = scores.presence;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.geoSeo.report.presence', 'Local Presence'), score)),
        sec
      );

      let html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('reports.geoSeo.report.sectionIntros.presence', 'Local presence factors include Google Business Profile optimization, local directory citations, and review signals. This section evaluates indicators of your local search presence and identifies opportunities to strengthen your visibility in local search results.')) + '</p>';

      // Google Business status
      html += PR.renderMetrics([
        { value: d.googleBusiness ? t('reports.geoSeo.report.presence.claimed', 'Claimed') : t('reports.geoSeo.report.presence.notFound', 'Not Found'), label: t('reports.geoSeo.report.presence.googleBusinessLabel', 'Google Business Profile'), color: d.googleBusiness ? '#10b981' : '#ef4444' },
        { value: d.citations || 0, label: t('reports.geoSeo.report.presence.citationsLabel', 'Citations Found') }
      ]);

      // Google Business callout
      if (!d.googleBusiness) {
        html += PR.renderCallout(
          t('reports.geoSeo.report.presence.gbpCalloutTitle', 'Claim Your Google Business Profile'),
          t('reports.geoSeo.report.presence.gbpCalloutBody', 'A verified Google Business Profile is essential for appearing in Google Maps and the local pack. Claiming and optimizing your profile should be a top priority.'),
          'warning'
        );
      } else {
        html += PR.renderCallout(
          t('reports.geoSeo.report.presence.gbpFoundTitle', 'Google Business Profile Detected'),
          t('reports.geoSeo.report.presence.gbpFoundBody', 'Your Google Business Profile was detected. Ensure it is fully optimized with accurate hours, photos, and regular posts for maximum local visibility.'),
          'tip'
        );
      }

      // Citations progress
      if (d.citations !== undefined && d.citations !== null) {
        const citationTarget = 50;
        html += PR.renderProgress(
          t('reports.geoSeo.report.presence.citationsLabel', 'Citations Found'),
          Math.min(d.citations, citationTarget), citationTarget
        );
      }

      // Directories table
      if (d.directories && d.directories.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.geoSeo.report.presence.directoriesHeading', 'Directory Listings')) + '</h3>';
        const dirRows = d.directories.slice(0, 20).map(function (dir) {
          const dirName = typeof dir === 'string' ? dir : (dir.name || dir.directory || '-');
          const dirListed = typeof dir === 'object' && dir.listed !== undefined ? dir.listed : true;
          return [
            '<strong>' + esc(dirName) + '</strong>',
            dirListed
              ? PR.renderStatus('pass', t('reports.geoSeo.report.status.listed', 'Listed'))
              : PR.renderStatus('fail', t('reports.geoSeo.report.status.notListed', 'Not Listed'))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.geoSeo.report.presence.table.directory', 'Directory'), width: '60%' },
            { label: t('seo.report.table.status', 'Status'), width: '40%' }
          ],
          dirRows,
          { striped: true }
        );

        if (d.directories.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: d.directories.length - 20 }) + '</p>';
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Citations & Directories
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-citations .pdf-section__content');
      const d = analysis.citations || {};
      const score = scores.citations;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.geoSeo.report.citations', 'Citations & Directories'), score)),
        sec
      );

      let html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('reports.geoSeo.report.sectionIntros.citations', 'Directory citations are mentions of your business on third-party websites and directories. Consistent and widespread citations help search engines verify your business legitimacy and improve your geographic search rankings. This section analyzes your citation profile across major directories.')) + '</p>';

      // Metrics
      html += PR.renderMetrics([
        { value: d.directoryCount || 0, label: t('reports.geoSeo.report.citations.directoryCountLabel', 'Directories Found') },
        { value: d.hasCitationSection ? t('seo.report.status.found', 'Found') : t('seo.report.status.notFound', 'Not found'), label: t('reports.geoSeo.report.citations.citationSectionLabel', 'Citation Section'), color: d.hasCitationSection ? '#10b981' : '#ef4444' },
        { value: d.hasDirectoryBadges ? t('seo.report.status.found', 'Found') : t('seo.report.status.notFound', 'Not found'), label: t('reports.geoSeo.report.citations.directoryBadgesLabel', 'Directory Badges'), color: d.hasDirectoryBadges ? '#10b981' : '#ef4444' }
      ]);

      // Directory links table
      if (d.directoryLinks && d.directoryLinks.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.geoSeo.report.citations.linksHeading', 'Directory Links')) + '</h3>';
        const linkRows = d.directoryLinks.slice(0, 20).map(function (link) {
          const domain = typeof link === 'string' ? link : (link.domain || link.url || '-');
          const text = typeof link === 'object' ? (link.text || link.linkText || '-') : '-';
          return [
            '<strong>' + esc(domain) + '</strong>',
            esc(text)
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.geoSeo.report.citations.table.domain', 'Domain'), width: '50%' },
            { label: t('reports.geoSeo.report.citations.table.linkText', 'Link Text'), width: '50%' }
          ],
          linkRows,
          { striped: true }
        );

        if (d.directoryLinks.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: d.directoryLinks.length - 20 }) + '</p>';
        }
      } else {
        html += PR.renderCallout(
          t('reports.geoSeo.report.citations.noneTitle', 'No Directory Citations Found'),
          t('reports.geoSeo.report.citations.noneBody', 'Building citations on major directories like Yelp, Yellow Pages, and industry-specific sites can significantly boost your local search rankings.'),
          'warning'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Multi-Location & Geo Pages
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-multi-location .pdf-section__content');
      const d = analysis.multiLocation || {};
      const score = scores.multiLocation;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.geoSeo.report.multiLocation', 'Multi-Location & Geo Pages'), score)),
        sec
      );

      let html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('reports.geoSeo.report.sectionIntros.multiLocation', 'Multi-location optimization ensures your business is properly represented across all geographic areas you serve. This includes dedicated location pages, hreflang tags for international targeting, service area definitions, store locators, and geo-specific content. Proper multi-location setup helps search engines serve the right page for each geographic query.')) + '</p>';

      // Metrics
      const locationLinkCount = (d.locationLinks || []).length;
      const hreflangCount = d.hreflangCount || 0;

      html += PR.renderMetrics([
        { value: locationLinkCount, label: t('reports.geoSeo.report.multiLocation.locationLinksLabel', 'Location Links') },
        { value: hreflangCount, label: t('reports.geoSeo.report.multiLocation.hreflangCountLabel', 'Hreflang Tags') }
      ]);

      // Status items
      const statusItems = [
        { key: 'hasServiceAreaSchema', label: t('reports.geoSeo.report.multiLocation.serviceAreaSchema', 'ServiceArea Schema'), value: d.hasServiceAreaSchema },
        { key: 'hasStoreLocator', label: t('reports.geoSeo.report.multiLocation.storeLocator', 'Store Locator'), value: d.hasStoreLocator },
        { key: 'hasGeoContent', label: t('reports.geoSeo.report.multiLocation.geoContent', 'Geo-Specific Content'), value: d.hasGeoContent }
      ];

      const statusRows = statusItems.map(function (item) {
        return [
          esc(item.label),
          item.value
            ? PR.renderStatus('pass', t('seo.report.status.found', 'Found'))
            : PR.renderStatus('fail', t('seo.report.status.notFound', 'Not found'))
        ];
      });

      html += PR.renderTable(
        [
          { label: t('seo.report.table.property', 'Property'), width: '60%' },
          { label: t('seo.report.table.status', 'Status'), width: '40%' }
        ],
        statusRows,
        { striped: true }
      );

      // Location links table
      if (d.locationLinks && d.locationLinks.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.geoSeo.report.multiLocation.linksHeading', 'Location Pages')) + '</h3>';
        const locRows = d.locationLinks.slice(0, 20).map(function (link) {
          const url = typeof link === 'string' ? link : (link.url || link.href || '-');
          const label = typeof link === 'object' ? (link.label || link.text || link.title || '-') : '-';
          return [
            '<strong>' + esc(url) + '</strong>',
            esc(label)
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.geoSeo.report.multiLocation.table.url', 'URL'), width: '60%' },
            { label: t('reports.geoSeo.report.multiLocation.table.label', 'Label'), width: '40%' }
          ],
          locRows,
          { striped: true }
        );

        if (d.locationLinks.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: d.locationLinks.length - 20 }) + '</p>';
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       7. Reviews & Reputation
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-reviews .pdf-section__content');
      const d = analysis.reviews || {};
      const score = scores.reviews;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.geoSeo.report.reviews', 'Reviews & Reputation'), score)),
        sec
      );

      let html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('reports.geoSeo.report.sectionIntros.reviews', 'Online reviews and reputation signals are critical local ranking factors. Search engines use review quantity, quality, and recency to determine local search rankings. This section analyzes your review presence, aggregate ratings, and reputation indicators across platforms.')) + '</p>';

      // Metrics — AggregateRating data and review platform count
      const aggregateRating = d.aggregateRating || {};
      const platformCount = d.platformCount || (d.platforms || []).length || 0;

      html += PR.renderMetrics([
        { value: aggregateRating.ratingValue || '-', label: t('reports.geoSeo.report.reviews.ratingValueLabel', 'Aggregate Rating') },
        { value: aggregateRating.reviewCount || '-', label: t('reports.geoSeo.report.reviews.reviewCountLabel', 'Review Count') },
        { value: platformCount, label: t('reports.geoSeo.report.reviews.platformCountLabel', 'Review Platforms') }
      ]);

      // Status items
      const reviewStatusItems = [
        { key: 'hasTestimonialsSection', label: t('reports.geoSeo.report.reviews.testimonialsSection', 'Testimonials Section'), value: d.hasTestimonialsSection },
        { key: 'hasStarWidgets', label: t('reports.geoSeo.report.reviews.starWidgets', 'Star Rating Widgets'), value: d.hasStarWidgets },
        { key: 'hasReviewCount', label: t('reports.geoSeo.report.reviews.reviewCountPresent', 'Review Count Displayed'), value: d.hasReviewCount }
      ];

      const reviewStatusRows = reviewStatusItems.map(function (item) {
        return [
          esc(item.label),
          item.value
            ? PR.renderStatus('pass', t('seo.report.status.found', 'Found'))
            : PR.renderStatus('fail', t('seo.report.status.notFound', 'Not found'))
        ];
      });

      html += PR.renderTable(
        [
          { label: t('seo.report.table.property', 'Property'), width: '60%' },
          { label: t('seo.report.table.status', 'Status'), width: '40%' }
        ],
        reviewStatusRows,
        { striped: true }
      );

      // Review platform links table
      if (d.platformLinks && d.platformLinks.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.geoSeo.report.reviews.platformsHeading', 'Review Platforms')) + '</h3>';
        const platRows = d.platformLinks.slice(0, 20).map(function (link) {
          const platform = typeof link === 'string' ? link : (link.platform || link.name || '-');
          const url = typeof link === 'object' ? (link.url || link.href || '-') : '-';
          return [
            '<strong>' + esc(platform) + '</strong>',
            esc(url)
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.geoSeo.report.reviews.table.platform', 'Platform'), width: '40%' },
            { label: t('reports.geoSeo.report.reviews.table.url', 'URL'), width: '60%' }
          ],
          platRows,
          { striped: true }
        );

        if (d.platformLinks.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: d.platformLinks.length - 20 }) + '</p>';
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       8. Recommendations
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.geoSeo.report.recommendations', 'Recommendations'))),
        sec
      );

      let html = '';

      // Section intro
      html += '<p class="pdf-section__intro">' + esc(t('reports.geoSeo.report.sectionIntros.recommendations', 'Based on the GEO SEO analysis, these recommendations target the most impactful improvements for your local search visibility and geographic relevance.')) + '</p>';

      if (recommendations.length > 0) {
        // Group by priority/severity
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
          t('reports.geoSeo.report.recommendations.noneTitle', 'Strong GEO SEO'),
          t('reports.geoSeo.report.recommendations.noneBody', 'Your site follows GEO SEO best practices. Continue monitoring your local presence, citations, and reviews for sustained rankings.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       Hide empty sections
       ----------------------------------------------------------------------- */
    document.querySelectorAll('.pdf-section').forEach(function (sec) {
      const content = sec.querySelector('.pdf-section__content');
      if (content && !content.innerHTML.trim()) {
        sec.style.display = 'none';
      }
    });
  });

  /* =========================================================================
     Shared Utilities
     ========================================================================= */

  /** Render issues list for a section */
  function _renderIssuesList(issues, t) {
    if (!issues || issues.length === 0) return '';
    let html = '<div class="pdf-issues" style="margin-top:12px;">';
    html += '<h4 class="pdf-subsection__title">' + (t('common.pdf.execSummary.issuesFound', 'Issues Found') || 'Issues') + '</h4>';
    issues.forEach(function (issue) {
      const text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
      html += '<div class="pdf-issue pdf-issue--warning">' +
        '<span class="pdf-issue__text">' + PdfReport.helpers.esc(text) + '</span>' +
      '</div>';
    });
    html += '</div>';
    return html;
  }

})(window);
