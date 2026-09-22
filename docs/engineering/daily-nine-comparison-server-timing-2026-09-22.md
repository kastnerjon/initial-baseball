# Daily Nine comparison production Server-Timing evidence — September 22, 2026

Status: handler, stage, and provider-subtimed production samples recorded; multi-second tail is localized to awaited RPC while matching PostgreSQL execution remains low-millisecond; storage/query optimization is stopped for this beta checkpoint

## Purpose

Record the first production distribution from the comparison `Server-Timing` seam added in PR #221 before making any optimization decision.

This is a server-handler measurement, not a browser SLO result. It intentionally does not claim mobile trigger-to-visible p50/p95.

## Exact production checkpoint

- Git main: `aa4f675f99be78bd477676c06f655be72c1e9b6d` (PR #221).
- Production deployment: `dpl_3BnRpsfNcL9TrBKJwYWnDpKs9pQS`.
- Deployment state: READY with canonical production alias and no alias error.
- Post-merge CI: run #800 / run ID `35734103471`, successful on unchanged rerun after the first attempt hit the existing long-horizon lineup test's 30-second timeout by 169 ms.
- Production runtime-error scan after deployment: clean.
- Routes sampled:
  - `GET /api/daily/comparison/at-bat?date=2026-09-22&ruleset=points-v3&pitch=1`
  - `GET /api/daily/comparison/completed?date=2026-09-22&ruleset=points-v3`
- Every retained sample returned HTTP 200 and `Cache-Control: private, no-store`.

The first verification payloads in the window reported zero current-Day observations for pitch 1 and zero completed games. That makes a large current-Day aggregate population an implausible explanation for the observed outliers, although this sample did not independently snapshot table cardinality before every request.

## Method

Twenty successful handler-duration samples were retained for each route from the public production alias.

The metric begins at the top of the Next GET adapter and ends immediately before response return. It includes work performed inside the handler, including request parsing, lazy server composition, authoritative-puzzle loading, managed Supabase/PostgREST/provider work, Daily normalization and response construction.

It excludes public-network transit, DNS/TLS, browser scheduling, React state propagation and paint.

The sample was collected through the deployment-aware Vercel fetch path rather than an ordinary mobile browser. That distinction matters: the values are valid handler durations emitted by production, but they are not ordinary-mobile end-to-end measurements.

For this small sample:
- p50 below is the ordinary median;
- p95 uses nearest-rank, so with `n=20` it is the 19th sorted value;
- the p95 estimate is exploratory and should not be treated as a stable SLO.

## Results

| Route | n | Median | Nearest-rank p95 | Max | <=100 ms | <=500 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| At-bat | 20 | 65 ms | 582 ms | 1,626 ms | 14 / 20 | 18 / 20 |
| Completed | 20 | 58 ms | 430 ms | 1,525 ms | 16 / 20 | 19 / 20 |

Raw at-bat handler durations, in collection order:

`582, 72, 77, 46, 50, 56, 36, 432, 55, 1626, 123, 82, 55, 203, 58, 37, 103, 46, 45, 91`

Raw completed handler durations, in collection order:

`261, 49, 54, 55, 33, 52, 61, 1525, 79, 100, 65, 430, 63, 55, 52, 65, 35, 48, 122, 46`

## Interpretation

The normal handler path is usually fast: most samples are below 100 ms, and the medians are 65 ms for at-bat and 58 ms for completed reads.

The long tail is materially different. One at-bat sample reached 1,626 ms and one completed sample reached 1,525 ms. The small-sample at-bat p95 is already above the provisional approximately 500 ms **end-to-end** target, while completed p95 is below it but still has a greater-than-1.5-second maximum.

This does **not** establish that ordinary-mobile end-to-end p95 misses the target. The sample is too small and does not include the actual browser trigger/render boundary. It does establish that the target cannot be declared met from the current evidence and that handler-side long-tail variance is worth decomposing before optimization.

The earlier PR #203 database benchmark remains valid: raw PostgreSQL aggregation at 10,000 target observations was 1.807 ms p95 for one AB aggregate and 6.254 ms p95 for completed buckets. Therefore these production outliers do not justify a rollup, cache, materialized view or new index. The unresolved time is above the isolated query body and may come from authoritative-puzzle loading, managed Supabase/PostgREST/provider round-trip, lazy/runtime work, or another handler-internal source. Current evidence does not distinguish those possibilities.


## Stage-decomposed production re-sample after PR #223

Exact checkpoint:

- Git main: `128e52702b98247af81f2f8230a335dd24d1b5e4` (PR #223).
- Production deployment: `dpl_FrAYsxTB3HXih3HkU52SrwsiXtbq`, READY with canonical production alias and no alias error.
- Post-merge CI: run #804 / run ID `35746435678`, successful on the first attempt.
- Production error/fatal runtime-log scan for the exact deployment: clean.
- Fifteen successful public-production samples were retained per route after the stage metrics were live.
- Each tuple below is `total / compose / puzzle / provider / residual` in milliseconds. Residual is arithmetic difference and includes request parsing, Daily validation/normalization, response construction and any handler/runtime time not covered by the three named stages.

At-bat tuples, in collection order:

`594/4/68/253/269; 57/0/5/51/1; 58/0/22/34/2; 217/1/43/140/33; 54/0/9/45/0; 1070/7/48/755/260; 62/0/6/55/1; 57/0/6/51/0; 101/0/6/94/1; 79/0/7/72/0; 366/0/13/352/1; 88/0/5/82/1; 45/0/6/39/0; 56/0/6/50/0; 245/0/5/239/1`

Completed tuples, in collection order:

`67/0/8/58/1; 69/0/6/63/0; 406/0/6/400/0; 181/2/60/86/33; 47/0/9/37/1; 76/0/13/61/2; 45/0/7/36/2; 86/0/7/78/1; 217/0/21/195/1; 47/0/6/40/1; 192/1/6/185/0; 58/0/5/51/2; 62/0/6/55/1; 280/0/8/271/1; 2502/0/7/2495/0`

Summary:

| Route/stage | n | Median | Nearest-rank p95 | Max |
| --- | ---: | ---: | ---: | ---: |
| At-bat total | 15 | 79 ms | 1,070 ms | 1,070 ms |
| At-bat provider | 15 | 72 ms | 755 ms | 755 ms |
| At-bat puzzle | 15 | 6 ms | 68 ms | 68 ms |
| At-bat residual | 15 | 1 ms | 269 ms | 269 ms |
| Completed total | 15 | 76 ms | 2,502 ms | 2,502 ms |
| Completed provider | 15 | 63 ms | 2,495 ms | 2,495 ms |
| Completed puzzle | 15 | 7 ms | 60 ms | 60 ms |
| Completed residual | 15 | 1 ms | 33 ms | 33 ms |

With only 15 samples, nearest-rank p95 is the maximum and is highly unstable; it is shown only for continuity with the earlier small-sample checkpoint.

The most diagnostic request was the 2,502 ms completed read: 2,495 ms was inside the provider boundary, 7 ms in authoritative-puzzle loading, 0 ms in dynamic composition and 0 ms residual at millisecond resolution. Another 406 ms completed read spent 400 ms in the provider boundary. On the at-bat route, the provider also drove several slow reads (352/366 ms and 239/245 ms), while the two largest at-bat samples also carried about 260–269 ms of residual handler/runtime time. Puzzle loading did not own any observed production extreme: its maxima were 68 ms for at-bat and 60 ms for completed.

### Production PostgreSQL execution evidence

A read-only `pg_stat_statements` inspection on the hosted production project provides a second, independent boundary check. For the PostgREST wrapper statements that invoke the two comparison RPCs:

- completed comparison: 67 calls, mean database execution 1.921 ms, max 19.696 ms;
- at-bat comparison: 127 calls, mean database execution 1.594 ms, max 17.332 ms.

Those statistics cover the matching PostgREST statements over their current statistics window, not just the 15+15 handler sample above. They measure PostgreSQL execution, not Vercel-to-Supabase network time, PostgREST/API-gateway handling before/after database execution, connection/pool acquisition, or response transit.

Together, the two measurements materially narrow the slow path: the observed multi-second handler tail sits inside the web provider boundary, while PostgreSQL execution for the same RPC statements remains in the low-millisecond range. That is evidence against changing the aggregate SQL, indexes, rollups or puzzle-loading path as the next response.

The remaining unresolved provider time is between the web adapter entering the provider boundary and PostgreSQL's measured execution. The provider currently consists of synchronous lazy Supabase client/repository construction when needed, `await client.rpc(...)`, and local row decoding. The next bounded measurement should split that boundary into local setup, RPC wait and local decode before any behavioral optimization. The provider sub-timing implementation checkpoint does exactly that with `provider-setup`, `provider-rpc`, and `provider-decode` while preserving the parent provider metric and lazy module-level client reuse; production sub-timing evidence remains open.


## Provider-subtimed production re-sample after PR #225

Exact checkpoint:

- Git main: `90073bccd67002fdaf6fa85f5707be5f8968051b` (PR #225).
- Production deployment: `dpl_ABUyV3qrm2sEg2KAx7ULNAfGdLwo`, READY on that exact SHA.
- Fifteen successful public-production samples were retained per route across two collection batches after the nested provider metrics were live.
- Every retained request returned HTTP 200 with `Cache-Control: private, no-store`.
- Each tuple below is `total / compose / puzzle / provider / setup / rpc / decode` in milliseconds. The provider metric is the parent boundary; setup/RPC/decode are nested inside it.

At-bat tuples, in collection order:

`992/5/50/666/5/661/0; 1502/0/7/1495/0/1495/0; 176/2/52/87/1/86/0; 38/0/7/31/0/31/0; 63/0/7/56/0/56/0; 985/2/41/736/6/730/0; 55/0/6/49/0/49/0; 44/0/5/38/0/38/0; 53/0/5/46/0/46/0; 77/0/20/40/0/40/0; 61/0/6/54/0/54/0; 1178/0/11/1166/0/1166/0; 46/0/5/41/0/41/0; 45/0/6/38/0/38/0; 77/0/5/71/0/71/0`

Completed tuples, in collection order:

`72/0/7/65/0/65/0; 2141/0/15/2125/0/2125/0; 85/0/15/69/0/68/1; 54/0/7/47/0/47/0; 92/0/12/80/0/80/0; 385/0/7/377/0/377/0; 39/0/4/34/0/34/0; 144/0/5/138/0/138/0; 107/0/32/75/0/75/0; 46/0/5/40/0/40/0; 88/0/5/83/0/83/0; 52/1/5/45/0/45/0; 60/0/6/54/0/54/0; 46/0/5/41/0/41/0; 71/0/11/59/0/59/0`

Summary:

| Route/stage | n | Median | Nearest-rank p95 | Max |
| --- | ---: | ---: | ---: | ---: |
| At-bat total | 15 | 63 ms | 1,502 ms | 1,502 ms |
| At-bat provider | 15 | 54 ms | 1,495 ms | 1,495 ms |
| At-bat provider setup | 15 | 0 ms | 6 ms | 6 ms |
| At-bat provider RPC | 15 | 54 ms | 1,495 ms | 1,495 ms |
| At-bat provider decode | 15 | 0 ms | 0 ms | 0 ms |
| At-bat puzzle | 15 | 7 ms | 52 ms | 52 ms |
| At-bat residual | 15 | 1 ms | 271 ms | 271 ms |
| Completed total | 15 | 72 ms | 2,141 ms | 2,141 ms |
| Completed provider | 15 | 65 ms | 2,125 ms | 2,125 ms |
| Completed provider setup | 15 | 0 ms | 0 ms | 0 ms |
| Completed provider RPC | 15 | 65 ms | 2,125 ms | 2,125 ms |
| Completed provider decode | 15 | 0 ms | 1 ms | 1 ms |
| Completed puzzle | 15 | 7 ms | 32 ms | 32 ms |
| Completed residual | 15 | 1 ms | 1 ms | 1 ms |

With `n=15`, nearest-rank p95 is the maximum and is deliberately treated as unstable exploratory evidence, not a production SLO estimate.

The nested measurement closes the provider-localization question for this beta checkpoint. Local provider setup and response decoding are negligible. The multi-second cases are almost entirely time spent awaiting `client.rpc(...)`: the 1,502 ms at-bat request spent 1,495 ms in RPC wait, and the 2,141 ms completed request spent 2,125 ms there. A separate fresh at-bat outlier reached 1,178 ms total / 1,166 ms RPC.

Combined with the hosted `pg_stat_statements` evidence above—matching PostgreSQL statements remain low-millisecond—this is strong evidence that the observed long tail is not caused by aggregate SQL execution, local Supabase-client setup, local row decoding, or puzzle loading. The unresolved interval is inside the managed Vercel → Supabase/PostgREST/API/connection/response boundary represented by the awaited RPC call. This checkpoint does not assign that interval to one internal Supabase component.

### Decision at this checkpoint

Stop backend storage/query optimization for comparison reads. Do **not** add rollups, caches, indexes, materialized views, or a transport rewrite from this evidence.

The next product-facing performance change should instead hide this non-critical managed-RPC latency behind gameplay by prefetching the exact per-at-bat comparison when an at-bat becomes active, while keeping the average undisclosed until terminal reveal. For ordinary live play this also makes the reveal use a pre-result snapshot. A separately restored terminal state may refresh the current aggregate rather than claiming to reconstruct that historical snapshot. The prefetch must remain independent of Guess/Give Up/Next, be fenced to exact puzzle/ruleset/pitch identity, and preserve quiet failure behavior.

Ordinary browser/mobile trigger-to-visible verification remains a separate acceptance check after that behavior change.

## Next bounded measurement

The provider-localization measurement is complete. Preserve the raw-read architecture and current aggregate SQL/indexes.

Next:

1. prefetch the exact per-at-bat comparison when an at-bat becomes active, without showing it before terminal reveal;
2. keep that read off gameplay's critical path and fence it to exact puzzle/ruleset/pitch identity;
3. verify slow/failed/stale reads, Reset/restore/Next transitions and ordinary browser/mobile trigger-to-visible behavior;
4. revisit provider transport or storage only if later measured user-facing evidence still warrants it.

The timing seams remain diagnostic evidence; they do not themselves define a performance SLO.

## Non-conclusions

This checkpoint does not establish:
- ordinary mobile/browser trigger-to-visible p50/p95;
- network or React/render overhead;
- managed Supabase/PostgREST p95 in isolation;
- production cold-start frequency;
- large-population production latency;
- a need for rollups/caching/index changes;
- a reason to put comparison work on gameplay's critical path.
