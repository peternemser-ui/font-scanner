/**
 * IP Reputation Report — PDF Renderer
 * Renders all IP reputation analysis sections into the PDF template.
 */
(function (window) {
  'use strict';

  if (!window.PdfReport) {
    console.error('[ip-reputation-report-render] PdfReport not loaded');
    return;
  }

  const PR = window.PdfReport;

  PdfReport.register('ip-reputation', function renderIPReputation(data, utils) {
    const t = utils.t;
    const esc = utils.esc;
    const truncate = utils.truncate;
    const scoreClass = utils.scoreClass;

    let sectionIndex = 1;

    const reputation = data.reputation || {};
    const security = data.security || {};
    const infrastructure = data.infrastructure || {};
    const recommendations = data.recommendations || [];

    /* -----------------------------------------------------------------------
       1. IP Reputation
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-reputation .pdf-section__content');
      const score = reputation.trustScore;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.ipReputation.report.reputation', 'IP Reputation'), score)),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.ipReputation.report.sectionIntros.reputation', 'IP reputation reflects how trusted your server\'s IP address is across the internet. This section evaluates trust scores, spam likelihood, malware association, and blacklist status. A poor IP reputation can cause email deliverability issues, search engine penalties, and may indicate shared hosting with malicious neighbors.')) + '</p>';

      // Metrics cards for trust/spam/malware/phishing scores
      html += PR.renderMetrics([
        { value: reputation.trustScore !== undefined ? reputation.trustScore : '-', label: t('reports.ipReputation.report.reputation.trustScore', 'Trust Score'), color: reputation.trustScore >= 70 ? '#10b981' : reputation.trustScore >= 40 ? '#f59e0b' : '#ef4444' },
        { value: reputation.spamScore !== undefined ? reputation.spamScore : '-', label: t('reports.ipReputation.report.reputation.spamScore', 'Spam Score'), color: (reputation.spamScore || 0) > 30 ? '#ef4444' : '#10b981' },
        { value: reputation.malwareScore !== undefined ? reputation.malwareScore : '-', label: t('reports.ipReputation.report.reputation.malwareScore', 'Malware Score'), color: (reputation.malwareScore || 0) > 30 ? '#ef4444' : '#10b981' },
        { value: reputation.phishingScore !== undefined ? reputation.phishingScore : '-', label: t('reports.ipReputation.report.reputation.phishingScore', 'Phishing Score'), color: (reputation.phishingScore || 0) > 30 ? '#ef4444' : '#10b981' }
      ]);

      // Blacklist status table
      const blacklistData = reputation.blacklistStatus || {};
      const blacklistEntries = Array.isArray(blacklistData) ? blacklistData : Object.keys(blacklistData).map(function (key) {
        return { name: key, listed: blacklistData[key] };
      });

      if (blacklistEntries.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.ipReputation.report.reputation.blacklistHeading', 'Blacklist Status')) + '</h3>';

        const listedCount = blacklistEntries.filter(function (b) { return b.listed; }).length;
        if (listedCount === 0) {
          html += PR.renderCallout(
            t('reports.ipReputation.report.reputation.blacklistCleanTitle', 'Clean Blacklist Status'),
            t('reports.ipReputation.report.reputation.blacklistCleanBody', 'This IP is not listed on any of the checked blacklists.'),
            'tip'
          );
        }

        const blRows = blacklistEntries.slice(0, 25).map(function (b) {
          return [
            '<strong>' + esc(b.name || '-') + '</strong>',
            b.listed
              ? PR.renderStatus('fail', t('reports.ipReputation.report.reputation.listed', 'Listed'))
              : PR.renderStatus('pass', t('reports.ipReputation.report.reputation.clean', 'Clean'))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.ipReputation.report.reputation.table.blacklist', 'Blacklist'), width: '55%' },
            { label: t('seo.report.table.status', 'Status'), width: '35%' }
          ],
          blRows,
          { striped: true }
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       2. Security Assessment
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-security .pdf-section__content');
      const ssl = security.sslCertificate || {};
      const score = ssl.valid ? 100 : 0;

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.ipReputation.report.security', 'Security Assessment'), score)),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.ipReputation.report.sectionIntros.security', 'This security assessment examines your server\'s SSL/TLS configuration, DNS security, and email authentication setup. Proper security configuration protects your visitors and builds trust with search engines and email providers.')) + '</p>';

      // SSL Certificate details table
      if (Object.keys(ssl).length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.ipReputation.report.security.sslHeading', 'SSL/TLS Certificate')) + '</h3>';

        const sslRows = [];
        sslRows.push([
          esc(t('reports.ipReputation.report.security.rows.status', 'Certificate Status')),
          ssl.valid ? PR.renderStatus('pass', t('reports.ipReputation.report.security.valid', 'Valid')) : PR.renderStatus('fail', t('reports.ipReputation.report.security.invalid', 'Invalid'))
        ]);
        sslRows.push([
          esc(t('reports.ipReputation.report.security.rows.issuer', 'Issuer')),
          esc(ssl.issuer || '-')
        ]);
        sslRows.push([
          esc(t('reports.ipReputation.report.security.rows.protocol', 'Protocol')),
          esc(ssl.protocol || '-')
        ]);
        sslRows.push([
          esc(t('reports.ipReputation.report.security.rows.validFrom', 'Valid From')),
          esc(ssl.validFrom || '-')
        ]);
        sslRows.push([
          esc(t('reports.ipReputation.report.security.rows.expiry', 'Expiry')),
          esc(ssl.expiry || ssl.validUntil || '-')
        ]);
        if (ssl.daysRemaining !== undefined && ssl.daysRemaining !== null) {
          sslRows.push([
            esc(t('reports.ipReputation.report.security.rows.daysRemaining', 'Days Remaining')),
            '<span style="color:' + (ssl.daysRemaining > 30 ? '#10b981' : ssl.daysRemaining > 7 ? '#f59e0b' : '#ef4444') + ';font-weight:600;">' + ssl.daysRemaining + '</span>'
          ]);
        }
        if (ssl.subject) {
          sslRows.push([
            esc(t('reports.ipReputation.report.security.rows.subject', 'Subject')),
            esc(ssl.subject)
          ]);
        }

        html += PR.renderTable(
          [
            { label: t('seo.report.table.property', 'Property'), width: '35%' },
            { label: t('seo.report.table.value', 'Value'), width: '65%' }
          ],
          sslRows,
          { striped: true }
        );

        // SSL metrics
        html += PR.renderMetrics([
          { value: ssl.valid ? t('reports.ipReputation.report.security.valid', 'Valid') : t('reports.ipReputation.report.security.invalid', 'Invalid'), label: t('reports.ipReputation.report.security.rows.status', 'Certificate Status'), color: ssl.valid ? '#10b981' : '#ef4444' },
          { value: ssl.protocol || '-', label: t('reports.ipReputation.report.security.rows.protocol', 'Protocol') },
          { value: ssl.daysRemaining !== undefined && ssl.daysRemaining !== null ? ssl.daysRemaining : '-', label: t('reports.ipReputation.report.security.rows.daysRemaining', 'Days Remaining') }
        ]);
      } else {
        html += PR.renderCallout(
          t('reports.ipReputation.report.security.noSslTitle', 'No SSL Certificate'),
          t('reports.ipReputation.report.security.noSslBody', 'No SSL/TLS certificate was detected for this target.'),
          'warning'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       3. Infrastructure
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-infrastructure .pdf-section__content');

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.ipReputation.report.infrastructure', 'Infrastructure'))),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.ipReputation.report.sectionIntros.infrastructure', 'Infrastructure analysis reveals details about your server\'s hosting environment, network configuration, and technical setup. Understanding your infrastructure helps identify potential single points of failure and optimization opportunities.')) + '</p>';

      if (Object.keys(infrastructure).length > 0) {
        // Build metrics from available infrastructure data
        const infraMetrics = [];
        if (infrastructure.server) {
          infraMetrics.push({ value: esc(truncate(infrastructure.server, 20)), label: t('reports.ipReputation.report.infrastructure.server', 'Server') });
        }
        if (infrastructure.hosting || infrastructure.provider) {
          infraMetrics.push({ value: esc(truncate(infrastructure.hosting || infrastructure.provider, 20)), label: t('reports.ipReputation.report.infrastructure.hosting', 'Hosting') });
        }
        if (infrastructure.country || infrastructure.location) {
          infraMetrics.push({ value: esc(truncate(infrastructure.country || infrastructure.location, 20)), label: t('reports.ipReputation.report.infrastructure.location', 'Location') });
        }
        if (infrastructure.asn) {
          infraMetrics.push({ value: esc(truncate(String(infrastructure.asn), 20)), label: t('reports.ipReputation.report.infrastructure.asn', 'ASN') });
        }

        if (infraMetrics.length > 0) {
          html += PR.renderMetrics(infraMetrics);
        }

        // Infrastructure details table
        const infraRows = [];
        const fields = [
          { key: 'ip', label: t('reports.ipReputation.report.infrastructure.rows.ip', 'IP Address') },
          { key: 'hostname', label: t('reports.ipReputation.report.infrastructure.rows.hostname', 'Hostname') },
          { key: 'server', label: t('reports.ipReputation.report.infrastructure.rows.server', 'Server Software') },
          { key: 'os', label: t('reports.ipReputation.report.infrastructure.rows.os', 'Operating System') },
          { key: 'hosting', label: t('reports.ipReputation.report.infrastructure.rows.hosting', 'Hosting Provider') },
          { key: 'provider', label: t('reports.ipReputation.report.infrastructure.rows.provider', 'Provider') },
          { key: 'country', label: t('reports.ipReputation.report.infrastructure.rows.country', 'Country') },
          { key: 'city', label: t('reports.ipReputation.report.infrastructure.rows.city', 'City') },
          { key: 'location', label: t('reports.ipReputation.report.infrastructure.rows.location', 'Location') },
          { key: 'asn', label: t('reports.ipReputation.report.infrastructure.rows.asn', 'ASN') },
          { key: 'org', label: t('reports.ipReputation.report.infrastructure.rows.org', 'Organization') },
          { key: 'cdn', label: t('reports.ipReputation.report.infrastructure.rows.cdn', 'CDN') },
          { key: 'reverseIp', label: t('reports.ipReputation.report.infrastructure.rows.reverseIp', 'Reverse DNS') }
        ];

        fields.forEach(function (f) {
          if (infrastructure[f.key] !== undefined && infrastructure[f.key] !== null && infrastructure[f.key] !== '') {
            infraRows.push([
              esc(f.label),
              esc(truncate(String(infrastructure[f.key]), 80))
            ]);
          }
        });

        if (infraRows.length > 0) {
          html += '<h3 class="pdf-subsection__title">' + esc(t('reports.ipReputation.report.infrastructure.detailsHeading', 'Infrastructure Details')) + '</h3>';
          html += PR.renderTable(
            [
              { label: t('seo.report.table.property', 'Property'), width: '35%' },
              { label: t('seo.report.table.value', 'Value'), width: '65%' }
            ],
            infraRows,
            { striped: true }
          );
        }
      } else {
        html += PR.renderCallout(
          t('reports.ipReputation.report.infrastructure.noDataTitle', 'No Infrastructure Data'),
          t('reports.ipReputation.report.infrastructure.noDataBody', 'Infrastructure information could not be determined for this target.'),
          'warning'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       4. DNS & Email
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-dns .pdf-section__content');
      const mxRecords = security.mxRecords || [];
      const dnsSecurity = security.dnsSecurity || {};

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.ipReputation.report.dns', 'DNS & Email'))),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.ipReputation.report.sectionIntros.dns', 'DNS and email configuration are critical for both deliverability and security. This section examines your MX records, DNSSEC status, and email authentication mechanisms (SPF, DKIM, DMARC). Proper configuration prevents email spoofing and improves deliverability.')) + '</p>';

      // DNSSEC status
      if (Object.keys(dnsSecurity).length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.ipReputation.report.dns.dnssecHeading', 'DNSSEC')) + '</h3>';
        html += '<div style="margin:8px 0;">' +
          PR.renderStatus(
            dnsSecurity.enabled ? 'pass' : 'fail',
            dnsSecurity.enabled
              ? t('reports.ipReputation.report.dns.dnssecEnabled', 'DNSSEC Enabled')
              : t('reports.ipReputation.report.dns.dnssecDisabled', 'DNSSEC Not Enabled')
          ) +
        '</div>';

        if (dnsSecurity.details) {
          html += '<p class="pdf-text-muted pdf-text-small">' + esc(dnsSecurity.details) + '</p>';
        }
      }

      // MX Records table
      if (mxRecords.length > 0) {
        html += '<h3 class="pdf-subsection__title">' + esc(t('reports.ipReputation.report.dns.mxHeading', 'MX Records')) + '</h3>';

        const mxRows = mxRecords.slice(0, 20).map(function (mx) {
          const host = typeof mx === 'string' ? mx : (mx.exchange || mx.host || mx.value || '-');
          const priority = typeof mx === 'string' ? '-' : (mx.priority !== undefined ? String(mx.priority) : '-');
          return [
            esc(priority),
            '<span class="pdf-table__truncate">' + esc(truncate(host, 60)) + '</span>'
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.ipReputation.report.dns.table.priority', 'Priority'), width: '20%' },
            { label: t('reports.ipReputation.report.dns.table.mailServer', 'Mail Server'), width: '70%' }
          ],
          mxRows,
          { striped: true }
        );
      } else {
        html += PR.renderCallout(
          t('reports.ipReputation.report.dns.noMxTitle', 'No MX Records'),
          t('reports.ipReputation.report.dns.noMxBody', 'No MX records were found for this domain. Email delivery may not be configured.'),
          'warning'
        );
      }

      sec.innerHTML = html;
    })();

    /* -----------------------------------------------------------------------
       5. Open Ports
       ----------------------------------------------------------------------- */
    (function () {
      const sec = document.querySelector('#section-ports .pdf-section__content');
      const openPorts = security.openPorts || [];

      sec.parentElement.insertBefore(
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.ipReputation.report.ports', 'Open Ports'))),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.ipReputation.report.sectionIntros.ports', 'Open port analysis identifies network services exposed on your server. Unnecessary open ports increase your attack surface and may indicate misconfigured services. This section lists detected open ports and their associated services.')) + '</p>';

      if (openPorts.length > 0) {
        // Metrics
        html += PR.renderMetrics([
          { value: openPorts.length, label: t('reports.ipReputation.report.ports.totalOpen', 'Open Ports'), color: openPorts.length > 10 ? '#ef4444' : openPorts.length > 5 ? '#f59e0b' : '#10b981' }
        ]);

        // Ports table
        const portRows = openPorts.slice(0, 30).map(function (p) {
          const port = typeof p === 'number' ? p : (p.port || '-');
          const service = typeof p === 'number' ? '-' : (p.service || '-');
          const status = typeof p === 'number' ? 'open' : (p.status || 'open');
          return [
            '<strong>' + esc(String(port)) + '</strong>',
            esc(service),
            PR.renderStatus(status === 'open' ? 'found' : 'pass', esc(status))
          ];
        });

        html += PR.renderTable(
          [
            { label: t('reports.ipReputation.report.ports.table.port', 'Port'), width: '20%' },
            { label: t('reports.ipReputation.report.ports.table.service', 'Service'), width: '40%' },
            { label: t('seo.report.table.status', 'Status'), width: '30%' }
          ],
          portRows,
          { striped: true }
        );
      } else {
        html += PR.renderCallout(
          t('reports.ipReputation.report.ports.noneTitle', 'No Open Ports Detected'),
          t('reports.ipReputation.report.ports.noneBody', 'No open ports were found during the scan, or port scanning was not performed.'),
          'tip'
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
        _htmlToNode(PR.renderSectionHeader(sectionIndex++, t('reports.ipReputation.report.recommendations', 'Recommendations'))),
        sec
      );

      let html = '';

      html += '<p class="pdf-section__intro">' + esc(t('reports.ipReputation.report.sectionIntros.recommendations', 'Based on the IP reputation and security analysis, these recommendations prioritize improvements for your server\'s trustworthiness, security posture, and email deliverability.')) + '</p>';

      if (recommendations.length > 0) {
        // Group by priority/severity
        const critical = recommendations.filter(function (r) { return (r.priority || r.severity) === 'critical'; });
        const high = recommendations.filter(function (r) { return (r.priority || r.severity) === 'high'; });
        const medium = recommendations.filter(function (r) { return (r.priority || r.severity) === 'medium'; });
        const low = recommendations.filter(function (r) { const p = r.priority || r.severity; return !p || p === 'low'; });
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
          t('reports.ipReputation.report.recommendations.noneTitle', 'Good Reputation Standing'),
          t('reports.ipReputation.report.recommendations.noneBody', 'Your IP has a clean reputation. Continue monitoring for changes and maintain security best practices.'),
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

  function _htmlToNode(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.firstChild;
  }

})(window);
