# Daily Nine comparison provider sub-timing

Status: implemented and production-evidenced

## Scope contract

- **Goal:** split the already-identified web provider boundary into local setup, managed RPC wait and local response decode without changing comparison behavior.
- **Owning layer:** `apps/web` server-only comparison composition and Supabase comparison adapter.
- **In scope:** preserve the existing total/provider timings; add request-local `provider-setup`, `provider-rpc` and `provider-decode`; preserve lazy module-level Supabase client reuse; test successful and failed provider paths; reconcile canonical docs.
- **Out of scope:** Supabase schema/RPC SQL/index changes, transport replacement, caching/rollups, timeouts/retries, client/browser telemetry, React/UI changes, scoring/comparison semantics, or any latency optimization.
- **Acceptance checks:** invalid/puzzle-failed requests still do not initialize the provider; successful reads emit the nested stages in stable order; query failures record RPC wait without inventing decode time; full CI and exact-head Preview pass.
- **Stop conditions:** any change intended to improve latency rather than measure it becomes a separate PR after production sub-timing evidence is recorded.

## Design

The existing `daily-comparison-provider` timer remains the parent boundary.

Nested metrics:

- `daily-comparison-provider-setup`: synchronous provider preparation for the request. This includes checking/reusing the module-level Supabase client, creating it on first use if necessary, and creating the small request-scoped repository wrapper that carries the timing context.
- `daily-comparison-provider-rpc`: only the awaited `client.rpc(...)` operation.
- `daily-comparison-provider-decode`: only local validation/decoding of a successful RPC payload into provider sufficient statistics.

The module-level Supabase client remains lazy and reused. The request-scoped repository wrapper is deliberately cheap and contains no network state; recreating it is how request-local timing reaches the adapter without global mutable timing context or changing the portable Daily repository contract.

A query error records setup + RPC but no decode. A configuration/setup failure records setup but no RPC/decode. Request validation or puzzle failure still occurs before any provider setup.

The integer-millisecond nested timings need not sum exactly to the parent provider duration because of rounding and tiny uninstrumented call overhead. The parent remains the authoritative provider boundary.

Production re-sampling is complete on PR #225 / main `90073bccd67002fdaf6fa85f5707be5f8968051b`. Across 15 successful samples per route, provider setup was 0 ms median, decode was 0 ms median, and the provider long tail tracked `client.rpc(...)` wait: at-bat RPC median 54 ms with 1,495 ms max; completed RPC median 65 ms with 2,125 ms max. Matching hosted PostgreSQL statements remain low-millisecond. No SQL/index/rollup/cache change is justified by this checkpoint.

The next bounded behavior change is an at-bat-onset comparison prefetch that hides managed RPC latency behind gameplay while withholding AVG presentation until terminal reveal.
