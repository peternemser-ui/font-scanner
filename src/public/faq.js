/* Site Mechanic - FAQ Page */

(function() {
  const FAQ_GROUPS = [
    {
      title: 'Getting started',
      tag: 'Basics',
      items: [
        {
          q: 'What is Site Mechanic?',
          aHtml: 'Site Mechanic is a set of website diagnostics modules (Speed & UX, SEO, Accessibility, Security, Fonts & Design, Hosting, and more). You paste a URL, run a scan, and get prioritized issues plus next-step recommendations.',
          schema: true
        },
        {
          q: 'Do I need an account to run scans?',
          aHtml: 'No. Most scans can be run without signing in. If you choose a paid report/export, you may be prompted to sign in or purchase credits depending on the tool.',
          schema: true
        },
        {
          q: 'What URLs can I scan?',
          aHtml: 'Use a public, reachable URL (for example <code>https://example.com</code>). Redirects are fine. Pages behind logins or IP allow-lists may not be scannable.',
          schema: true
        },
        {
          q: 'How long do scans take?',
          aHtml: 'It depends on the module and the site. Quick scans are typically under a minute; Lighthouse audits can take a few minutes. If a site is slow or blocks automation, scans can take longer or fail.',
          schema: true
        }
      ]
    },
    {
      title: 'Reports, exports, and pricing',
      tag: 'Billing',
      items: [
        {
          q: 'What is a “paid report” on Site Mechanic?',
          aHtml: 'A paid report is an export/share outcome for a specific scan, such as PDF export, share links, downloadable data, or extended fix guidance. You can usually run the scan for free and then decide whether to purchase the report.',
          schema: true
        },
        {
          q: 'How do credits work?',
          aHtml: 'Credits are used to unlock paid reports for individual scans. When a report is locked, you’ll see options to buy a single report or buy a credit pack. If you already have credits, you can unlock with 1 credit.',
          schema: true
        },
        {
          q: 'Can I buy a single report without a subscription?',
          aHtml: 'Yes. Many tools offer a “buy single report” option for one scan. Credit packs are also available if you run reports regularly.',
          schema: true
        },
        {
          q: 'Do you offer refunds?',
          aHtml: 'If you’re not satisfied within the first 14 days of a subscription purchase, contact support for a refund. For one-off credit purchases, reach out and we’ll help resolve issues or correct billing mistakes.',
          schema: true
        },
        {
          q: 'What payment methods do you accept?',
          aHtml: 'Payments are processed through Stripe. Most major credit/debit cards are supported. Site Mechanic does not store your full card details on our servers.',
          schema: true
        }
      ]
    },
    {
      title: 'Accuracy and limitations',
      tag: 'How it works',
      items: [
        {
          q: 'Why can results differ from what I see in Chrome DevTools?',
          aHtml: 'Many metrics depend on device emulation, network conditions, caching, and timing. Site Mechanic uses automated runs that may not match your exact local environment. Treat results as directional signals, then verify fixes locally.',
          schema: true
        },
        {
          q: 'Do you crawl my entire website?',
          aHtml: 'It depends on the module. Some tools analyze a single page URL. Crawling modules (when enabled) scan multiple pages based on discovered links and limits.',
          schema: true
        },
        {
          q: 'Can you scan staging sites or localhost?',
          aHtml: 'No. For security reasons, Site Mechanic blocks localhost and private network targets. Use a publicly reachable staging URL instead.',
          schema: false
        }
      ]
    },
    {
      title: 'Privacy, storage, and security',
      tag: 'Privacy',
      items: [
        {
          q: 'What data is stored after I run a scan?',
          aHtml: 'Site Mechanic may store scan artifacts needed to generate reports (for example exported PDFs). Generated PDF files are automatically cleaned up after a retention period (7 days by default).',
          schema: true
        },
        {
          q: 'Do you store screenshots?',
          aHtml: 'Some reports include screenshots to make results easier to review. Screenshot/report artifacts follow the same retention approach as reports (automatic cleanup).',
          schema: false
        },
        {
          q: 'Can my site block scans?',
          aHtml: 'Yes. Some sites block automated browsers, rate-limit requests, or require cookies/authentication. If a scan fails, try again, or test a different page URL.',
          schema: false
        }
      ]
    },
    {
      title: 'Troubleshooting',
      tag: 'Help',
      items: [
        {
          q: 'The scan is stuck on a step (loading / measuring). What should I do?',
          aHtml: 'First, try a simpler URL (homepage vs. deep route) and re-run. If the site is slow or blocks automation, the scan may time out. If the issue persists, send the URL and the module name to support so we can reproduce.',
          schema: false
        },
        {
          q: 'I unlocked a report but exports are still locked.',
          aHtml: 'Refresh the page once after unlocking. If it still looks locked, the report ID may not match (for example if the scan was re-run). Re-open the same scan results page and try again, or contact support with the URL + timestamp.',
          schema: false
        }
      ]
    }
  ];

  function stripTags(html) {
    return String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  function buildFaqJsonLd() {
    const entities = [];
    FAQ_GROUPS.forEach(group => {
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

    root.innerHTML = FAQ_GROUPS
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
    renderFaq();
    setupSearch();
    setupControls();
  });
})();
