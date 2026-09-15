# Daily Nine points-v3 scoring

Status: Approved implementation scope, September 15, 2026.

## Goal

Make the default Daily Nine scoring easy to explain and consistent across engine calculation, terminal result copy, saved-session restoration, signed progression, and spoiler-safe sharing.

## Product contract

- Every at-bat starts at 7 points.
- Each revealed hint removes 1 point.
- Each wrong guess removes 1 point.
- A third wrong guess records K and awards 0 points.
- Give Up records K and awards 0 points.
- Nine at-bats have a 63-point maximum.
- Baseball outcomes remain HR/3B/2B/1B/BB/K; the points formula is independent of the outcome for correct resolutions.

Player-facing explanation: “Each at-bat is worth up to 7 points. Every hint or wrong guess costs 1 point. Three wrong guesses—or Give Up—score 0 points. Play all 9 at-bats for up to 63 points.”

## Ownership and compatibility

- packages/shared owns the version identifier and current default.
- packages/engine owns the pure points-v3 formula and maximum.
- apps/web transports verified reveal/strike facts and derives terminal display copy.
- points-v2, points-v1, and legacy-inning-v1 are unchanged compatibility policies; completed results are never rewritten.
- No published puzzle, lineup, repeat window, hosting setting, or Classic rules change is in scope.

## Acceptance

- Focused engine tests cover deductions, third wrong guess, Give Up/K, maximum, malformed negative inputs, and v2 compatibility.
- Web resolution and local-storage tests prove raw verified facts drive scoring and restoration.
- Token/share tests accept points-v3 and retain spoiler-safe Daily Nine output.
- Canonical engine/API/data-model/product/architecture/handoff/todo docs describe v3 and compatibility boundaries.
- Full CI, typecheck, production build-order, data/hidden-answer QA, and bounded review pass before merge.

## Stop conditions

Do not mutate prior ruleset formulas, add client-trusted point submissions, add a generic ruleset plugin framework, change puzzle publication/lineups, or fold Classic integration into this change.
