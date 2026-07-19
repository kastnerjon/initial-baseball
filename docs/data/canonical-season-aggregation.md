# Canonical Player-Season Aggregation

This document defines the shadow player-season aggregation layer built on the repository's canonical Lahman source facts.

## Source reality

The checked-in baseball files are intentionally compact, not complete copies of every Lahman table.

- `Batting.csv` contains player, season and selected batting counting statistics.
- `Pitching.csv` contains player, season and selected pitching counting statistics.
- Either compact file may contain more than one row for the same player-season, but it does not retain team, league or formal Lahman stint columns.
- `Appearances.csv` retains player, season, team and position-appearance counts.

The pipeline must model those files as they exist. It must not invent stint or team attributes that are absent from the source.

## Canonical source facts

`generate-canonical-season-facts.mjs` attaches every accepted source row to an Initial Baseball canonical player through the player's exact Lahman ID. It performs no name matching or career-year matching.

The generator writes:

- `batting-source-rows.json`;
- `pitching-source-rows.json`;
- `appearances.json`;
- `canonical-season-facts-report.json`;
- `canonical-season-facts-report.md`.

Repeated batting or pitching rows for one player-season receive a deterministic `sourceRow` ordinal. That ordinal preserves each checked-in row for auditability without claiming that it is an official team stint.

Appearance rows remain at their source grain of one player, season and team.

## Season grain

`generate-canonical-season-aggregates.mjs` produces one row per `(playerId, season)` for each independent fact family:

- batting seasons;
- pitching seasons;
- appearance seasons.

Batting and pitching remain separate so two-way players retain both records.

## Aggregation rules

Batting and pitching counting statistics are summed across every compact source row belonging to the same canonical player-season.

A statistic remains `null` only when every contributing source row has `null` for that field. Known values are summed without converting an unknown historical value into an explicit zero.

Pitching workload remains stored as outs. Rates such as batting average, on-base percentage, slugging, OPS, ERA and WHIP are calculated later from aggregate components rather than averaged from formatted source rates.

Appearance statistics are summed across team rows. Their sorted unique team IDs become the authoritative team history attached to the batting and pitching season records.

Each season row preserves:

- the canonical player ID;
- the exact Lahman player ID;
- the season;
- sorted unique team IDs from appearances;
- the number of contributing batting, pitching or appearance source rows;
- the available summed counting statistics.

League IDs are not published because the checked-in compact source files do not provide a reliable league field at the required grain.

## Validation

Strict generation fails when:

- a source or aggregate key is duplicated;
- required canonical, Lahman, season, source-row or team identifiers are malformed;
- one canonical player-season contains conflicting Lahman IDs;
- a counting statistic is negative or not an integer;
- an aggregate row count differs from independently grouped source rows;
- any summed statistic differs from an independent source-row calculation;
- source-row counts, appearance-row counts or team IDs do not reconcile;
- an expected aggregate is missing or an unexpected aggregate appears;
- a batting or pitching season cannot be linked to an appearance season.

The reconciliation path independently groups and sums the source artifacts rather than calling the production aggregation functions. This prevents a shared implementation bug from validating itself.

## Outputs

The season generator writes:

- `batting-seasons.json`;
- `pitching-seasons.json`;
- `appearance-seasons.json`;
- `canonical-season-aggregates-report.json`;
- `canonical-season-aggregates-report.md`.

Every artifact includes SHA-256 hashes for its direct input artifacts.

## Commands

```bash
pnpm --filter @initial-baseball/baseball-data generate:canonical-season-facts:strict
pnpm --filter @initial-baseball/baseball-data generate:canonical-season-aggregates:strict
```

CI runs both commands in strict mode and uploads the canonical universe, source facts, season aggregates, reports and captured generator log as the `canonical-baseball-data` artifact. The artifact is uploaded even when strict validation fails so the failure can be audited.

## Future source upgrades

A future data release may replace the compact batting and pitching files with complete team-stint facts. That requires an explicit adapter and schema-version change. The current pipeline must not infer or reconstruct missing team stints from row order.

## Safety boundary

This remains a shadow data layer. It does not change the live game, search, hints, reveal cards, Daily selection or current serving artifacts.

The next layer derives career facts from these player-season records. Runtime migration occurs only after career and serving artifacts reconcile and pass release gates.
