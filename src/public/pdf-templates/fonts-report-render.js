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
    var duplicates = data.duplicates || (data.issues && data.issues.duplicates) || [];
    var recommendations = data.recommendations || [];

    // Full scan deep data
    var fullScan = data.fullScan || {};
    var fonts = fullScan.fonts || {};
    var fullPerformance = fullScan.performance || {};
    var bestPractices = fullScan.bestPractices || {};
    var advancedAnalysis = fonts.advancedAnalysis || {};
    var fontMetrics = fonts.fontMetrics || [];
    var categorizedFonts = fonts.categorizedFonts || {};

    // Resolve fontDelivery from fullScan if top-level is empty
    if (!fontDelivery.totalRequests && !fontDelivery.requests) {
      fontDelivery = fonts.fontDelivery || fontDelivery;
    }
    if (!fallbackStability.score && !fallbackStability.fallbackStacks) {
      fallbackStability = fonts.fallbackStability || fallbackStability;
    }

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

      // Overview metrics — add display issue count
      var displayIssueCount = summary.displayIssueCount || 0;
      var preloadIssueCount = summary.preloadIssueCount || 0;
      var metricsArr = [
        { value: summary.totalFamilies || families.length || 0, label: t('fonts.report.families.totalLabel', 'Total Families'), color: (summary.totalFamilies || families.length || 0) > 3 ? '#f59e0b' : '#10b981' },
        { value: summary.totalVariants || families.reduce(function (sum, f) { return sum + (f.variants ? f.variants.length : 0); }, 0) || 0, label: t('fonts.report.families.variantsLabel', 'Total Variants') },
        { value: summary.duplicateCount || duplicates.length || 0, label: t('fonts.report.families.duplicatesLabel', 'Duplicates'), color: (summary.duplicateCount || duplicates.length || 0) > 0 ? '#f59e0b' : '#10b981' },
        { value: displayIssueCount, label: t('fonts.report.families.displayIssuesLabel', 'Display Issues'), color: displayIssueCount > 0 ? '#ef4444' : '#10b981' }
      ];
      html += PR.renderMetrics(metricsArr);

      // Families table with richer columns (weight, style, variant count, issue badges)
      if (families.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.families.detailsHeading', 'Detected Families')) + '</h3>';

        var dupMap = {};
        if (data.issues && data.issues.duplicates) {
          data.issues.duplicates.forEach(function (d) { dupMap[(d.family || d.name || '').toLowerCase()] = true; });
        }
        var dispMap = {};
        if (data.issues && data.issues.displayIssues) {
          data.issues.displayIssues.forEach(function (d) { dispMap[(d.family || d.name || '').toLowerCase()] = true; });
        }

        var famRows = families.slice(0, 20).map(function (f) {
          var variants = f.variants || [];
          var weights = variants.map(function (v) { return v.weight || v || '400'; });
          var uniqueWeights = [];
          weights.forEach(function (w) { if (uniqueWeights.indexOf(String(w)) === -1) uniqueWeights.push(String(w)); });
          var styles = [];
          variants.forEach(function (v) {
            var s = v.style || 'normal';
            if (styles.indexOf(s) === -1) styles.push(s);
          });
          var source = (f.sources && f.sources.length > 0) ? f.sources[0] : (f.detectedFrom || (f.pagesFound && f.pagesFound.length > 0 ? f.pagesFound[0] : '-'));

          // Issue badges
          var nameStr = '<strong>' + esc(f.name || '-') + '</strong>';
          var fName = (f.name || '').toLowerCase();
          if (dupMap[fName]) {
            nameStr += ' ' + PR.renderStatus('fail', t('fonts.report.families.duplicateLabel', 'DUPLICATE'));
          }
          if (dispMap[fName]) {
            nameStr += ' ' + PR.renderStatus('warning', t('fonts.report.families.noDisplayLabel', 'NO DISPLAY'));
          }

          return [
            nameStr,
            esc(uniqueWeights.join(', ') || '-'),
            esc(styles.join(', ') || 'normal'),
            String(variants.length),
            '<span class="pdf-table__truncate">' + esc(truncate(source, 35)) + '</span>'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('fonts.report.families.table.name', 'Family'), width: '22%' },
            { label: t('fonts.report.families.table.weights', 'Weights'), width: '20%' },
            { label: t('fonts.report.families.table.style', 'Style'), width: '12%' },
            { label: t('fonts.report.families.table.variants', 'Variants'), width: '10%' },
            { label: t('fonts.report.families.table.source', 'Source'), width: '28%' }
          ],
          famRows,
          { striped: true }
        );
      }

      // Categorized fonts (from full scan) — Google, System, Icons
      var hasCats = categorizedFonts.googleFonts || categorizedFonts.system || categorizedFonts.iconFonts;
      if (hasCats) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.families.categoriesHeading', 'Font Categories')) + '</h3>';
        var catRows = [];
        if (categorizedFonts.googleFonts && categorizedFonts.googleFonts.length > 0) {
          catRows.push([
            '<strong style="color:#4285f4;">' + esc(t('fonts.report.families.category.google', 'Google Fonts')) + '</strong>',
            String(categorizedFonts.googleFonts.length),
            esc(categorizedFonts.googleFonts.slice(0, 4).map(function (f) { return f.fontFamily || f.name || f; }).join(', '))
          ]);
        }
        if (categorizedFonts.system && categorizedFonts.system.length > 0) {
          catRows.push([
            '<strong style="color:#10b981;">' + esc(t('fonts.report.families.category.system', 'System Fonts')) + '</strong>',
            String(categorizedFonts.system.length),
            esc(categorizedFonts.system.slice(0, 4).map(function (f) { return f.fontFamily || f.name || f; }).join(', '))
          ]);
        }
        if (categorizedFonts.iconFonts && categorizedFonts.iconFonts.length > 0) {
          catRows.push([
            '<strong style="color:#f59e0b;">' + esc(t('fonts.report.families.category.icons', 'Icon Fonts')) + '</strong>',
            String(categorizedFonts.iconFonts.length),
            esc(categorizedFonts.iconFonts.slice(0, 4).map(function (f) { return f.fontFamily || f.name || f; }).join(', '))
          ]);
        }
        if (catRows.length > 0) {
          html += PR.renderTable(
            [
              { label: t('fonts.report.families.table.category', 'Category'), width: '25%' },
              { label: t('fonts.report.families.table.count', 'Count'), width: '10%' },
              { label: t('fonts.report.families.table.families', 'Families'), width: '55%' }
            ],
            catRows,
            { striped: true }
          );
        }
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

      // Rich provider table with families, type badge, and font count
      var provRows = providers.map(function (p) {
        var provFamilies = (p.families || []).map(function (f) {
          return typeof f === 'string' ? f : (f && f.name ? f.name : String(f));
        });
        var familyText = provFamilies.length > 0
          ? esc(provFamilies.slice(0, 5).join(', ')) + (provFamilies.length > 5 ? ' +' + (provFamilies.length - 5) : '')
          : '<em style="color:#888;">' + esc(t('fonts.report.providers.noFamilies', 'N/A')) + '</em>';

        // Self-hosted vs external status
        var isSelfHosted = /self/i.test(p.name || '');
        var statusHtml = isSelfHosted
          ? PR.renderStatus('pass', t('fonts.report.privacy.selfHosted', 'Self-Hosted'))
          : PR.renderStatus('warning', t('fonts.report.providers.external', 'External'));

        return [
          '<strong>' + esc(p.name || '-') + '</strong>',
          statusHtml,
          esc(p.type || '-'),
          String(p.count || provFamilies.length || 0),
          familyText
        ];
      });

      html += PR.renderTable(
        [
          { label: t('fonts.report.providers.table.provider', 'Provider'), width: '18%' },
          { label: t('seo.report.table.status', 'Status'), width: '14%' },
          { label: t('fonts.report.providers.table.type', 'Type'), width: '12%' },
          { label: t('fonts.report.providers.table.fontsServed', 'Count'), width: '8%' },
          { label: t('fonts.report.providers.table.families', 'Families Served'), width: '40%' }
        ],
        provRows,
        { striped: true }
      );

      // Evidence code snippets for each provider
      var hasEvidence = providers.some(function (p) { return p.url || p.type === '@font-face'; });
      if (hasEvidence) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.providers.evidenceHeading', 'Detection Evidence')) + '</h3>';
        providers.forEach(function (p) {
          var snippet = '';
          if (p.url) {
            if (p.type === 'link') {
              snippet = '<link href="' + esc(truncate(p.url, 70)) + '" rel="stylesheet">';
            } else if (p.type === '@import') {
              snippet = '@import url(\'' + esc(truncate(p.url, 60)) + '\');';
            } else if (p.type === 'script') {
              snippet = '<script src="' + esc(truncate(p.url, 65)) + '"><\/script>';
            }
          } else if (p.type === '@font-face') {
            var fam = (p.families && p.families[0]) || 'CustomFont';
            if (typeof fam === 'object') fam = fam.name || 'CustomFont';
            snippet = '@font-face { font-family: \'' + esc(fam) + '\'; src: url(\'/fonts/...\'); }';
          }
          if (snippet) {
            html += '<div class="pdf-fix-card__code-block" style="margin-bottom:8px;">' +
              '<div class="pdf-fix-card__code-label" style="padding:4px 8px;font-size:0.7rem;color:#666;">' + esc(p.name || '') + '</div>' +
              '<pre class="pdf-fix-card__code-pre" style="padding:8px 10px;font-size:0.75rem;margin:0;white-space:pre-wrap;word-break:break-all;">' + esc(snippet) + '</pre>' +
            '</div>';
          }
        });
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Font Loading Performance
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-loading .pdf-section__content');

      // Compute a loading performance score like the web UI
      var preloads = fontDelivery.preloads || data.preloads || [];
      var preconnectStatus = fontDelivery.preconnectStatus || fontDelivery.preconnects || [];
      var fontDisplayIssues = data.displayIssues || (data.issues && data.issues.displayIssues) || [];
      if (fontDisplayIssues.length === 0 && advancedAnalysis.fontDisplay && advancedAnalysis.fontDisplay.issues) {
        fontDisplayIssues = advancedAnalysis.fontDisplay.issues;
      }
      var preloadIssues = data.preloadIssues || (data.issues && data.issues.preloadIssues) || [];
      var requests = fontDelivery.requests || [];

      var loadScore = 100;
      if (preloadIssues.length > 0) loadScore -= 20;
      if (fontDisplayIssues.length > 0) loadScore -= fontDisplayIssues.length * 10;
      if (preconnectStatus.filter(function (p) { return !p.found && p.recommended; }).length > 0) loadScore -= 15;
      loadScore = Math.max(0, Math.min(100, loadScore));

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('fonts.fontLoadingPerformance', 'Font Loading Performance'), loadScore)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('fonts.report.sectionIntros.loading', 'Font loading speed directly impacts First Contentful Paint (FCP) and overall perceived performance. Slow-loading fonts cause invisible text (FOIT) or flash of unstyled text (FOUT), degrading user experience. This section evaluates loading time, estimated bandwidth cost, and the impact on rendering performance. Using font-display: swap and preloading critical fonts are key optimization strategies.')) + '</p>';

      // Render-blocking summary metrics (matching web UI)
      var renderBlockingCount = requests.filter(function (r) {
        return !preloads.some(function (p) { return p.href && r.url && p.href.indexOf(r.url.split('/').pop()) !== -1; });
      }).length;

      html += PR.renderMetrics([
        { value: requests.length || (summary.totalFamilies || 0), label: t('fonts.report.loading.totalFontsLabel', 'Total Fonts') },
        { value: preloads.length, label: t('fonts.report.loading.preloadedLabel', 'Preloaded'), color: preloads.length > 0 ? '#10b981' : '#f59e0b' },
        { value: renderBlockingCount, label: t('fonts.report.loading.renderBlockingLabel', 'Render-Blocking'), color: renderBlockingCount > 0 ? '#f59e0b' : '#10b981' }
      ]);

      // FOIT/FOUT analysis
      var hasFontDisplaySwap = fontDisplayIssues.filter(function (i) { return i.message && i.message.indexOf('block') !== -1; }).length === 0;
      if (hasFontDisplaySwap) {
        html += PR.renderCallout(
          t('fonts.report.loading.foitGoodTitle', 'FOIT/FOUT Prevention'),
          t('fonts.report.loading.foitGoodBody', 'Fonts use font-display: swap or optional, preventing Flash of Invisible Text (FOIT).'),
          'tip'
        );
      } else {
        html += PR.renderCallout(
          t('fonts.report.loading.foitIssueTitle', 'FOIT/FOUT Risk Detected'),
          fontDisplayIssues.length + ' ' + t('fonts.report.loading.foitIssueBody', 'font(s) may cause invisible text during load. Add font-display: swap to prevent FOIT.'),
          'warning'
        );
        // List individual display issues
        fontDisplayIssues.slice(0, 5).forEach(function (issue) {
          html += PR.renderIssue(issue.message || t('fonts.report.loading.fontDisplayIssue', 'Font display issue detected'), 'warning');
        });
      }

      // Preload status
      html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.loading.preloadHeading', 'Font Preloading')) + '</h3>';
      if (preloads.length > 0) {
        html += PR.renderCallout(
          preloads.length + ' ' + t('fonts.report.loading.preloadFoundTitle', 'font(s) preloaded'),
          t('fonts.report.loading.preloadFoundBody', 'Critical fonts load early for faster rendering.'),
          'tip'
        );
        var preloadRows = preloads.slice(0, 6).map(function (p) {
          var fileName = (p.href || '').split('/').pop() || t('fonts.report.loading.fontLabel', 'font');
          return [esc(fileName), '<span class="pdf-table__truncate">' + esc(truncate(p.href || '-', 60)) + '</span>'];
        });
        html += PR.renderTable(
          [
            { label: t('fonts.report.loading.table.file', 'File'), width: '25%' },
            { label: t('fonts.report.loading.table.href', 'URL'), width: '65%' }
          ],
          preloadRows,
          { striped: true }
        );
      } else {
        html += PR.renderCallout(
          t('fonts.report.loading.noPreloadsTitle', 'No Font Preloads Detected'),
          t('fonts.report.loading.noPreloadsBody', 'Add preload hints for critical fonts: <link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>'),
          'warning'
        );
      }

      // Preconnect hints
      if (preconnectStatus.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.loading.preconnectHeading', 'Preconnect Hints')) + '</h3>';
        var pcRows = preconnectStatus.map(function (p) {
          return [
            esc(p.domain || '-'),
            p.found
              ? PR.renderStatus('pass', t('fonts.report.loading.connected', 'Connected'))
              : PR.renderStatus('fail', t('fonts.report.loading.missing', 'Missing'))
          ];
        });
        html += PR.renderTable(
          [
            { label: t('fonts.report.loading.table.domain', 'Domain'), width: '55%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          pcRows,
          { striped: true }
        );
        var missingPc = preconnectStatus.filter(function (p) { return !p.found && p.recommended; });
        if (missingPc.length > 0) {
          var pcCode = missingPc.map(function (p) { return '<link rel="preconnect" href="https://' + (p.domain || '') + '">'; }).join('\n');
          html += '<div class="pdf-fix-card__code-block" style="margin-top:8px;">' +
            '<div class="pdf-fix-card__code-label pdf-fix-card__code-label--good">' + esc(t('fonts.report.loading.addToHead', 'Add to HTML <head>')) + '</div>' +
            '<pre class="pdf-fix-card__code-pre" style="padding:8px 10px;font-size:0.75rem;margin:0;">' + esc(pcCode) + '</pre>' +
          '</div>';
        }
      }

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

      // Classify providers
      var thirdParty = providers.filter(function (p) { return !/self/i.test(p.name || ''); });
      var selfHosted = providers.filter(function (p) { return /self/i.test(p.name || ''); });
      var hasGoogleFonts = providers.some(function (p) { return /google/i.test(p.name || ''); });
      var hasAdobeFonts = providers.some(function (p) { return /adobe|typekit/i.test(p.name || ''); });

      // Extract third-party domains
      var thirdPartyDomains = [];
      providers.forEach(function (p) {
        if (p.url) {
          try {
            var urlObj = new URL(p.url);
            if (thirdPartyDomains.indexOf(urlObj.hostname) === -1) {
              thirdPartyDomains.push(urlObj.hostname);
            }
          } catch (e) { /* ignore */ }
        }
      });

      // Risk level assessment
      var riskLevel = thirdParty.length === 0 ? 'low' : (hasGoogleFonts ? 'medium' : 'low');
      html += PR.renderMetrics([
        { value: riskLevel.toUpperCase(), label: t('fonts.report.privacy.riskLevelLabel', 'Privacy Risk'), color: riskLevel === 'low' ? '#10b981' : '#f59e0b' },
        { value: thirdParty.length, label: t('fonts.report.privacy.thirdPartyLabel', 'Third-Party Providers'), color: thirdParty.length > 0 ? '#f59e0b' : '#10b981' },
        { value: thirdPartyDomains.length, label: t('fonts.report.privacy.domainsLabel', 'External Domains'), color: thirdPartyDomains.length > 0 ? '#f59e0b' : '#10b981' }
      ]);

      // External domains table
      if (thirdPartyDomains.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.privacy.domainsHeading', 'External Domains Contacted')) + '</h3>';
        var domainRows = thirdPartyDomains.map(function (d) {
          return [
            esc(d),
            PR.renderStatus('warning', t('fonts.report.privacy.sendsData', 'Sends Visitor Data'))
          ];
        });
        html += PR.renderTable(
          [
            { label: t('fonts.report.privacy.domainCol', 'Domain'), width: '50%' },
            { label: t('fonts.report.privacy.impactCol', 'Privacy Impact'), width: '40%' }
          ],
          domainRows,
          { striped: true }
        );
        html += '<p style="font-size:0.8rem;color:#666;margin-top:4px;">' + esc(t('fonts.report.privacy.domainNote', 'Each external domain receives visitor IP addresses and may set cookies.')) + '</p>';
      }

      // Google Fonts GDPR callout
      if (hasGoogleFonts) {
        html += PR.renderCallout(
          t('fonts.report.privacy.gdprWarningTitle', 'Google Fonts Privacy Consideration'),
          t('fonts.report.privacy.gdprWarningBody', 'Google Fonts sends visitor data (IP address, user agent) to Google servers. Under GDPR, this may require explicit consent. Consider self-hosting fonts using tools like google-webfonts-helper.'),
          'warning'
        );
      }

      // Adobe Fonts callout
      if (hasAdobeFonts) {
        html += PR.renderCallout(
          t('fonts.report.privacy.adobeWarningTitle', 'Adobe Fonts Privacy Notice'),
          t('fonts.report.privacy.adobeWarningBody', 'Adobe Fonts (Typekit) sends visitor data to Adobe servers and requires an active subscription.'),
          'warning'
        );
      }

      // Provider classification table
      html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.privacy.classificationHeading', 'Font Provider Classification')) + '</h3>';
      var classRows = [];
      if (selfHosted.length > 0) {
        classRows.push([
          '<strong style="color:#10b981;">' + esc(t('fonts.report.privacy.selfHosted', 'Self-Hosted')) + '</strong>',
          String(selfHosted.length),
          PR.renderStatus('pass', t('fonts.report.privacy.noIssue', 'No Privacy Concern')),
          esc(t('fonts.report.privacy.selfHostedDesc', 'Maximum privacy, you control the fonts'))
        ]);
      }
      if (hasGoogleFonts) {
        var googleCount = providers.filter(function (p) { return /google/i.test(p.name || ''); }).length;
        classRows.push([
          '<strong style="color:#4285f4;">' + esc(t('fonts.report.privacy.googleLabel', 'Google Fonts')) + '</strong>',
          String(googleCount),
          PR.renderStatus('warning', t('fonts.report.privacy.consentRequired', 'May Require Consent')),
          esc(t('fonts.report.privacy.googleDesc', 'Free CDN, sends visitor data to Google'))
        ]);
      }
      if (hasAdobeFonts) {
        var adobeCount = providers.filter(function (p) { return /adobe|typekit/i.test(p.name || ''); }).length;
        classRows.push([
          '<strong style="color:#ef4444;">' + esc(t('fonts.report.privacy.adobeLabel', 'Adobe Fonts')) + '</strong>',
          String(adobeCount),
          PR.renderStatus('warning', t('fonts.report.privacy.consentRequired', 'May Require Consent')),
          esc(t('fonts.report.privacy.adobeDesc', 'Requires subscription, sends data to Adobe'))
        ]);
      }
      if (classRows.length > 0) {
        html += PR.renderTable(
          [
            { label: t('fonts.report.providers.table.provider', 'Provider'), width: '22%' },
            { label: t('fonts.report.providers.table.fontsServed', 'Count'), width: '10%' },
            { label: t('seo.report.table.status', 'Status'), width: '22%' },
            { label: t('fonts.report.privacy.descCol', 'Description'), width: '38%' }
          ],
          classRows,
          { striped: true }
        );
      }

      // Self-hosting recommendation
      if (thirdParty.length > 0) {
        html += PR.renderCallout(
          t('fonts.report.privacy.selfHostTitle', 'Consider Self-Hosting'),
          t('fonts.report.privacy.selfHostBody', 'Self-hosting fonts eliminates third-party requests, improving privacy compliance and potentially reducing load times. Most web fonts can be legally self-hosted with proper licensing.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Font Delivery
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-delivery .pdf-section__content');

      // Use advancedAnalysis formats as fallback
      var fallbackFormats = (advancedAnalysis.formats && advancedAnalysis.formats.summary) ? advancedAnalysis.formats.summary : {};
      var hasNetworkData = fontDelivery && fontDelivery.totalRequests > 0;

      if (!hasNetworkData && !fallbackFormats.total && !(fontDelivery.formats)) {
        sec.parentElement.style.display = 'none';
        return;
      }

      var deliveryScore = hasNetworkData
        ? fontDelivery.score
        : (fallbackFormats.woff2Percentage >= 80 ? 90 : fallbackFormats.woff2Percentage >= 50 ? 70 : 50);

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('fonts.fontDelivery', 'Font Delivery'), deliveryScore)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('fonts.report.sectionIntros.delivery', 'Font delivery optimization ensures fonts are downloaded efficiently. Using modern formats like WOFF2 reduces file sizes by 30-50% compared to older formats. This section analyzes font file requests, formats, sizes, and loading times. Implementing preconnect hints for external font servers and preloading critical font files accelerates delivery.')) + '</p>';

      // Top-level metrics
      var modernPct = hasNetworkData ? (fontDelivery.modernFormatPercentage || 0) : (fallbackFormats.woff2Percentage || 0);
      html += PR.renderMetrics([
        { value: fontDelivery.totalRequests || fallbackFormats.total || 0, label: hasNetworkData ? t('fonts.report.delivery.requestsLabel', 'Font Requests') : t('fonts.report.delivery.fontFacesLabel', 'Font Faces') },
        { value: fontDelivery.totalBytesKB ? fontDelivery.totalBytesKB + 'KB' : '-', label: t('fonts.report.delivery.totalSizeLabel', 'Total Size') },
        { value: fontDelivery.averageLoadTime ? fontDelivery.averageLoadTime + 'ms' : '-', label: t('fonts.report.delivery.avgLoadLabel', 'Avg Load Time') },
        { value: modernPct + '%', label: t('fonts.report.delivery.woff2Label', 'Modern Format'), color: modernPct >= 80 ? '#10b981' : '#f59e0b' }
      ]);

      // WOFF2 coverage progress
      var formats = fontDelivery.formats || {};
      var totalFormats = (formats.woff2 || 0) + (formats.woff || 0) + (formats.ttf || 0) + (formats.otf || 0) + (formats.legacy || 0);
      if (totalFormats > 0) {
        html += PR.renderProgress(
          t('fonts.report.delivery.woff2Label', 'Modern Format'),
          formats.woff2 || 0, totalFormats
        );
      }

      // Format distribution table
      if (totalFormats > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.delivery.formatHeading', 'Font Format Distribution')) + '</h3>';
        var formatRows = [];
        if (formats.woff2) formatRows.push([esc('WOFF2'), String(formats.woff2), PR.renderStatus('pass', t('fonts.report.delivery.modern', 'Modern'))]);
        if (formats.woff) formatRows.push([esc('WOFF'), String(formats.woff), PR.renderStatus('pass', t('fonts.report.delivery.acceptable', 'Acceptable'))]);
        if (formats.ttf) formatRows.push([esc('TTF'), String(formats.ttf), PR.renderStatus('warning', t('fonts.report.delivery.legacy', 'Legacy'))]);
        if (formats.otf) formatRows.push([esc('OTF'), String(formats.otf), PR.renderStatus('warning', t('fonts.report.delivery.legacy', 'Legacy'))]);
        if (formats.legacy) formatRows.push([esc('EOT/SVG'), String(formats.legacy), PR.renderStatus('fail', t('fonts.report.delivery.obsolete', 'Obsolete'))]);
        html += PR.renderTable(
          [
            { label: t('fonts.report.delivery.table.format', 'Format'), width: '25%' },
            { label: t('fonts.report.delivery.table.count', 'Count'), width: '15%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          formatRows,
          { striped: true }
        );
      }

      // Legacy formats warning
      if (fontDelivery.hasLegacyFormats || (formats.legacy && formats.legacy > 0)) {
        html += PR.renderCallout(
          t('fonts.report.delivery.legacyTitle', 'Legacy Formats Detected'),
          t('fonts.report.delivery.legacyBody', 'Consider removing EOT/SVG formats for smaller bundles. Modern browsers all support WOFF2.'),
          'warning'
        );
      }

      // Preconnect hints
      var preconnects = fontDelivery.preconnects || [];
      if (preconnects.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.delivery.preconnectHeading', 'Preconnect Hints')) + '</h3>';
        var pcRows = preconnects.map(function (p) {
          return [
            esc(p.domain || '-'),
            p.found
              ? PR.renderStatus('pass', t('fonts.report.delivery.connected', 'Connected'))
              : PR.renderStatus('fail', t('fonts.report.delivery.missing', 'Missing'))
          ];
        });
        html += PR.renderTable(
          [
            { label: t('fonts.report.loading.table.domain', 'Domain'), width: '50%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          pcRows,
          { striped: true }
        );
        var missingPreconnects = fontDelivery.preconnectsMissing || 0;
        if (missingPreconnects > 0) {
          var pcFixCode = preconnects.filter(function (p) { return !p.found && p.recommended; }).map(function (p) {
            return '<link rel="preconnect" href="https://' + (p.domain || '') + '">';
          }).join('\n');
          if (pcFixCode) {
            html += '<div class="pdf-fix-card__code-block" style="margin-top:8px;">' +
              '<div class="pdf-fix-card__code-label pdf-fix-card__code-label--good">' + esc(t('fonts.report.loading.addToHead', 'Add to HTML <head>')) + '</div>' +
              '<pre class="pdf-fix-card__code-pre" style="padding:8px 10px;font-size:0.75rem;margin:0;">' + esc(pcFixCode) + '</pre>' +
            '</div>';
          }
        }
      }

      // Preload status
      var preloads = fontDelivery.preloads || [];
      if (preloads.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.delivery.preloadHeading', 'Font Preloads')) + ' (' + preloads.length + ')</h3>';
        var plRows = preloads.slice(0, 6).map(function (p) {
          return [esc((p.href || '').split('/').pop() || 'font'), '<span class="pdf-table__truncate">' + esc(truncate(p.href || '-', 60)) + '</span>'];
        });
        html += PR.renderTable(
          [
            { label: t('fonts.report.loading.table.file', 'File'), width: '25%' },
            { label: 'URL', width: '65%' }
          ],
          plRows,
          { striped: true }
        );
      } else {
        html += PR.renderCallout(
          t('fonts.report.delivery.noPreloadsTitle', 'No Font Preloads Detected'),
          t('fonts.report.delivery.noPreloadsBody', 'Add preload hints for critical fonts to accelerate rendering.'),
          'warning'
        );
      }

      // Font requests table with cache status column
      if (fontDelivery.requests && fontDelivery.requests.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.delivery.requestsHeading', 'Network Requests')) + '</h3>';
        var reqRows = fontDelivery.requests.slice(0, 15).map(function (r) {
          var fileName = (r.url || '').split('/').pop().split('?')[0] || 'font';
          var formatStatus = (r.format === 'woff2')
            ? PR.renderStatus('pass', 'WOFF2')
            : PR.renderStatus('warning', (r.format || '-').toUpperCase());
          return [
            '<span class="pdf-table__truncate">' + esc(truncate(fileName, 30)) + '</span>',
            formatStatus,
            esc(r.sizeKB ? r.sizeKB + 'KB' : '-'),
            r.loadTime ? r.loadTime + 'ms' : '-',
            r.cacheStatus
              ? (r.cacheStatus === 'HIT' ? PR.renderStatus('pass', 'HIT') : PR.renderStatus('warning', r.cacheStatus))
              : '-'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('fonts.report.delivery.table.file', 'File'), width: '25%' },
            { label: t('fonts.report.delivery.table.format', 'Format'), width: '14%' },
            { label: t('fonts.report.delivery.table.size', 'Size'), width: '12%' },
            { label: t('fonts.report.delivery.table.loadTime', 'Load Time'), width: '14%' },
            { label: t('fonts.report.delivery.table.cache', 'Cache'), width: '12%' }
          ],
          reqRows,
          { striped: true }
        );
        if (fontDelivery.requests.length > 15) {
          html += '<p style="font-size:0.75rem;color:#888;">+ ' + (fontDelivery.requests.length - 15) + ' ' + esc(t('fonts.report.delivery.moreRequests', 'more requests')) + '</p>';
        }
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Fallback & Layout Stability
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-stability .pdf-section__content');

      // Use advancedAnalysis as fallback source (matches web UI logic)
      var aaFallbackStacks = advancedAnalysis.fallbackStacks || {};
      var aaClsRisk = advancedAnalysis.clsRisk || {};
      var aaFontDisplay = advancedAnalysis.fontDisplay || {};

      var hasStabilityData = fallbackStability && (fallbackStability.score !== undefined || (fallbackStability.fallbackStacks && fallbackStability.fallbackStacks.length > 0));

      var fsStacks = hasStabilityData ? (fallbackStability.fallbackStacks || []) : (aaFallbackStacks.stacks || []);
      var fsSummary = hasStabilityData ? fallbackStability.fallbackStacksSummary : (aaFallbackStacks.summary || {});
      var metricOverrides = hasStabilityData ? (fallbackStability.metricOverrides || []) : [];
      var fontDisplayBreakdown = hasStabilityData ? fallbackStability.fontDisplayBreakdown : null;
      var displaySummary = hasStabilityData ? (fallbackStability.fontDisplaySummary || {}) : (aaFontDisplay.summary || {});
      var clsRisk = hasStabilityData ? (fallbackStability.clsRisk || {}) : aaClsRisk;
      var stabilityScore = hasStabilityData ? fallbackStability.score : (aaFallbackStacks.summary ? aaFallbackStacks.summary.score : (aaClsRisk.score || 70));

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('fonts.fallbackLayoutStability', 'Fallback & Layout Stability'), stabilityScore)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('fonts.report.sectionIntros.stability', 'Layout stability during font loading prevents jarring visual shifts that frustrate users and hurt Core Web Vitals scores. Proper fallback font stacks and font-display settings minimize Cumulative Layout Shift (CLS). This section analyzes your fallback stacks, font-display usage, and CLS risk factors. Using size-adjusted fallback fonts with metric overrides can virtually eliminate font-related layout shift.')) + '</p>';

      // CLS Risk + Score metrics
      var clsLevel = clsRisk.level || 'N/A';
      html += PR.renderMetrics([
        { value: stabilityScore || 0, label: t('fonts.report.stability.scoreLabel', 'Stability Score'), color: (stabilityScore || 0) >= 80 ? '#10b981' : (stabilityScore || 0) >= 60 ? '#f59e0b' : '#ef4444' },
        { value: clsLevel.toUpperCase(), label: t('fonts.report.stability.clsRiskLabel', 'CLS Risk'), color: clsLevel === 'low' ? '#10b981' : clsLevel === 'medium' ? '#f59e0b' : '#ef4444' }
      ]);

      // CLS Risk details (individual risks)
      var risks = clsRisk.risks || [];
      if (risks.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.stability.risksHeading', 'Layout Shift Risks')) + '</h3>';
        risks.forEach(function (risk) {
          var sev = (risk.type === 'warning' || risk.type === 'medium') ? 'warning' : 'critical';
          html += PR.renderIssue(esc(risk.title) + (risk.detail ? ' — ' + esc(risk.detail) : ''), sev);
        });
      } else if (clsLevel === 'low') {
        html += PR.renderCallout(
          t('fonts.report.stability.lowRiskTitle', 'Low CLS Risk'),
          t('fonts.report.stability.lowRiskBody', 'Low risk of font-related layout shifts. Good configuration!'),
          'tip'
        );
      }

      // font-display Breakdown
      html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.stability.fontDisplayHeading', 'font-display Values')) + '</h3>';

      if (displaySummary.optimal !== undefined) {
        html += PR.renderMetrics([
          { value: displaySummary.optimal || 0, label: t('fonts.report.stability.optimalLabel', 'Optimal (swap/optional)'), color: '#10b981' },
          { value: displaySummary.acceptable || 0, label: t('fonts.report.stability.acceptableLabel', 'Acceptable (fallback)'), color: '#f59e0b' },
          { value: displaySummary.problematic || 0, label: t('fonts.report.stability.problematicLabel', 'Problematic (block/auto)'), color: (displaySummary.problematic || 0) > 0 ? '#ef4444' : '#10b981' }
        ]);
      }

      // font-display breakdown by value
      if (fontDisplayBreakdown) {
        var fdRows = [];
        if (fontDisplayBreakdown.swap && fontDisplayBreakdown.swap.length > 0) {
          fdRows.push([esc('swap'), String(fontDisplayBreakdown.swap.length), PR.renderStatus('pass', t('fonts.report.stability.optimal', 'Optimal'))]);
        }
        if (fontDisplayBreakdown.optional && fontDisplayBreakdown.optional.length > 0) {
          fdRows.push([esc('optional'), String(fontDisplayBreakdown.optional.length), PR.renderStatus('pass', t('fonts.report.stability.optimal', 'Optimal'))]);
        }
        if (fontDisplayBreakdown.fallback && fontDisplayBreakdown.fallback.length > 0) {
          fdRows.push([esc('fallback'), String(fontDisplayBreakdown.fallback.length), PR.renderStatus('warning', t('fonts.report.stability.acceptable', 'Acceptable'))]);
        }
        if (fontDisplayBreakdown.block && fontDisplayBreakdown.block.length > 0) {
          fdRows.push([esc('block'), String(fontDisplayBreakdown.block.length), PR.renderStatus('fail', t('fonts.report.stability.problematic', 'Problematic'))]);
        }
        if (fontDisplayBreakdown.auto && fontDisplayBreakdown.auto.length > 0) {
          fdRows.push([esc('auto/none'), String(fontDisplayBreakdown.auto.length), PR.renderStatus('fail', t('fonts.report.stability.problematic', 'Problematic'))]);
        }
        if (fdRows.length > 0) {
          html += PR.renderTable(
            [
              { label: t('fonts.report.stability.table.value', 'Value'), width: '25%' },
              { label: t('fonts.report.stability.table.count', 'Count'), width: '15%' },
              { label: t('seo.report.table.status', 'Status'), width: '30%' }
            ],
            fdRows,
            { striped: true }
          );
        }
      }

      // Problematic font-display code fix suggestion
      if ((displaySummary.problematic || 0) > 0) {
        html += '<div class="pdf-fix-card__code-block" style="margin-top:8px;">' +
          '<div class="pdf-fix-card__code-label pdf-fix-card__code-label--good">' + esc(t('fonts.report.stability.recommendedFix', 'Recommended Fix')) + '</div>' +
          '<pre class="pdf-fix-card__code-pre" style="padding:8px 10px;font-size:0.75rem;margin:0;">font-display: swap;</pre>' +
        '</div>';
      }

      // Metric overrides
      html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.stability.metricOverridesHeading', 'Metric Overrides')) + ' (' + metricOverrides.length + ')</h3>';
      if (metricOverrides.length > 0) {
        html += PR.renderCallout(
          t('fonts.report.stability.metricOverridesFoundTitle', 'Metric Overrides Detected'),
          t('fonts.report.stability.metricOverridesFoundBody', 'Using metric overrides helps minimize layout shifts when fonts swap.'),
          'tip'
        );
        var moRows = metricOverrides.map(function (mo) {
          var props = [];
          if (mo.sizeAdjust) props.push('size-adjust: ' + mo.sizeAdjust);
          if (mo.ascentOverride) props.push('ascent-override: ' + mo.ascentOverride);
          if (mo.descentOverride) props.push('descent-override: ' + mo.descentOverride);
          if (mo.lineGapOverride) props.push('line-gap-override: ' + mo.lineGapOverride);
          return [
            '<strong>' + esc(mo.family || '-') + '</strong>',
            esc(props.join(', ') || '-')
          ];
        });
        html += PR.renderTable(
          [
            { label: t('fonts.report.stability.table.family', 'Family'), width: '25%' },
            { label: t('fonts.report.stability.table.overrides', 'Overrides Applied'), width: '65%' }
          ],
          moRows,
          { striped: true }
        );
      } else {
        html += PR.renderCallout(
          t('fonts.report.stability.noMetricOverridesTitle', 'No Metric Overrides Detected'),
          t('fonts.report.stability.noMetricOverridesBody', 'Consider using metric overrides to minimize layout shifts.'),
          'info'
        );
        html += '<div class="pdf-fix-card__code-block" style="margin-top:8px;">' +
          '<div class="pdf-fix-card__code-label pdf-fix-card__code-label--good">' + esc(t('fonts.report.stability.exampleOverrides', 'Example @font-face with metric overrides')) + '</div>' +
          '<pre class="pdf-fix-card__code-pre" style="padding:8px 10px;font-size:0.75rem;margin:0;">@font-face {\n  font-family: \'Fallback\';\n  src: local(\'Arial\');\n  size-adjust: 105%;\n  ascent-override: 90%;\n  descent-override: 20%;\n}</pre>' +
        '</div>';
      }

      // Fallback Stack Quality
      html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.stability.fallbackStacksHeading', 'Fallback Stack Quality')) + '</h3>';

      if (fsSummary && (fsSummary.excellent || fsSummary.good || fsSummary.poor)) {
        html += PR.renderMetrics([
          { value: fsSummary.excellent || 0, label: t('fonts.report.stability.excellentLabel', 'Excellent'), color: '#10b981' },
          { value: fsSummary.good || 0, label: t('fonts.report.stability.goodLabel', 'Good'), color: '#3b82f6' },
          { value: fsSummary.poor || 0, label: t('fonts.report.stability.poorLabel', 'Poor'), color: (fsSummary.poor || 0) > 0 ? '#ef4444' : '#10b981' }
        ]);
      }

      if (fsStacks.length > 0) {
        var stackRows = fsStacks.slice(0, 10).map(function (s) {
          var qualityColor = s.quality === 'excellent' ? '#10b981' : s.quality === 'good' ? '#22c55e' : '#ef4444';
          var qualityStatus = s.quality === 'excellent' ? 'pass' : s.quality === 'good' ? 'pass' : 'fail';
          var recCol = (s.recommendation && s.quality !== 'excellent')
            ? '<em style="font-size:0.75rem;color:#888;">' + esc(truncate(s.recommendation, 50)) + '</em>'
            : '-';
          return [
            '<span class="pdf-table__truncate">' + esc(truncate(s.stack, 50)) + '</span>',
            '<span style="color:' + qualityColor + ';font-weight:600;">' + esc((s.quality || '-').charAt(0).toUpperCase() + (s.quality || '-').slice(1)) + '</span>',
            s.hasGenericFallback ? PR.renderStatus('pass', t('seo.report.status.yes', 'Yes')) : PR.renderStatus('fail', t('seo.report.status.no', 'No')),
            recCol
          ];
        });

        html += PR.renderTable(
          [
            { label: t('fonts.report.stability.table.stack', 'Font Stack'), width: '35%' },
            { label: t('fonts.report.stability.table.quality', 'Quality'), width: '14%' },
            { label: t('fonts.report.stability.table.genericFallback', 'Generic'), width: '10%' },
            { label: t('fonts.report.stability.table.recommendation', 'Recommendation'), width: '33%' }
          ],
          stackRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       7. Advanced Typography
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-advanced .pdf-section__content');
      var aa = advancedAnalysis;

      // Calculate advanced score (matching web UI)
      var aaScores = [];
      if (aa.formats && aa.formats.summary && aa.formats.summary.woff2Percentage !== undefined) {
        aaScores.push(aa.formats.summary.woff2Percentage);
      }
      if (aa.fontDisplay && aa.fontDisplay.summary && aa.fontDisplay.summary.score !== undefined) {
        aaScores.push(aa.fontDisplay.summary.score);
      }
      if (aa.accessibility && aa.accessibility.score !== undefined) {
        aaScores.push(aa.accessibility.score);
      }
      if (aa.fallbackStacks && aa.fallbackStacks.summary && aa.fallbackStacks.summary.score !== undefined) {
        aaScores.push(aa.fallbackStacks.summary.score);
      }
      if (aa.clsRisk && aa.clsRisk.score !== undefined) {
        aaScores.push(aa.clsRisk.score);
      }
      var advancedScore = aaScores.length > 0
        ? Math.round(aaScores.reduce(function (a, b) { return a + b; }, 0) / aaScores.length)
        : null;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('fonts.advancedTypographyAnalysis', 'Advanced Typography'), advancedScore)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('fonts.report.sectionIntros.advanced', 'Advanced typography features like variable fonts, subsetting, and unicode-range can significantly reduce file sizes and improve performance. Variable fonts combine multiple weights and styles into a single file, reducing HTTP requests. Subsetting removes unused glyphs, and unicode-range allows the browser to download only needed character sets. This section checks for adoption of these modern optimization techniques.')) + '</p>';

      var hasAdvancedData = aa && Object.keys(aa).length > 0;

      if (hasAdvancedData) {
        // -- Font Format Analysis subsection --
        if (aa.formats) {
          var fmtSummary = aa.formats.summary || {};
          var fmtFormats = aa.formats.formats || {};
          html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.advanced.formatHeading', 'Font Format Analysis')) + '</h3>';
          html += PR.renderMetrics([
            { value: fmtSummary.woff2Count || 0, label: 'WOFF2', color: '#10b981' },
            { value: (fmtFormats.woff ? fmtFormats.woff.length : 0), label: 'WOFF', color: '#4285f4' },
            { value: ((fmtFormats.ttf ? fmtFormats.ttf.length : 0) + (fmtFormats.otf ? fmtFormats.otf.length : 0)), label: 'TTF/OTF', color: '#f59e0b' },
            { value: (fmtSummary.woff2Percentage || 0) + '%', label: t('fonts.report.delivery.woff2Label', 'Modern Format'), color: (fmtSummary.woff2Percentage || 0) >= 80 ? '#10b981' : '#f59e0b' }
          ]);
          if (fmtSummary.hasLegacyFormats) {
            html += PR.renderCallout(
              t('fonts.report.advanced.legacyTitle', 'Legacy Formats Detected'),
              t('fonts.report.advanced.legacyBody', 'Legacy formats detected (EOT/SVG). Consider removing for smaller bundles.'),
              'warning'
            );
          }
        }

        // -- font-display Audit subsection --
        if (aa.fontDisplay) {
          var fdSummary = aa.fontDisplay.summary || {};
          var fdValues = aa.fontDisplay.values || {};
          html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.advanced.fontDisplayHeading', 'font-display Audit')) +
            (fdSummary.score !== undefined ? ' (' + fdSummary.score + '/100)' : '') + '</h3>';

          var fdAuditRows = [];
          if (fdValues.swap && fdValues.swap.length > 0) fdAuditRows.push([esc('swap'), String(fdValues.swap.length), PR.renderStatus('pass', t('fonts.report.stability.optimal', 'Optimal'))]);
          if (fdValues.optional && fdValues.optional.length > 0) fdAuditRows.push([esc('optional'), String(fdValues.optional.length), PR.renderStatus('pass', t('fonts.report.stability.optimal', 'Optimal'))]);
          if (fdValues.fallback && fdValues.fallback.length > 0) fdAuditRows.push([esc('fallback'), String(fdValues.fallback.length), PR.renderStatus('warning', t('fonts.report.stability.acceptable', 'Acceptable'))]);
          if (fdValues.block && fdValues.block.length > 0) fdAuditRows.push([esc('block'), String(fdValues.block.length), PR.renderStatus('fail', t('fonts.report.stability.problematic', 'Problematic'))]);
          var autoLen = (fdValues.auto ? fdValues.auto.length : 0) + (fdValues.notSet ? fdValues.notSet.length : 0);
          if (autoLen > 0) fdAuditRows.push([esc('auto/none'), String(autoLen), PR.renderStatus('fail', t('fonts.report.stability.problematic', 'Problematic'))]);

          if (fdAuditRows.length > 0) {
            html += PR.renderTable(
              [
                { label: t('fonts.report.stability.table.value', 'Value'), width: '25%' },
                { label: t('fonts.report.stability.table.count', 'Count'), width: '15%' },
                { label: t('seo.report.table.status', 'Status'), width: '30%' }
              ],
              fdAuditRows,
              { striped: true }
            );
          }

          if (fdSummary.problematicCount > 0) {
            html += PR.renderCallout(
              t('fonts.report.advanced.fontDisplayFixTitle', 'Action Needed'),
              t('fonts.report.advanced.fontDisplayFixBody', 'Add font-display: swap to prevent Flash of Invisible Text (FOIT).'),
              'warning'
            );
          } else {
            html += PR.renderCallout(
              t('fonts.report.advanced.fontDisplayGoodTitle', 'All Fonts Optimal'),
              t('fonts.report.advanced.fontDisplayGoodBody', 'All fonts use optimal font-display values.'),
              'tip'
            );
          }
        }

        // -- Typography Accessibility subsection --
        if (aa.accessibility) {
          html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.advanced.accessibilityHeading', 'Typography Accessibility')) +
            (aa.accessibility.score !== undefined ? ' (' + aa.accessibility.score + '/100)' : '') + '</h3>';

          var a11yPassed = aa.accessibility.passed || [];
          var a11yIssues = aa.accessibility.issues || [];

          if (a11yPassed.length > 0 || a11yIssues.length > 0) {
            var a11yRows = [];
            a11yPassed.forEach(function (item) {
              a11yRows.push([
                PR.renderStatus('pass', t('seo.report.status.pass', 'Pass')),
                '<strong>' + esc(item.title || '') + '</strong>',
                esc(item.detail || '')
              ]);
            });
            a11yIssues.forEach(function (item) {
              var sev = item.type === 'warning' ? 'warning' : 'fail';
              a11yRows.push([
                PR.renderStatus(sev, sev === 'warning' ? t('seo.report.status.warning', 'Warning') : t('seo.report.status.fail', 'Fail')),
                '<strong>' + esc(item.title || '') + '</strong>',
                esc(item.detail || '')
              ]);
            });
            html += PR.renderTable(
              [
                { label: t('seo.report.table.status', 'Status'), width: '12%' },
                { label: t('fonts.report.advanced.table.check', 'Check'), width: '28%' },
                { label: t('fonts.report.advanced.table.detail', 'Detail'), width: '52%' }
              ],
              a11yRows,
              { striped: true }
            );
          }
        }

        // -- Variable Fonts subsection --
        var vf = aa.variableFonts || {};
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.advanced.variableFontsHeading', 'Variable Fonts')) +
          ' (' + ((vf.variableFonts && vf.variableFonts.length) || 0) + ' ' + esc(t('seo.report.status.detected', 'Detected')) + ')</h3>';

        if (vf.hasVariableFonts && vf.variableFonts && vf.variableFonts.length > 0) {
          html += PR.renderCallout(
            t('fonts.report.advanced.variableFontsFoundTitle', 'Variable Fonts In Use'),
            t('fonts.report.advanced.variableFontsFoundBody', 'Using variable fonts reduces HTTP requests and enables smooth weight/width transitions.'),
            'tip'
          );
          var vfRows = vf.variableFonts.map(function (font) {
            return [esc(font.fontFamily || font.name || '-')];
          });
          html += PR.renderTable(
            [{ label: t('fonts.report.families.table.name', 'Family'), width: '60%' }],
            vfRows,
            { striped: true }
          );
        } else {
          // Check from declarations
          var hasVarFromDecl = declarations.some(function (d) { return d.weight && d.weight.indexOf(' ') !== -1; });
          var hasUnicodeRange = declarations.some(function (d) { return d.unicodeRange; });

          var featureRows = [
            [t('fonts.report.advanced.variableFonts', 'Variable Fonts'), (hasVarFromDecl || vf.hasVariableFonts) ? PR.renderStatus('pass', t('seo.report.status.detected', 'Detected')) : PR.renderStatus('na', t('seo.report.status.notDetected', 'Not detected'))],
            [t('fonts.report.advanced.unicodeRange', 'Unicode-Range'), hasUnicodeRange ? PR.renderStatus('pass', t('seo.report.status.detected', 'Detected')) : PR.renderStatus('na', t('seo.report.status.notDetected', 'Not detected'))],
            [t('fonts.report.advanced.metricOverrides', 'Metric Overrides'), (fallbackStability.hasMetricOverrides || (fallbackStability.metricOverrides && fallbackStability.metricOverrides.length > 0)) ? PR.renderStatus('pass', t('seo.report.status.detected', 'Detected')) : PR.renderStatus('na', t('seo.report.status.notDetected', 'Not detected'))]
          ];
          html += PR.renderTable(
            [
              { label: t('fonts.report.advanced.table.feature', 'Feature'), width: '40%' },
              { label: t('seo.report.table.status', 'Status'), width: '40%' }
            ],
            featureRows,
            { striped: true }
          );

          if (vf.potentialSavings) {
            html += PR.renderCallout(
              t('fonts.report.advanced.considerVariableTitle', 'Consider Variable Fonts'),
              esc(vf.potentialSavings),
              'info'
            );
          }
        }

        // -- CLS Risk in advanced --
        if (aa.clsRisk) {
          html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.advanced.clsRiskHeading', 'Layout Shift Risk (CLS)')) +
            (aa.clsRisk.level ? ' — ' + aa.clsRisk.level.toUpperCase() : '') + '</h3>';
          var aaRisks = aa.clsRisk.risks || [];
          if (aaRisks.length === 0) {
            html += PR.renderCallout(
              t('fonts.report.stability.lowRiskTitle', 'Low CLS Risk'),
              t('fonts.report.advanced.lowClsBody', 'Low risk of font-related layout shifts. Good font-display and fallback configuration.'),
              'tip'
            );
          } else {
            aaRisks.forEach(function (risk) {
              html += PR.renderIssue(esc(risk.title) + (risk.detail ? ' — ' + esc(risk.detail) : ''), risk.type === 'high' ? 'critical' : 'warning');
            });
          }
        }

      } else {
        // No advanced analysis data — show basic feature check from declarations
        var hasVariableFonts = declarations.some(function (d) { return d.weight && d.weight.indexOf(' ') !== -1; });
        var hasUnicodeRange = declarations.some(function (d) { return d.unicodeRange; });

        var advRows = [
          [t('fonts.report.advanced.variableFonts', 'Variable Fonts'), hasVariableFonts ? PR.renderStatus('pass', t('seo.report.status.detected', 'Detected')) : PR.renderStatus('na', t('seo.report.status.notDetected', 'Not detected'))],
          [t('fonts.report.advanced.unicodeRange', 'Unicode-Range'), hasUnicodeRange ? PR.renderStatus('pass', t('seo.report.status.detected', 'Detected')) : PR.renderStatus('na', t('seo.report.status.notDetected', 'Not detected'))],
          [t('fonts.report.advanced.metricOverrides', 'Metric Overrides'), (fallbackStability.hasMetricOverrides) ? PR.renderStatus('pass', t('seo.report.status.detected', 'Detected')) : PR.renderStatus('na', t('seo.report.status.notDetected', 'Not detected'))]
        ];

        html += PR.renderTable(
          [
            { label: t('fonts.report.advanced.table.feature', 'Feature'), width: '50%' },
            { label: t('seo.report.table.status', 'Status'), width: '50%' }
          ],
          advRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       8. Performance Metrics
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-performance .pdf-section__content');
      if (!sec) return;

      var hasFullScan = !!data.fullScan;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('fonts.report.performance.heading', 'Performance Metrics'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('fonts.report.sectionIntros.performance', 'This section shows how typography impacts page performance. Metrics include page load timing, font family and variant counts, and typography scale consistency. Fewer families and weights mean faster loading. A consistent type scale improves readability and design quality.')) + '</p>';

      // Calculate typography stats from fontMetrics (matching web UI)
      var fontFamilySet = {};
      var weightSet = {};
      var sizeMap = {};
      var weightCounts = {};

      fontMetrics.forEach(function (m) {
        if (m.fontFamily) {
          var primary = m.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
          if (primary) fontFamilySet[primary] = true;
        }
        if (m.fontWeight) {
          weightSet[m.fontWeight] = true;
          weightCounts[m.fontWeight] = (weightCounts[m.fontWeight] || 0) + 1;
        }
        if (m.fontSize) {
          sizeMap[m.fontSize] = (sizeMap[m.fontSize] || 0) + 1;
        }
      });

      var uniqueFonts = Object.keys(fontFamilySet).length;
      var uniqueWeights = Object.keys(weightSet).length;
      var uniqueSizes = Object.keys(sizeMap).length;

      // Core metrics
      var perfMetrics = [];
      if (hasFullScan && fullPerformance.initialLoadTime) {
        perfMetrics.push({ value: fullPerformance.initialLoadTime + 'ms', label: t('fonts.report.performance.pageLoad', 'Page Load'), color: fullPerformance.initialLoadTime < 1000 ? '#10b981' : fullPerformance.initialLoadTime < 2000 ? '#f59e0b' : '#ef4444' });
      }
      perfMetrics.push({ value: summary.totalFamilies || families.length || 0, label: t('fonts.report.families.totalLabel', 'Total Families'), color: (summary.totalFamilies || families.length || 0) <= 3 ? '#10b981' : '#f59e0b' });
      perfMetrics.push({ value: uniqueFonts || '-', label: t('fonts.report.performance.uniqueFonts', 'Unique Fonts') });
      perfMetrics.push({ value: uniqueWeights || '-', label: t('fonts.report.performance.fontWeights', 'Font Weights') });
      perfMetrics.push({ value: uniqueSizes || '-', label: t('fonts.report.performance.fontSizes', 'Font Sizes') });
      html += PR.renderMetrics(perfMetrics);

      // Typography scale analysis
      var sizeEntries = [];
      var sizeKeys = Object.keys(sizeMap);
      sizeKeys.forEach(function (k) {
        sizeEntries.push({ size: k, count: sizeMap[k], px: parseFloat(k) });
      });
      sizeEntries.sort(function (a, b) { return b.px - a.px; });

      if (sizeEntries.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.performance.typographyScale', 'Typography Scale')) + '</h3>';
        var scaleRows = sizeEntries.slice(0, 10).map(function (s) {
          return [esc(s.size), String(s.count)];
        });
        html += PR.renderTable(
          [
            { label: t('fonts.report.performance.table.fontSize', 'Font Size'), width: '40%' },
            { label: t('fonts.report.performance.table.usage', 'Usage Count'), width: '25%' }
          ],
          scaleRows,
          { striped: true }
        );
      }

      // Weight distribution
      var weightEntries = [];
      var wKeys = Object.keys(weightCounts);
      wKeys.forEach(function (k) {
        weightEntries.push({ weight: k, count: weightCounts[k] });
      });
      weightEntries.sort(function (a, b) { return parseInt(a.weight) - parseInt(b.weight); });

      if (weightEntries.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.performance.weightDistribution', 'Weight Distribution')) + '</h3>';
        var wRows = weightEntries.map(function (w) {
          return [esc(w.weight), String(w.count)];
        });
        html += PR.renderTable(
          [
            { label: t('fonts.report.performance.table.weight', 'Weight'), width: '30%' },
            { label: t('fonts.report.performance.table.elements', 'Elements'), width: '25%' }
          ],
          wRows,
          { striped: true }
        );
      }

      // Typography usage table (element, font, size, weight, sample)
      if (fontMetrics.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('fonts.report.performance.typographyUsage', 'Typography Usage')) + '</h3>';
        var usageRows = fontMetrics.slice(0, 12).map(function (m) {
          var fontName = m.fontFamily ? m.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : '-';
          var sample = m.textContent ? truncate(m.textContent, 30) : '-';
          return [
            esc('<' + (m.element || '?') + '>'),
            esc(truncate(fontName, 18)),
            esc(m.fontSize || '-'),
            esc(m.fontWeight || '-'),
            '<em style="color:#888;font-size:0.75rem;">' + esc(sample) + '</em>'
          ];
        });
        html += PR.renderTable(
          [
            { label: t('fonts.report.performance.table.element', 'Element'), width: '10%' },
            { label: t('fonts.report.performance.table.font', 'Font'), width: '20%' },
            { label: t('fonts.report.performance.table.size', 'Size'), width: '12%' },
            { label: t('fonts.report.performance.table.weight', 'Weight'), width: '10%' },
            { label: t('fonts.report.performance.table.sample', 'Sample'), width: '38%' }
          ],
          usageRows,
          { striped: true }
        );
        if (fontMetrics.length > 12) {
          html += '<p style="font-size:0.75rem;color:#888;">+ ' + (fontMetrics.length - 12) + ' ' + esc(t('fonts.report.performance.moreElements', 'more elements analyzed')) + '</p>';
        }
      }

      // Performance tips
      var tips = [];
      if ((summary.totalFamilies || families.length || 0) > 3) {
        tips.push(t('fonts.report.performance.tip.reduceFamilies', 'Consider reducing font families to 2-3 for faster loading.'));
      }
      if (uniqueWeights > 4) {
        tips.push(t('fonts.report.performance.tip.consolidateWeights', 'Using ' + uniqueWeights + ' font weights. Consider consolidating to 3-4.'));
      }
      if (uniqueSizes > 8) {
        tips.push(t('fonts.report.performance.tip.consistentScale', uniqueSizes + ' different font sizes detected. Aim for a consistent type scale (6-8 sizes).'));
      }
      if (tips.length === 0) {
        tips.push(t('fonts.report.performance.tip.wellOptimized', 'Your typography setup is well-optimized for performance.'));
      }
      if (tips.length > 0) {
        html += PR.renderCallout(
          t('fonts.report.performance.tipsTitle', 'Typography Performance Tips'),
          tips.join(' '),
          tips.length === 1 && tips[0].indexOf('well-optimized') !== -1 ? 'tip' : 'info'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       9. Recommendations
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('fonts.report.recommendationsHeading', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('fonts.report.sectionIntros.recommendations', 'Based on the font analysis, this section provides actionable recommendations to optimize your typography stack. Each recommendation targets a specific area — from reducing file sizes with modern formats to improving layout stability with proper fallback chains. Implementing these changes can improve both performance metrics and user experience across all devices.')) + '</p>';

      // Build rich fix cards (matching web UI pattern)
      var fixes = _buildFontsFixes(data, bestPractices, families, providers, summary, fontDelivery, fallbackStability, advancedAnalysis, t, esc);

      // Also include simple recommendations and duplicate warnings
      var allRecs = recommendations.slice();
      if (duplicates.length > 0) {
        duplicates.forEach(function (dup) {
          allRecs.push({ priority: 'medium', title: dup.message || (dup.family + ' loaded ' + dup.instances + ' times'), description: dup.recommendation || '' });
        });
      }

      if (fixes.length > 0) {
        // Render rich fix cards (like SEO pattern)
        fixes.forEach(function (fix) {
          html += _renderFixCard(fix, t, esc);
        });
      }

      // Also render simple text recommendations that are not covered by fix cards
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
      }

      if (fixes.length === 0 && allRecs.length === 0) {
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

  /* =========================================================================
     Fix Card Builder — mirrors web UI buildFontsFixCards logic
     ========================================================================= */
  function _buildFontsFixes(data, bestPractices, families, providers, summary, fontDelivery, fallbackStability, advancedAnalysis, t, esc) {
    var fixes = [];

    var displayIssueCount = summary.displayIssueCount || 0;
    var hasGoogleFonts = providers.some(function (p) { return /google/i.test(p.name || ''); });
    var primaryFont = (families[0] && families[0].name) || 'Inter';
    var secondaryFont = (families[1] && families[1].name) || 'system-ui';
    var totalFamilies = summary.totalFamilies || families.length || 0;
    var dupCount = summary.duplicateCount || (data.duplicates ? data.duplicates.length : (data.issues && data.issues.duplicates ? data.issues.duplicates.length : 0));
    var preloads = fontDelivery.preloads || data.preloads || [];

    // Get advanced analysis data
    var formatAnalysis = advancedAnalysis.formats || {};
    var woff2Percentage = formatAnalysis.summary ? formatAnalysis.summary.woff2Percentage || 0 : 0;
    var hasLegacyFormats = formatAnalysis.summary ? formatAnalysis.summary.hasLegacyFormats || false : false;
    var fallbackAnalysis = advancedAnalysis.fallbackStacks || {};
    var fallbackScore = fallbackAnalysis.summary ? fallbackAnalysis.summary.score || (fallbackStability.score || 70) : (fallbackStability.score || 70);
    var variableFontsAnalysis = advancedAnalysis.variableFonts || {};
    var hasVariableFonts = variableFontsAnalysis.fonts ? variableFontsAnalysis.fonts.length > 0 : false;
    var accessibilityAnalysis = advancedAnalysis.accessibility || {};
    var accessScore = accessibilityAnalysis.score || 70;

    // 1. Font-display optimization (ALWAYS SHOW)
    fixes.push({
      title: displayIssueCount > 0
        ? t('fonts.report.fixes.fontDisplayTitle', 'Fix font-display issues') + ' (' + displayIssueCount + ' ' + t('fonts.report.fixes.affected', 'affected') + ')'
        : t('fonts.report.fixes.optimizeFontDisplay', 'Optimize font-display strategy'),
      category: t('fonts.report.fixes.renderPerformance', 'Render Performance'),
      severity: displayIssueCount > 0 ? 'high' : 'medium',
      description: displayIssueCount > 0
        ? t('fonts.report.fixes.fontDisplayDesc', 'Font(s) are missing or have suboptimal font-display values, which can cause Flash of Invisible Text (FOIT).')
        : t('fonts.report.fixes.fontDisplayOptimizeDesc', 'The font-display property controls how fonts render during loading. Choosing the right strategy improves perceived performance and prevents layout shifts.'),
      impact: t('fonts.report.fixes.fontDisplayImpact', 'Eliminates invisible text during loading, reduces CLS, improves Core Web Vitals.'),
      problematicCode: '@font-face {\n  font-family: \'' + primaryFont + '\';\n  src: url(\'font.woff2\') format(\'woff2\');\n  /* Missing font-display */\n}',
      snippet: '@font-face {\n  font-family: \'' + primaryFont + '\';\n  font-display: swap;\n  src: url(\'font.woff2\') format(\'woff2\');\n}\n\n/* Google Fonts - add display=swap */\n<link href="https://fonts.googleapis.com/css2?family=' + primaryFont.replace(/\s+/g, '+') + '&display=swap" rel="stylesheet">',
      steps: [
        t('fonts.report.fixes.steps.1', 'Audit all @font-face declarations in your CSS'),
        t('fonts.report.fixes.steps.2', 'Add font-display: swap to each declaration'),
        t('fonts.report.fixes.steps.3', 'For Google Fonts, append &display=swap to the URL'),
        t('fonts.report.fixes.steps.4', 'Test with Chrome DevTools Network throttling')
      ]
    });

    // 2. Font loading strategy (ALWAYS SHOW)
    fixes.push({
      title: t('fonts.report.fixes.loadingTitle', 'Implement font preloading strategy'),
      category: t('fonts.report.fixes.loadingPerformance', 'Loading Performance'),
      severity: 'high',
      description: preloads.length === 0
        ? t('fonts.report.fixes.loadingDesc', 'No font preloads detected. Preloading critical fonts can reduce First Contentful Paint by 100-500ms.')
        : t('fonts.report.fixes.loadingStrategyDesc', 'Font loading strategy significantly impacts page load time. Preloading critical fonts and using preconnect hints reduces FCP.'),
      impact: t('fonts.report.fixes.loadingImpact', 'Faster FCP, improved LCP, better experience on slow connections.'),
      problematicCode: '<head>\n  <link rel="stylesheet" href="styles.css">\n  <!-- Fonts discovered late -->\n</head>',
      snippet: '<head>\n  ' + (hasGoogleFonts ? '<link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  ' : '') + '<link rel="preload" href="/fonts/' + primaryFont.toLowerCase().replace(/\s+/g, '-') + '.woff2"\n        as="font" type="font/woff2" crossorigin>\n</head>',
      steps: [
        t('fonts.report.fixes.steps.preload1', 'Add preconnect hints for external font origins'),
        t('fonts.report.fixes.steps.preload2', 'Preload critical above-the-fold font files'),
        t('fonts.report.fixes.steps.preload3', 'Verify with Lighthouse or WebPageTest')
      ]
    });

    // 3. Font file optimization (ALWAYS SHOW)
    fixes.push({
      title: woff2Percentage < 80
        ? t('fonts.report.fixes.modernFormatsTitle', 'Upgrade to modern font formats (WOFF2)')
        : t('fonts.report.fixes.optimizeDelivery', 'Optimize font file delivery'),
      category: t('fonts.report.fixes.optimization', 'Optimization'),
      severity: woff2Percentage < 50 ? 'high' : 'medium',
      description: woff2Percentage < 80
        ? t('fonts.report.fixes.formatIssueDesc', 'WOFF2 provides 30-50% smaller files compared to WOFF, and up to 75% smaller than TTF/OTF.')
        : t('fonts.report.fixes.formatOptimizeDesc', 'Modern font formats like WOFF2 provide excellent compression. Further optimization can be achieved through subsetting and variable fonts.'),
      impact: t('fonts.report.fixes.modernFormatsImpact', 'Smaller downloads, faster loading, reduced bandwidth.'),
      problematicCode: '@font-face {\n  src: url(\'font.ttf\') format(\'truetype\'),\n       url(\'font.woff\') format(\'woff\');\n  /* TTF: ~150KB, WOFF: ~100KB */\n}',
      snippet: '@font-face {\n  font-display: swap;\n  src: url(\'' + primaryFont.toLowerCase().replace(/\s+/g, '-') + '.woff2\') format(\'woff2\'),\n       url(\'' + primaryFont.toLowerCase().replace(/\s+/g, '-') + '.woff\') format(\'woff\');\n  /* WOFF2: ~60KB (60% smaller!) */\n}',
      steps: [
        t('fonts.report.fixes.steps.format1', 'Convert fonts to WOFF2 format'),
        t('fonts.report.fixes.steps.format2', 'Update @font-face src to use WOFF2 first'),
        t('fonts.report.fixes.steps.format3', 'Remove legacy EOT/SVG format references')
      ]
    });

    // 4. Font family consolidation (ALWAYS SHOW)
    fixes.push({
      title: totalFamilies > 3
        ? t('fonts.report.fixes.tooManyTitle', 'Reduce font families') + ' (' + totalFamilies + ' ' + t('seo.report.status.detected', 'Detected') + ')'
        : t('fonts.report.fixes.establishFontSystem', 'Establish a font system'),
      category: t('fonts.report.fixes.optimization', 'Optimization'),
      severity: totalFamilies > 4 ? 'high' : 'medium',
      description: totalFamilies > 3
        ? t('fonts.report.fixes.tooManyDesc', 'Using more than 3 font families increases page weight and load times. Each additional family adds HTTP requests and parsing overhead.')
        : t('fonts.report.fixes.fontSystemDesc', 'A well-structured font system improves consistency, reduces maintenance, and ensures optimal performance.'),
      impact: t('fonts.report.fixes.tooManyImpact', 'Reduce page weight, fewer HTTP requests, faster rendering.'),
      problematicCode: '/* Loading multiple similar fonts */\n@import url(\'https://fonts.googleapis.com/css2?family=Roboto\');\n@import url(\'https://fonts.googleapis.com/css2?family=Open+Sans\');\n@import url(\'https://fonts.googleapis.com/css2?family=Lato\');',
      snippet: ':root {\n  --font-display: \'' + primaryFont + '\', sans-serif;\n  --font-body: \'' + secondaryFont + '\', sans-serif;\n}\n\nh1, h2, h3 { font-family: var(--font-display); }\nbody, p { font-family: var(--font-body); }',
      steps: [
        t('fonts.report.fixes.steps.reduce1', 'Identify which families are critical for branding'),
        t('fonts.report.fixes.steps.reduce2', 'Consolidate similar families (e.g., use system fonts for body)'),
        t('fonts.report.fixes.steps.reduce3', 'Remove unused font family imports')
      ]
    });

    // 5. Fallback font optimization (ALWAYS SHOW)
    fixes.push({
      title: t('fonts.report.fixes.optimizeFallbacks', 'Optimize fallback font stacks') + (fallbackScore < 80 ? ' (' + t('reports.common.score', 'Score') + ': ' + fallbackScore + '%)' : ''),
      category: t('fonts.report.fixes.categories.layoutStability', 'Layout Stability'),
      severity: fallbackScore < 60 ? 'high' : 'medium',
      description: t('fonts.report.fixes.fallbackDesc', 'Fallback fonts display while custom fonts load. Poorly matched fallbacks cause Cumulative Layout Shift (CLS) when the web font swaps in.'),
      impact: t('fonts.report.fixes.fallbackImpact', 'Reduces CLS by 0.05-0.2, improves Core Web Vitals score, eliminates jarring text reflow on font swap.'),
      problematicCode: 'body {\n  font-family: \'' + primaryFont + '\', sans-serif;\n  /* Generic sans-serif has different metrics */\n}',
      snippet: 'body {\n  font-family: \'' + primaryFont + '\',\n    -apple-system, BlinkMacSystemFont,\n    \'Segoe UI\', Roboto, Arial, sans-serif;\n}\n\n/* Or use size-adjust for perfect matching */\n@font-face {\n  font-family: \'' + primaryFont + ' Fallback\';\n  src: local(\'Arial\');\n  size-adjust: 105%;\n}',
      steps: [
        t('fonts.report.fixes.steps.fallbackOptimization.1', 'Test your site with fonts blocked to see fallback appearance'),
        t('fonts.report.fixes.steps.fallbackOptimization.2', 'Choose system fonts with similar x-height and character width'),
        t('fonts.report.fixes.steps.fallbackOptimization.3', 'Use CSS size-adjust property to fine-tune fallback metrics'),
        t('fonts.report.fixes.steps.fallbackOptimization.4', 'Consider metric override properties (ascent, descent, line-gap)'),
        t('fonts.report.fixes.steps.fallbackOptimization.5', 'Use tools like Fontaine or Capsize to calculate exact adjustments'),
        t('fonts.report.fixes.steps.fallbackOptimization.6', 'Implement CSS Font Loading API for precise control'),
        t('fonts.report.fixes.steps.fallbackOptimization.7', 'Test CLS with Lighthouse and WebPageTest'),
        t('fonts.report.fixes.steps.fallbackOptimization.8', 'Verify layout stability on slow 3G connections')
      ]
    });

    // 6. Duplicate fonts (show if duplicates found)
    if (dupCount > 0) {
      fixes.push({
        title: t('fonts.report.fixes.duplicatesTitle', 'Remove duplicate font declarations') + ' (' + dupCount + ')',
        category: t('fonts.report.fixes.optimization', 'Optimization'),
        severity: 'high',
        description: t('fonts.report.fixes.duplicatesDesc', 'Duplicate font declarations waste bandwidth and increase parsing time.'),
        impact: t('fonts.report.fixes.duplicatesImpact', 'Reduced page weight, fewer duplicate requests, cleaner CSS.'),
        steps: [
          t('fonts.report.fixes.steps.dup1', 'Search CSS for duplicate @font-face rules'),
          t('fonts.report.fixes.steps.dup2', 'Remove redundant declarations, keeping one per weight/style'),
          t('fonts.report.fixes.steps.dup3', 'Check for duplicate Google Fonts link tags')
        ]
      });
    }

    // 7. GDPR / self-hosting (show if Google Fonts detected)
    if (hasGoogleFonts) {
      fixes.push({
        title: t('fonts.report.fixes.gdprTitle', 'Self-host Google Fonts for GDPR compliance'),
        category: t('fonts.report.fixes.privacy', 'Privacy & Compliance'),
        severity: 'medium',
        description: t('fonts.report.fixes.gdprDesc', 'Google Fonts sends visitor IP addresses to Google servers, which may violate GDPR. Self-hosting eliminates this third-party data transfer.'),
        impact: t('fonts.report.fixes.gdprImpact', 'GDPR compliance, no third-party cookies, potentially faster delivery.'),
        problematicCode: '<link href="https://fonts.googleapis.com/css2?family=' + primaryFont + '" rel="stylesheet">',
        snippet: '/* Self-hosted alternative */\n@font-face {\n  font-family: \'' + primaryFont + '\';\n  font-display: swap;\n  src: url(\'/fonts/' + primaryFont.toLowerCase().replace(/\s+/g, '-') + '.woff2\') format(\'woff2\');\n}',
        steps: [
          t('fonts.report.fixes.steps.gdpr1', 'Download font files using google-webfonts-helper'),
          t('fonts.report.fixes.steps.gdpr2', 'Host WOFF2 files on your server'),
          t('fonts.report.fixes.steps.gdpr3', 'Replace Google Fonts link with self-hosted @font-face'),
          t('fonts.report.fixes.steps.gdpr4', 'Remove the Google Fonts <link> tag')
        ]
      });
    }

    // 8. Variable fonts (ALWAYS SHOW)
    fixes.push({
      title: hasVariableFonts
        ? t('fonts.report.fixes.optimizeVariableFonts', 'Optimize variable font usage')
        : t('fonts.report.fixes.considerVariableFonts', 'Consider variable fonts for weight flexibility'),
      category: t('fonts.report.fixes.categories.modernTypography', 'Modern Typography'),
      severity: 'low',
      description: hasVariableFonts
        ? t('fonts.report.fixes.variableFontsDetectedDesc', 'Variable fonts detected! Ensure you are leveraging their full potential with CSS font-variation-settings.')
        : t('fonts.report.fixes.variableFontsConsiderDesc', 'Using multiple weights of the same font family? Variable fonts bundle all weights into one file, often smaller than 2 static fonts combined.'),
      impact: t('fonts.report.fixes.variableFontsImpact', 'Single file for all weights (saves 50-200KB), enables smooth weight animations, more design flexibility.'),
      problematicCode: '/* 4 separate files */\n@font-face { font-weight: 400; src: url(\'regular.woff2\'); }\n@font-face { font-weight: 500; src: url(\'medium.woff2\'); }\n@font-face { font-weight: 600; src: url(\'semibold.woff2\'); }\n@font-face { font-weight: 700; src: url(\'bold.woff2\'); }',
      snippet: '/* 1 variable font file */\n@font-face {\n  font-family: \'' + primaryFont + ' VF\';\n  font-display: swap;\n  src: url(\'' + primaryFont.toLowerCase().replace(/\s+/g, '-') + '-variable.woff2\')\n       format(\'woff2-variations\');\n  font-weight: 100 900;\n}',
      steps: [
        t('fonts.report.fixes.steps.variableFonts.1', 'Check if your font has a variable version (Google Fonts, fonts.google.com)'),
        t('fonts.report.fixes.steps.variableFonts.2', 'Download or link to the variable font file'),
        t('fonts.report.fixes.steps.variableFonts.3', 'Update @font-face with font-weight range (e.g., 100 900)'),
        t('fonts.report.fixes.steps.variableFonts.4', 'Use format("woff2 supports variations") for proper browser support'),
        t('fonts.report.fixes.steps.variableFonts.5', 'Replace static weight values with variable font family'),
        t('fonts.report.fixes.steps.variableFonts.6', 'Explore additional axes (width, slant, optical size) if available'),
        t('fonts.report.fixes.steps.variableFonts.7', 'Remove old static font files to save space'),
        t('fonts.report.fixes.steps.variableFonts.8', 'Test across browsers - variable fonts have 95%+ support')
      ]
    });

    // 9. Accessibility (ALWAYS SHOW)
    fixes.push({
      title: t('fonts.report.fixes.improveAccessibility', 'Improve font accessibility') + (accessScore < 80 ? ' (' + t('reports.common.score', 'Score') + ': ' + accessScore + '%)' : ''),
      category: t('fonts.report.fixes.categories.accessibility', 'Accessibility'),
      severity: accessScore < 60 ? 'high' : 'medium',
      description: t('fonts.report.fixes.accessibilityDesc', 'Font choices significantly impact readability for users with visual impairments, dyslexia, and cognitive disabilities. WCAG guidelines provide minimum standards.'),
      impact: t('fonts.report.fixes.accessibilityImpact', 'WCAG compliance, wider audience reach, improved readability for all users, reduced eye strain.'),
      problematicCode: 'body {\n  font-size: 12px;        /* Too small */\n  line-height: 1.2;       /* Too tight */\n  letter-spacing: -0.5px; /* Negative tracking */\n}',
      snippet: 'body {\n  font-size: 1rem;        /* 16px base, scales with user prefs */\n  line-height: 1.6;       /* WCAG minimum is 1.5 */\n  letter-spacing: 0.01em; /* Slight positive tracking */\n}\n\np { max-width: 70ch; }   /* Optimal line length */',
      steps: [
        t('fonts.report.fixes.steps.accessibility.1', 'Set base font-size to 100% (16px) to respect user preferences'),
        t('fonts.report.fixes.steps.accessibility.2', 'Use rem/em units for all font sizes, not px'),
        t('fonts.report.fixes.steps.accessibility.3', 'Ensure line-height is at least 1.5 (WCAG requirement)'),
        t('fonts.report.fixes.steps.accessibility.4', 'Limit line length to 45-80 characters (use max-width: 70ch)'),
        t('fonts.report.fixes.steps.accessibility.5', 'Use left-alignment, avoid justified text'),
        t('fonts.report.fixes.steps.accessibility.6', 'Ensure minimum font-size of 16px for body, 14px for small text'),
        t('fonts.report.fixes.steps.accessibility.7', 'Test with browser zoom at 200% - content should remain readable'),
        t('fonts.report.fixes.steps.accessibility.8', 'Consider offering a dyslexia-friendly font option')
      ]
    });

    return fixes;
  }

  /* =========================================================================
     Fix Card Renderer — mirrors SEO _renderFixCard pattern
     ========================================================================= */
  function _renderFixCard(fix, t, esc) {
    var severityLower = (fix.severity || 'medium').toLowerCase();

    var html = '<div class="pdf-fix-card">';

    // Header
    html += '<div class="pdf-fix-card__header">';
    var severityLabel = { high: t('seo.fixes.severity.high', 'High'), medium: t('seo.fixes.severity.medium', 'Medium'), low: t('seo.fixes.severity.low', 'Low') }[severityLower] || fix.severity;
    html += '<span class="pdf-fix-card__severity pdf-fix-card__severity--' + severityLower + '">' + esc(severityLabel) + '</span>';
    html += '<span class="pdf-fix-card__title">' + esc(fix.title) + '</span>';
    if (fix.category) {
      html += '<span class="pdf-fix-card__category">' + esc(fix.category) + '</span>';
    }
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

    // Code comparison
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

      html += '</div>';
    }

    // Steps
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
      html += '</div>';
    }

    html += '</div>'; // end body
    html += '</div>'; // end fix-card

    return html;
  }

  function _htmlToNode(html) {
    var temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.firstChild;
  }

})(window);
