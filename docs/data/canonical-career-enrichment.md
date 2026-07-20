# Canonical Season and Career Enrichment

This layer adds values that are derived or sourced beyond the direct counting statistics already stored in canonical season and career cards. It sits after both card layers and before the canonical runtime payload.

## Current scope

The generators produce:

- one season-enrichment record per canonical season card; and
- one career-enrichment record per canonical career card.

Season enrichment currently adds:

- regular-season on-base percentage derived from canonical Lahman season totals;
- regular-season slugging percentage carried from the validated season card only when every required source-row component is present;
- regular-season OPS as on-base percentage plus slugging percentage;
- explicit placeholders and provenance for future WAR, OPS+, ERA+, FIP, awards, All-Star selections, voting finishes, and league-leading flags.

Career enrichment currently adds:

- career on-base percentage derived from canonical Lahman career totals only when every required batting source row is complete;
- career slugging percentage derived from canonical Lahman career totals only when every required batting source row is complete;
- career OPS as on-base percentage plus slugging percentage;
- Hall of Fame induction metadata from the committed Lahman `HallOfFame.csv` table;
- explicit provenance and source hashes.

The OPS calculation uses at-bats, hits, walks, hit-by-pitches, sacrifice flies, doubles, triples, and home runs. A derived rate is published only when every contributing Lahman batting source row contains every required component. Mixed known and unknown rows do not produce a partial denominator or numerator. In those cases OBP, SLG, and OPS remain `null` rather than being estimated.

This rule matters for historical data. For example, Willie Mays has early batting rows without sacrifice-fly values, so career OBP and OPS remain `null` until a complete approved source is available. Modern complete careers such as David Ortiz, Mariano Rivera, Ken Griffey Jr., and David Wright still receive calculated OPS values.

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

`canonical season cards + canonical batting source rows -> canonical season enrichment`

`canonical career cards + canonical career aggregates + canonical batting source rows + Lahman Hall of Fame -> canonical career enrichment`

`season enrichment + career enrichment + canonical cards + canonical identity -> canonical runtime payload`

The reveal data can therefore display one row per regular season with configurable columns, while the career line remains a separate summary. Display names come from canonical identity. Longer legal names remain search aliases and are not promoted into the reveal display field.

## QA

Strict generation checks:

- exactly one season-enrichment row per season card;
- exactly one career-enrichment row per career card;
- stable canonical and Lahman identity joins;
- source-row completeness before publishing OBP, SLG, or OPS;
- OPS reconciliation to OBP plus SLG at both levels;
- unsupported values remain `null`;
- season regression coverage for David Ortiz, Ken Griffey Jr., Shohei Ohtani, and an intentionally incomplete 1944 source case;
- career regression coverage for David Ortiz, Mariano Rivera, Ken Griffey Jr., David Wright, and the intentionally incomplete Willie Mays career case.
