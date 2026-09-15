# Compact Daily scorebook

Date: 2026-09-08

## Scope contract

- Goal: make guessing immediately accessible and canonical statistics easy to scan on phone, tablet, and desktop.
- Owning layer: apps/web presentation. Existing components already own all affected rendering; reuse them and the current five CSS files.
- In scope: compact masthead/help/status; single current-strike indicator; history after play; quiet secondary actions; readable system typography; flat surfaces; compact career/season tables with separate Season/Team columns and contained scrolling; terminal/complete presentation; focused rendering regressions. Expected source/test files: page.tsx, styles.css, daily-shell.css, daily-game.css, daily-results.css, daily-responsive.css, components/{DailyInningGame,DailyScorebug,AtBatCard,PlayerRevealCard}.tsx, components/AtBatCard.test.tsx, dailyAtBatResolution.test.ts (12).
- Out of scope: scoring, player facts/search semantics, progression/answer authority, persistence/auth/publication, admin redesign, aggregate results, lineup generation and new dependencies.
- Acceptance: focused rendering tests; 320/375/390px phones, 768px tablet, 1440px desktop browser checks for fresh/hinted/search/selected/pending/wrong/terminal/history/refresh/completion states; table overflow remains local and all team IDs and unavailable/zero distinctions remain visible; typecheck, tests, lint, file-size gate, canonical runtime pipeline, production build/hidden-answer QA, PR documentation CI and one bounded review.
- Stop conditions: a new primary layer/dependency/authority or data change; over 12 source/test files or roughly 600 net handwritten added lines; unrelated findings are recorded separately, not absorbed.

## Architecture check

All changes are web-specific rendering and interaction hierarchy. React may depend on current shared types, engine scoring formatters and canonical reveal view models; portable packages must not depend on these components. No rule, normalization, request contract, persistence model or package boundary changes. Existing pendingAdvance facts may be rendered directly without recomputing scores. Product blueprint, START-HERE and todo must record the revised visual direction and verified deployment baseline.

## Sequence

1. Verify latest main, PR/CI/deployment and record production findings.
2. Replace oversized styling; compact header/help/status and move history below play.
3. Simplify active/terminal hierarchy and readable canonical stats tables.
4. Run focused checks and browser gameplay/layout QA; inspect rendered screenshots.
5. Run full gates once, update canonical docs with evidence/limits, one bounded review, push one coherent branch and open PR.

## Baseline

Main d2de746664e7d154294f54dc9ae4b1d55f651ad8 (PR #135) is deployed as dpl_32hGx8N4TKEGKsCaoqHxVbBfVxtf, READY at initial-baseball-web.vercel.app. No open PRs at inspection. PR #135 head CI run 33282802850 passed. Handoff/todo still incorrectly requested its merge. Vercel runtime errors returned five occurrences of insufficient eligible Daily players for slot 2 (ranks 1-250), with timestamps spanning September 3–8; this is a separate production follow-up, not evidence of a UI defect or a healthy runtime.


## Follow-up polish — September 15, 2026

The masthead and footer stay on the same 640px content rail as the game surface while preserving the wider page container for desktop statistics. Scorecard rows use balanced three-column alignment for initials, canonical answer, and outcome; wrapping and tap-target sizing remain intact at mobile breakpoints.
