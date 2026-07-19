# Canonical Season Cards

This document defines the implemented shadow artifact that sits between the canonical season aggregates and future runtime serving data.

## Objective

Produce one deterministic record per `(playerId, season)` using only checked-in canonical facts and calculations that can be derived safely from complete inputs.

Related documents have distinct roles:

- `season-card-data-contract.md` defines the desired long-term product shape.
- `season-card-source-feasibility.md` defines which fields current sources can support.
- this document defines what is implemented now and how it is validated.

## Inputs and ownership

The generator consumes only the canonical player universe and canonical batting, pitching, and appearance season aggregates. It must not read legacy runtime player objects, match players by name, scrape websites, or reconstruct absent fields.

Names are display and search data. Stable source IDs determine which person owns each statistic.

## Implemented fields

Direct batting fields: AB, R, H, 2B, 3B, HR, RBI, SB, BB, HBP, and SF.

Direct pitching fields: W, L, SV, outs pitched, H allowed, ER, BB allowed, and SO.

Identity and appearance fields: canonical player ID, Lahman player ID, season, available team IDs, and available position-appearance totals.

Safely derived fields: AVG, total bases, SLG, ERA, WHIP, K/9, BB/9, and K/BB. A derived value is emitted only when every required component is known and the denominator is valid.

## Unsupported fields

The artifact does not fabricate unsupported fields. Current unsupported fields include G, PA, batting SO, CS, SH, GIDP, OBP, OPS, WAR, OPS+, ERA+, FIP, awards, award voting, All-Star selections, league-leader flags, and authoritative league IDs where player-season coverage is absent.

Promoting a field requires a documented source, reproducible ingestion, identity mapping, coverage analysis, reconciliation, and schema review.

## Outputs

The generator writes:

- `season-cards.json`;
- `season-card-coverage.json`;
- `season-card-report.json`;
- `season-card-report.md`.

The artifact records source checksums and distinguishes unknown `null` values from real zeroes.

## Validation gates

Strict generation rejects duplicate keys, unknown canonical players, conflicting Lahman IDs, malformed counts, impossible batting totals, invalid derived values, and missing or duplicate aggregate keys.

The independent QA command then verifies every generated card against the canonical universe and source aggregates. It fails when:

- a canonical ID and Lahman ID do not describe the same player;
- one external source ID is owned by multiple canonical players;
- batting, pitching, team, or position values differ from their aggregates;
- a derived statistic cannot be independently reproduced;
- a player-season is missing, duplicated, or unexpected;
- a representative regression player resolves to the wrong identity or values.

Recorded career ranges are diagnostic rather than authoritative identity gates. Lahman MLB debut and final dates do not bound Negro League seasons and may lag newer season-stat files, so range drift is reported as a warning while exact ID-crosswalk mismatches remain fatal.

## Representative regression cases

The current suite includes David Ortiz, Hank Aaron, Mookie Betts, Mariano Rivera, Pedro Martínez, and Shohei Ohtani. These cases are resolved through the canonical Lahman crosswalk, not by matching visible names.

## Runtime boundary

This is still a shadow artifact. The live game, reveal, search, hints, Daily selection, saved-state loading, and admin dashboard remain on the existing runtime data.

Runtime migration must be a separate change with parity tests and rollback support. It must not reimplement baseball calculations in the game layer.

## Commands

```bash
pnpm --filter @initial-baseball/baseball-data generate:canonical-season-cards
pnpm --filter @initial-baseball/baseball-data generate:canonical-season-cards:strict
pnpm --filter @initial-baseball/baseball-data qa:canonical-season-cards
```

CI runs the complete canonical identity-to-season-card pipeline, executes independent QA, and uploads the reports in the `canonical-baseball-data` artifact.