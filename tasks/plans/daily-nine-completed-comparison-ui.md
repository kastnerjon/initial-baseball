# Daily Nine completed-game comparison UI

Status: implemented on PR #209; verification pending
Date: 2026-09-19

## Scope contract

- **Goal:** show current completed-game Daily Nine comparison on the final results screen without delaying the ninth-player reveal, View Results, sharing, or completion delivery.
- **Owning layer:** `apps/web`.
- **In scope:** a dedicated completed-comparison React hook over the existing comparison client/controller; prefetch from the final engine-complete transition; current-read refresh on restored completed games; whole-game YOU / AVG presentation; strict-lower BEAT percentage using the existing Daily-domain helper; settled 0–1 / 2–9 / 10+ average thresholds and 20-completion BEAT threshold; quiet unavailable state; reset/restore fencing; focused pure/static-render tests; canonical handoff/todo/architecture updates.
- **Out of scope:** per-row historical at-bat averages on the final scorecard, comparison caching/coalescing/backoff, result-write retry changes, persistence authority changes, server/shared/Daily/engine/database changes, Classic comparison, latency instrumentation, R5/R6/R8, new dependencies or mounted DOM test infrastructure.
- **Acceptance checks:** the completed read can start while the ninth terminal reveal is still visible; moving to View Results does not restart a semantically identical request; restore fetches current comparison; ties are not counted as beaten; BEAT stays hidden below 20 completed results; comparison failure affects only comparison UI; focused tests, typecheck, full CI, file-size checks and applicable Preview verification pass.
- **Stop conditions:** any need to change scoring, comparison contracts, persistence/write authority, result delivery, Supabase, dependencies, or Classic behavior moves to another PR.

## Architecture

```text
final points-v3 engine transition / restored completion
  -> useDailyNineCompletedComparison
     -> Daily Nine comparison request controller [completed channel]
     -> Daily Nine comparison browser client
     -> existing completed comparison GET API
     -> getDailyNineStrictLowerFinishRate [packages/daily]
  -> DailyNineCompletedComparison presentation
  -> GameCompleteView
```

The hook owns browser read state only. The completed population remains independent from resolved-at-bat observations and from completed-result write delivery.

The browser does not reimplement tie semantics: `getDailyNineStrictLowerFinishRate` remains the portable Daily owner. React only formats the returned fraction for display.

## Request timing

The input helper accepts the current engine points summary plus an optional pending terminal points summary.

- On the ninth terminal reveal, the pending engine summary is already complete, so the completed read starts before View Results.
- After View Results, the committed engine summary has the same puzzle/ruleset/final-score identity. The hook depends on those scalar values, so the in-flight/current request does not restart merely because UI state moved from pending to committed.
- A restored completed game constructs the same current-read input and fetches present comparison data; historical averages are not persisted.

Reset and durable restore synchronously invalidate the completed channel before replacing local identity/state.

## Presentation

- loading: show YOU and a quiet loading AVG state;
- 0–1 completed results: withhold AVG and wait for more results;
- 2–9: show Early average plus completed-result count;
- 10–19: show normal average and count; explain that BEAT appears at 20;
- 20+: show YOU / AVG / BEAT plus count; ties are explicitly not counted as beaten;
- unavailable/malformed read: comparison-only unavailable state.

Counts are labeled completed results, not unique people. The UI does not claim the user's own completion is already included.

## File-size boundary

`DailyInningGame.tsx` entered this PR at the repository's 500-line ceiling. The integration remains thin; import formatting provides the required headroom instead of extracting unrelated gameplay behavior or waiving the gate.

## Documentation impact

Update START-HERE, architecture, todo and the resolved-at-bat comparison roadmap to record completed-game comparison as implemented and make real end-to-end latency/mobile verification the next comparison checkpoint.
