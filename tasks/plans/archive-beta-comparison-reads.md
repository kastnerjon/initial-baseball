# Archive-beta comparison reads

Status: merged; production verified on 2026-10-06. Separate browser activation is implemented in `tasks/plans/archive-beta-comparison-browser.md`; exact release evidence belongs to that PR.

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

## Verified release checkpoint — 2026-10-06

#303 merged as `68a8f7a3cee3c3c047097757fc0ddc8847203ca2`. Final head `3a6da8f7c59cf4b41c14ddf3223dc3aa6238289f` passed exact-head CI #1039 (37523735765), attempt 1, and READY Preview `dpl_2XdwEnCsxtufsC3x8xWxQwbNQNR8`. The single bounded fresh-eyes review completed on that head with no major issues and no inline findings. Local and remote tree hashes matched `88b5853c9329488a1cb1022455056d7221a88783`.

Push CI #1040 (37524260191) passed on the exact merge. At this checkpoint, production `dpl_G9YePjyaZZwCs2Y3GZVdcT1p7UtK` was READY on that SHA and served the canonical domain. `/`, `/archive`, `/archive/1` returned 200; unissued `/archive/2` returned 404. Archive AB/completed reads returned schema-1 200 with exact beta #1/v4 identity, zero samples and null averages. Same-date current Daily returned its distinct editorial puzzle ID/number with five AB samples and AVG 3.4. Mismatched IDs returned sanitized 404. Preview additionally verified unissued identities fail 404, archive v3 fails 400, and date-only Daily v3 remains 200. All comparison responses retained `private, no-store`.

The exact-production error/fatal 30m scan at 20:13 UTC, more than 60 seconds after READY, was empty. Read-only Supabase retained one beta row, zero permanent rows, original issue timestamp/fingerprint, 531 AB rows and 56 completed rows, with zero archive-beta result rows. No migration, issue or hosted result write was performed. These are dated verification snapshots, not promises that traffic/deployment counts will never change.

Local gates passed 44 focused tests, 702 web tests across 101 files, full typecheck, file-size/whitespace/documentation checks, strict data runtime pipeline with zero critical issues, and production build/hidden-answer scan. Hosted CI also passed the full repository/data/build gates. Browser archive comparison activation is next and remains disabled in this release. Native hosted result-delivery, physical/admin/mobile and cross-archive reset QA remain open; #294 is not closed. Continuous monitoring/drains remain unverified; #301 stays a separate timing investigation.
