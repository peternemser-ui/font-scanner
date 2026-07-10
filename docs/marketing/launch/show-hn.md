# Show HN post

**Post from your own HN account. Best window: Tue–Thu, 7–9am ET.**
**Rules recap: no marketing language, be present in comments for the first 3–4 hours, respond to every technical question honestly.**

---

## Title

Show HN: Site Mechanic – scan a site for performance, SEO, a11y, and security issues

*(79 chars — under the 80 limit. Alternative if taken tone-wise: "Show HN: I built a website diagnostics tool that ranks what to fix first")*

## Body

I'm a solo dev and I kept doing the same dance for every client site: run Lighthouse, run WAVE, check securityheaders.com, eyeball the font loading, then manually merge it all into something a client could read. Site Mechanic is that dance as one scan.

Enter a URL and it runs performance (Lighthouse), SEO, WCAG accessibility, security headers/SSL, and typography checks in parallel, then ranks the findings by severity — most critical first, each with enough context to act on. Most scans finish in ~30 seconds. No signup: 10 free scans a day.

Tech: Node/Express, Puppeteer with the stealth plugin for scanning (some sites 403 plain requests), Lighthouse 11 for perf, headless Chrome rendering HTML templates for the PDF reports. The whole thing runs on a single DigitalOcean droplet with Docker Compose. Getting a pool of headless Chromes to not OOM a 2GB container taught me more about the kernel memory cgroup than I expected to learn this year.

It's localized in 8 languages (the scan report language locks at scan start so you never get mixed-language output — surprisingly hard to get right with AI-generated recommendations in the mix).

Free tier is the real product — the paid tier adds PDF export, saved reports, and multi-page crawls. I'd genuinely value feedback on the scan accuracy: if it gets your site wrong, tell me where.

https://sitemechanic.io

---

**Prep before posting:**
- [ ] Scan HN's own site and 2–3 popular sites beforehand so you know what commenters will see
- [ ] Confirm the droplet is healthy — HN front page ≈ 10–30k visits in a day; free-tier scans will spike Chrome load (BROWSER_POOL_MAX is 2; consider bumping the container memory headroom check that morning)
- [ ] Have answers ready for: "how is this different from Lighthouse?" (answer: it isn't trying to be — it merges Lighthouse with 4 other check types and ranks across them; Lighthouse alone doesn't do security headers, WCAG beyond audits, or typography)
