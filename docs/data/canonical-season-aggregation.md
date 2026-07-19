# Canonical Player-Season Aggregation

This document defines the shadow player-season aggregation layer introduced after the canonical Lahman stint pipeline.

## Inputs

The generator consumes the immutable raw canonical artifacts produced by `generate-canonical-season-facts.mjs`:

- `batting-stints.json`;
- `pitching-stints.json`;
- `appearances.json`.

Every input row is already attached to an Initial Baseball canonical player ID through an exact Lahman player-ID mapping. This layer performs no name matching or identity resolution.

## Grain

The output grain is one row per `(playerId, season)` for each independent fact family:

- batting seasons;
- pitching seasons;
- appearance seasons.

Batting and pitching remain separate so two-way players retain both records.

## Aggregation rules

Counting statistics are summed across every contributing team stint.

A statistic is `null` only when every contributing stint has `null` for that field. A mixture of known and missing values sums the known source values without converting the missing rows to explicit zeroes.

Pitching workload remains stored as outs. Rates such as batting average, OPS and ERA are not stored here; later serving layers calculate them from aggregate components.

Each season row also preserves:

- sorted unique team IDs;
- sorted unique league IDs;
- the number of contributing source rows;
- the canonical player ID;
- the exact Lahman player ID.

## Validation

Strict generation fails when:

- duplicate player-season rows exist;
- one canonical player-season contains conflicting Lahman player IDs;
- a counting-stat value is not an integer;
- the output row count differs from the independently grouped source facts;
- any summed statistic differs from an independent source-row calculation;
- team IDs, league IDs or stint counts do not reconcile;
- an expected aggregate is missing or an unexpected aggregate appears.

The reconciliation path does not call the production aggregation function. This prevents a shared implementation bug from validating itself.

## Outputs

The generator writes:

- `batting-seasons.json`;
- `pitching-seasons.json`;
- `appearance-seasons.json`;
- `canonical-season-aggregates-report.json`;
- `canonical-season-aggregates-report.md`.

Every artifact records SHA-256 hashes for its raw input artifacts.

## Commands

```bash
pnpm --filter @initial-baseball/baseball-data generate:canonical-season-facts:strict
pnpm --filter @initial-baseball/baseball-data generate:canonical-season-aggregates:strict
```

CI runs both commands in strict mode and uploads the universe, raw facts and season aggregates together as the `canonical-baseball-data` artifact.

## Safety boundary

This is still a shadow data layer. It does not change the live game, search, hints, reveal cards, Daily selection or current serving artifacts.

The next layer derives career facts from these player-season records. Runtime migration occurs only after career and serving artifacts reconcile and pass release gates.
