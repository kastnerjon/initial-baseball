# Daily Nine browser comparison client

Status: in progress  
Date: 2026-09-19

## Scope contract

- **Goal:** add a browser-owned, read-only Daily Nine comparison transport/decoder that can safely support later asynchronous UI without touching gameplay or persistence.
- **Owning layer:** `apps/web`.
- **In scope:** typed browser GET client for the existing at-bat and completed comparison routes; runtime decoding of schema-1 success/error payloads; authoritative response-identity verification against the requested puzzle/ruleset/slot; explicit `cache: 'no-store'`; caller-supplied `AbortSignal`; focused transport/decode tests; canonical handoff/todo reconciliation.
- **Out of scope:** request generation/stale-callback lifecycle; React hooks or components; YOU / AVG presentation; sample-size copy; completed scorecard UI; result writes or delivery retries; coupling reads to AB/completed-result acknowledgment; caching/coalescing/retry timers; Supabase/schema/index/function changes; scoring/domain changes; Classic comparison; R5/R6/R8; new dependencies or DOM test infrastructure.
- **Acceptance checks:** valid schema-1 responses decode; malformed/unexpected/error responses fail closed; a response whose server-derived puzzle/ruleset/pitch identity differs from the request is rejected; both read methods propagate the caller's abort signal and use browser `no-store`; no browser UI imports the new client yet; focused tests, typecheck, full CI, file-size gate and applicable Preview checks pass.
- **Stop conditions:** any need to change the shared HTTP contract, Daily comparison semantics, gameplay/persistence authority, server routes, Supabase, dependencies, or React lifecycle belongs in a separate PR.

## Architecture

This PR introduces only the web/browser side of the existing seam:

```text
future comparison request controller/hook/UI
  -> browser comparison client   [this PR]
  -> existing GET /api/daily/comparison/*
  -> existing server comparison service
  -> DailyNineComparisonRepository
  -> current raw-read Supabase provider
```

The browser client does not know or care whether the provider aggregates immutable raw rows or later reads a projection. That migration remains contained behind `DailyNineComparisonRepository`.

Request generation and stale-callback fencing are deliberately deferred to the next bounded browser-lifecycle PR. This client only accepts a caller-owned `AbortSignal` and validates that a successful response belongs to the exact semantic request identity.

## UX boundary for the next PR

This PR does not wire UI. Its API is designed so the next PR can:

1. commit the user's terminal baseball outcome/points immediately;
2. start comparison asynchronously without awaiting analytics/result writes;
3. leave Next At Bat usable regardless of comparison state;
4. use the next bounded request-lifecycle controller to fence old reads on advance/reset/restore/session loss;
5. degrade a comparison failure to comparison-only unavailable state.

Briefly stale population snapshots and non-self-inclusion remain acceptable. No UI may claim the returned average includes the user's just-written result.

## Decode policy

Do not trust a TypeScript cast from `response.json()`.

The client validates:

- schema version and response kind;
- exact server-derived puzzle ID/date/number/ruleset;
- exact pitch for at-bat reads;
- non-negative safe counts;
- finite/null averages;
- completed histogram as non-negative safe integer counts;
- freshness timestamp shape and `live | cached` status.

The client does not duplicate scoring formulas or presentation thresholds. Domain/presentation owners retain those responsibilities.

## Documentation impact

Add this bounded scope plan and update the canonical handoff/todo/architecture after implementation to record that browser comparison transport/decoding exists while request lifecycle and presentation remain unimplemented.
