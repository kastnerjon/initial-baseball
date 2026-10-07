# Center at-bat hint and comparison details

Status: CSS implementation complete; exact review/release evidence is recorded in the implementing PR.

## Scope contract

- **Goal:** center the hint content/button below initials and the terminal YOU/AVG/BEAT/status/note block below the outcome, matching the owner's October 7 screenshots.
- **Owning layer:** apps/web CSS presentation.
- **In scope:** existing hint-list/empty/button and at-bat comparison selectors; shrink-to-content centered hint block with bounded width; retain left-aligned multiline clue text and existing Hints/count header; canonical docs and focused existing render checks.
- **Out of scope:** player reveal alignment, guess/action rows, completed-game layout, scoring, comparison math/samples, writes/persistence, archive history, broader visual redesign, dependencies and database changes.
- **Acceptance:** center empty and revealed clue content/button; center metric/status/note rows including wrapping/loading/unavailable; long clue text wraps without overflow and remains readable; header/player reveal remain unchanged; existing component tests, typecheck/lint, file-size/docs/whitespace checks, required full suite/data/build, exact-head review/CI/READY Preview and post-merge checks. Record physical-device QA separately.
- **Stop conditions:** JS/component behavior change, new abstraction/dependency or layout redesign beyond the two highlighted sections; separate any such finding.

## Architecture and effects

Reuse the current semantic markup and scoped CSS classes. Grid item alignment centers the hint block/button without changing the heading; the hint block keeps its existing label/value grid and left text alignment. The block's maximum width and zero minimum width allow long clues to wrap. Comparison text plus flex justification center each row without changing its live region, status text or domain math. No engine/Daily/shared/DB change or React hook change; current and archive consumers retain the same rendering path.

## Starting checkpoint

Main `c61bbaf727ad3026eaf8ed29605c4bb642278d35`, canonical production READY at that SHA, no open PRs, Supabase ACTIVE_HEALTHY. #323 archive comparisons are production-verified. Local archive history stays next separate work.

## Verification

15 existing focused AtBatCard/result/comparison render tests passed; full workspace tests passed (773 web tests/108 files). Typecheck, lint, file-size, whitespace and documentation-gate tests passed. Strict data pipeline, season-card QA, 13,620-player runtime QA, production build and hidden-answer scan passed. No new unit test mirrors CSS declarations.

Existing 640px/360px hint-grid breakpoints remain intact. Centered content is bounded by max-width 100%/min-width 0 and existing clue-value overflow wrapping; comparison status already wraps. Cloud browser policy blocks local fixture pages, so narrow-width visual and physical-device QA remain open. Hosted visual verification and exact CI/Preview/production evidence belong to the implementing PR. Build-generated saves/Next configuration changes excluded; no dependency, JavaScript or database change.
