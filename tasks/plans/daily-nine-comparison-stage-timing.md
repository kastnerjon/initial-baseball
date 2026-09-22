# Daily Nine comparison stage-level Server-Timing

Status: implementation checkpoint

## Scope contract

- **Goal:** decompose the production comparison handler long tail enough to identify whether time is spent loading server composition, loading the authoritative puzzle, or performing the managed comparison-provider read.
- **Owning layer:** `apps/web` server composition and comparison HTTP adapters.
- **In scope:** preserve the existing route-total `Server-Timing` metric; add request-local `compose`, `puzzle`, and `provider` submetrics; cover successful and failing stage behavior; reconcile timing evidence and canonical handoff docs.
- **Out of scope:** client telemetry, browser Performance API logging, persistent metrics, database instrumentation, Supabase schema/query/index changes, caching/rollups, scoring/comparison semantics, React/UI changes, retry/backoff, or any latency optimization.
- **Acceptance checks:** disabled responses still avoid server composition; active responses retain the total metric and expose only stages actually attempted; provider timing wraps the repository call rather than Daily normalization; focused/full CI and exact-head Vercel preview pass.
- **Stop conditions:** if the stage sample points to a concrete optimization, make that optimization in a separate PR after production evidence is recorded.

## Design

The existing route total remains the outer timing boundary.

Three request-local submetrics are added:

- `daily-comparison-compose`: dynamic server-module loading/composition at the route boundary;
- `daily-comparison-puzzle`: `dailyRuntime.getPublicPuzzle(...)`, including whatever authoritative public-puzzle path is required for that request;
- `daily-comparison-provider`: the `DailyNineComparisonRepository` call itself, including lazy server Supabase-client/repository creation on the first request and the managed RPC round trip.

Daily average/histogram normalization remains outside `provider`. The residual between total and measured stages continues to cover request parsing, service validation/normalization, response construction and uninstrumented runtime overhead.

Stage recording uses a per-request object passed down from the route. There is no global mutable timing context, request ID, user/browser identity, payload logging or persistent telemetry.

A stage is emitted only if it was attempted. Therefore:
- disabled requests expose only the route total;
- request validation failures after composition expose total + compose;
- puzzle failures expose total + compose + puzzle;
- provider failures expose total + compose + puzzle + provider.

This is still a measurement seam. Production must be re-sampled before any performance conclusion or optimization.
