# Completed-result contract scope

## Goal

Define and verify the portable analytics-quality completed-game submission contract for the two current beta games so later persistence can accept raw at-bat facts and derive authoritative summaries without trusting a browser-submitted score.

## Owning layer

`packages/engine` owns validation and derivation. `packages/shared` supplies only the stable cross-platform transport/result types consumed by the engine and later web/provider adapters.

## In scope

- schema-versioned completed-result submission using stable puzzle identity, exact ruleset/game identity, client-generated idempotency ID, and ordered native `DailyCompletedAtBat` facts;
- first accepted analytics-quality rulesets are `points-v3` and `classic-inning-v1` only;
- validation against the expected public puzzle ID/date/number, pitch order, and initials;
- validation of hint count, wrong-guess count, resolution/outcome consistency, and correct-outcome/hint-depth consistency;
- engine-owned completion validation: Daily Nine requires all nine scheduled at-bats; Classic must stop exactly when three outs or batter nine completes the game;
- authoritative engine derivation of Daily Nine points/maximum/strikeouts and Classic runs/hits/outs/strikeouts;
- normalized validated result output suitable for a later idempotent repository boundary;
- focused tests for valid and malformed/spoofed/incomplete submissions in both games;
- canonical documentation/todo reconciliation for the bounded contract.

## Out of scope

- provider-neutral result repository/service port;
- Supabase migration/codec/adapter or RLS;
- public submission API or browser submission ID persistence;
- aggregate queries, averages, distributions, percentiles, or comparison UI;
- archive routes/history;
- accepting compatibility `points-v1`, `points-v2`, or `legacy-inning-v1` submissions without an explicit analytics-quality migration rule;
- choosing the permanent launch game, ruleset, date, or Classic overall ranking metric.

The repository/service boundary follows in a separate bounded PR. This split keeps the first implementation owned by the engine/shared contract and avoids combining persistence/client-server authority with pure validation.

## Acceptance checks

- valid `points-v3` nine-at-bat facts derive the same total/max/strikeouts as existing scoring rules;
- valid Classic facts derive runner/run/hit/out state and accept completion at exactly three outs or batter nine;
- spoofed puzzle identity, wrong initials/order, malformed hint/wrong-guess counts, inconsistent resolution/outcome, impossible correct outcome for hint depth, incomplete games, extra Classic at-bats after completion, and unsupported rulesets are rejected;
- no React, Next.js, Supabase, storage, network, date, or platform dependency enters the engine;
- focused tests, typecheck, full CI/data pipeline, file-size checks, and bounded review pass;
- canonical docs accurately state what is implemented versus still pending.

## Stop conditions

Stop and open a separate decision/follow-up if validation requires changing gameplay/scoring rules, redefining puzzle identity, accepting reconstructed legacy facts as analytics-quality submissions, adding persistence/client-server authority, or choosing an unsettled launch/percentile/replay policy.
