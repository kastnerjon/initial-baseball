# Points-v4 H4 comparison and presentation compatibility

Status: implementation scope; public comparison/presentation compatibility only  
Date: 2026-09-27

## Goal

Widen the existing Daily Nine comparison HTTP/read/browser path from exact `points-v3` to exact `points-v3 | points-v4`, and verify the existing scorecard/share/comparison presentation correctly renders finalized v4 half-point values.

This is not the public scoring cutover. `CURRENT_DAILY_RULESET_VERSION` remains `points-v3`. How-to copy and final cutover QA remain H5.

## Current foundation

H1-H3 are complete:

- H1 server result writes accept exact v3/v4;
- H2 isolates current-Daily v4 gameplay saves from the historical v3-era key;
- H3 widens browser attempt journal/outbox, exact-version Web Lock ownership/takeover and completed-result delivery to v3/v4;
- provider-neutral comparison math and the Supabase comparison provider already support v4 0.5-point values and a 73-slot 0..36 histogram.

The remaining comparison gap is deliberately above that provider seam: schema-1 comparison transport, read-service routing, browser response decoding and comparison hooks still hardcode v3.

## Design

### Shared comparison transport

Keep schema version 1.

Widen `DailyNineComparisonApiKey.rulesetVersion` to exact `points-v3 | points-v4`.

The completed histogram remains an offset histogram owned by the exact ruleset:
- v3: 64 slots for 0..63 in 1-point steps;
- v4: 73 slots for 0..36 in 0.5-point steps.

The transport does not send a client-trusted scoring formula. Ruleset identity remains sufficient for Daily to interpret the histogram.

### Server read routing

Parse `ruleset` as an exact supported comparison ruleset and carry that exact value through:
- authoritative puzzle loading;
- `DailyNineComparisonService.getAtBat`;
- `DailyNineComparisonService.getCompletedGames`;
- returned comparison identity.

Do not substitute the public default and do not hardcode v4. Classic/legacy/v1/v2 remain unsupported at the comparison boundary.

### Browser client and request identity

The browser decoder accepts only v3/v4 comparison identity and still requires the response to exactly match the request puzzle/date/number/ruleset/pitch.

Existing request controllers already include ruleset in equality, so no request-lifecycle redesign is needed.

### Browser hooks

Widen:
- active-slot prefetch / reveal projection;
- completed-game comparison;
- scorecard per-AB comparison reads;

to supported exact v3/v4 rulesets.

Each request must carry the caller's exact ruleset. Preserve:
- active-slot prefetch before own points are visible;
- no request restart merely because own points become known;
- asynchronous/nonblocking comparison I/O;
- abort/generation stale-response fencing;
- scorecard concurrency cap and low-sample retry behavior;
- fail-quiet unavailable states.

### Fractional presentation verification

The existing presentation layer already uses numeric values rather than integer-only contracts:
- completed AVG uses `.toFixed(1)`;
- per-AB AVG uses `.toFixed(1)`;
- scorecard points use integer-or-one-decimal formatting.

H4 adds explicit v4 regression proofs for:
- 0.5 AB score;
- fractional per-AB average;
- fractional completed total and average;
- strict-lower BEAT against the v4 73-slot histogram;
- scorecard table/share rows with half-points;
- native share text retaining the “Daily Nine” label for points-v4.

The only known presentation code correction identified before implementation is `getDailyModeName()`: it currently labels v4 as “Daily Inning” because only v2/v3 are classified as Daily Nine.

## In scope

- widen schema-1 comparison API key to v3/v4;
- exact-version v3/v4 read-service routing;
- exact-version browser response decode/identity validation;
- widen at-bat/completed/scorecard comparison activation hooks to v3/v4;
- fix v4 Daily Nine share mode label;
- focused v4 transport/read/client/hook/presentation tests;
- reconcile canonical docs and activation watchlists.

## Out of scope

- How-to modal/copy (H5);
- switching `CURRENT_DAILY_RULESET_VERSION` (H5, last);
- gameplay-save or result-delivery changes;
- Supabase schema/RPC/provider changes;
- scoring formula changes;
- cache/rollup/index work;
- archive routes/navigation;
- changing comparison sampling thresholds or retry policy.

## Invariants to preserve

1. Comparison populations remain exact puzzle + exact ruleset.
2. v3 and v4 are never merged by date or puzzle alone.
3. Classic/legacy/v1/v2 comparison requests remain unsupported.
4. Authoritative puzzle identity is server-derived; query puzzle IDs/scores remain untrusted.
5. Comparison reads remain read-only and provider-neutral.
6. Client response identity must exactly match the request.
7. Comparison I/O never blocks gameplay resolution/result persistence.
8. Active-slot prefetch stays hidden until terminal own points exist.
9. Stale/aborted requests cannot overwrite current state.
10. Scorecard reads keep the existing concurrency/retry bounds.
11. Fractional v4 values are rendered, not rounded to integers.
12. `CURRENT_DAILY_RULESET_VERSION` stays v3 after H4.

## Verification

Before merge:

- fresh-eye architecture/source review;
- focused shared/API/read-service/client/hook/presentation tests;
- full repository typecheck/tests/file-size/data/build gates;
- exact-head Vercel Preview READY;
- Preview still exposes current v3 7/63 public gameplay copy;
- no Supabase migration/data mutation;
- no H5/default-switch leakage.

After merge:

- verify exact new `main` SHA;
- verify push CI on the merge SHA;
- verify production Vercel READY on that SHA;
- verify live public Daily remains points-v3;
- scan exact production deployment error/fatal logs;
- verify no unexpected open PRs.

## Documentation impact

Update START-HERE, API/data-model/engine/architecture/product docs, September 24 roadmap, todo, comparison G plans and H3 handoff so H4 is recorded as complete only after merge and H5 remains the sole scoring-cutover checkpoint.
