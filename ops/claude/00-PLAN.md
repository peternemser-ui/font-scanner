# Workstream Automation Plan (run one at a time)

You are operating inside a Node/Express web app repo with a static frontend under `src/public/` and backend under `src/`.
Your job is to implement ONLY the current workstream file (this file is an overview; do not change code for 00-PLAN).

## Golden rules
- Make minimal, production-safe edits.
- Do NOT touch or commit SQLite runtime artifacts: `data/*.db-wal`, `data/*.db-shm`.
- Keep `package-lock.json` unchanged unless absolutely required by a dependency change you can justify.
- Prefer compatibility: do not break existing exports/imports; if you change an API, add a shim.
- After edits: run `npm test`. If tests fail due to your changes, fix them as part of the same workstream.

## Workflow (per workstream)
1) Start from clean `main` synced to `origin/main`.
2) Create a new branch named `feat/ws-XX-<slug>`.
3) Apply ONLY the instructions in that `ops/claude/XX-*.md` file.
4) Run: `git status -sb` then `npm test`.
5) Commit with message: `ws-XX: <short title>`.
6) Merge to `main` using `--no-ff`.
7) Push `main`.

## Definition of done
- The workstream’s acceptance checklist passes.
- `npm test` passes OR any failing tests are explicitly unrelated (and you add a short note in the PR/commit message). Prefer making tests pass.
- `git status` is clean.

