# Playable archive beta

Status: Merged and production verified; ordinary-browser/mobile interaction remains deferred prelaunch QA
Last updated: 2026-10-05

## Scope contract

- **Goal:** browse actually issued beta puzzles, play Daily Nine using current scoring, restore isolated progress, finish and share an exact archive link.
- **Owning layer:** apps/web public archive composition and its existing gameplay client.
- **In scope:** beta read/materialization/runtime composition; signed-token routing through existing gameplay endpoints; recent issued-puzzle catalog and numbered page; entry link; beta/permanent/current save isolation; disable archive delivery/comparison through current-Daily transports; exact archive sharing; focused tests; canonical docs.
- **Out of scope:** new infrastructure/dependencies/schema, permanent launch, hosted archive result/comparison populations, local history policy, new scoring, Classic activation, visual redesign, accounts/leaderboards/head-to-head and live editorial approvals.
- **Acceptance checks:** missing/pre-epoch/future/unissued dates fail closed; catalog returns metadata only; signed identity binds all hints/resolutions; bootstrap redacts answers and includes only current-batter hints; frozen order/initials/hints survive materialization; all nine at-bats complete under current rules; current/archive/version saves and locks remain isolated; restore/reset are safe; no archive contribution reaches current-Daily endpoints; exact spoiler-safe archive share; focused tests, typecheck/lint, full build/hidden-answer/file-size/docs gates, bounded fresh review, exact-head CI/Preview, then exact production/push CI/canonical/log/database checks.
- **Stop conditions:** more than 12 handwritten source/test files or ~600 net lines, changes to portable authority/scoring/storage contracts, or new infrastructure require decomposition before expansion. Existing manual device QA remains deferred prelaunch; do not claim physical/browser interaction without evidence.

## Architecture check

Existing Daily runtime owns redaction, signed progression, hints and resolution. Existing schema-2 materialization owns frozen clues; extend its accepted server-only input type to the already-defined beta record, not duplicate gameplay. Public routes own date availability and rendering, not issuance. Route render/request writes never create a puzzle. Token dispatch verifies the signature before choosing the issued-beta source; each runtime still independently verifies exact puzzle identity. Browser storage remains platform-specific and isolates exact archive series/puzzle/ruleset. Existing current-Daily result APIs are not a valid archive population: archive play must not call them or show their averages. No portable package changes are needed.

Expected handwritten paths: serverArchiveBetaRuntime.ts and its test; serverCanonicalRuntime.ts; permanentDailyPuzzleMaterialization.ts; dailyModeStorage.ts and its test; useDailyGameplayPersistence.ts; useCompletedDailyResultSubmission.ts; components/DailyInningGame.tsx; components/DailyModePage.tsx; archive/page.tsx; archive/[dailyNumber]/page.tsx. Keep the existing game coordinator below 500 lines.

## Verified starting checkpoint

#295 merged at b20f0b414512d83260900d2cbd42faa7ef51f0e4 after exact-head CI #1018, READY Preview and bounded review with both findings corrected. Push CI #1019 passed; exact production dpl_GndGRQ15MAiq2Do34uKQhdy279Yy is READY and canonically aliased, HTTP 200 and queried error/fatal scan clean. Read-only database checks preserve one October 4 beta row, original timestamp and content fingerprint; zero permanent rows. Remaining manual admin/mobile QA stays in #294.

## Delivery discipline

The owner reaffirmed quality gates while asking for less fragmentation. Group related implementation around this usable feature, reuse existing seams, and avoid speculative scaffolding. Do not lower review, CI, answer integrity, save isolation or production gates to accelerate delivery.

## Local verification

