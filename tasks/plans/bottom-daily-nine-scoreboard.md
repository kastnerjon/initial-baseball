# Bottom Daily Nine Scoreboard — bounded step 1

Status: Implementation committed for CI, review, and owner visual QA.

## Scope contract

- **Goal:** replace the existing bottom points-mode at-bat scorecard with a detailed Scoreboard; leave the current top nine-column scoreboard untouched.
- **Owner:** `apps/web` private presentation + existing web comparison presentation.
- **In scope:** AB / Player / OUTCOME-SCORE / AVG / BEAT % table, local Reveal answers toggle default OFF, resolved-name fallback, actual cumulative personal TOTAL and separately sourced completed-game AVG/final-only BEAT; mobile responsive presentation, tests, canonical docs.
- **Out of scope:** top scoreboard replacement, progress circles, gameplay/hint/search, post-AB chart, Game Complete card redesign, share format, scoring, backend/database/result writes, Classic, archive issuance, new dependencies.
- **Acceptance:** no resolved names present in table HTML with toggle OFF; toggle shows only names received in existing resolved terminal answers; zero/one peer and histogram-missing cases safely show — or strictly lower BEAT, ties not beaten; TOTAL BEAT does not appear before personal completion; exact puzzle/version/exclusion preserved by existing read hooks; Classic and spoiler-safe share remain unchanged. CI, READY Preview, bounded fresh-eyes review and production checks.
- **Stop conditions:** any cross-layer/scoring/data-contract/persistence/auth change, new dependency, or unrelated UX redesign.

## Architecture

The existing `PitchResultList` still coordinates points-versus-Classic rendering; a new small web-only `DailyNineDetailedScoreboard` owns the detailed table and local show/hide control. Existing `dailyNineScorecardComparisonPresentation` provides the row model used by share; new BEAT derivation reuses the existing terminal at-bat strict-lower helper and completed-game presentation. No additional reads, writes, or persisted state are introduced. Only already resolved canonical answers can enter the table. The scoreboard reports an accurate partial personal TOTAL and an independent whole-game peer AVG throughout play; only final scores permit whole-game BEAT.

## Deferred

Wait for owner visual acceptance of the bottom Scoreboard before replacing the top numerical scoreboard with nine progress circles. Mobile physical-device QA remains open independently.

## Documentation impact

Reconcile the product blueprint, architecture private recap, START-HERE and TODO; no engine/API/schema documentation changes.
