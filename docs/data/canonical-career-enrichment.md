# Canonical Career Enrichment

This layer adds values that are derived or sourced beyond direct career counting stats. It sits after canonical career cards and before runtime serving.

## Current scope

The generator produces one enrichment record per canonical career card.

It currently adds:

- career on-base percentage derived from canonical Lahman career totals;
- career slugging percentage derived from canonical Lahman career totals;
- career OPS as on-base percentage plus slugging percentage;
- Hall of Fame induction metadata from the committed Lahman `HallOfFame.csv` table;
- explicit provenance and source hashes.

The OPS calculation uses the standard denominator available from the committed inputs: at-bats, walks, hit-by-pitches, and sacrifice flies. If any required component is unavailable, OBP and OPS remain `null` rather than being estimated.

## Deliberately unsupported values

The following remain `null` because the repository does not yet contain an approved source or completed derivation:

- WAR;
- OPS+;
- ERA+;
- FIP;
- player awards;
- All-Star selections;
- league-leading indicators.

The source manifest records why each field is unavailable. The generator validates that unsupported fields have not been populated accidentally.

## Architecture

The data flow is:

`canonical career cards + canonical career aggregates + Lahman Hall of Fame -> canonical career enrichment`

This PR does not change the live game or mutate the direct canonical career totals. A later serving step may join the card and enrichment artifacts into the runtime payload.

## QA

Strict generation checks:

- exactly one enrichment row per career card;
- stable canonical and Lahman identity joins;
- OPS reconciliation to OBP plus SLG;
- unsupported values remain `null`;
- regression coverage for David Ortiz, Mariano Rivera, Ken Griffey Jr., and David Wright.
