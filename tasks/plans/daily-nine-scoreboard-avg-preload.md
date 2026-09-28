# Daily Nine scoreboard AVG preload

## Goal

Show each exact-slot Daily Nine comparison AVG in the inning scoreboard from the start of the game, as soon as that comparison read resolves, and keep it available throughout play.

This is a browser-consumer change only. It must not change scoring, result persistence, comparison population semantics, Supabase schema/RPCs, or the existing Daily Nine comparison HTTP contract.

## Product contract

- Request all nine exact-slot at-bat comparison aggregates after saved-game hydration.
- Bind every request to the exact puzzle identity, exact ruleset version, and exact pitch number already used by the comparison client.
- Keep gameplay nonblocking if one or more comparison reads are slow or fail.
- Show a successfully loaded per-AB AVG before that AB is played or resolved.
- Keep successfully loaded values visible while play advances.
- Use a loading presentation while a supported comparison is still in flight; reserve `—` for genuinely unavailable or sample-withheld values.
- Preserve the existing 0–1-result withholding policy.
- Continue refreshing low-sample/unavailable completed slots when gameplay advances so a newly written result can become visible without changing comparison semantics.
- Reuse the same cached slot for the terminal YOU / AVG result card instead of issuing a second active-slot comparison request.
- TOTAL AVG remains separate: it is `—` before completion and is sourced only from the authoritative completed-game comparison after completion. Never derive TOTAL AVG from the nine per-AB averages.

## Owning layer

The browser comparison-consumer layer owns this work:

- the existing multi-pitch comparison cache/request controller owns concurrent exact-slot reads and stale-response fencing;
- the Daily Nine game composition supplies all nine requested pitch numbers plus completed-pitch progress;
- pure presentation code decides loading/display/withheld rendering;
- React does not calculate aggregate comparison semantics.

The server read service, comparison domain, Supabase repository/RPCs, scoring engine, and persistence layers remain unchanged.

## Implementation plan

1. Generalize the existing scorecard comparison cache input so requested pitch numbers and completed pitch numbers are separate concepts.
   - requested pitches: all nine puzzle slots after hydration;
   - completed pitches: only gameplay-completed slots, used to trigger the existing low-sample/error refresh behavior.
2. Preserve bounded concurrency and independent per-pitch request ownership. Do not use the single active-at-bat request channel for nine concurrent reads.
3. In `DailyInningGame`, request all puzzle pitch numbers through that cache and derive the active terminal comparison state from the cached current slot plus authoritative engine-derived own points.
4. Remove the redundant active-at-bat network request ownership from game composition; retain pure state projection helpers where useful.
5. Update inning-scoreboard presentation so per-AB comparison display no longer depends on the user's AB being resolved.
   - loading/missing cache entry for a supported slot renders a loading glyph;
   - successful 2+ sample aggregate renders the formatted AVG;
   - unavailable/null/0–1 sample remains `—`.
6. Leave completed-game comparison and TOTAL AVG wiring untouched except for any presentation test needed to prove it remains authoritative.
7. Add focused tests for:
   - all nine slots being eligible for preload independent of completion;
   - bounded independent pitch reads and identity reset behavior;
   - completed-pitch advancement refreshing only eligible low-sample/unavailable cached states;
   - pre-resolved scoreboard AVG visibility;
   - loading vs withheld/unavailable presentation;
   - terminal active card projecting the already cached slot;
   - points-v4 half-point averages;
   - TOTAL AVG never being derived from per-AB values.
8. Reconcile `docs/START-HERE.md`, `tasks/todo.md`, and `tasks/plans/2026-09-27-near-term-product-sequence.md` after implementation.

## Scope / stop conditions

Split into another PR rather than expanding this one if implementation requires any of:

- a new comparison API or batch endpoint;
- a Supabase migration/RPC change;
- a change to exact puzzle/ruleset comparison identity;
- a new scoring or sample-threshold rule;
- archive-specific behavior;
- gameplay blocking on comparison reads.

## Verification

Before merge:

- focused comparison/cache/presentation tests;
- `corepack pnpm typecheck`;
- `corepack pnpm test`;
- `corepack pnpm check:file-sizes`;
- exact-head GitHub CI;
- exact-head Vercel Preview;
- fresh-eye code/architecture review;
- no unresolved review threads.

Supabase hosted verification is not required unless the implementation unexpectedly changes hosted persistence/read contracts. After merge, verify exact main push CI, exact production deployment, live page response, error/fatal runtime logs, and open-PR state.
