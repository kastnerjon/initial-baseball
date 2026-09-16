# Classic mode-aware browser experience scope

Status: active bounded implementation, September 16, 2026.

## Goal

Expose Classic Inning as a first-class browser mode at `/classic` while keeping Daily Nine at `/`, using the same public puzzle and signed server transport but isolated browser saves and mode-aware completion/results/sharing.

## Owning layer

Primary owner: `apps/web` presentation and browser persistence. Baseball outcomes/completion remain in `packages/engine`; signed progression remains in the existing web server runtime.

## In scope

- `/` requests the default Daily Nine `points-v3` bootstrap and `/classic` requests `classic-inning-v1`;
- shared page composition so both modes render the same core game without duplicating gameplay logic;
- clear Daily Nine / Classic Inning navigation and mode identity in completion/share presentation;
- initialize browser `DailyGameState` from the server bootstrap ruleset rather than always assuming the current points ruleset;
- dedicated Classic local-storage key/namespace while preserving the existing default Daily key and schema compatibility for points-v1, points-v2, points-v3 and legacy saves;
- load/save/clear/reset only the selected mode;
- mode-aware active, pending-resolution, completed, refresh and hint-restoration flows;
- terminal Classic completion after three outs without advancing to an unplayed batter;
- scorecard/reveal/share behavior that includes only played/resolved batters so unplayed Classic answers remain hidden;
- focused component/storage/state tests, browser QA, canonical docs and handoff reconciliation.

## Out of scope

- changing engine baseball mechanics or the `classic-inning-v1` contract;
- changing puzzle identity, lineup selection, admin/editor behavior or publication;
- server-side gameplay sessions or per-action persistence;
- aggregates, percentiles, accounts, leaderboards or head-to-head;
- new dependencies, hosting settings or database migrations;
- broad visual redesign beyond the minimum mode navigation/label treatment.

## Compatibility contract

- Existing Daily Nine storage key remains unchanged so current users keep their saved game.
- Classic uses a distinct key derived from the same puzzle date and cannot overwrite/reset Daily Nine.
- Legacy/default saves continue to normalize under their stored/safe inferred ruleset exactly as before.
- The signed bootstrap ruleset is authoritative for a newly initialized game and must match the mode page.

## Acceptance checks

- `/` initializes points-v3 and `/classic` initializes Classic from the same daily puzzle/date;
- switching modes preserves independent progress;
- reset in one mode leaves the other mode untouched;
- refresh restores active, pending-advance and completed state in the correct mode;
- Classic third-out/Give Up/third-wrong-guess completion does not expose or advance to the next batter;
- Classic with fewer than three outs may continue through batter nine and then completes;
- Daily Nine still plays all nine regardless of recorded strikeouts;
- saved points-v1/points-v2/legacy default-key sessions remain readable;
- scorecard and share output never reveal unplayed Classic answers;
- clipboard share remains spoiler-safe and mode-labelled;
- desktop, phone and tablet browser layouts remain usable;
- full CI, file-size, build/data QA, hidden-answer checks and exact-head Vercel preview pass.

## Stop conditions

Stop and split if work requires a storage schema redesign rather than a namespaced key, a new API/dependency, any server authority change, changes to engine rules, or exceeds repository decomposition thresholds.
