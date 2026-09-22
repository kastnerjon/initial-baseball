# Daily Nine scorecard/share average

Status: issue #216 implementation scope
Date: 2026-09-22

## Scope contract

- **Goal:** show the existing whole-game Daily Nine comparison AVG on both completed scorecard surfaces: the private answer scorecard and the spoiler-safe copied/shareable output.
- **Owning layer:** `apps/web` presentation.
- **In scope:** derive scorecard/share presentation from the existing `DailyNineCompletedComparisonState`; preserve the settled 0–1 withheld / 2–9 early / 10+ normal AVG policy; render the displayable whole-game AVG inside the private scorecard; decorate the existing spoiler-safe share text with only whole-game AVG plus completed-result count; keep clipboard status tied to the exact text copied; focused tests and canonical documentation.
- **Out of scope:** new comparison reads, new aggregate calculations, Supabase/API/shared/engine changes, scoring changes, per-at-bat averages on completed/share scorecards, BEAT in copied share text, onset-of-AB AVG display, Classic comparison, persistence changes, or browser/mobile verification unrelated to this presentation.
- **Acceptance checks:** scorecard/share surfaces reuse the same completed-comparison state; 0–1 and unavailable/loading states do not publish an AVG; 2–9 says `Early AVG`; 10+ says `AVG`; copied output remains answer/spoiler-safe; comparison arrival never blocks sharing; focused tests, typecheck, file-size/full CI and exact-head Preview pass.
- **Stop conditions:** any need to change comparison population/sample semantics, scoring, transport, storage, result delivery or engine share contracts becomes separate work.

## Design

The engine-owned `DailyShareResult` and `formatDailyShareText` remain unchanged. They describe the user's immutable game result and stay portable.

The web completion screen already owns a current asynchronous `DailyNineCompletedComparisonState`. A small pure web presentation helper converts that existing state into:

- the existing YOU / AVG / BEAT presentation;
- an optional scorecard AVG view model only when the settled sample policy allows an actual average;
- one spoiler-safe share line such as `Early AVG 34.3 · 7 completed results` or `AVG 33.5 · 19 completed results`.

The helper does not fetch, aggregate or score anything. It only formats the already-returned completed-game average.

The private scorecard may still contain answer names. The share line contains only the whole-game aggregate and completed-result count. Per-AB averages and answer data remain excluded.

Because comparison can arrive after the completion screen is already usable, sharing stays available immediately. If share text changes after an earlier copy, the Copy UI must not claim the newly displayed text is already on the clipboard; copy state therefore records the exact text written.

## Documentation impact

Reconcile START-HERE, todo, architecture and the comparison roadmap to mark issue #216 implemented without changing comparison/backend architecture.
