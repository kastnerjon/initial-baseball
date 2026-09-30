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

- career on-base percentage derived from unrounded canonical Lahman career totals after checking the underlying source rows for required components;
- career slugging percentage derived from unrounded canonical Lahman career totals after checking the underlying source rows for required components;
- career OPS as on-base percentage plus slugging percentage;
- Hall of Fame induction metadata from the committed Lahman `HallOfFame.csv` table;
- explicit provenance and source hashes.

OBP uses `(H + BB + HBP) / (AB + BB + HBP + SF)`, following [Baseball-Reference's formula](https://www.baseball-reference.com/glossary/on-base-percentage/). The sacrifice-fly rule did not apply before 1908, in 1931–1938, or in 1940–1953; a blank Lahman `SF` field in those seasons is therefore inapplicable to the formula and contributes zero. The rule applied in 1908–1930 and 1939, then again from 1954 onward, so a blank `SF` in those periods remains unavailable. The historical rule changes are documented by [SABR](https://sabr.org/journal/article/the-sacrifice-fly/) and [Retrosheet's rule-change record](https://www.retrosheet.org/rules/RulesChangesSummary.pdf). Unknown required fields such as `HBP` are never treated as zero.

Career OBP and SLG are computed from career counting-stat totals, not averaged season rates or rounded display values. The pipeline checks source-row availability for each rate's own required components, so an unavailable derived season rate does not invalidate a career rate when the career inputs are supported. Unknown required inputs still keep that rate unavailable. OPS is the sum of the unrounded derived OBP and SLG values.

This rule matters for historical data. Ernie Banks's 1953 row has an unknown `SF` field, but the rule was not in effect that season; his 1953 OBP and career OBP/OPS can be calculated from the supported counts. Willie Mays's early blank `SF` fields from years when the rule was absent are handled the same way. This rule does not fill missing sacrifice flies from a season when the rule was active or unknown hit-by-pitches.

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
- rate-specific source completeness before publishing OBP, SLG, or OPS, including historical sacrifice-fly applicability before 1908 and in 1931–1938 and 1940–1953;
- OPS reconciliation to OBP plus SLG at both levels;
- unsupported values remain `null`;
- season regression coverage for David Ortiz, Ken Griffey Jr., Shohei Ohtani, and Roy Campanella's 1944 row from a season when the SF rule was absent;
- career regression coverage for Ernie Banks, David Ortiz, Mariano Rivera, Ken Griffey Jr., David Wright, and Willie Mays;
- focused tests that preserve null when HBP or SF from a season with an active rule is genuinely unknown and distinguish aggregate rates from averages of season rates.

The current generated hitter/two-way universe has 8,537 careers. This rebuild reduces unavailable career OBP from 1,987 to 1,404 and unavailable OPS from 1,994 to 1,412. Among careers with at least 500 AB or five seasons, unavailable OPS falls from 416 to 111. Season OPS availability increases from 55,685 to 59,155 of 78,665 rows. These counts include pre-1908 seasons, when SF was not part of the rule; missing HBP and missing SF from seasons when the rule applied remain unavailable.
