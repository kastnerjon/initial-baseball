# Canonical Season Cards

This document defines the implementation boundary for the generated Initial Baseball player-season card artifact.

## Objective

Produce one deterministic canonical season-card record per `(playerId, season)` using only facts confirmed by the repository's checked-in sources and calculations that can be derived safely from complete inputs.

The target product contract remains documented in `season-card-data-contract.md`. Source feasibility remains documented in `season-card-source-feasibility.md`. This document governs the implementation that sits between those two documents.

## Inputs

The generator consumes only existing canonical artifacts:

- canonical player universe;
- canonical batting-season aggregates;
- canonical pitching-season aggregates;
- canonical appearance-season aggregates;
- source manifests and checksums emitted by those generators.

It must not read legacy runtime player objects, match players by name, scrape websites, or reconstruct fields absent from the canonical inputs.

## Confirmed direct fields

The generated artifact may publish only fields proven present in the current canonical aggregates.

Batting:

- at bats;
- runs;
- hits;
- doubles;
- triples;
- home runs;
- runs batted in;
- stolen bases;
- walks;
- hit by pitch;
- sacrifice flies.

Pitching:

- wins;
- losses;
- saves;
- outs pitched;
- hits allowed;
- earned runs;
- walks allowed;
- strikeouts.

Appearance and identity:

- canonical player ID;
- Lahman player ID for provenance;
- season;
- available team IDs;
- available position-appearance totals.

## Safe derived fields

A derived value is published only when every required component is known and the denominator is valid.

Implemented calculations:

- batting average from hits and at bats;
- total bases from hits, doubles, triples, and home runs;
- slugging percentage from total bases and at bats;
- earned-run average from earned runs and outs pitched;
- WHIP from walks allowed, hits allowed, and outs pitched;
- strikeouts per nine innings;
- walks per nine innings;
- strikeout-to-walk ratio when walks allowed is greater than zero.

On-base percentage and OPS are not approved from the current source boundary because the compact batting data does not confirm every required denominator component across the full historical range.

## Explicitly unsupported fields

The artifact represents the following as unavailable rather than fabricating them:

- batting games, plate appearances, caught stealing, batting strikeouts, sacrifice hits, and grounded-into-double-plays;
- most expanded pitching workload and role fields;
- OPS and OPS+;
- ERA+ and FIP;
- WAR;
- league-leader flags;
- All-Star selections;
- awards and award-voting finishes;
- authoritative league IDs when unavailable at player-season grain.

A later source audit may promote a field from unsupported to direct or derived. That requires a documented source, coverage analysis, mapping strategy, reproducible ingestion, and schema-version review.

## Output

The generator writes:

- `season-cards.json`;
- `season-card-coverage.json`;
- `season-card-report.json`;
- `season-card-report.md`.

Each season-card record includes:

- schema version;
- canonical player ID;
- Lahman player ID;
- season;
- teams and positions when available;
- batting and pitching sections when present;
- direct and derived values;
- provenance showing which aggregate families exist;
- source artifact checksums at the artifact level.

## Coverage reporting

The coverage report counts, for every populated field:

- total relevant player-seasons;
- known non-null values;
- real zero values;
- unknown values;
- derived values;
- direct values.

Unsupported target-contract fields appear with status `unsupported-current-source`; they do not disappear merely because they are not populated.

## Validation

Strict generation fails for:

- duplicate `(playerId, season)` records;
- unknown canonical player IDs;
- conflicting Lahman IDs for one canonical player-season;
- negative or malformed counting statistics;
- derived values emitted with missing inputs;
- arithmetic that fails independent reconciliation;
- hits greater than at bats;
- component extra-base hits exceeding total hits;
- malformed seasons;
- missing or duplicate aggregate keys.

The generator independently recalculates the principal derived rates during validation instead of trusting the emitted values.

## Runtime boundary

This remains a shadow artifact. It does not change the live game, reveal, search, hints, Daily selection, saved-state loading, or admin dashboard.

Runtime migration is a later PR after the artifact, coverage report, representative player checks, and reconciliation tests pass.

## Commands

```bash
pnpm --filter @initial-baseball/baseball-data generate:canonical-season-cards
pnpm --filter @initial-baseball/baseball-data generate:canonical-season-cards:strict
```

CI runs strict season-card generation after canonical season aggregation and uploads the resulting directory inside the `canonical-baseball-data` artifact.
