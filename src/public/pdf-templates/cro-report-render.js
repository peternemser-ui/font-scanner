/**
 * CRO Report — PDF Renderer
 * Renders all Conversion Rate Optimization analysis sections into the PDF template.
 * Matches the richness of the web UI (cro-script.js) including:
 *   - CTA examples, above-fold counts, aboveFold status
 *   - Form details table (fieldCount, hasEmail, hasPhone, hasValidation, hasAutocomplete)
 *   - Trust signal checklist (hasSSL, hasTestimonials, etc.) with pass/fail
 *   - Mobile UX metrics (tapTargetCompliance, avgFontSize, hasViewportMeta)
 *   - Rich fix cards with code examples, impact callouts, step-by-step guides
 *   - Enhanced quick-win cards with timeEstimate, difficulty, steps
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[cro-report-render] PdfReport not loaded');
    return;
  }

  var PR = window.PdfReport;

  PdfReport.register('cro', function renderCRO(data, utils) {
    var t = utils.t;
    var esc = utils.esc;
    var truncate = utils.truncate;
    var scoreClass = utils.scoreClass;
    var translateImpact = utils.translateImpact || function(v) { return v; };

    var sectionIndex = 1;

    function _htmlToNode(htmlStr) {
      var tpl = document.createElement('template');
      tpl.innerHTML = htmlStr.trim();
      return tpl.content.firstChild;
    }

    // Resolve data sources
    var scores = data.scores || {};
    var analysis = data.analysis || {};
    var quickWins = data.quickWins || [];
    var recommendations = data.recommendations || [];

    // --- Normalize sub-objects: inject derived fields the renderer expects ---
    // The API returns scores at `data.scores.{cta,form,trust,mobile}` but
    // the renderer reads `analysis.ctas.score`, `analysis.forms.score`, etc.
    // Also derive `count`, `avgFields`, `aboveFold` that the API doesn't include.

    // CTAs: inject score and aboveFold boolean
    if (analysis.ctas) {
      if (analysis.ctas.score === undefined && scores.cta !== undefined) {
        analysis.ctas.score = scores.cta;
      }
      if (analysis.ctas.aboveFold === undefined && analysis.ctas.visible !== undefined) {
        analysis.ctas.aboveFold = analysis.ctas.visible > 0;
      }
    }

    // Forms: inject score and avgFields
    if (analysis.forms) {
      if (analysis.forms.score === undefined && scores.form !== undefined) {
        analysis.forms.score = scores.form;
      }
      if (analysis.forms.avgFields === undefined && analysis.forms.details && analysis.forms.details.length > 0) {
        var totalFields = 0;
        analysis.forms.details.forEach(function (f) { totalFields += (f.fieldCount || 0); });
        analysis.forms.avgFields = Math.round(totalFields / analysis.forms.details.length);
      }
    }

    // Trust Signals: inject score and count
    if (analysis.trustSignals) {
      if (analysis.trustSignals.score === undefined && scores.trust !== undefined) {
        analysis.trustSignals.score = scores.trust;
      }
      if (analysis.trustSignals.count === undefined) {
        var trustCount = 0;
        var trustBoolKeys = ['hasSSL', 'hasTestimonials', 'hasSocialProof', 'hasContactInfo', 'hasPrivacyPolicy', 'hasSecurityBadges'];
        trustBoolKeys.forEach(function (k) { if (analysis.trustSignals[k]) trustCount++; });
        analysis.trustSignals.count = trustCount;
      }
    }

    // Mobile UX: inject score, guard NaN tapTargetCompliance
    if (analysis.mobileUX) {
      if (analysis.mobileUX.score === undefined && scores.mobile !== undefined) {
        analysis.mobileUX.score = scores.mobile;
      }
      // tapTargetCompliance can be NaN when totalButtons is 0 (0/0)
      if (isNaN(analysis.mobileUX.tapTargetCompliance)) {
        analysis.mobileUX.tapTargetCompliance = 0;
      }
    }

    /* -----------------------------------------------------------------------
       1. CRO Overview
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-overview .pdf-section__content');
      var score = data.overallScore || data.score;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cro.report.overviewTitle', 'CRO Overview'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cro.report.sectionIntros.overview', 'Conversion Rate Optimization (CRO) analyzes how effectively your page converts visitors into customers or leads. This overview presents your aggregate CRO score across four key dimensions: calls to action, forms, trust signals, and mobile user experience. A well-optimized page guides visitors toward desired actions with clear, compelling elements.')) + '</p>';

      // Score grid for sub-scores
      html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cro.report.overview.scoresHeading', 'CRO Sub-Scores')) + '</h3>';
      html += '<div class="pdf-score-grid">';

      var subScores = [
        { key: 'cta', label: t('reports.cro.report.sections.cta', 'Calls to Action') },
        { key: 'form', label: t('reports.cro.report.sections.forms', 'Form Analysis') },
        { key: 'trust', label: t('reports.cro.report.sections.trust', 'Trust Signals') },
        { key: 'mobile', label: t('reports.cro.report.sections.mobile', 'Mobile UX') }
      ];

      subScores.forEach(function (sub) {
        var val = scores[sub.key];
        if (val === undefined || val === null) return;
        html += '<div class="pdf-score-card">' +
          '<div class="pdf-score-card__label">' + esc(sub.label) + '</div>' +
          '<div class="pdf-score-card__value score-' + scoreClass(val) + '">' + val + '</div>' +
        '</div>';
      });

      html += '</div>';

      // Overview metrics — include mobile score too
      var overallVal = scores.overall !== undefined ? scores.overall : (data.overallScore || data.score || '-');
      var overallNum = Number(overallVal) || 0;
      html += PR.renderMetrics([
        { value: overallVal, label: t('reports.cro.report.overview.overallScore', 'Overall Score'), color: overallNum >= 70 ? '#10b981' : overallNum >= 40 ? '#f59e0b' : '#ef4444' },
        { value: scores.cta !== undefined ? scores.cta : '-', label: t('reports.cro.report.sections.cta', 'Calls to Action') },
        { value: scores.form !== undefined ? scores.form : '-', label: t('reports.cro.report.sections.forms', 'Form Analysis') },
        { value: scores.trust !== undefined ? scores.trust : '-', label: t('reports.cro.report.sections.trust', 'Trust Signals') },
        { value: scores.mobile !== undefined ? scores.mobile : '-', label: t('reports.cro.report.sections.mobile', 'Mobile UX') }
      ]);

      // Summary stats (matches web UI renderCROSummarySection)
      var highPriorityCount = 0;
      recommendations.forEach(function (r) {
        if ((r.priority || r.severity) === 'high' || (r.priority || r.severity) === 'critical') highPriorityCount++;
      });

      if (recommendations.length > 0 || highPriorityCount > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.common.summary', 'Summary')) + '</h3>';
        html += PR.renderMetrics([
          { value: highPriorityCount, label: t('reports.cro.stats.highPriority', 'High Priority'), color: highPriorityCount > 0 ? '#ef4444' : '#10b981' },
          { value: recommendations.length, label: t('reports.cro.stats.totalRecommendations', 'Total Recommendations') },
          { value: quickWins.length, label: t('reports.cro.report.sections.quickWins', 'Quick Wins') }
        ]);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Calls to Action
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-cta .pdf-section__content');
      var d = analysis.ctas || {};
      var score = scores.cta;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cro.report.sections.cta', 'Calls to Action'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cro.report.sectionIntros.cta', 'Calls to action (CTAs) are the primary conversion drivers on your page. Effective CTAs use action-oriented language, stand out visually, and are positioned where users are most likely to engage. This section evaluates your CTAs for visibility, clarity, and placement effectiveness.')) + '</p>';

      // Metrics — include visible/above-fold count (web UI shows ctas.visible)
      var metricsArr = [
        { value: d.count || 0, label: t('reports.cro.report.cta.totalFound', 'CTAs Found') },
        { value: d.score !== undefined ? d.score : '-', label: t('reports.cro.report.cta.score', 'CTA Score'), color: (d.score || 0) >= 70 ? '#10b981' : (d.score || 0) >= 40 ? '#f59e0b' : '#ef4444' }
      ];
      if (d.visible !== undefined) {
        metricsArr.push({ value: d.visible, label: t('reports.cro.aboveTheFold', 'Above the Fold'), color: d.visible > 0 ? '#10b981' : '#ef4444' });
      }
      html += PR.renderMetrics(metricsArr);

      // Above-fold status callout (web UI shows this prominently)
      if (d.aboveFold === false || (d.visible !== undefined && d.visible === 0)) {
        html += PR.renderCallout(
          t('reports.cro.report.cta.noAboveFoldTitle', 'No CTA Above the Fold'),
          t('reports.cro.report.cta.noAboveFoldBody', 'Visitors should see a clear call-to-action without scrolling. Adding a CTA above the fold can increase conversions by 20-30%.'),
          'warning'
        );
      } else if (d.aboveFold === true || (d.visible !== undefined && d.visible > 0)) {
        html += PR.renderCallout(
          t('reports.cro.report.cta.aboveFoldOkTitle', 'CTA Visible Above the Fold'),
          t('reports.cro.report.cta.aboveFoldOkBody', 'At least one call-to-action is visible without scrolling, which is critical for conversions.'),
          'tip'
        );
      }

      // CTA examples (web UI shows these as styled badges)
      var examples = d.examples || [];
      if (examples.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cro.ctaExamplesFound', 'CTA Examples Found:')) + '</h3>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">';
        examples.slice(0, 15).forEach(function (text) {
          var ctaLabel = typeof text === 'string' ? text : (text.text || text.label || '');
          html += '<span style="display:inline-block;padding:6px 14px;border-radius:6px;font-size:0.82rem;font-weight:500;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:#3b82f6;">' + esc(truncate(ctaLabel, 40)) + '</span>';
        });
        html += '</div>';
      }

      // CTAs found table
      var found = d.found || [];
      if (found.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cro.report.cta.foundHeading', 'CTAs Detected')) + '</h3>';
        var ctaRows = found.slice(0, 20).map(function (cta) {
          var ctaText = typeof cta === 'string' ? cta : (cta.text || cta.label || '-');
          var ctaType = typeof cta === 'object' && cta.type ? cta.type : '-';
          var ctaLocation = typeof cta === 'object' && cta.location ? cta.location : '-';
          return [
            '<strong>' + esc(truncate(ctaText, 60)) + '</strong>',
            esc(ctaType),
            esc(truncate(ctaLocation, 40))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.cro.report.cta.table.text', 'CTA Text'), width: '45%' },
            { label: t('reports.cro.report.cta.table.type', 'Type'), width: '20%' },
            { label: t('reports.cro.report.cta.table.location', 'Location'), width: '35%' }
          ],
          ctaRows,
          { striped: true }
        );

        if (found.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: found.length - 20 }) + '</p>';
        }
      } else if (examples.length === 0) {
        html += PR.renderCallout(
          t('reports.cro.report.cta.noneTitle', 'No CTAs Detected'),
          t('reports.cro.report.cta.noneBody', 'No clear calls to action were found on this page. Adding prominent CTAs is critical for conversions.'),
          'warning'
        );
      }

      // Issues
      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Form Analysis
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-forms .pdf-section__content');
      var d = analysis.forms || {};
      var score = scores.form;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cro.report.sections.forms', 'Form Analysis'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cro.report.sectionIntros.forms', 'Form design directly impacts completion rates. Complex, lengthy, or poorly designed forms are a leading cause of conversion abandonment. This section analyzes your forms for field count, label clarity, validation feedback, and mobile usability to identify friction points.')) + '</p>';

      // Metrics
      var formMetrics = [
        { value: d.count || 0, label: t('reports.cro.report.forms.totalFound', 'Forms Found') },
        { value: d.score !== undefined ? d.score : '-', label: t('reports.cro.report.forms.score', 'Form Score'), color: (d.score || 0) >= 70 ? '#10b981' : (d.score || 0) >= 40 ? '#f59e0b' : '#ef4444' }
      ];
      if (d.avgFields !== undefined) {
        formMetrics.push({ value: d.avgFields, label: t('reports.cro.report.forms.avgFields', 'Avg. Fields'), color: d.avgFields <= 5 ? '#10b981' : d.avgFields <= 8 ? '#f59e0b' : '#ef4444' });
      }
      html += PR.renderMetrics(formMetrics);

      // Rich form details table (web UI: renderFormContent with details array)
      var details = d.details || [];
      if (details.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cro.report.forms.detailsHeading', 'Form Details')) + '</h3>';

        var detailRows = details.slice(0, 15).map(function (form, idx) {
          var fieldCount = form.fieldCount !== undefined ? form.fieldCount : (form.fields !== undefined ? form.fields : '-');
          var fieldColor = Number(fieldCount) <= 5 ? '#10b981' : Number(fieldCount) <= 8 ? '#f59e0b' : '#ef4444';
          return [
            '<strong>' + esc(t('reports.cro.formNumber', 'Form {{number}}', { number: idx + 1 })) + '</strong>',
            '<span style="color:' + fieldColor + ';font-weight:600;">' + esc(String(fieldCount)) + '</span>',
            PR.renderStatus(form.hasEmail ? 'pass' : 'neutral', form.hasEmail ? '&#10003;' : '&#8211;'),
            PR.renderStatus(form.hasPhone ? 'pass' : 'neutral', form.hasPhone ? '&#10003;' : '&#8211;'),
            PR.renderStatus(form.hasValidation ? 'pass' : 'warning', form.hasValidation ? '&#10003;' : '&#10007;'),
            PR.renderStatus(form.hasAutocomplete ? 'pass' : 'warning', form.hasAutocomplete ? '&#10003;' : '&#10007;')
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.cro.form', 'Form'), width: '18%' },
            { label: t('reports.cro.fields', 'Fields'), width: '12%' },
            { label: t('reports.cro.email', 'Email'), width: '14%' },
            { label: t('reports.cro.phone', 'Phone'), width: '14%' },
            { label: t('reports.cro.validation', 'Validation'), width: '18%' },
            { label: t('reports.cro.autocomplete', 'Autocomplete'), width: '24%' }
          ],
          detailRows,
          { striped: true }
        );

        if (details.length > 15) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: details.length - 15 }) + '</p>';
        }

        // Form optimization tips callout (matches web UI)
        html += PR.renderCallout(
          t('reports.cro.formOptimizationTips', 'Form Optimization Tips'),
          t('reports.cro.tips.keepFormsUnder5', 'Keep forms under 5 fields when possible') + '. ' +
          t('reports.cro.tips.useAutocomplete', 'Use autocomplete to speed up form filling') + '. ' +
          t('reports.cro.tips.addInlineValidation', 'Add inline validation for better UX') + '.',
          'info'
        );
      } else {
        // Fallback: simple found-forms table
        var found = d.found || [];
        if (found.length > 0) {
          html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cro.report.forms.foundHeading', 'Forms Detected')) + '</h3>';
          var formRows = found.slice(0, 15).map(function (form) {
            var formName = typeof form === 'string' ? form : (form.name || form.id || form.action || '-');
            var fieldCount = typeof form === 'object' && form.fields !== undefined ? form.fields : (typeof form === 'object' && form.fieldCount !== undefined ? form.fieldCount : '-');
            var formType = typeof form === 'object' && form.type ? form.type : '-';
            return [
              '<strong>' + esc(truncate(formName, 50)) + '</strong>',
              esc(String(fieldCount)),
              esc(formType)
            ];
          });

          html += PR.renderTable(
            [
              { label: t('reports.cro.report.forms.table.form', 'Form'), width: '45%' },
              { label: t('reports.cro.report.forms.table.fields', 'Fields'), width: '20%' },
              { label: t('reports.cro.report.forms.table.type', 'Type'), width: '35%' }
            ],
            formRows,
            { striped: true }
          );

          if (found.length > 15) {
            html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: found.length - 15 }) + '</p>';
          }
        } else if (d.count === 0 || (d.count === undefined && found.length === 0 && details.length === 0)) {
          html += PR.renderCallout(
            t('reports.cro.report.forms.noneTitle', 'No Forms Detected'),
            t('reports.cro.report.forms.noneBody', 'No forms were found on this page. Consider adding lead capture or contact forms to improve conversions.'),
            'info'
          );
        }
      }

      // Issues
      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. Trust Signals
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-trust .pdf-section__content');
      var d = analysis.trustSignals || {};
      var score = scores.trust;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cro.report.sections.trust', 'Trust Signals'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cro.report.sectionIntros.trust', 'Trust signals reassure visitors that your site is legitimate, secure, and reliable. These include security badges, testimonials, reviews, contact information, and social proof. This section evaluates the presence and effectiveness of trust-building elements on your page.')) + '</p>';

      // Metrics
      html += PR.renderMetrics([
        { value: d.count || 0, label: t('reports.cro.report.trust.totalFound', 'Trust Signals Found') },
        { value: d.score !== undefined ? d.score : '-', label: t('reports.cro.report.trust.score', 'Trust Score'), color: (d.score || 0) >= 70 ? '#10b981' : (d.score || 0) >= 40 ? '#f59e0b' : '#ef4444' }
      ]);

      // Trust signal checklist (matches web UI renderTrustContent)
      // The web UI checks 6 specific boolean keys on the trustSignals object
      var trustChecklist = [
        { key: 'hasSSL', label: t('reports.cro.trustSignalsList.sslCertificate', 'SSL Certificate'), desc: t('reports.cro.trustSignalsList.secureHttps', 'Secure HTTPS connection') },
        { key: 'hasTestimonials', label: t('reports.cro.trustSignalsList.testimonials', 'Testimonials'), desc: t('reports.cro.trustSignalsList.customerReviews', 'Customer reviews visible') },
        { key: 'hasSocialProof', label: t('reports.cro.trustSignalsList.socialProof', 'Social Proof'), desc: t('reports.cro.trustSignalsList.trustBadges', 'Trust badges or certifications') },
        { key: 'hasContactInfo', label: t('reports.cro.trustSignalsList.contactInfo', 'Contact Information'), desc: t('reports.cro.trustSignalsList.phoneDisplayed', 'Phone number displayed') },
        { key: 'hasPrivacyPolicy', label: t('reports.cro.trustSignalsList.privacyPolicy', 'Privacy Policy'), desc: t('reports.cro.trustSignalsList.privacyFound', 'Privacy policy link found') },
        { key: 'hasSecurityBadges', label: t('reports.cro.trustSignalsList.securityBadges', 'Security Badges'), desc: t('reports.cro.trustSignalsList.securitySeals', 'Security seals visible') }
      ];

      // Check if we have any boolean trust keys in the data
      var hasTrustBooleans = trustChecklist.some(function (item) {
        return d[item.key] !== undefined;
      });

      if (hasTrustBooleans) {
        var presentCount = 0;
        trustChecklist.forEach(function (item) { if (d[item.key]) presentCount++; });

        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cro.trustSignalAnalysis', 'Trust Signal Analysis')) + '</h3>';

        html += '<p class="pdf-text-muted" style="margin-bottom:12px;">' +
          esc(t('reports.cro.trustSignalsDescription', 'Trust signals reduce friction and increase conversion rates. {{present}} of {{total}} trust elements detected.', { present: presentCount, total: trustChecklist.length })) +
        '</p>';

        var trustRows = trustChecklist.map(function (item) {
          var hasIt = !!d[item.key];
          return [
            '<strong>' + esc(item.label) + '</strong><br><span class="pdf-text-muted pdf-text-small">' + esc(item.desc) + '</span>',
            PR.renderStatus(hasIt ? 'pass' : 'fail', hasIt ? t('reports.cro.report.trust.present', 'Present') : t('reports.cro.report.trust.missing', 'Missing'))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.cro.report.trust.table.signal', 'Trust Signal'), width: '70%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          trustRows,
          { striped: true }
        );
      }

      // Also render the generic found-signals table if present
      var found = d.found || [];
      if (found.length > 0) {
        if (hasTrustBooleans) {
          html += '<h3 class="pdf-subsection__title" style="margin-top:16px;">' + esc(t('reports.cro.report.trust.foundHeading', 'Trust Signals Detected')) + '</h3>';
        } else {
          html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cro.report.trust.foundHeading', 'Trust Signals Detected')) + '</h3>';
        }
        var trustFoundRows = found.slice(0, 20).map(function (signal) {
          var signalName = typeof signal === 'string' ? signal : (signal.name || signal.text || signal.type || '-');
          var signalType = typeof signal === 'object' && signal.type ? signal.type : '-';
          var signalStatus = typeof signal === 'object' && signal.status ? signal.status : 'found';
          return [
            '<strong>' + esc(truncate(signalName, 60)) + '</strong>',
            esc(signalType),
            PR.renderStatus(signalStatus === 'found' || signalStatus === 'pass' ? 'pass' : 'warning', esc(signalStatus))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.cro.report.trust.table.signal', 'Trust Signal'), width: '45%' },
            { label: t('reports.cro.report.trust.table.type', 'Type'), width: '25%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          trustFoundRows,
          { striped: true }
        );

        if (found.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: found.length - 20 }) + '</p>';
        }
      } else if (!hasTrustBooleans) {
        html += PR.renderCallout(
          t('reports.cro.report.trust.noneTitle', 'No Trust Signals Detected'),
          t('reports.cro.report.trust.noneBody', 'No trust signals were found on this page. Adding testimonials, security badges, and social proof can significantly improve conversions.'),
          'warning'
        );
      }

      // Issues
      if (d.issues && d.issues.length > 0) {
        html += _renderIssuesList(d.issues, t);
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Mobile UX
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-mobile-ux .pdf-section__content');
      var d = analysis.mobileUX || {};
      var score = scores.mobile;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cro.report.sections.mobile', 'Mobile UX'), score)),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cro.report.sectionIntros.mobileUx', 'Mobile UX optimization ensures conversion elements work effectively on touchscreen devices. This includes tap-friendly buttons, mobile-optimized forms, and responsive layouts that maintain conversion paths. Over 50% of purchases now begin on mobile devices.')) + '</p>';

      // Rich metrics matching web UI (tapTargetCompliance, avgFontSize, hasViewportMeta)
      var mobileMetrics = [
        { value: d.score !== undefined ? d.score : (score !== undefined ? score : '-'), label: t('reports.cro.report.mobileUx.score', 'Mobile UX Score'), color: (d.score || score || 0) >= 70 ? '#10b981' : (d.score || score || 0) >= 40 ? '#f59e0b' : '#ef4444' }
      ];

      if (d.tapTargetCompliance !== undefined) {
        var tapPct = (d.tapTargetCompliance * 100).toFixed(1);
        mobileMetrics.push({ value: tapPct + '%', label: t('reports.cro.mobile.tapTargetCompliance', 'Tap Target Compliance'), color: d.tapTargetCompliance >= 0.8 ? '#10b981' : '#f59e0b' });
      }
      if (d.avgFontSize !== undefined) {
        mobileMetrics.push({ value: Number(d.avgFontSize).toFixed(0) + 'px', label: t('reports.cro.mobile.averageFontSize', 'Average Font Size'), color: d.avgFontSize >= 16 ? '#10b981' : '#f59e0b' });
      }
      html += PR.renderMetrics(mobileMetrics);

      // Mobile detail table (web UI shows 3 visual circles; PDF renders a table)
      var mobileDetailRows = [];
      if (d.tapTargetCompliance !== undefined) {
        var tapOk = d.tapTargetCompliance >= 0.8;
        mobileDetailRows.push([
          '<strong>' + esc(t('reports.cro.mobile.tapTargetCompliance', 'Tap Target Compliance')) + '</strong><br><span class="pdf-text-muted pdf-text-small">' + esc(t('reports.cro.mobile.minimumSize', '44×44px minimum')) + '</span>',
          (d.tapTargetCompliance * 100).toFixed(1) + '%',
          PR.renderStatus(tapOk ? 'pass' : 'warning', tapOk ? t('reports.cro.report.mobileUx.good', 'Good') : t('reports.cro.report.mobileUx.needsImprovement', 'Needs Improvement'))
        ]);
      }
      if (d.avgFontSize !== undefined) {
        var fontOk = d.avgFontSize >= 16;
        mobileDetailRows.push([
          '<strong>' + esc(t('reports.cro.mobile.averageFontSize', 'Average Font Size')) + '</strong><br><span class="pdf-text-muted pdf-text-small">' + esc(t('reports.cro.mobile.recommended16px', '16px recommended')) + '</span>',
          Number(d.avgFontSize).toFixed(0) + 'px',
          PR.renderStatus(fontOk ? 'pass' : 'warning', fontOk ? t('reports.cro.report.mobileUx.good', 'Good') : t('reports.cro.report.mobileUx.needsImprovement', 'Needs Improvement'))
        ]);
      }
      if (d.hasViewportMeta !== undefined) {
        mobileDetailRows.push([
          '<strong>' + esc(t('reports.cro.mobile.viewportMeta', 'Viewport Meta')) + '</strong><br><span class="pdf-text-muted pdf-text-small">' + esc(t('reports.cro.mobile.responsiveScaling', 'Responsive scaling')) + '</span>',
          d.hasViewportMeta ? t('seo.report.status.set', 'Set') : t('seo.report.status.missing', 'Missing'),
          PR.renderStatus(d.hasViewportMeta ? 'pass' : 'fail', d.hasViewportMeta ? t('reports.cro.report.mobileUx.configured', 'Configured') : t('reports.cro.report.mobileUx.missing', 'Missing'))
        ]);
      }

      if (mobileDetailRows.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cro.report.mobileUx.detailsHeading', 'Mobile UX Details')) + '</h3>';
        html += PR.renderTable(
          [
            { label: t('reports.cro.report.mobileUx.metric', 'Metric'), width: '50%' },
            { label: t('reports.cro.report.mobileUx.value', 'Value'), width: '20%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          mobileDetailRows,
          { striped: true }
        );
      }

      // Mobile UX issues
      var issues = d.issues || [];
      if (issues.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.cro.report.mobileUx.issuesHeading', 'Mobile UX Issues')) + '</h3>';
        issues.slice(0, 20).forEach(function (issue) {
          var issueText = typeof issue === 'string' ? issue : (issue.message || issue.title || issue.description || '');
          var sev = typeof issue === 'object' && issue.severity ? issue.severity.toLowerCase() : 'warning';
          html += PR.renderIssue(esc(issueText), sev);
        });

        if (issues.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: issues.length - 20 }) + '</p>';
        }
      } else {
        html += PR.renderCallout(
          t('reports.cro.report.mobileUx.noIssuesTitle', 'No Mobile UX Issues'),
          t('reports.cro.report.mobileUx.noIssuesBody', 'No significant mobile UX issues were detected. Your page appears to be well-optimized for mobile conversions.'),
          'tip'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       6. Quick Wins
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-quick-wins .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cro.report.sections.quickWins', 'Quick Wins'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cro.report.sectionIntros.quickWins', 'Quick wins are high-impact, low-effort changes that can immediately improve your conversion rate. These prioritized actions offer the best return on investment for optimization efforts.')) + '</p>';

      if (quickWins.length > 0) {
        function _badgeColor(level) {
          var l = (level || '').toLowerCase();
          if (l === 'high') return '#ef4444';
          if (l === 'medium') return '#f59e0b';
          if (l === 'low') return '#3b82f6';
          if (l === 'easy') return '#10b981';
          return '#6b7280';
        }

        function _difficultyColor(diff) {
          var d = (diff || '').toLowerCase();
          if (d === 'easy') return '#10b981';
          if (d === 'medium') return '#f59e0b';
          if (d === 'hard') return '#ef4444';
          return '#6b7280';
        }

        // Render each quick win as a rich card (matches web UI createQuickWinsSection)
        quickWins.slice(0, 20).forEach(function (qw, idx) {
          var title = qw.title || t('reports.cro.quickWin', 'Quick Win');
          var impactText = qw.impact || '-';
          var timeEst = qw.timeEstimate || '';
          var difficulty = qw.difficulty || '';
          var steps = qw.steps || [];

          html += '<div class="pdf-fix-card" style="margin-bottom:12px;">';

          // Header with number and badges
          html += '<div class="pdf-fix-card__header">';
          html += '<span class="pdf-fix-card__severity pdf-fix-card__severity--low" style="background:#f59e0b;color:#fff;min-width:24px;text-align:center;">#' + (idx + 1) + '</span>';
          html += '<span class="pdf-fix-card__title">' + esc(title) + '</span>';
          if (difficulty) {
            html += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:600;color:#fff;background:' + _difficultyColor(difficulty) + ';">' + esc(difficulty) + '</span>';
          }
          html += '</div>';

          // Body
          html += '<div class="pdf-fix-card__body">';

          // Time estimate and impact line
          var metaLine = '';
          if (timeEst) {
            metaLine += '<span style="color:#10b981;font-weight:600;font-size:0.82rem;margin-right:16px;">' + esc(t('reports.cro.report.quickWins.time', 'Time')) + ': ' + esc(timeEst) + '</span>';
          }
          if (impactText) {
            metaLine += '<span style="color:#3b82f6;font-weight:600;font-size:0.82rem;">' + esc(t('reports.cro.report.quickWins.table.impact', 'Impact')) + ': ' + esc(String(impactText)) + '</span>';
          }
          if (metaLine) {
            html += '<div style="margin-bottom:8px;">' + metaLine + '</div>';
          }

          // Description if present
          if (qw.description) {
            html += '<div class="pdf-fix-card__description">' + esc(truncate(qw.description, 200)) + '</div>';
          }

          // Steps (matches web UI "How to fix" section)
          if (steps.length > 0) {
            html += '<div class="pdf-fix-card__steps">';
            html += '<div class="pdf-fix-card__steps-title">' + esc(t('reports.cro.howToFix', 'How to fix:')) + '</div>';
            steps.forEach(function (step, sIdx) {
              html += '<div class="pdf-fix-card__step">';
              html += '<span class="pdf-fix-card__step-num">' + (sIdx + 1) + '</span>';
              html += '<span>' + esc(step) + '</span>';
              html += '</div>';
            });
            html += '</div>';
          }

          html += '</div>'; // end body
          html += '</div>'; // end fix-card
        });

        if (quickWins.length > 20) {
          html += '<p class="pdf-text-muted pdf-text-small">' + t('seo.report.common.moreCount', '... {{count}} more', { count: quickWins.length - 20 }) + '</p>';
        }
      } else {
        html += PR.renderCallout(
          t('reports.cro.report.quickWins.noneTitle', 'No Quick Wins Identified'),
          t('reports.cro.report.quickWins.noneBody', 'The analysis did not identify specific quick wins. Review the detailed section recommendations for improvement opportunities.'),
          'info'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       7. Recommendations (Rich Fix Cards)
       ----------------------------------------------------------------------- */
    (function () {
      var sec = document.querySelector('#section-recommendations .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.cro.report.sections.recommendations', 'Recommendations'))),
        sec
      );

      var html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.cro.report.sectionIntros.recommendations', 'Based on the CRO analysis, these recommendations prioritize improvements with the highest potential impact on your conversion rate.')) + '</p>';

      // Build rich fix cards (mirrors buildCROFixCards from cro-script.js)
      var fixCards = _buildCROFixCards(data, t, esc);

      if (fixCards.length > 0) {
        html += '<p class="pdf-text-muted" style="margin-bottom:16px;">' +
          esc(t('reports.cro.croFixes', 'CRO Fixes')) + ' — ' +
          esc(t('reports.cro.improvementsFound', '{{count}} improvements found', { count: fixCards.length })) +
        '</p>';

        // Render each fix card with full richness
        fixCards.forEach(function (fix) {
          html += _renderFixCard(fix, t, esc);
        });
      } else if (recommendations.length > 0) {
        // Fallback: simple grouped recommendations if fix cards could not be built
        var critical = recommendations.filter(function (r) { return (r.priority || r.severity) === 'critical'; });
        var high = recommendations.filter(function (r) { return (r.priority || r.severity) === 'high'; });
        var medium = recommendations.filter(function (r) { return (r.priority || r.severity) === 'medium'; });
        var low = recommendations.filter(function (r) {
          var p = r.priority || r.severity;
          return !p || p === 'low';
        });
        var groups = [
          { items: critical, label: t('common.pdf.execSummary.critical', 'Critical'), color: '#ef4444' },
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
              '<div class="pdf-rec__text"><strong>' + esc(r.title || r.message || '') + '</strong>' +
              (r.description || r.detail ? '<br>' + esc(r.description || r.detail) : '') +
              (r.impact ? '<br><em style="color:#6b7280;">' + esc(t('reports.cro.impact', 'Impact')) + ': ' + esc(r.impact) + '</em>' : '') +
              '</div>' +
            '</div>';
          });
          html += '</div>';
        });
      } else {
        html += PR.renderCallout(
          t('reports.cro.report.recommendations.noneTitle', 'Strong CRO Posture'),
          t('reports.cro.report.recommendations.noneBody', 'Your site follows CRO best practices. Continue monitoring conversion metrics and A/B testing for further optimization.'),
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

  /* =======================================================================
     Private helpers
     ======================================================================= */

  /**
   * Render a list of issues with severity badges.
   */
  function _renderIssuesList(issues, t) {
    if (!issues || issues.length === 0) return '';
    var html = '<div class="pdf-issues" style="margin-top:12px;">';
    html += '<h4 class="pdf-subsection__title">' + (t('common.pdf.execSummary.issuesFound', 'Issues Found') || 'Issues') + '</h4>';
    issues.forEach(function (issue) {
      var text = typeof issue === 'string' ? issue : (issue.message || issue.title || '');
      var sev = typeof issue === 'object' && issue.severity ? issue.severity.toLowerCase() : 'warning';
      html += '<div class="pdf-issue pdf-issue--' + sev + '">' +
        '<span class="pdf-issue__text">' + PdfReport.helpers.esc(text) + '</span>' +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  /**
   * Render a rich fix card with severity badge, description, impact, code blocks, and steps.
   * Follows the same pattern as _renderFixCard in seo-report-render.js.
   */
  function _renderFixCard(fix, t, esc) {
    var severityLower = (fix.severity || 'medium').toLowerCase();

    var html = '<div class="pdf-fix-card">';

    // Header
    html += '<div class="pdf-fix-card__header">';
    var severityLabels = { high: t('seo.fixes.severity.high', 'High'), medium: t('seo.fixes.severity.medium', 'Medium'), low: t('seo.fixes.severity.low', 'Low'), critical: t('seo.fixes.severity.critical', 'Critical') };
    var severityLabel = severityLabels[severityLower] || fix.severity;
    html += '<span class="pdf-fix-card__severity pdf-fix-card__severity--' + severityLower + '">' + esc(severityLabel) + '</span>';
    html += '<span class="pdf-fix-card__title">' + esc(fix.title) + '</span>';
    if (fix.category) {
      html += '<span class="pdf-fix-card__category">' + esc(fix.category) + '</span>';
    }
    html += '</div>';

    // Body
    html += '<div class="pdf-fix-card__body">';

    // Description
    if (fix.description) {
      html += '<div class="pdf-fix-card__description">' + esc(fix.description) + '</div>';
    }

    // Impact callout (matches web UI "Expected Impact" green box)
    if (fix.impact) {
      html += '<div class="pdf-fix-card__impact">';
      html += '<strong>' + esc(t('reports.common.fix.expectedImpact', 'Expected Impact')) + ':</strong> ' + esc(fix.impact);
      html += '</div>';
    }

    // Code comparison grid (problematic vs fixed)
    if (fix.problematicCode || fix.snippet) {
      html += '<div class="pdf-fix-card__code-grid">';

      if (fix.problematicCode) {
        html += '<div class="pdf-fix-card__code-block">';
        html += '<div class="pdf-fix-card__code-label pdf-fix-card__code-label--bad">' +
          esc(t('reports.common.fix.currentIssue', 'Current Issue')) + '</div>';
        html += '<pre class="pdf-fix-card__code-pre">' + esc(fix.problematicCode) + '</pre>';
        html += '</div>';
      }

      if (fix.snippet) {
        html += '<div class="pdf-fix-card__code-block">';
        html += '<div class="pdf-fix-card__code-label pdf-fix-card__code-label--good">' +
          esc(t('reports.common.fix.recommendedFix', 'Recommended Fix')) + '</div>';
        html += '<pre class="pdf-fix-card__code-pre">' + esc(fix.snippet) + '</pre>';
        html += '</div>';
      }

      html += '</div>'; // end code-grid
    }

    // Step-by-step guide
    if (fix.steps && fix.steps.length > 0) {
      html += '<div class="pdf-fix-card__steps">';
      html += '<div class="pdf-fix-card__steps-title">' +
        esc(t('reports.common.fix.stepByStepFix', 'Step-by-Step Fix:')) + '</div>';
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

  /**
   * Build rich fix cards from CRO data.
   * Mirrors buildCROFixCards from cro-script.js, including:
   *   - Cards from recommendations with code, steps, category, impact
   *   - Cards from quick wins
   *   - CTA above-fold fix
   *   - Form optimization fix
   *   - Trust signal fix
   *   - Mobile UX fix
   */
  function _buildCROFixCards(data, t, esc) {
    var cards = [];
    var ctas = (data.analysis && data.analysis.ctas) || {};
    var forms = (data.analysis && data.analysis.forms) || {};
    var trust = (data.analysis && data.analysis.trustSignals) || {};
    var mobile = (data.analysis && data.analysis.mobileUX) || {};
    var recs = data.recommendations || [];
    var qwins = data.quickWins || [];

    // Build cards from recommendations
    recs.forEach(function (rec, idx) {
      var severity = (rec.priority === 'high' || rec.priority === 'critical') ? 'High'
        : rec.priority === 'medium' ? 'Medium' : 'Low';

      cards.push({
        id: 'rec-' + idx,
        title: rec.message || rec.title || t('reports.cro.fixes.optimizationOpportunity', 'Optimization Opportunity'),
        severity: severity,
        category: rec.category || _getCROCategory(rec, t),
        impact: rec.impact || t('reports.cro.fixes.improvedConversionRate', 'Improved conversion rate'),
        description: rec.detail || rec.description || t('reports.cro.fixes.applyRecommendation', 'Apply this recommendation to improve conversions.'),
        problematicCode: rec.currentCode || _generateCROProblemCode(rec, t),
        snippet: rec.fixedCode || _generateCROFixCode(rec, t),
        steps: rec.steps || _getDefaultCROSteps(rec, t)
      });
    });

    // Add quick wins as fix cards
    qwins.forEach(function (win, idx) {
      cards.push({
        id: 'qw-' + idx,
        title: win.title || t('reports.cro.quickWin', 'Quick Win'),
        severity: 'Low',
        category: t('reports.cro.quickWin', 'Quick Win'),
        impact: win.impact || t('reports.cro.fixes.quickWinImpact', '+5-15% conversions'),
        description: (win.title || '') + '. ' + t('reports.cro.estimatedTime', 'Estimated time') + ': ' + (win.timeEstimate || t('reports.cro.fiveMinutes', '5 min')),
        problematicCode: _generateQuickWinProblemCode(win, t),
        snippet: _generateQuickWinFixCode(win, t),
        steps: win.steps || []
      });
    });

    // CTA above-fold fix
    if (ctas.aboveFold === false || ctas.count === 0) {
      cards.push({
        id: 'cta-fold',
        title: t('reports.cro.fixes.ctaAboveFold', 'Add a CTA above the fold'),
        severity: 'High',
        category: t('reports.cro.categories.ctas', 'CTAs'),
        impact: t('reports.cro.fixes.ctaImpact', 'Increase conversions by 20-30%'),
        description: t('reports.cro.fixes.ctaAboveFoldDescription', 'Visitors should see a clear call-to-action without scrolling. Currently, no CTA is visible above the fold.'),
        problematicCode: '<!-- No CTA visible above the fold -->\n<div class="hero">\n  <h1>Welcome to Our Site</h1>\n  <p>Discover our amazing products...</p>\n  <!-- Missing CTA button here -->\n</div>',
        snippet: '<!-- CTA above the fold -->\n<div class="hero">\n  <h1>Welcome to Our Site</h1>\n  <p>Discover our amazing products...</p>\n  <button class="cta-primary" style="\n    padding: 1rem 2rem;\n    font-size: 1.1rem;\n    background: #ff6600;\n    color: white;\n    border: none;\n    border-radius: 8px;\n    cursor: pointer;\n  ">Get Started Free</button>\n</div>',
        steps: [
          t('reports.cro.steps.ctaFold.identifyButton', 'Identify your most important CTA button'),
          t('reports.cro.steps.ctaFold.moveVisible', 'Move it to be visible without scrolling'),
          t('reports.cro.steps.ctaFold.useContrast', 'Use contrasting colors to make it stand out')
        ]
      });
    }

    // Form optimization fix
    if (forms.count > 0 && (forms.avgFields > 5 || !forms.hasLabels)) {
      var formDesc = forms.avgFields > 5
        ? t('reports.cro.fixes.formTooManyFields', 'Forms have {{count}} fields on average. Consider reducing to 3-5 essential fields.', { count: forms.avgFields })
        : t('reports.cro.fixes.formMissingLabels', 'Forms are missing proper labels which hurts accessibility and conversions.');
      cards.push({
        id: 'form-optimize',
        title: t('reports.cro.fixes.optimizeForm', 'Optimize form for conversions'),
        severity: 'Medium',
        category: t('reports.cro.categories.forms', 'Forms'),
        impact: t('reports.cro.fixes.formImpact', 'Reduce form abandonment by 15-25%'),
        description: formDesc,
        problematicCode: '<!-- Current form structure -->\n<form>\n  <input type="text" placeholder="Name">\n  <input type="email" placeholder="Email">\n  <input type="tel" placeholder="Phone">\n  <input type="text" placeholder="Company">\n  <input type="text" placeholder="Job Title">\n  <textarea placeholder="Message"></textarea>\n  <!-- Too many fields, missing labels -->\n</form>',
        snippet: '<!-- Optimized form -->\n<form>\n  <label for="name">Name *</label>\n  <input id="name" type="text" required>\n  \n  <label for="email">Email *</label>\n  <input id="email" type="email" required>\n  \n  <label for="message">How can we help?</label>\n  <textarea id="message"></textarea>\n  \n  <button type="submit" class="cta-primary">\n    Send Message\n  </button>\n</form>',
        steps: [
          t('reports.cro.steps.formOptimize.reduceFields', 'Reduce form fields to 3-5 essential ones'),
          t('reports.cro.steps.formOptimize.addLabels', 'Add visible labels above each field'),
          t('reports.cro.steps.formOptimize.markRequired', 'Mark required fields clearly'),
          t('reports.cro.steps.formOptimize.useCompellingText', 'Use a compelling submit button text')
        ]
      });
    }

    // Trust signal fix
    if (!trust.hasSecurityBadges && !trust.hasTestimonials) {
      cards.push({
        id: 'trust-signals',
        title: t('reports.cro.fixes.addTrustSignals', 'Add trust signals'),
        severity: 'Medium',
        category: t('reports.cro.categories.trustSignals', 'Trust Signals'),
        impact: t('reports.cro.fixes.trustImpact', 'Increase trust and conversions by 10-20%'),
        description: t('reports.cro.fixes.trustDescription', 'No security badges or testimonials detected. Adding trust elements can significantly boost conversions.'),
        problematicCode: '<!-- Checkout section without trust signals -->\n<div class="checkout">\n  <h2>Complete Your Order</h2>\n  <form>\n    <input type="text" placeholder="Card Number">\n    <button type="submit">Pay Now</button>\n  </form>\n  <!-- Missing trust signals -->\n</div>',
        snippet: '<!-- Checkout with trust signals -->\n<div class="checkout">\n  <h2>Complete Your Order</h2>\n  \n  <!-- Security badges -->\n  <div class="trust-badges" style="display: flex; gap: 1rem; margin: 1rem 0;">\n    <img src="/icons/ssl-secure.svg" alt="SSL Secured">\n    <img src="/icons/money-back.svg" alt="30-Day Money Back">\n    <img src="/icons/trusted.svg" alt="Trusted by 10,000+">\n  </div>\n  \n  <form>\n    <input type="text" placeholder="Card Number">\n    <button type="submit">Pay Now - Secure Checkout</button>\n  </form>\n  \n  <!-- Testimonial -->\n  <blockquote class="testimonial">\n    "Great product, fast shipping!" - John D.\n  </blockquote>\n</div>',
        steps: [
          t('reports.cro.steps.trustSignals.addBadges', 'Add security badges near payment forms'),
          t('reports.cro.steps.trustSignals.includeTestimonials', 'Include customer testimonials or reviews'),
          t('reports.cro.steps.trustSignals.displayCertifications', 'Display any certifications or partner logos'),
          t('reports.cro.steps.trustSignals.useSecureLanguage', 'Use "Secure Checkout" language on buttons')
        ]
      });
    }

    // Mobile UX fix
    if (mobile.score && mobile.score < 70) {
      cards.push({
        id: 'mobile-ux',
        title: t('reports.cro.fixes.improveMobile', 'Improve mobile experience'),
        severity: 'High',
        category: t('reports.cro.categories.mobileExperience', 'Mobile Experience'),
        impact: t('reports.cro.fixes.mobileImpact', 'Mobile users make up 60%+ of traffic'),
        description: t('reports.cro.fixes.mobileDescription', 'Mobile UX score is {{score}}/100. Improving mobile experience is critical for conversions.', { score: mobile.score }),
        problematicCode: '<!-- Mobile issues -->\n<style>\n  body { font-size: 14px; } /* Too small */\n  .btn { padding: 8px; }    /* Tap target too small */\n  .form input { width: 100%; }\n</style>',
        snippet: '<!-- Mobile-optimized -->\n<style>\n  body { \n    font-size: 16px; /* Readable on mobile */\n  }\n  .btn { \n    padding: 14px 24px;\n    min-height: 44px; /* Minimum tap target */\n  }\n  .form input { \n    width: 100%;\n    font-size: 16px; /* Prevents zoom on iOS */\n    padding: 12px;\n  }\n</style>',
        steps: [
          t('reports.cro.steps.mobileUx.increaseFontSize', 'Increase base font size to 16px minimum'),
          t('reports.cro.steps.mobileUx.makeButtonsLarger', 'Make buttons at least 44x44px'),
          t('reports.cro.steps.mobileUx.ensureInputFontSize', 'Ensure form inputs are at least 16px font'),
          t('reports.cro.steps.mobileUx.testDevices', 'Test on actual mobile devices')
        ]
      });
    }

    // Sort: High first, then Medium, then Low
    var severityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
    cards.sort(function (a, b) {
      return (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
    });

    return cards;
  }

  /**
   * Determine the CRO category from a recommendation.
   */
  function _getCROCategory(rec, t) {
    var msg = (rec.message || rec.title || '').toLowerCase();
    if (msg.indexOf('cta') >= 0 || msg.indexOf('button') >= 0 || msg.indexOf('click') >= 0) return t('reports.cro.categories.ctas', 'CTAs');
    if (msg.indexOf('form') >= 0 || msg.indexOf('input') >= 0 || msg.indexOf('field') >= 0) return t('reports.cro.categories.forms', 'Forms');
    if (msg.indexOf('trust') >= 0 || msg.indexOf('security') >= 0 || msg.indexOf('badge') >= 0) return t('reports.cro.categories.trustSignals', 'Trust Signals');
    if (msg.indexOf('mobile') >= 0 || msg.indexOf('responsive') >= 0 || msg.indexOf('touch') >= 0 || msg.indexOf('tap') >= 0) return t('reports.cro.categories.mobileExperience', 'Mobile Experience');
    return t('reports.cro.categories.croOptimization', 'CRO Optimization');
  }

  /**
   * Generate problem code snippet for a recommendation.
   */
  function _generateCROProblemCode(rec, t) {
    var title = (rec.message || rec.title || '').toLowerCase();

    if (title.indexOf('mobile') >= 0 || title.indexOf('tap') >= 0 || title.indexOf('touch') >= 0) {
      return '/* Mobile Experience Issues */\n\n/* Problem: Small tap targets */\n.button {\n  padding: 6px 12px;      /* Too small for touch */\n  font-size: 12px;        /* Hard to read on mobile */\n}\n\n/* Problem: Text too small */\nbody {\n  font-size: 14px;        /* Below 16px causes zoom on iOS */\n}';
    }

    if (title.indexOf('cta') >= 0 || title.indexOf('button') >= 0 || title.indexOf('fold') >= 0) {
      return '<!-- CTA Issues -->\n\n<!-- Problem: Weak call-to-action -->\n<button class="btn">Submit</button>\n\n<!-- Problem: CTA below the fold -->\n<div class="hero">\n  <h1>Welcome</h1>\n  <!-- No CTA visible without scrolling -->\n</div>';
    }

    if (title.indexOf('form') >= 0 || title.indexOf('input') >= 0 || title.indexOf('field') >= 0 || title.indexOf('label') >= 0) {
      return '<!-- Form Issues -->\n\n<!-- Problem: Missing labels -->\n<input type="email" placeholder="Email">\n\n<!-- Problem: Too many fields -->\n<form>\n  <input placeholder="First Name">\n  <input placeholder="Last Name">\n  <input placeholder="Email">\n  <input placeholder="Phone">\n  <input placeholder="Company">\n  <!-- 5+ fields = high abandonment -->\n</form>';
    }

    if (title.indexOf('trust') >= 0 || title.indexOf('security') >= 0 || title.indexOf('testimonial') >= 0 || title.indexOf('review') >= 0) {
      return '<!-- Trust Signal Issues -->\n\n<!-- Problem: No security indicators -->\n<form class="payment-form">\n  <input type="text" placeholder="Card Number">\n  <button>Pay $99</button>\n  <!-- No SSL badge, no guarantees shown -->\n</form>';
    }

    if (title.indexOf('font') >= 0 || title.indexOf('readability') >= 0 || title.indexOf('text') >= 0 || title.indexOf('size') >= 0) {
      return '/* Readability Issues */\n\nbody {\n  font-size: 14px;        /* Too small on mobile */\n  line-height: 1.2;       /* Too tight */\n}\n\n.paragraph {\n  max-width: none;        /* Lines too long */\n  color: #999;            /* Low contrast */\n}';
    }

    var detail = rec.detail || '';
    return '<!-- Current Implementation -->\n<!-- Issue: ' + (rec.message || rec.title || 'Needs optimization') + ' -->\n' +
      (detail ? '<!-- Details: ' + detail + ' -->\n' : '') +
      '\n<!-- This affects conversion rates by making it harder\n     for users to complete their goals on the page. -->';
  }

  /**
   * Generate fix code snippet for a recommendation.
   */
  function _generateCROFixCode(rec, t) {
    var title = (rec.message || rec.title || '').toLowerCase();

    if (title.indexOf('mobile') >= 0 || title.indexOf('tap') >= 0 || title.indexOf('touch') >= 0) {
      return '/* Mobile-Optimized CSS */\n\n.button, .cta, a.nav-link {\n  min-height: 44px;       /* Apple HIG minimum */\n  min-width: 44px;\n  padding: 12px 24px;\n  font-size: 16px;\n}\n\nbody {\n  font-size: 16px;        /* Prevents iOS zoom */\n  line-height: 1.5;\n}\n\n@media (max-width: 768px) {\n  .container { padding: 16px; }\n  .button { width: 100%; }\n}';
    }

    if (title.indexOf('cta') >= 0 || title.indexOf('button') >= 0 || title.indexOf('fold') >= 0) {
      return '<!-- Optimized CTA -->\n\n<button class="cta-primary" style="\n  background: linear-gradient(135deg, #ff6b00, #ff8533);\n  color: white;\n  padding: 16px 32px;\n  font-size: 18px;\n  font-weight: 600;\n  border: none;\n  border-radius: 8px;\n  cursor: pointer;\n">\n  Get Started Free\n</button>\n\n<div class="hero">\n  <h1>Transform Your Business Today</h1>\n  <p>Join 10,000+ companies already growing</p>\n  <button class="cta-primary">Start Free Trial</button>\n</div>';
    }

    if (title.indexOf('form') >= 0 || title.indexOf('input') >= 0 || title.indexOf('field') >= 0 || title.indexOf('label') >= 0) {
      return '<!-- Optimized Form -->\n\n<form class="conversion-form">\n  <div class="form-group">\n    <label for="email">Email Address *</label>\n    <input id="email" type="email" required\n      placeholder="you@company.com"\n      style="width:100%;padding:12px 16px;font-size:16px;\n        border:2px solid #e0e0e0;border-radius:8px;">\n  </div>\n  <div class="form-group">\n    <label for="name">Full Name *</label>\n    <input id="name" type="text" required>\n  </div>\n  <button type="submit" class="cta-primary">\n    Get Your Free Quote\n  </button>\n</form>';
    }

    if (title.indexOf('trust') >= 0 || title.indexOf('security') >= 0 || title.indexOf('testimonial') >= 0 || title.indexOf('review') >= 0) {
      return '<!-- Trust Signals Implementation -->\n\n<div class="trust-badges" style="display:flex;gap:16px;align-items:center;margin:16px 0;">\n  <img src="/badges/ssl-secure.svg" alt="SSL Secured" width="80">\n  <img src="/badges/money-back.svg" alt="30-Day Guarantee" width="80">\n  <span style="color:#666;font-size:14px;">256-bit SSL Encryption</span>\n</div>\n\n<blockquote class="testimonial" style="background:#f8f9fa;border-left:4px solid #00c853;padding:20px;">\n  <p style="font-style:italic;">\"This product increased our conversions by 40%!\"</p>\n  <cite>-- Sarah J., Marketing Director</cite>\n</blockquote>';
    }

    if (title.indexOf('font') >= 0 || title.indexOf('readability') >= 0 || title.indexOf('text') >= 0 || title.indexOf('size') >= 0) {
      return '/* Readability Optimizations */\n\nbody {\n  font-size: 16px;        /* Mobile-friendly base */\n  line-height: 1.6;       /* Comfortable reading */\n  color: #333;            /* High contrast */\n}\n\n.paragraph, .content p {\n  max-width: 65ch;        /* Optimal line length */\n  margin-bottom: 1.5em;\n}\n\n@media (max-width: 768px) {\n  body { font-size: 17px; }\n}';
    }

    return '<!-- Recommended Implementation -->\n\n<section class="optimized-section">\n  <h2>Clear Headline</h2>\n  <p>Supporting text that explains the value.</p>\n  <button class="cta-primary">Take Action</button>\n</section>\n\n<style>\n  .cta-primary {\n    padding: 14px 28px;\n    font-size: 16px;\n    font-weight: 600;\n    background: #0066ff;\n    color: white;\n    border-radius: 8px;\n  }\n</style>';
  }

  /**
   * Get default step-by-step fix instructions for a recommendation.
   */
  function _getDefaultCROSteps(rec, t) {
    var title = (rec.message || rec.title || '').toLowerCase();

    if (title.indexOf('mobile') >= 0 || title.indexOf('tap') >= 0 || title.indexOf('touch') >= 0) {
      return [
        t('reports.cro.steps.mobile.findButtonStyles', 'Open your CSS and find button/link styles'),
        t('reports.cro.steps.mobile.setMinSize', 'Set min-height: 44px and min-width: 44px on all interactive elements'),
        t('reports.cro.steps.mobile.addPadding', 'Add padding: 12px 24px to buttons for comfortable touch'),
        t('reports.cro.steps.mobile.setFontSize', 'Set body font-size to 16px to prevent iOS zoom on inputs'),
        t('reports.cro.steps.mobile.useDevTools', 'Use Chrome DevTools mobile emulation to test (F12 → Toggle Device)'),
        t('reports.cro.steps.mobile.testDevices', 'Test on actual iOS and Android devices before deploying')
      ];
    }

    if (title.indexOf('cta') >= 0 || title.indexOf('button') >= 0 || title.indexOf('fold') >= 0 || title.indexOf('call-to-action') >= 0) {
      return [
        t('reports.cro.steps.cta.identifyAction', 'Identify the primary action you want visitors to take'),
        t('reports.cro.steps.cta.placeProminent', 'Place a prominent CTA button in the hero section (above the fold)'),
        t('reports.cro.steps.cta.useActionText', 'Use action-oriented text: "Get Started", "Try Free", "Book Now"'),
        t('reports.cro.steps.cta.applyContrast', 'Apply high-contrast colors (e.g., orange or green on dark backgrounds)'),
        t('reports.cro.steps.cta.addVisualWeight', 'Add visual weight with padding, shadows, or borders'),
        t('reports.cro.steps.cta.testMobile', 'Test button visibility on mobile without scrolling')
      ];
    }

    if (title.indexOf('form') >= 0 || title.indexOf('input') >= 0 || title.indexOf('field') >= 0 || title.indexOf('label') >= 0) {
      return [
        t('reports.cro.steps.form.reduceFields', 'Reduce form fields to 3-5 essential ones (name, email, message)'),
        t('reports.cro.steps.form.addLabels', 'Add visible <label> elements above each input field'),
        t('reports.cro.steps.form.markRequired', 'Mark required fields with * and aria-required="true"'),
        t('reports.cro.steps.form.usePlaceholders', 'Use descriptive placeholders like "you@company.com"'),
        t('reports.cro.steps.form.addErrorMessages', 'Add helpful error messages that explain how to fix issues'),
        t('reports.cro.steps.form.includeTrustMessage', 'Include a trust message near the submit button ("Your info is safe")')
      ];
    }

    if (title.indexOf('trust') >= 0 || title.indexOf('security') >= 0 || title.indexOf('testimonial') >= 0 || title.indexOf('review') >= 0 || title.indexOf('badge') >= 0) {
      return [
        t('reports.cro.steps.trust.addSecurityBadges', 'Add SSL/security badges near payment forms and checkout buttons'),
        t('reports.cro.steps.trust.displayTestimonials', 'Display customer testimonials with real names and photos'),
        t('reports.cro.steps.trust.showRatings', 'Show star ratings or review counts (e.g., "4.9/5 from 2,000+ reviews")'),
        t('reports.cro.steps.trust.includeGuarantee', 'Include money-back guarantee or free trial messaging'),
        t('reports.cro.steps.trust.addLogos', 'Add logos of trusted partners, certifications, or media mentions'),
        t('reports.cro.steps.trust.placeNearConversion', 'Place trust signals near conversion points, not just in the footer')
      ];
    }

    if (title.indexOf('font') >= 0 || title.indexOf('text') >= 0 || title.indexOf('readability') >= 0 || title.indexOf('size') >= 0) {
      return [
        t('reports.cro.steps.font.setBaseFontSize', 'Set base body font-size to 16px (minimum for mobile)'),
        t('reports.cro.steps.font.useLineHeight', 'Use line-height: 1.5 to 1.6 for comfortable reading'),
        t('reports.cro.steps.font.limitWidth', 'Limit paragraph width to 65-75 characters with max-width'),
        t('reports.cro.steps.font.ensureContrast', 'Ensure color contrast ratio is at least 4.5:1 (use WebAIM checker)'),
        t('reports.cro.steps.font.testMobile', 'Test on mobile devices to verify readability')
      ];
    }

    // Generic fallback
    return [
      t('reports.cro.steps.generic.reviewImplementation', 'Review the current implementation in your browser DevTools'),
      t('reports.cro.steps.generic.identifyElement', 'Identify the specific element or section that needs improvement'),
      t('reports.cro.steps.generic.applyChanges', 'Apply the recommended code changes from the Code tab'),
      t('reports.cro.steps.generic.testChanges', 'Test the changes on desktop and mobile devices'),
      t('reports.cro.steps.generic.monitorMetrics', 'Monitor conversion metrics after deployment')
    ];
  }

  /**
   * Generate problem code for a quick win.
   */
  function _generateQuickWinProblemCode(win, t) {
    var title = (win.title || '').toLowerCase();

    if (title.indexOf('cta') >= 0 || title.indexOf('fold') >= 0) {
      return '<!-- Quick Win: CTA Placement -->\n<!-- Current: CTA is below the fold -->\n<div class="hero">\n  <h1>Welcome to Our Site</h1>\n  <p>Long intro text...</p>\n</div>\n<!-- CTA appears only after scrolling -->';
    }

    if (title.indexOf('font') >= 0 || title.indexOf('size') >= 0) {
      return '/* Quick Win: Font Size */\nbody {\n  font-size: 14px;  /* Too small for mobile */\n}';
    }

    if (title.indexOf('button') >= 0 || title.indexOf('tap') >= 0) {
      return '/* Quick Win: Button Size */\n.button {\n  padding: 8px 12px;  /* Tap target too small */\n  font-size: 12px;\n}';
    }

    return '<!-- Quick Win: ' + (win.title || '') + ' -->\n<!-- Current state needs optimization -->\n<!-- Estimated fix time: ' + (win.timeEstimate || '5 minutes') + ' -->';
  }

  /**
   * Generate fix code for a quick win.
   */
  function _generateQuickWinFixCode(win, t) {
    var title = (win.title || '').toLowerCase();

    if (title.indexOf('cta') >= 0 || title.indexOf('fold') >= 0) {
      return '<!-- Quick Win: CTA Above Fold -->\n<div class="hero">\n  <h1>Welcome to Our Site</h1>\n  <p>Brief, compelling intro</p>\n  <button class="cta-primary">Get Started</button>\n</div>';
    }

    if (title.indexOf('font') >= 0 || title.indexOf('size') >= 0) {
      return '/* Quick Win: Readable Font */\nbody {\n  font-size: 16px;  /* Readable, prevents zoom */\n  line-height: 1.5;\n}';
    }

    if (title.indexOf('button') >= 0 || title.indexOf('tap') >= 0) {
      return '/* Quick Win: Touch-Friendly Buttons */\n.button {\n  min-height: 44px;\n  padding: 12px 24px;\n  font-size: 16px;\n}';
    }

    return '<!-- Quick Win: ' + (win.title || '') + ' -->\n<!-- Apply the recommended change -->';
  }

})(window);
