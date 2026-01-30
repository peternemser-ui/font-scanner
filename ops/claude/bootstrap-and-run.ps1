<#
bootstrap-and-run.ps1

What it does:
- Optionally seeds ops/claude/*.md with the prompts we developed
- Runs each workstream in a safe order on its own branch
- Commits changes after each workstream

Assumes:
- You have a Claude CLI that accepts stdin, e.g.:
    Get-Content file -Raw | claude
- Git repo is clean at start

Usage:
  # Seed prompts + run all workstreams
  powershell -ExecutionPolicy Bypass -File .\ops\claude\bootstrap-and-run.ps1 -SeedPrompts

  # Run only (if prompts already in files)
  powershell -ExecutionPolicy Bypass -File .\ops\claude\bootstrap-and-run.ps1

  # Run with tests after each workstream
  powershell -ExecutionPolicy Bypass -File .\ops\claude\bootstrap-and-run.ps1 -SeedPrompts -RunTests "npm test"

  # Use different Claude executable
  powershell -ExecutionPolicy Bypass -File .\ops\claude\bootstrap-and-run.ps1 -ClaudeExe "claude-code"
#>

param(
  [string]$RepoRoot = (Get-Location).Path,
  [string]$ClaudeExe = "claude",
  [string]$BaseBranch = "main",
  [string]$RunTests = "",

  [switch]$SeedPrompts,          # writes prompt content into ops/claude/*.md
  [switch]$OverwritePrompts,     # overwrite even if file already has content
  [switch]$DryRun                # shows what it would do, does not call Claude / git commit
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Exec($cmd) {
  Write-Host ">> $cmd" -ForegroundColor Cyan
  if ($DryRun) { return }
  cmd /c $cmd
  if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $cmd" }
}

function GitPorcelain() {
  return (git status --porcelain)
}

function EnsureFile($path, $content) {
  $exists = Test-Path $path
  if (-not $exists) {
    New-Item -ItemType File -Path $path -Force | Out-Null
  }

  $current = ""
  try { $current = Get-Content $path -Raw } catch { $current = "" }

  $shouldWrite = $SeedPrompts -and ( $OverwritePrompts -or [string]::IsNullOrWhiteSpace($current) )
  if ($shouldWrite) {
    Write-Host "Seeding: $path" -ForegroundColor Green
    if (-not $DryRun) { Set-Content -Path $path -Value $content -Encoding UTF8 }
  }
}

function RunClaudeFromFile($filePath) {
  Write-Host "Running Claude with: $filePath" -ForegroundColor Green
  if ($DryRun) { return }

  $prompt = Get-Content $filePath -Raw

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $ClaudeExe
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $false
  $psi.RedirectStandardError = $false
  $psi.UseShellExecute = $false

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  $null = $p.Start()
  $p.StandardInput.WriteLine($prompt)
  $p.StandardInput.Close()
  $p.WaitForExit()

  if ($p.ExitCode -ne 0) {
    throw "Claude failed (exit $($p.ExitCode)). If your CLI doesn't accept stdin, tell me the exact command and I'll adjust."
  }
}

# Move to repo root
Set-Location $RepoRoot
Exec "git rev-parse --is-inside-work-tree"

# Preflight: clean working tree
if (GitPorcelain) { throw "Working tree not clean. Commit or stash first." }

# Ensure ops/claude exists
$opsDir = Join-Path $RepoRoot "ops\claude"
if (!(Test-Path $opsDir)) { throw "Missing folder: $opsDir" }

# Ensure Claude command exists
if (-not $DryRun) {
  try { $null = Get-Command $ClaudeExe -ErrorAction Stop } catch {
    throw "Cannot find '$ClaudeExe' in PATH. Pass -ClaudeExe or fix PATH."
  }
}

# ---------- PROMPT CONTENT (seed into files) ----------
$preamble = @"
Before making changes:
- Print the repo tree for src/ and server/ (or equivalent).
- Identify the exact files you will edit (and why).
- Make incremental changes only. Do not refactor unrelated code.
- After each milestone, summarize what changed and where.

Rules:
- Prefer additive changes over rewrites.
- Keep existing behavior intact unless the task is a bugfix.
- If you touch shared components, keep changes minimal.
- Do not destroy months of work: avoid large renames or broad refactors.

Now do this task:
"@

$readme = @"
# ops/claude

This folder contains workstream prompts for Claude Code. Each file is a single self-contained prompt.

Suggested run order:
1) 05-billing-entitlements.md
2) 06-sqlite-hardening.md
3) 04-url-cache-bug.md
4) 07-csp-onclick-fix.md
5) 01-design-system.md
6) 02-report-shell.md
7) 03-pro-gating.md
8) 09-fonts-privacy-usability.md
9) 08-legal-pages.md

Branch strategy: one workstream per branch.
"@

$plan = @"
# 00-PLAN

Goal: production readiness with minimal disruption.

Principles:
- Separate backend scalability from UI refactors.
- Introduce a ReportShell and PRO gating via configuration, not by rewriting analyzers.
- Keep SQLite now, but harden it and isolate DB access behind a repository layer.
- Fix URL sticky/cache behavior early (critical UX bug).
- Remove inline onclick handlers to satisfy CSP in production (event delegation).
- Add legal pages + footer wiring before launch.

Definition of Done:
- Billing models work: Single Pass / Day Pass / Monthly Pass
- Reports are versioned: analyzer_version, schema_version, renderer_version
- URL input never gets stuck; scanning a different URL is frictionless
- PRO sections are consistently labeled + gated in accordions
- CSP warnings resolved: no inline onclick in generated report HTML
- Legal pages exist and are linked everywhere
"@

$designSystem = $preamble + @"
Goal: Standardize typography, spacing, borders, buttons, cards, section headers, and backgrounds across ALL tool pages so the UI feels like one product.

Tasks:
1) Locate global stylesheet(s) and layout template(s). Add a design token layer using CSS variables (or Tailwind config if Tailwind is used).
2) Enforce Inter as the only primary font across the app (400/500/600/700). Headings use tighter tracking and reduced line-height (Swiss style).
3) Define tokens:
   - color: --text, --muted, --bg, --surface, --border, --accent, --success, --warning, --danger
   - radius: --r-sm, --r-md, --r-lg
   - spacing scale: 4/8/12/16/24/32/48
   - type scale: body, small, h1/h2/h3 with consistent line-heights
4) Standardize primitives:
   - Primary button style (and use one verb everywhere: "Analyze")
   - Secondary + ghost button
   - Card + border + radius
   - Input styles
   - Badge (neutral/success/warn/danger)
   - Accordion/section header style
5) Standardize Scan Form (shared component):
   - Input label "Website URL"
   - Primary CTA "Analyze"
   - Advanced options collapsed under "Advanced"
6) Background grid treatment:
   Choose ONE: apply globally or remove globally. Implement consistently.

Deliverables:
- Commit includes tokens + primitives + ScanForm unification
- List exact files edited
"@

$reportShell = $preamble + @"
Goal: Every analyzer page renders its report via one shared ReportShell layout so future releases improve rendering without rewriting every page.

Steps:
1) Find all report pages/tools.
2) Create a shared component ReportShell that takes a normalized model:
   {
     toolKey,
     toolLabel,
     url,
     timestamp,
     screenshotUrl,
     scores: [{label, value, status}],
     sections: [{id, title, access, rightBadge?, contentType, data}],
     fixes: [{title, severity, category, tabs: ["Summary","Code","HowTo"], body}],
     summary: {issuesFound, recommendations, checksPassed}
   }
3) Refactor each tool page to map existing results into this model and render ReportShell.
4) Add “Viewing saved report…” banner when report loaded from history/cache:
   - actions: [Rescan] [Copy URL] [Clear]
5) Ensure consistent spacing + score ring sizes across tools.

Definition of Done:
- All tools share the same outer structure
- Tools only map data; they do not implement layout
- Adding a new section later is config, not redesign

Deliverables:
- Shared component + refactors (mapping only)
- Short README note: how to add a tool using ReportShell
"@

$proGating = $preamble + @"
Goal: Implement section-level PRO gating across all accordions, consistently, without rewriting analyzers.

Rules:
- Free always includes: screenshot, overall score + sub-scores, quick wins (top 3), summary counts.
- PRO includes: deep tables, per-element/per-url lists, code/how-to tabs, exports.

Implementation:
1) Add access: "free" | "pro" to every section/accordion config.
2) For non-entitled users:
   - render section title + PRO badge + 2-line teaser
   - lock overlay/blur for body with "Unlock to view"
3) Fix accordions with tabs:
   - Summary tab stays free
   - Code + How-to tabs are PRO
4) Use ONE entitlement resolver everywhere (UI reads from same source):
   - canViewProSections, canExport, etc.

Deliverables:
- One shared gating implementation in ReportShell/Accordion component
- Consistent PRO badge style
- Updated config across tools with correct access flags
"@

$urlCacheBug = $preamble + @"
Goal: Fix usability bug where the URL input gets stuck due to cache/localStorage/route initialization, preventing easy scanning of a different URL.

Steps:
1) Search for any persisted URL usage:
   - localStorage/sessionStorage keys like lastUrl, siteUrl, targetUrl, scanUrl
2) Identify where scan input is initialized. Change behavior so:
   - Default input starts empty OR uses current query param (?url=) if present.
   - Remember-last-URL is optional (explicit toggle), OFF by default.
3) UX improvements:
   - Clear (X) button in input when populated.
   - If last URL exists, show a secondary "Use previous URL" button (does not auto-fill).
4) Ensure route changes do NOT re-inject stored URL unless toggle is enabled.
5) Add a quick test verifying:
   - scan A, navigate to another tool, type B, it stays B, scan runs for B.

Deliverables:
- Bugfix commit + test
- Notes on which keys were removed/changed and why
"@

$billing = $preamble + @"
Goal: Billing must reliably support:
- Single Pass: unlock PRO/exports for ONE report run (reportId scoped)
- Day Pass: unlock PRO/exports for 24 hours (user scoped)
- Monthly Pass: subscription unlocks everything while active; user can cancel anytime; active until period end

Tasks:
1) Audit current Stripe integration: products/prices, checkout, webhook handlers, entitlement storage.
2) Implement a single entitlement resolver used everywhere:
   - canUserExport(reportId)
   - canAccessProTools()
   - canViewProSections()
3) Model entitlements:
   - single_report_unlock: {reportId, userId, expiresAt?}
   - day_pass: {userId, expiresAt=now+24h}
   - monthly_sub: {userId, status, currentPeriodEnd}
4) Webhooks:
   - checkout.session.completed
   - customer.subscription.updated
   - invoice.paid
   - update entitlements deterministically
5) Add endpoint:
   - GET /api/me/entitlements returns the effective entitlements
6) Ensure UI unlock state updates reliably after purchase (server-confirmed response).

Deliverables:
- Schema + resolver + webhooks + /api/me/entitlements
- Smoke test instructions
"@

$sqlite = $preamble + @"
Goal: Keep SQLite viable for early production while making the data layer swappable later (Postgres) without rewriting business logic.

Implement:
1) SQLite PRAGMAs at connection open:
   - journal_mode=WAL
   - synchronous=NORMAL
   - foreign_keys=ON
   - busy_timeout=5000
2) Add indexes:
   - reports(user_id, created_at)
   - reports(url)
   - entitlements(user_id, expires_at)
   - report_artifacts(report_id, type)
3) Prevent long write locks:
   - short transactions
   - store large artifacts (screenshots, raw lighthouse json) outside sqlite (filesystem/object store)
   - DB stores pointers/paths + metadata
4) Add repository layer abstraction:
   - createReportRun, saveArtifact, listReports, setEntitlement, getEntitlements
   - SQLite impl now; future Postgres stub (optional)
5) Add report versioning fields:
   - analyzer_version, schema_version, renderer_version

Deliverables:
- Connection hardened + migrations + indexes
- Repo-layer in place
- Large artifact storage moved out of sqlite rows
"@

$cspFix = $preamble + @"
Goal: Fix CSP (Content Security Policy) warnings caused by inline onclick handlers in generated HTML (noted around line ~478).

Context:
These warnings are security issues. They may not break dev, but must be fixed for production CSP. Proper fix: event delegation (like Broken Links fix accordions) instead of inline onclick.

Implementation:
1) Replace inline onclick="..." with data attributes:
   - data-action="..." data-id="..."
2) Add ONE delegated click handler at a stable report container root:
   container.addEventListener('click', (e) => { route by data-action })
3) Ensure all existing accordion toggles and fix interactions still work.
4) Remove any remaining inline handlers in report HTML generation.

Deliverables:
- No inline onclick remains
- Event delegation implemented cleanly
- Brief note on the container root selector used
"@

$legal = $preamble + @"
Goal: Add production-ready legal pages and wire them into footer + checkout surfaces.

Pages:
- /legal/terms
- /legal/privacy
- /legal/cookies
- /legal/disclaimer (best-effort scans; not a guarantee)
- /legal/refunds (policy for single/day/month)

Implementation:
1) Add consistent footer links on every page.
2) Add a purchase/checkout notice: "By purchasing, you agree to Terms + Privacy."
3) Ensure support/contact email appears in footer and legal pages.

Deliverables:
- Routes + pages + footer links
- Checkout notice added
"@

$ux = $preamble + @"
Goal: Improve report usefulness and reduce scroll fatigue (especially Fonts & Typography and Privacy Compliance) without changing analyzers drastically.

Fonts & Typography:
- Add a “Font Inventory” summary card near top (families, weights, providers, total font files)
- Collapse repeated sample blocks into a single accordion: “Typography Samples”
- Add table filter/search (family/provider/type)
- Add a “Loading Strategy” mini-section: preload candidates, render-blocking notes, font-display guidance

Privacy Compliance:
- Add “Top Risks” box near top (max 3)
- Add quick pass/fail checks:
  - Cookie banner detected?
  - Reject All present and equal prominence?
  - Non-essential blocked before consent?
- Put deep cookie/vendor lists behind PRO gating

Global improvement:
- Add a consistent “Quick Wins” accordion (free) that shows:
  - 3 issues, 3 fixes, 1 biggest lever
- Standardize fix cards to include: severity, impact, verification step.

Deliverables:
- Layout improvements (minimal analyzer changes)
- Clear mapping of what becomes PRO vs free
"@

# Seed files (if requested)
EnsureFile (Join-Path $opsDir "README.md") $readme
EnsureFile (Join-Path $opsDir "00-PLAN.md") $plan
EnsureFile (Join-Path $opsDir "01-design-system.md") $designSystem
EnsureFile (Join-Path $opsDir "02-report-shell.md") $reportShell
EnsureFile (Join-Path $opsDir "03-pro-gating.md") $proGating
EnsureFile (Join-Path $opsDir "04-url-cache-bug.md") $urlCacheBug
EnsureFile (Join-Path $opsDir "05-billing-entitlements.md") $billing
EnsureFile (Join-Path $opsDir "06-sqlite-hardening.md") $sqlite
EnsureFile (Join-Path $opsDir "07-csp-onclick-fix.md") $cspFix
EnsureFile (Join-Path $opsDir "08-legal-pages.md") $legal
EnsureFile (Join-Path $opsDir "09-fonts-privacy-usability.md") $ux

# ---------- WORKSTREAM RUN ORDER (includes ALL we developed) ----------
$workstreams = @(
  @{ File="05-billing-entitlements.md";     Branch="feat/billing-entitlements";     Commit="Workstream: billing + entitlements" },
  @{ File="06-sqlite-hardening.md";         Branch="feat/sqlite-hardening";         Commit="Workstream: sqlite hardening + versioning" },
  @{ File="04-url-cache-bug.md";            Branch="feat/url-cache-bug";            Commit="Workstream: fix sticky URL cache behavior" },
  @{ File="07-csp-onclick-fix.md";          Branch="feat/csp-event-delegation";     Commit="Workstream: CSP inline onclick -> event delegation" },
  @{ File="01-design-system.md";            Branch="feat/design-system-scanform";   Commit="Workstream: design tokens + ScanForm unify" },
  @{ File="02-report-shell.md";             Branch="feat/report-shell";             Commit="Workstream: ReportShell standardization" },
  @{ File="03-pro-gating.md";               Branch="feat/pro-gating";               Commit="Workstream: PRO gating + labels" },
  @{ File="09-fonts-privacy-usability.md";  Branch="feat/fonts-privacy-ux";         Commit="Workstream: fonts/privacy usability upgrades" },
  @{ File="08-legal-pages.md";              Branch="feat/legal-pages";              Commit="Workstream: legal pages + footer wiring" }
)

# Base branch up to date
Exec "git fetch --all --prune"
Exec "git checkout $BaseBranch"
Exec "git pull --ff-only"

$summary = @()

foreach ($w in $workstreams) {
  $filePath = Join-Path $opsDir $w.File
  if (!(Test-Path $filePath)) {
    Write-Host "!! Missing file, skipping: $filePath" -ForegroundColor Yellow
    continue
  }

  # Start each workstream from latest base branch
  Exec "git checkout $BaseBranch"
  Exec "git pull --ff-only"
  Exec "git checkout -B $($w.Branch) $BaseBranch"

  Write-Host "`n=== Running: $($w.File) on $($w.Branch) ===" -ForegroundColor Magenta

  RunClaudeFromFile $filePath

  if ($RunTests -ne "") { Exec $RunTests }

  $changes = GitPorcelain
  if ($changes) {
    Exec "git add -A"
    Exec "git commit -m ""$($w.Commit)"""
    $summary += "OK: $($w.File) -> $($w.Branch)"
  } else {
    $summary += "NO-CHANGES: $($w.File) -> $($w.Branch)"
  }
}

Write-Host "`n=== DONE ===" -ForegroundColor Green
$summary | ForEach-Object { Write-Host $_ }
Write-Host "`nNext: merge branches in order (backend -> UI), resolve conflicts early." -ForegroundColor Cyan
