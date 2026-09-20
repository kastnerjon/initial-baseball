# Daily Nine comparison request lifecycle

Status: implemented on PR #207; verification pending  
Date: 2026-09-19

## Scope contract

- **Goal:** add a browser-owned request-lifecycle controller that safely coordinates asynchronous Daily Nine comparison reads without touching gameplay, persistence, or React presentation.
- **Owning layer:** `apps/web`.
- **In scope:** one comparison request controller; independent at-bat and completed channels; semantic request keys; channel-local generation/request IDs; replacement/invalidation abort; stale success/error/settled suppression; whole-session invalidation; focused delayed-response tests; canonical handoff/todo/architecture reconciliation.
- **Out of scope:** React hooks/components; YOU / AVG rendering; low-sample presentation; completed scorecard UI; result writes/delivery retry; analytics-write acknowledgment coupling; request caching/coalescing/backoff; server routes; shared/Daily/engine contracts; Supabase/schema/index/function changes; Classic comparison; R5/R6/R8; new dependencies.
- **Acceptance checks:** starting a replacement request aborts and fences the prior request; explicit channel invalidation aborts and fences late success/error/settled callbacks; `invalidateAll` independently invalidates both channels; at-bat and completed channels never cancel or mutate each other; semantic identity is part of current-request validation; stale cleanup cannot clear newer pending state; source/test files remain within repository size guidance; focused tests, typecheck, full CI, file-size checks and applicable Vercel verification pass.
- **Stop conditions:** any need to change React lifecycle, gameplay/write authority, shared/domain/server contracts, persistence, dependencies, or product presentation moves to a separate PR.

## Architecture

This PR adds the lifecycle layer between the already-merged browser client and future React ownership:

```text
future comparison hook/UI
  -> comparison request controller   [this PR]
  -> browser comparison client       [PR #206]
  -> existing comparison GET API/service
  -> DailyNineComparisonRepository
  -> persistence provider
```

The comparison controller is deliberately separate from `dailyGameplayRequestController`.

Gameplay requests are write-authority sensitive and reject concurrent requests. Comparison reads are replaceable, read-only, and split into independent at-bat/completed channels. Reusing the gameplay controller would couple unlike semantics and make the later UX harder to reason about.

## Request identity

Every active request stores:

- semantic key:
  - at-bat: puzzle ID/date/number + ruleset + pitch;
  - completed: puzzle ID/date/number + ruleset;
- channel-local generation;
- monotonically increasing request ID;
- its AbortController.

Starting a request first invalidates the prior request on that same channel, synchronously incrementing the channel generation and aborting the prior signal.

A callback may mutate consumer state only if the exact semantic key + generation + request ID is still current. Abort is an efficiency mechanism, not the correctness mechanism: a request that settles after abort must still be inert.

At-bat and completed channels maintain independent generation/active state. This allows a final completed-game comparison to coexist with an in-flight final-AB comparison without accidental cancellation.

## UX boundary

No UI is wired in this PR.

The controller exists so the next PR can guarantee:

1. the user's baseball result/points commit immediately;
2. comparison starts asynchronously;
3. Next At Bat does not await comparison;
4. advancing/reset/restore/session loss synchronously fences obsolete comparison work;
5. stale comparison cleanup cannot erase newer loading/data state;
6. comparison failure remains isolated from gameplay.

The controller does not wait for result-write acknowledgement and does not imply that a comparison snapshot includes the user's just-finished result.

## Documentation impact

Add this bounded scope plan and update canonical handoff/todo/architecture after implementation to record request lifecycle as implemented while React comparison ownership and presentation remain next.
