# Daily Nine comparison stage-level Server-Timing

Status: implemented and production-sampled

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


## Production result

PR #223 merged as `128e52702b98247af81f2f8230a335dd24d1b5e4`. Exact production deployment `dpl_FrAYsxTB3HXih3HkU52SrwsiXtbq` is READY and post-merge CI #804 passed.

A 15-sample-per-route production re-sample shows that puzzle loading is not the observed extreme-tail owner. The strongest completed request measured 2,502 ms total with 2,495 ms in `provider`, 7 ms in `puzzle`, 0 ms in `compose`, and 0 ms residual at millisecond resolution. Other slow completed reads were similarly provider-dominant (400/406 ms and 271/280 ms). At-bat reads also showed provider-heavy tails, although the two largest at-bat samples retained about 260–269 ms of residual runtime/handler time.

A read-only production `pg_stat_statements` check separately shows the matching PostgREST SQL statements remain low-millisecond: completed mean 1.921 ms / max 19.696 ms over 67 calls; at-bat mean 1.594 ms / max 17.332 ms over 127 calls. Those database statistics do not include Vercel-to-Supabase transit, API/PostgREST handling outside database execution, pool/connection acquisition, or response transit.

Conclusion: preserve the raw-read SQL/index architecture. The next bounded measurement is inside the web provider adapter itself: separate local client/repository setup, `client.rpc(...)` wait, and local decode. Any provider behavior change remains a later PR after that evidence.
