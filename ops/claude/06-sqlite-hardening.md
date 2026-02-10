# 06 — SQLite Hardening (production-safe + test-safe)

## Goal
Harden SQLite usage without breaking tests.
Also ensure SQLite runtime files are never tracked and do not block dev workflows on Windows.

## Required changes
1) **Never track WAL/SHM**
   - Ensure `.gitignore` includes:
     - `data/*.db-wal`
     - `data/*.db-shm`
   - Ensure any code does not depend on these being committed.

2) **PRAGMA hardening (safe defaults)**
   - In `src/db/index.js` (or wherever DB is initialized), apply pragmas:
     - `PRAGMA foreign_keys = ON;`
     - `PRAGMA journal_mode = WAL;` (unless the environment forces otherwise)
     - `PRAGMA busy_timeout = 5000;`
     - `PRAGMA synchronous = NORMAL;`
     - `PRAGMA temp_store = MEMORY;`
   - Must not crash on environments that deny a pragma; handle gracefully.

3) **Export compatibility**
   - Tests currently expect `Database` to be a constructor from `require('../../src/db')`.
   - Ensure `module.exports` includes `Database` as a constructible class/function.
   - If you refactored exports, add a compatibility layer.

4) **Test stability**
   - If tests create a test DB file, ensure proper cleanup/close on teardown.
   - Make sure `jest` does not hang due to open handles.

5) **Add/adjust migration if needed**
   - If you add a migration (e.g. `005_sqlite_hardening.sql`), ensure it runs cleanly and is idempotent where possible.

## Acceptance checklist
- `npm test` no longer fails with “Database is not a constructor”.
- Jest exits cleanly (no open handles) or you add proper close logic.
- WAL/SHM files are ignored and not tracked.

