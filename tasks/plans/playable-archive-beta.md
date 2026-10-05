# Playable archive beta

Status: Implemented locally; review/CI/Preview and production gates pending
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

- 76 focused tests passed across archive runtime, frozen materialization, storage, gameplay lifecycle and ownership. New assertions cover all nine Give Ups under points-v4, redacted bootstrap/current-batter hints, exact signed identity, future/missing rejection, metadata-only catalog and no current-Daily completed-result retry/create from archives.
- All 677 web tests (100 files), web typecheck/lint, file-size and whitespace checks passed.
- Full strict data generation reported zero critical issues; production Next build and hidden-answer QA passed (2 initial payloads, 31 client chunks). The dynamic archive bootstrap is separately tested for redaction; the existing build scanner's two payloads are not archive interaction evidence.
- React boundary review: pages fetch server-side, serialize redacted bootstrap only, preserve existing hook order and game controls, use identity-keyed storage and accessible navigation. No dependency/schema/portable-package changes; 12 source/test files, below the scoped line threshold.
- Browser automation is unavailable in this environment: both normal and debug `agent-browser open about:blank` failed with `Daemon process exited during startup with no error output`. This is a local tool startup failure before any authentication or app request, not a Vercel plugin/CLI/protected-preview result. Ordinary-browser/mobile gameplay, refresh, two-tab ownership and clipboard interaction remain unverified prelaunch QA; do not claim them from unit tests or plugin HTML fetches.
