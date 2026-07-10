# Reddit posts

**Read each subreddit's self-promo rules the same day you post — they change. Never post the same text twice; these are per-community variants. Space posts at least a week apart. Reply to every comment.**

---

## r/SideProject (self-promo welcome)

**Title:** I built a website diagnostics tool that merges 5 audits into one ranked fix list

**Body:**

Solo project I've been building: Site Mechanic — enter a URL, it scans performance (Lighthouse), SEO, accessibility (WCAG), security headers/SSL, and font loading in parallel, then ranks everything it finds by severity.

The itch: every client audit meant running four different tools and manually merging results. Now it's one scan, ~30 seconds, and the output is ordered by "fix this first."

Free: 10 scans/day, no signup — https://sitemechanic.io
Paid adds PDF reports and saved history.

Stack for the curious: Node/Express, Puppeteer + stealth plugin, Lighthouse 11, SQLite→Postgres, one DigitalOcean droplet. Happy to answer anything about the build — the headless-Chrome-in-Docker memory management alone could be its own post.

---

## r/webdev (check Showoff Saturday rules — usually the only self-promo slot)

**Title:** [Showoff Saturday] One scan for performance, SEO, a11y, security, and typography — ranked by severity

**Body:**

Built this because I was tired of tab-cycling between Lighthouse, WAVE, and securityheaders.com for every audit. Site Mechanic runs all of them (plus font/typography checks) in one parallel scan and merges results into a single severity-ranked fix list.

10 free scans a day, no signup: https://sitemechanic.io

It handles bot-protected sites that block normal audit tools (stealth headless Chrome), and reports come in 8 languages. Would love brutal feedback from this sub specifically — if the scores disagree with your own Lighthouse runs, tell me and I'll dig into why.

---

## r/juststart / r/SEO (be careful — these subs are hostile to tool spam; only post if genuinely engaging)

Better approach for these: don't post the tool. Answer questions ("how do I check my site's Core Web Vitals?") and mention the tool only when it directly answers the question, alongside alternatives. One good answer a week beats any launch post here.
