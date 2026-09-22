# Daily Nine terminal at-bat comparison UI

Status: implemented on PR #208
Date: 2026-09-19

## Scope contract

- **Goal:** show an asynchronous YOU / AVG comparison after each terminal Daily Nine at-bat without delaying the user's baseball result or Next At Bat action.
- **Owning layer:** `apps/web`.
- **In scope:** a dedicated identity-keyed React hook over the existing comparison client/controller; terminal at-bat comparison presentation; settled 0–1 / 2–9 / 10+ sample states; quiet unavailable state; restored-terminal reads; synchronous fencing on advance/reset/restore; focused static-render presentation tests; canonical handoff/todo/architecture updates; one durable workflow lesson about batching GitHub writes to avoid unnecessary Vercel builds.
- **Out of scope:** completed-game comparison, final scorecard comparison rows, strict-lower finisher percentage, comparison caching/coalescing/backoff, result-write retry changes, persistence ownership changes, server/shared/Daily/engine/database changes, Classic comparison, R5/R6/R8, new dependencies or mounted DOM test infrastructure.
- **Acceptance checks:** the terminal baseball result remains renderable before comparison resolves; comparison loading/small-sample/normal/unavailable states render without changing the Next button; exact puzzle/ruleset/pitch identity drives reads; stale comparison callbacks are fenced by the existing request controller; reset/restore/advance invalidate obsolete at-bat reads; no comparison request waits for analytics delivery acknowledgment; focused tests, typecheck, full CI, file-size checks and Preview/browser verification pass.
- **Stop conditions:** any need to alter scoring rules, persistence/write authority, result-delivery retry, shared/API contracts, Supabase, dependencies, or completed-game comparison moves to another PR.

## Architecture

```text
DailyInningGame hydrated active identity + nullable engine-derived point delta
  -> useDailyNineAtBatComparison
     -> Daily Nine comparison request controller   [PR #207]
     -> Daily Nine comparison browser client       [PR #206]
     -> existing comparison GET API/service
  -> DailyNineAtBatComparison presentation
  -> AtBatCard
```

The hook owns only browser read state. It does not persist comparison data, resend analytics writes, or know whether the provider uses raw reads or a future rollup.

`DailyInningGame` derives the user's awarded points from the already-computed engine transition: terminal pending total minus the pre-at-bat total. The UI therefore does not duplicate the points-v3 scoring formula.

## UX

The user's outcome and awarded points continue to render immediately from the existing terminal result path. A September 22 follow-up moves only the comparison **read** earlier: once saved-game hydration is complete, the exact points-v3 slot is prefetched while the AB is active. The prefetched read state is never exposed by the active card or public hook state before terminal resolution.

Presentation policy:

- loading: show YOU and a quiet loading AVG state;
- 0–1 received results: hide the average and say more results are needed;
- 2–9: show the average, count and an Early average label;
- 10+: show the average and count normally;
- read failure/malformed response: show a quiet comparison-unavailable state only.

Counts are labeled as received results, not people. The UI never says the user's just-finished result is already included.

Next At Bat / View Results remains independent from comparison state.

## Lifecycle

The request key is exact puzzle ID/date/number + points-v3 + pitch number. The PR #207 controller remains the stale-callback authority. The network effect depends only on that key; engine-derived own points are a separate nullable presentation input and intentionally do not restart the request.

Prefetch does not begin until saved-game hydration has selected the authoritative current pitch, preventing a throwaway pitch-1 read from initial React defaults. Advance, Reset and durable restore fence the prior at-bat read synchronously before changing identity. Live play normally moves the aggregate read ahead of the player's result write, but no exact self-exclusion guarantee is claimed if that read is still in flight when the write lands. A separately restored terminal pending at-bat starts a fresh current read from the restored identity; comparison snapshots are not persisted. Comparison state stays outside gameplay persistence and result-delivery hooks.

## Testing boundary

The repository still has no mounted DOM-capable React test dependency. This PR does not add one. Existing client/controller tests cover transport and stale-request mechanics; `AtBatCard` static-render tests cover the new player-facing states. Preview/browser verification supplies integration evidence.

## Documentation impact

Update START-HERE, architecture, todo and the comparison roadmap to record terminal at-bat YOU / AVG as implemented while completed-game comparison remains next. Record the Vercel build-rate workflow lesson in `tasks/lessons.md`.
