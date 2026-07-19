# Canonical Career Aggregates

## Purpose

This layer rolls the validated canonical player-season aggregates into one deterministic career record per canonical player. It is the only approved source for career totals used by future reveal cards, serving releases, search metadata, or admin tools.

## Architecture gate

- **Owner:** `packages/baseball-data`.
- **Source of truth:** canonical season aggregates; no legacy runtime player objects.
- **Identity rule:** statistics are grouped only by canonical player ID and must preserve the exact Lahman ID crosswalk.
- **Direction:** season aggregates → career aggregates → future career cards / serving artifacts → clients.
- **Runtime:** no live runtime behavior changes in this phase.

## Inputs

- canonical player universe;
- canonical batting-season aggregates;
- canonical pitching-season aggregates;
- canonical appearance-season aggregates.

The generator never joins by player name and never reads raw baseball CSVs directly.

## Outputs

The generator writes:

- `batting-careers.json`;
- `pitching-careers.json`;
- `appearance-careers.json`;
- `canonical-career-aggregates-report.json`;
- `canonical-career-aggregates-report.md`.

Each record includes canonical player ID, Lahman player ID, first and last covered season, season count, sorted team IDs, source season count, and the supported direct counting fields.

## Missing-data behavior

A career field is `null` only when every contributing season is unknown for that field. Real zeroes remain `0`. Batting and pitching remain independent so two-way players can have both career records.

## Validation

Strict generation fails for:

- unknown canonical players;
- duplicate career keys;
- one canonical player resolving to multiple Lahman IDs;
- direct totals that do not reconcile exactly to season aggregates;
- career years, team history, or season counts that differ from the underlying seasons;
- malformed or negative counting values;
- unexpected or missing career records.

Representative regression checks cover Ken Griffey Jr., David Wright, David Ortiz, and Mariano Rivera through stable Lahman IDs.

## Commands

```bash
pnpm --filter @initial-baseball/baseball-data generate:canonical-career-aggregates
pnpm --filter @initial-baseball/baseball-data generate:canonical-career-aggregates:strict
```

## Scope boundary

This phase does not compute career rate statistics, format UI strings, add WAR or awards, or migrate the live reveal. Those belong in later layers after these totals pass QA.