- 77 focused tests passed across archive runtime, frozen materialization, storage, gameplay lifecycle and ownership. New assertions cover all nine Give Ups under points-v4, redacted bootstrap/current-batter hints, exact signed identity, future/missing rejection, metadata-only catalog and no current-Daily completed-result retry/create from archives. Review regression also rejects same-date rows with an epoch-inconsistent number or puzzle ID before materialization/signing.
- All 677 web tests (100 files), web typecheck/lint, file-size and whitespace checks passed.
- Full strict data generation reported zero critical issues; production Next build and hidden-answer QA passed (2 initial payloads, 31 client chunks). The dynamic archive bootstrap is separately tested for redaction; the existing build scanner's two payloads are not archive interaction evidence.
- React boundary review: pages fetch server-side, serialize redacted bootstrap only, preserve existing hook order and game controls, use identity-keyed storage and accessible navigation. No dependency/schema/portable-package changes; 12 source/test files, below the scoped line threshold.
- Browser automation is unavailable in this environment: both normal and debug `agent-browser open about:blank` failed with `Daemon process exited during startup with no error output`. This is a local tool startup failure before any authentication or app request, not a Vercel plugin/CLI/protected-preview result. Ordinary-browser/mobile gameplay, refresh, two-tab ownership and clipboard interaction remain unverified prelaunch QA; do not claim them from unit tests or plugin HTML fetches.

## Bounded review and initial hosted checkpoint

#296 initial head 35f75dbfba3d2706ad6b3f1d718f86fc63c30f86 passed exact CI #1020 and READY Preview dpl_7hAgMjosvUrFraJ3xyuJ5dvNubq8. Connected-plugin catalog/#1 HTTP 200; malformed/zero/future/unissued numbers HTTP 404. Against the persisted row and canonical index, bootstrap contains all nine frozen initials, no answer IDs/names, and exactly the first batter's four frozen hint values. Error/fatal scan empty; original beta row/timestamp/fingerprint and zero permanent rows preserved. Initial BUILDING-time protected fetch returned 302 deployment_authentication_required, but the same plugin fetched after READY without new login.

First review attempt failed Unknown error without findings; one same-head retry completed the bounded pass. Both P2 findings are fixed in scope: validate loaded series/date/number/ID against the configured epoch, and reconcile the canonical architecture's obsolete unbuilt/empty archive statements. The guard's 77 focused tests and refreshed web production build are required on the fix; exact final-head CI/Preview and post-merge production checks remain mandatory. No further full review pass is requested.

The refreshed local suite passed all 678 web tests. Preview at 962d8a3 failed its build typecheck with `Cannot find namespace JSX` at the archive page return annotation; local ambient types had masked the missing React type import. Both archive pages now explicitly import `JSX` from React, matching existing app conventions. This is a build typing fix, not an authentication failure or new architectural scope. Final commit/build/CI/Preview gates must pass before merge.

## Production completion checkpoint

Final head 44466b45e9c9f9d5fd0899ba8e00e442c4ecabba passed CI #1022 (37329695414) and READY Preview dpl_4SEW96oMT7BXD7wLqRCuHZZgYsqV with repeated issued/missing/future/redaction checks. Both review threads resolved after independently checked in-scope fixes. #296 merged as 299c03130e6820261e130e785c30ac8cc0b1a052; push CI #1023 (37330878074) passed. Exact production dpl_5DK2MWkKP6GmCH54wREN2zw1HBpV is READY (Next.js 15.5.15, 135094 ms build), with canonical initial-baseball-web.vercel.app alias.

Canonical `/`, `/archive`, `/archive/1` returned HTTP 200; homepage links the archive. Unissued `/archive/2` and future `/archive/999999` returned 404. Issued bootstrap preserves all nine frozen initials, current points-v4, exact archive ID/share path, no canonical answer IDs or nine canonical display names, and exactly the first batter's four frozen hint values. Exact-deployment error/fatal 30m scan after more than 60 seconds READY found no logs. Read-only Supabase preserves one October 4 beta row, issued_at 2026-10-05 01:39:24.76+00 and fingerprint bfb08ff7892362e0762d858aa3920d53; zero permanent rows. No live editorial approval/publication performed.

Drains/continuous monitoring remain unverified: connected list-drains returned 404 Not Found; no absence or login failure is inferred. Real browser/mobile interactions remain the explicit checklist in todo, alongside existing admin QA #294. Hosted archive populations/comparison/history and permanent launch remain separate future work. This checkpoint records completed automated/hosted gates, not broad-launch readiness.
