# Archive-beta comparison reads

Status: implemented server phase; review and hosted release gates pending. Browser activation follows separately.

## Scope contract

- **Goal:** existing comparison GET routes can read the exact issued archive-beta puzzle and points-v4 population, without mixing same-date current Daily results.
- **Owning layer:** `apps/web` authoritative read composition and HTTP adapters. Daily owns aggregate semantics and its existing repository port; shared response schema stays unchanged.
- **In scope:** optional explicit `puzzleId` routing on both GET routes; reject malformed IDs, mismatched authoritative ID/date, and unsupported archive rulesets before provider reads; reuse the existing issued archive runtime and result-puzzle resolver. Preserve date-only current-Daily callers and historical current-Daily points-v3 reads.
- **Out of scope:** browser transport/UI activation, history/replay policy, result writes, scoring, permanent launch, Classic, migrations, caches, indexes, dependencies, and #301 timing investigation.
- **Acceptance checks:** exact archive and same-date Daily population separation; forged/unissued/mismatched identities fail closed; no-ID Daily compatibility; v4-only archive policy; sanitized errors, emergency switch, timing and private no-store remain intact. Run focused/web tests, typecheck/lint, file-size/whitespace/documentation gates, strict data pipeline and build/answer scan.
- **Stop conditions:** new persistence or authority model, schema/privilege change, more than 12 handwritten source/test files or about 600 net lines. Split browser activation into the following PR rather than crossing these boundaries.

## Architecture and effects

The existing comparison population already contains puzzle ID, date, number and ruleset. The missing web routing field must select the authoritative puzzle, never become an unchecked repository key. Reuse `getAuthoritativeDailyResultPuzzle`, then verify the requested ID/date against its public metadata. Date-only requests retain current Daily routing. Explicit archive beta accepts only the currently playable points-v4, matching result delivery.

This is the bounded server phase of the approved archive comparison work; browser identity transport and presentation remain disabled until the next PR. No portable package gains web/database imports, and no hidden player data enters comparison responses. Reads do not issue puzzles or mutate result populations. Empty populations preserve null averages; existing sample withholding and independent AB/completed semantics remain Daily-owned. Existing server kill switch covers both identities. Unknown/permanent IDs cannot select archive beta and fail exact identity verification.

## Starting checkpoint — 2026-10-06

Actual main is `e4165f4f2301a01e600e4db69e894fe04de8519a`, push CI #1038 passed, no open PRs, and canonical production `dpl_GSq2BVhmyKMjFoj1oRhVAtjrQJ2C` is READY on that SHA. Supabase has one unchanged beta issue and zero permanent issues; 531 AB and 56 completed rows, zero archive result rows. Existing worktrees are preserved. Native hosted-delivery and physical/admin/mobile QA remain open.
