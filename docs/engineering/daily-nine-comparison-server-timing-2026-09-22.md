# Daily Nine comparison production Server-Timing evidence — September 22, 2026

Status: handler-level production sample recorded; stage-decomposition instrumentation implemented; production stage re-sample and browser trigger-to-visible remain open

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

## Next bounded measurement

Before changing storage or comparison product behavior:

1. preserve the current raw-read architecture;
2. use the bounded stage-level timing seam to separate server composition, authoritative-puzzle loading and the exact provider repository call;
3. re-sample production after that decomposition;
4. separately perform ordinary mobile/browser trigger-to-visible QA, including delayed/failed reads and stale-request behavior.

Any actual performance change should target the measured slow stage rather than guessing. The stage seam is specified in `tasks/plans/daily-nine-comparison-stage-timing.md`; it does not itself change performance behavior.

## Non-conclusions

This checkpoint does not establish:
- ordinary mobile/browser trigger-to-visible p50/p95;
- network or React/render overhead;
- managed Supabase/PostgREST p95 in isolation;
- production cold-start frequency;
- large-population production latency;
- a need for rollups/caching/index changes;
- a reason to put comparison work on gameplay's critical path.
