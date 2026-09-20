# Daily Nine comparison hosted verification — 2026-09-20

This record captures what is verifiably true about the merged Daily Nine comparison browser checkpoint before physical/mobile interaction and end-to-end latency QA. It deliberately separates hosted/build evidence from browser observations that have not been performed.

## Exact checkpoint

Repository:

- `kastnerjon/initial-baseball`
- current `main`: `e5869a230cff423fd31642ead0f1bbf3763d4445`
- merge: PR #209, **Add completed Daily Nine comparison**
- open pull requests at verification time: none

GitHub Actions:

- push CI run: #771
- run ID: `35529202460`
- exact head: `e5869a230cff423fd31642ead0f1bbf3763d4445`
- conclusion: success

The CI job passed typecheck, tests, file-size checks, the canonical baseball-data pipeline, the production package build and hidden-answer postbuild QA.

## Production Vercel

Current production deployment:

- deployment: `dpl_6N5RxYheUVBEi89NZSmJm1ynz88a`
- project: `initial-baseball-web`
- source: Git
- target: production
- state / ready state: `READY`
- Git ref: `main`
- Git SHA: `e5869a230cff423fd31642ead0f1bbf3763d4445`
- alias error: none
- canonical aliases include `initial-baseball-web.vercel.app`

A Vercel runtime-error query over the reviewed six-hour window returned no runtime errors.

On the exact current deployment, runtime logs in the same reviewed window contained successful serverless reads from both comparison endpoints:

- `GET /api/daily/comparison/at-bat` — HTTP 200
- `GET /api/daily/comparison/completed` — HTTP 200

Multiple at-bat reads were visible between 18:39 and 18:47 UTC; completed reads were visible at 18:47 and 19:01 UTC. This proves that the deployed API path is being exercised successfully. The runtime logs do not identify the initiating client, so they do not by themselves prove browser-consumer execution, client-visible latency, mobile layout, request deduplication or failure behavior.

Earlier PR #209 Preview errors were explicitly reported by Vercel as the external free-tier deployment limit (`api-deployments-free-per-day`). The final production deployment above is a separate successful build and must not be conflated with those Preview refusals.

## Hosted Supabase

Project:

- ref: `dwreeiydvwikpamlokji`
- name: `initial-baseball-db`
- status: `ACTIVE_HEALTHY`
- PostgreSQL: 17

The hosted migration list includes:

- `20260919164818_create_daily_nine_comparison_reads`

The two comparison functions are present in `public`:

- `daily_nine_at_bat_comparison(...)`
- `daily_nine_completed_score_buckets(...)`

Hosted privilege inspection confirmed for both functions:

- `SECURITY DEFINER = false` (therefore normal invoker semantics);
- `anon` execute: false;
- `authenticated` execute: false;
- `service_role` execute: true.

The backing result tables remain RLS-enabled. This checkpoint made no Supabase change.

## Exact-main bundle/build evidence

GitHub CI production builds provide a comparable Next.js output across the browser-consumer sequence:

| checkpoint | root First Load JS | hidden-answer client chunks |
| --- | ---: | ---: |
| PR #207 merge `8256fa8c` | 119 kB | 847,307 bytes across 28 chunks |
| PR #208 merge `e56ff0d0` | 121 kB | 855,280 bytes across 28 chunks |
| PR #209 merge `e5869a23` | 122 kB | 859,314 bytes across 28 chunks |

From #207 through #209, the reported root First Load JS increased by about 3 kB. The hidden-answer QA scan's total client-chunk bytes increased by 12,007 bytes. These figures are build-output measurements, not a substitute for a browser network-transfer trace.

On exact current main, postbuild reported:

> Hidden-answer build QA passed for 2 initial payloads and 28 client chunks (859314 bytes).

The earlier #209 branch failure in hidden-answer QA was real and was fixed architecturally before merge by moving the shared at-bat count into a data-free Daily module and using the narrow `@initial-baseball/daily/comparison` subpath. This hosted checkpoint does not weaken or bypass that gate.

## Source/lifecycle review

The final source still has the intended boundaries:

- comparison client: read-only GET transport, `no-store`, runtime decode, exact response identity checks, caller AbortSignal;
- request controller: independent at-bat/completed channels, replacement abort plus generation/request/key fencing, stale success/error/settled suppression;
- at-bat hook: terminal points-v3 input only; own points come from the already-computed engine transition;
- completed hook: final pending engine summary may trigger the read before View Results; committed state with the same puzzle/ruleset/final score preserves the same semantic effect input; strict-lower finish rate remains Daily-owned;
- comparison failure does not call result-write clients or persistence;
- reset/restore explicitly invalidate comparison reads;
- hook cleanup invalidates in-flight reads on unmount.

`DailyInningGame.tsx` is 495 lines on current main. Treat it as effectively at the repository's hard limit; measurement or future comparison work should not be stuffed into that component merely because it is the integration point.

## What this evidence proves

It is reasonable to rely on these facts now:

- PR #209 is exactly what is deployed to production.
- GitHub CI and the exact production build are green.
- hidden-answer build QA passes on exact main.
- the expected hosted comparison schema/functions are present and server-only.
- both production comparison endpoints are successfully serving requests on the current deployment.
- there is no observed Vercel runtime error in the reviewed window.
- the browser-consumer changes caused a small build-output increase across #208/#209, not an unexplained order-of-magnitude jump in Next's reported First Load JS.

## What remains unverified

Do **not** infer any of the following from this checkpoint:

- physical iPhone/iPad layout quality;
- exact browser trigger → React-visible p50/p95;
- live server/provider latency decomposition;
- request count under React Strict Mode;
- ninth-at-bat prefetch continuity observed in a real browser;
- restored-completion refresh observed in a real browser;
- delayed/failing endpoint UX observed in a real browser;
- rapid Next/reset/restore/navigation stale-read behavior observed in a real browser;
- a browser network trace proving the exact transferred-byte impact.

Those remain the next QA gate. No runtime instrumentation has been added yet.

## Architecture disposition

No storage redesign is justified by this checkpoint. PR #203 already measured warmed database p95 near 1.8 ms for the at-bat aggregate and 6.3 ms for completed score buckets at 10,000 target results. Until end-to-end measurement identifies the database as the actual bottleneck, adding mutable rollups would increase write-path and rebuild complexity without evidence that it improves the user-visible delay.

Likewise, no generic analytics framework is justified merely because a timing boundary remains unmeasured. First use browser/network/server/provider evidence available during the interactive QA run. If one boundary cannot be measured reliably, design the smallest observability seam that exposes only that missing datum.
