# New Pay-for-Report Project — Bootstrap Checklist

Use this checklist when starting a new pay-for-report SaaS project from the Site Mechanic template.

## Step 1: Copy the `.claude/` directory

```bash
cp -r /path/to/sitemechanic/.claude /path/to/new-project/.claude
```

## Step 2: Update CLAUDE.md

Create a `CLAUDE.md` at the new project root. Update:
- [ ] Project name and description
- [ ] Tech stack (runtime, database, frontend, PDF generation, payments, auth, testing)
- [ ] Key file paths table
- [ ] Project invariants (keep the universal ones, add project-specific ones)
- [ ] Available specialist agents table

## Step 3: Update `.claude/invariants.json`

- [ ] Change `projectName` and `techSummary`
- [ ] Review each invariant — keep universal ones, update `appliesTo` globs for your file structure
- [ ] Add project-specific invariants
- [ ] Remove invariants that don't apply

## Step 4: Update hook scripts

- [ ] Verify `.claude/hooks/check-invariants.js` works with your file structure
- [ ] Update `post-edit-test.sh` file-to-test mappings for your test structure
- [ ] Test hooks: `node .claude/hooks/check-invariants.js <your-report-script.js>`

## Step 5: Keep universal agents, customize project-specific ones

### Universal agents (keep as-is, just update project references):
- `orchestrator-planner` — Task decomposition and coordination
- `qa-harness-regression` — Regression testing
- `i18n-language-lock` — Language consistency
- `pdf-fidelity-auditor` — PDF export fidelity
- `accessibility-auditor` — WCAG compliance
- `report-shell-design-system` — Report UI consistency
- `report-data-completeness` — Data validation
- `ux-billing-copy` — Billing microcopy
- `entitlements-pro-gating` — Billing/gating logic
- `stripe-webhooks-engineer` — Payment webhooks
- `error-resilience-engineer` — Error handling patterns
- `api-contract-guardian` — API contracts

### Project-specific agents (create new from template):
- [ ] Delete Site Mechanic-specific agents you don't need
- [ ] Use `.claude/templates/_base-agent.md` to create new domain agents
- [ ] Fill in the `{{PLACEHOLDER}}` values for each new agent

## Step 6: Update agent cross-references

- [ ] Search all agent files for "Site Mechanic" or "font-scanner" — replace with your project name
- [ ] Update file path references in agent definitions
- [ ] Update the agent roster in `orchestrator-planner.md`

## Step 7: Verify

- [ ] `node .claude/hooks/check-invariants.js <your-file>` — runs without errors
- [ ] Agent definitions reference correct file paths
- [ ] `npm test` passes
- [ ] `npm run lint` passes

## Agent Classification Reference

| Category | Agents | Portable? |
|----------|--------|-----------|
| Orchestration | orchestrator-planner | Yes — update agent roster |
| Billing | entitlements-pro-gating, stripe-webhooks-engineer, ux-billing-copy | Yes — update tier names/prices |
| Reports | report-shell-design-system, report-data-completeness, pdf-fidelity-auditor | Yes — update design tokens |
| Quality | qa-harness-regression, accessibility-auditor | Yes — update invariant list |
| i18n | i18n-language-lock | Yes — update locale list |
| API | api-contract-guardian, error-resilience-engineer | Yes — minimal changes |
| Infra | infra-deploy-guardian, observability-engineer, security-hardening-auditor | Partial — update deployment specifics |
| Performance | perf-scalability-engineer, db-migration-architect | Partial — update DB/cache specifics |
| Product-specific | admin-system-dashboard, seo-i18n-optimizer, user-report-dashboard | No — create new for each project |
