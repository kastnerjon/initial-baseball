# Bottom Scoreboard inline revealed answers

## Bounded scope contract

- **Goal:** Reveal ON reads `BH - Bryce Harper`, with the name starting beside initials; OFF shows initials only. All five metrics remain visible without horizontal scrolling.
- **Owner:** existing `apps/web` Scoreboard presentation and scoped CSS.
- **In scope:** dash separator, inline aligned player/answer subcolumns, mobile Player space, focused tests/render evidence and canonical documentation.
- **Out of scope:** top tracker, Game Complete, sharing, Classic, scoring/comparison semantics, state/persistence, APIs/data/Supabase or dependencies.
- **Architecture:** reuse the same component and resolved-only answer map; flex subcolumns in the existing Player cell let long names wrap in their own space rather than beneath initials. No new responsive JS or rule.
- **Acceptance:** 320/360/375/390/430/tablet/desktop rendered widths; Reveal OFF/ON; long names, half points, missing/populated metrics and TOTAL; no horizontal overflow or clipping. Focused/full required checks, independent review, exact-head CI/READY Preview, merge and production gates.
- **Stop:** new dependency/architecture, answer-authority or semantic change, or inaccessible fit requiring owner decision.

## Baseline

Main `78df1c99404cf0b32d772c0a3585ce3e2f9ead79` (#330), push CI #1111 succeeded, production `dpl_26CEL5uYgb4PCFUBvc2CgnFsfxoL` READY/canonical, no open PRs, Supabase ACTIVE_HEALTHY. Owner physical-phone feedback supersedes the prior explicit second-line answer treatment; preserve the successful all-metrics-visible correction.

## Render evidence

120 exact-component Chromium cases passed: 0/3/9 ABs × compact/completed × OFF/ON × 320/360/361/375/390/430/640/641/768/1366px. All names begin alongside initials; long names wrap only within their own flex subcolumn. No page/card/table overflow, text clipping or header overlap; TOTAL columns align. At 390px `BH - Bryce Harper` fits on one line. BB 0.5 and worst-width TOTAL 36 / 36.0 / 100% remain readable. Keyboard native disclosure/switch and default answer hiding pass. Screenshots inspected at 320/390/768/1366. No hosted results submitted; physical iPhone acceptance remains separate.

## Review and checks

One independent reviewer found no in-scope issues, separately reran all 120 Chromium cases/eight focused tests and inspected 320/390px screenshots. Full repository typecheck/lint/tests, file-size checks and production web build/hidden-answer QA passed locally. Existing strict data outputs remain unchanged; hosted CI reruns the required data pipeline. No generated/build-config changes are included. Exact-head CI/READY Preview and post-merge production evidence are retained in the associated PR before reporting release completion.
