# Canonical Season and Career Enrichment

This layer adds values that are derived or sourced beyond the direct counting statistics already stored in canonical season and career cards. It sits after both card layers and before runtime serving.

## Current scope

The generators produce:

- one season-enrichment record per canonical season card; and
- one career-enrichment record per canonical career card.

Season enrichment currently adds:

- regular-season on-base percentage derived from canonical Lahman season totals;
- regular-season slugging percentage carried from the validated season card;
- regular-season OPS as on-base percentage plus slugging percentage;
- explicit placeholders and provenance for future WAR, OPS+, ERA+, FIP, awards, All-Star selections, voting finishes, and league-leading flags.

Career enrichment currently adds:

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
- award-voting finishes;
- league-leading indicators.

These fields are represented at the season level first because awards, league-leading status, WAR, OPS+, and ERA+ are fundamentally season facts. Career summaries can later aggregate or summarize those validated season records rather than becoming a second source of truth.

## Architecture

The data flow is:

`canonical season cards -> canonical season enrichment`

`canonical career cards + canonical career aggregates + Lahman Hall of Fame -> canonical career enrichment`

The reveal card can therefore display one row per regular season with configurable columns, while the career line remains a separate summary derived from the same canonical facts. This PR does not change the live game or mutate direct canonical totals.

## QA

Strict generation checks:

- exactly one season-enrichment row per season card;
- exactly one career-enrichment row per career card;
- stable canonical and Lahman identity joins;
- OPS reconciliation to OBP plus SLG at both levels;
- unsupported values remain `null`;
- season regression coverage for David Ortiz, Ken Griffey Jr., and Shohei Ohtani;
- career regression coverage for David Ortiz, Mariano Rivera, Ken Griffey Jr., and David Wright.
