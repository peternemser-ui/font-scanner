/* Site Mechanic - FAQ Page */

(function() {
  const faqT = (key, fallback) => {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const result = window.i18n.t(key);
      if (result && result !== key) return result;
    }
    return fallback;
  };

  const FAQ_DEFINITION = [
    {
      id: 'gettingStarted',
      titleKey: 'faqPage.groups.gettingStarted.title',
      titleFallback: 'Getting started',
      tagKey: 'faqPage.groups.gettingStarted.tag',
      tagFallback: 'Basics',
      items: [
        {
          qKey: 'faqPage.groups.gettingStarted.items.whatIs.q',
          qFallback: 'What is Site Mechanic?',
          aKey: 'faqPage.groups.gettingStarted.items.whatIs.a',
          aFallback: 'Site Mechanic is a set of website diagnostics modules (Speed & UX, SEO, Accessibility, Security, Fonts & Design, Hosting, and more). You paste a URL, run a scan, and get prioritized issues plus next-step recommendations.',
          schema: true
        },
        {
          qKey: 'faqPage.groups.gettingStarted.items.accountNeeded.q',
          qFallback: 'Do I need an account to run scans?',
          aKey: 'faqPage.groups.gettingStarted.items.accountNeeded.a',
          aFallback: 'No. Most scans can be run without signing in. If you choose a paid report/export, you may be prompted to sign in or purchase credits depending on the tool.',
          schema: true
        },
        {
          qKey: 'faqPage.groups.gettingStarted.items.validUrls.q',
          qFallback: 'What URLs can I scan?',
          aKey: 'faqPage.groups.gettingStarted.items.validUrls.a',
          aFallback: 'Use a public, reachable URL (for example <code>https://example.com</code>). Redirects are fine. Pages behind logins or IP allow-lists may not be scannable.',
          schema: true
        },
        {
          qKey: 'faqPage.groups.gettingStarted.items.scanTime.q',
          qFallback: 'How long do scans take?',
          aKey: 'faqPage.groups.gettingStarted.items.scanTime.a',
          aFallback: 'It depends on the module and the site. Quick scans are typically under a minute; Lighthouse audits can take a few minutes. If a site is slow or blocks automation, scans can take longer or fail.',
          schema: true
        }
      ]
    },
    {
      id: 'reports',
      titleKey: 'faqPage.groups.reports.title',
      titleFallback: 'Reports, exports, and pricing',
      tagKey: 'faqPage.groups.reports.tag',
      tagFallback: 'Billing',
      items: [
        {
          qKey: 'faqPage.groups.reports.items.paidReport.q',
          qFallback: 'What is a "paid report" on Site Mechanic?',
          aKey: 'faqPage.groups.reports.items.paidReport.a',
          aFallback: 'A paid report is an export/share outcome for a specific scan, such as PDF export, share links, downloadable data, or extended fix guidance. You can usually run the scan for free and then decide whether to purchase the report.',
          schema: true
        },
        {
          qKey: 'faqPage.groups.reports.items.credits.q',
          qFallback: 'How do credits work?',
          aKey: 'faqPage.groups.reports.items.credits.a',
          aFallback: 'Credits are used to unlock paid reports for individual scans. When a report is locked, you\'ll see options to buy a single report or buy a credit pack. If you already have credits, you can unlock with 1 credit.',
          schema: true
        },
        {
          qKey: 'faqPage.groups.reports.items.singleReport.q',
          qFallback: 'Can I buy a single report without a subscription?',
          aKey: 'faqPage.groups.reports.items.singleReport.a',
          aFallback: 'Yes. Many tools offer a "buy single report" option for one scan. Credit packs are also available if you run reports regularly.',
          schema: true
        },
        {
          qKey: 'faqPage.groups.reports.items.refunds.q',
          qFallback: 'Do you offer refunds?',
          aKey: 'faqPage.groups.reports.items.refunds.a',
          aFallback: 'If you\'re not satisfied within the first 14 days of a subscription purchase, contact support for a refund. For one-off credit purchases, reach out and we\'ll help resolve issues or correct billing mistakes.',
          schema: true
        },
        {
          qKey: 'faqPage.groups.reports.items.payments.q',
          qFallback: 'What payment methods do you accept?',
          aKey: 'faqPage.groups.reports.items.payments.a',
          aFallback: 'Payments are processed through Stripe. Most major credit/debit cards are supported. Site Mechanic does not store your full card details on our servers.',
          schema: true
        }
      ]
    },
    {
      id: 'limits',
      titleKey: 'faqPage.groups.limits.title',
      titleFallback: 'Plans and limits',
      tagKey: 'faqPage.groups.limits.tag',
      tagFallback: 'Limits',
      items: [
        {
          qKey: 'faqPage.groups.limits.items.scanCount.q',
          qFallback: 'What counts as a "scan"?',
          aKey: 'faqPage.groups.limits.items.scanCount.a',
          aFallback: 'A scan is when you run any analyzer (Performance, SEO, Security, etc.) on a URL. Each time you click "Analyze" or "Run Scan", it counts as one scan toward your daily limit.',
          schema: true
        },
        {
          qKey: 'faqPage.groups.limits.items.reportUnlock.q',
          qFallback: 'What is a "paid report unlock"?',
          aKey: 'faqPage.groups.limits.items.reportUnlock.a',
          aFallback: 'A paid report unlock gives you access to Pro features for a specific scan result: PDF export, shareable links, detailed recommendations, and saved report history. Free users can view basic scan results but need to unlock for Pro features.',
          schema: true
        },
        {
          qKey: 'faqPage.groups.limits.items.planLimits.q',
          qFallback: 'What are the plan limits?',
          aKey: 'faqPage.groups.limits.items.planLimits.a',
          aFallback: '<strong>Free:</strong> 10 scans per day, Pro sections are locked.<br><strong>Day Pass ($20):</strong> Unlimited scans for 24 hours + 30 report unlocks.<br><strong>Pro Monthly ($29/mo):</strong> Unlimited scans + 250 report unlocks per month.<br><strong>Pro Annual ($290/yr):</strong> Unlimited scans + unlimited report unlocks.',
          schema: true
        },
        {
          qKey: 'faqPage.groups.limits.items.dailyLimit.q',
          qFallback: 'What happens when I hit my daily scan limit?',
          aKey: 'faqPage.groups.limits.items.dailyLimit.a',
          aFallback: 'When you reach 10 scans in a day (Free tier), the scan button is disabled until midnight UTC. You\'ll see upgrade options for Day Pass or Pro subscriptions to continue scanning immediately.',
          schema: true
        },
        {
          qKey: 'faqPage.groups.limits.items.unlocksRunOut.q',
          qFallback: 'What happens when I run out of report unlocks?',
          aKey: 'faqPage.groups.limits.items.unlocksRunOut.a',
          aFallback: 'For Day Pass users, you can unlock up to 30 reports during your 24-hour window. For Pro Monthly, your 250 reports reset at the start of each billing period. Pro Annual has unlimited unlocks. If you run out, you can purchase a Single Report ($5) or upgrade your plan.',
          schema: true
        },
        {
          qKey: 'faqPage.groups.limits.items.dayPass.q',
          qFallback: 'How does the Day Pass work?',
          aKey: 'faqPage.groups.limits.items.dayPass.a',
          aFallback: 'The Day Pass ($20) gives you full Pro access for 24 hours from the time of purchase. You get unlimited scans and up to 30 report unlocks during this window. It does not auto-renew—perfect for one-time projects or client presentations.',
          schema: true
        },
        {
          qKey: 'faqPage.groups.limits.items.singleReport.q',
          qFallback: 'How does the Single Report option work?',
          aKey: 'faqPage.groups.limits.items.singleReport.a',
          aFallback: 'Single Report ($5) lets you unlock one specific scan result without a subscription. After unlocking, you have permanent access to that report\'s Pro features including PDF export and detailed recommendations. Great if you only need one report occasionally.',
          schema: true
        },
        {
          qKey: 'faqPage.groups.limits.items.resets.q',
          qFallback: 'When do my limits reset?',
          aKey: 'faqPage.groups.limits.items.resets.a',
          aFallback: 'Daily scan limits reset at midnight UTC. For Pro Monthly subscribers, report unlocks reset at the start of each billing cycle. Day Pass limits expire 24 hours after purchase.',
          schema: true
        }
      ]
    },
    {
      id: 'accuracy',
      titleKey: 'faqPage.groups.accuracy.title',
      titleFallback: 'Accuracy and limitations',
      tagKey: 'faqPage.groups.accuracy.tag',
      tagFallback: 'How it works',
      items: [
        {
          qKey: 'faqPage.groups.accuracy.items.devtoolsDiff.q',
          qFallback: 'Why can results differ from what I see in Chrome DevTools?',
          aKey: 'faqPage.groups.accuracy.items.devtoolsDiff.a',
          aFallback: 'Many metrics depend on device emulation, network conditions, caching, and timing. Site Mechanic uses automated runs that may not match your exact local environment. Treat results as directional signals, then verify fixes locally.',
          schema: true
        },
        {
          qKey: 'faqPage.groups.accuracy.items.crawlAll.q',
          qFallback: 'Do you crawl my entire website?',
          aKey: 'faqPage.groups.accuracy.items.crawlAll.a',
          aFallback: 'It depends on the module. Some tools analyze a single page URL. Crawling modules (when enabled) scan multiple pages based on discovered links and limits.',
          schema: true
        },
        {
          qKey: 'faqPage.groups.accuracy.items.localhost.q',
          qFallback: 'Can you scan staging sites or localhost?',
          aKey: 'faqPage.groups.accuracy.items.localhost.a',
          aFallback: 'No. For security reasons, Site Mechanic blocks localhost and private network targets. Use a publicly reachable staging URL instead.',
          schema: false
        }
      ]
    },
    {
      id: 'privacy',
      titleKey: 'faqPage.groups.privacy.title',
      titleFallback: 'Privacy, storage, and security',
      tagKey: 'faqPage.groups.privacy.tag',
      tagFallback: 'Privacy',
      items: [
        {
          qKey: 'faqPage.groups.privacy.items.dataStored.q',
          qFallback: 'What data is stored after I run a scan?',
          aKey: 'faqPage.groups.privacy.items.dataStored.a',
          aFallback: 'Site Mechanic may store scan artifacts needed to generate reports (for example exported PDFs). Generated PDF files are automatically cleaned up after a retention period (7 days by default).',
          schema: true
        },
        {
          qKey: 'faqPage.groups.privacy.items.screenshots.q',
          qFallback: 'Do you store screenshots?',
          aKey: 'faqPage.groups.privacy.items.screenshots.a',
          aFallback: 'Some reports include screenshots to make results easier to review. Screenshot/report artifacts follow the same retention approach as reports (automatic cleanup).',
          schema: false
        },
        {
          qKey: 'faqPage.groups.privacy.items.blockScans.q',
          qFallback: 'Can my site block scans?',
          aKey: 'faqPage.groups.privacy.items.blockScans.a',
          aFallback: 'Yes. Some sites block automated browsers, rate-limit requests, or require cookies/authentication. If a scan fails, try again, or test a different page URL.',
          schema: false
        }
      ]
    },
    {
      id: 'troubleshooting',
      titleKey: 'faqPage.groups.troubleshooting.title',
      titleFallback: 'Troubleshooting',
      tagKey: 'faqPage.groups.troubleshooting.tag',
      tagFallback: 'Help',
      items: [
        {
          qKey: 'faqPage.groups.troubleshooting.items.stuck.q',
          qFallback: 'The scan is stuck on a step (loading / measuring). What should I do?',
          aKey: 'faqPage.groups.troubleshooting.items.stuck.a',
          aFallback: 'First, try a simpler URL (homepage vs. deep route) and re-run. If the site is slow or blocks automation, the scan may time out. If the issue persists, send the URL and the module name to support so we can reproduce.',
          schema: false
        },
        {
          qKey: 'faqPage.groups.troubleshooting.items.exportsLocked.q',
          qFallback: 'I unlocked a report but exports are still locked.',
          aKey: 'faqPage.groups.troubleshooting.items.exportsLocked.a',
          aFallback: 'Refresh the page once after unlocking. If it still looks locked, the report ID may not match (for example if the scan was re-run). Re-open the same scan results page and try again, or contact support with the URL + timestamp.',
          schema: false
        }
      ]
    }
  ];

  const getFaqGroups = () => FAQ_DEFINITION.map(group => ({
    title: faqT(group.titleKey, group.titleFallback),
    tag: faqT(group.tagKey, group.tagFallback),
    items: group.items.map(item => ({
      q: faqT(item.qKey, item.qFallback),
      aHtml: faqT(item.aKey, item.aFallback),
      schema: item.schema
    }))
  }));

  function stripTags(html) {
    return String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  function buildFaqJsonLd() {
    const entities = [];
    const groups = getFaqGroups();
    groups.forEach(group => {
      group.items.forEach(item => {
        if (!item.schema) return;
        entities.push({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: stripTags(item.aHtml)
          }
        });
      });
    });

    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: entities.slice(0, 25)
    };
  }

  function renderFaq() {
    const root = document.getElementById('faqRoot');
    if (!root) return;

    root.innerHTML = getFaqGroups()
      .map(group => {
        const itemsHtml = group.items
          .map(item => {
            const tag = group.tag || 'FAQ';
            return `
              <details class="faq-item" data-faq-item>
                <summary>
                  <span class="faq-item__q">
                    <span class="faq-item__tag">${tag}</span>
                    <span>${item.q}</span>
                  </span>
                  <span class="faq-item__chev" aria-hidden="true">›</span>
                </summary>
                <div class="faq-item__a">${item.aHtml}</div>
              </details>
            `;
          })
          .join('');

        return `
          <div class="faq-group" data-faq-group>
            <h2 class="faq-group__title">${group.title}</h2>
            ${itemsHtml}
          </div>
        `;
      })
      .join('');

    const jsonLd = buildFaqJsonLd();
    const script = document.getElementById('faqJsonLd');
    if (script) {
      script.textContent = JSON.stringify(jsonLd, null, 2);
    }
  }

  function setupSearch() {
    const input = document.getElementById('faqSearch');
    const empty = document.getElementById('faqEmpty');
    if (!input) return;

    const apply = () => {
      const query = String(input.value || '').trim().toLowerCase();
      const items = Array.from(document.querySelectorAll('[data-faq-item]'));
      let visibleCount = 0;

      items.forEach(details => {
        const text = details.textContent ? details.textContent.toLowerCase() : '';
        const match = !query || text.includes(query);
        details.style.display = match ? '' : 'none';
        if (match) visibleCount += 1;
      });

      const groups = Array.from(document.querySelectorAll('[data-faq-group]'));
      groups.forEach(group => {
        const hasVisible = !!group.querySelector('[data-faq-item]:not([style*="display: none"])');
        group.style.display = hasVisible ? '' : 'none';
      });

      if (empty) {
        empty.style.display = visibleCount === 0 ? '' : 'none';
      }
    };

    input.addEventListener('input', apply);
    apply();
  }

  function setupControls() {
    const expand = document.getElementById('faqExpandAll');
    const collapse = document.getElementById('faqCollapseAll');

    const setOpen = (value) => {
      document.querySelectorAll('[data-faq-item]').forEach(d => {
        if (value) d.setAttribute('open', '');
        else d.removeAttribute('open');
      });
    };

    if (expand) expand.addEventListener('click', () => setOpen(true));
    if (collapse) collapse.addEventListener('click', () => setOpen(false));
  }

  document.addEventListener('DOMContentLoaded', () => {
    const renderAll = () => {
      renderFaq();
      setupSearch();
      setupControls();
    };

    renderAll();

    window.addEventListener('languageChanged', () => {
      renderAll();
    });
  });
})();
