# 04 — URL Cache Bug Fix (report identity + collisions)

## Goal
Fix cache collisions where results from one URL/analyzer bleed into another due to weak cache keys.

## Required changes
1) **Define canonical report identity**
   - Canonical `reportId` MUST include:
     - analyzer type string (canonical)
     - normalized URL (stable normalization)
     - timestamp generated once per scan start
   - Example format:
     - `${analyzerType}:${hash(normalizedUrl)}:${scanStartedAtISO}`

2) **Normalization rules**
   - Lowercase hostname.
   - Strip default ports (80/443).
   - Ensure protocol is preserved (http vs https) OR normalize to https only if your app already forces it.
   - Remove trailing slash except root.
   - Keep path + query stable.

3) **Frontend storage keys**
   - Audit localStorage/sessionStorage usage for scan caches.
   - Ensure keys include analyzerType + normalizedUrlHash.
   - Fix any “latestResults” style key that causes overwrites.

4) **Backend cache**
   - If backend caches by URL only, update to use reportId or (analyzerType + normalizedUrl).

5) **Add tests**
   - Add a small unit test that proves two different URLs do not collide.
   - Add a test that two analyzer types on same URL do not collide.

## Acceptance checklist
- Re-running scans on different URLs no longer overwrites.
- Same URL across two analyzers yields distinct results.
- Tests cover collisions.
- `npm test` passes.

