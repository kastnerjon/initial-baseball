# Player data quality and canonical identity

Status: Living source of truth
Last updated: 2026-07-20

## Goal

Daily Inning must present one understandable, trustworthy representation of each real player. Source datasets contain duplicate identifiers, formal legal names, middle names, spelling variants, accents, same-name people, incomplete historical fields, multi-team seasons, and conflicting records. Those source irregularities must not leak directly into lineup selection, search, hints, or reveal cards.

## Canonical identity model

Each accepted player has:

- one stable internal canonical `playerId`;
- one Lahman player identifier;
- one user-facing `displayName`;
- zero or more searchable aliases;
- linked source identifiers and provenance;
- zero or more canonical regular-season records;
- at most one canonical career card and runtime reveal record.

A source row is evidence for a player. It is not automatically a separate playable player.

Canonical records are joined through canonical and source IDs. Display names are never join keys.

## Display-name and alias rules

The visible name is the name by which baseball fans commonly know the player.

Requirements:

- Preserve accents and ordinary punctuation in the display name.
- Search also works without accents or punctuation.
- Do not show a middle or legal name merely because one source contains it.
- Keep useful legal names, nicknames, shortened names, and former source display names as aliases when they are not the canonical display name.
- Handle suffixes such as Jr., Sr., II, and III consistently.
- Store manual display-name decisions as auditable data under `packages/baseball-data`, not UI patches.
- Runtime display payloads expose `displayName`, not `legalName`.

Example: the game displays `David Ortiz`; longer names remain searchable aliases.

## Genuine same-name players

Possible duplicates must never be merged by name alone. Resolution uses source identifiers and evidence such as birth date, debut/final year, teams, position, and source lineage.

Confirmed duplicate source identities resolve to one canonical player. Genuine same-name players remain separate canonical players.

Search and admin surfaces must distinguish genuine same-name records using available context such as:

- career years;
- hitter, pitcher, or two-way classification;
- primary position;
- teams;
- canonical ID in admin tooling.

The canonical index currently preserves the distinct Ben Taylor identities rather than choosing one based on the shared display name.

## Season ownership

A canonical season card represents one player and one regular season. It owns:

- season year;
- all teams represented in that season;
- position appearances;
- direct batting totals;
- direct pitching totals;
- safe derived season rates whose required source components are complete.

Multiple team rows for the same player-season are aggregated into one season card while retaining all team IDs. A player with both batting and pitching records may retain both sets of facts regardless of the presentation classification.

Season enrichment owns season-level advanced or separately sourced facts such as OPS and future WAR, OPS+, ERA+, awards, All-Star selections, voting finishes, and league-leading status.

## Career ownership

Career aggregates are exact rollups of accepted canonical seasons. Career cards own the career range, teams, primary position, player classification, direct career summaries, and references to every canonical season.

Career enrichment owns validated career rate statistics and Hall of Fame metadata. Season facts remain the primary owner of season-specific achievements and advanced values; career summaries may later aggregate those validated season records.

Career records must not introduce a second, conflicting representation of season facts.

## Missing-data and derived-stat rules

Null and zero are different:

- a known zero remains `0`;
- an unavailable component remains `null`;
- no missing component is silently treated as zero.

OBP, SLG, and OPS are published only when every contributing Lahman batting source row includes every required component.

For OBP, the required components are AB, H, BB, HBP, and SF. For SLG, the required components are AB, H, 2B, 3B, and HR. OPS requires both complete OBP and complete SLG.

Mixed known and unknown rows must not produce a partial rate. For example:

- the 1944 Roy Campanella source rows contain incomplete sacrifice-fly coverage, so that season's OBP and OPS remain `null`;
- Willie Mays has incomplete sacrifice-fly coverage in early career rows, so his career OBP and OPS remain `null` even though later seasons contain SF values.

Unsupported values such as WAR, OPS+, ERA+, FIP, player awards, All-Star selections, voting finishes, and league-leading indicators remain explicitly `null` until an approved source or derivation exists.

## Runtime serving contract

The canonical runtime layer packages validated data for consumers. It does not derive or correct baseball facts.

It produces:

- a lightweight player index for search, identity, classification, and shard lookup;
- deterministic reveal shards with career summaries and ordered regular-season rows;
- legacy-ID redirects whose targets have runtime reveal records;
- explicit exclusions for redirects without valid reveal targets;
- manifests and QA reports.

The runtime index may contain aliases for search. Full reveal records omit legal names and use only the canonical display name.

A valid reveal record must not be exposed to the browser before it is safe to reveal the hidden answer.

## Validation requirements

Generation checks include:

- one canonical identity per accepted Lahman player;
- stable canonical and Lahman ID joins;
- duplicate canonical IDs and source mappings;
- genuine normalized-name collisions;
- first season later than last season;
- duplicate player-season records;
- season rows outside the career range;
- incorrect multi-team aggregation;
- conflicting or implausible player classification;
- impossible or non-finite counting and derived statistics;
- career totals that fail to reconcile to canonical seasons;
- rate statistics populated from incomplete source rows;
- missing season or career enrichment joins;
- runtime index, reveal, shard, and redirect mismatches;
- accidental legal-name leakage into display payloads.

Critical failures stop strict generation. Lower-confidence anomalies remain visible in review reports.

## Quality-report workflow

`packages/baseball-data` produces deterministic reports for every canonical layer and CI uploads the complete pipeline artifact. A data-contract PR is not complete merely because CI is green.

Review also includes:

- generated summary and critical-issue reports;
- representative reveal records;
- incomplete historical cases;
- hitter, pitcher, and two-way cases;
- multi-team seasons;
- genuine same-name identities;
- pull-request review findings.

Direct generated-artifact edits are prohibited. Fix the source data, normalization, correction layer, or generator and regenerate.

## Admin-editable correction contract

The future admin dashboard must edit canonical player corrections through a service or repository boundary rather than changing generated JSON or React state.

Every correction must record:

- canonical `playerId`;
- changed fields;
- a human-readable reason;
- editor identity;
- edit timestamp.

Initial editable fields may include display name, aliases, role, position, career context, teams, and Daily eligibility. Corrections must be validated, auditable, reversible, and applied before artifacts are regenerated.

The lineup editor must show enough context to avoid selecting the wrong same-name player and must warn about incomplete reveal data or unresolved quality flags.

## Current implementation sequence

1. Complete and merge the canonical runtime payload and source-completeness fixes.
2. Migrate web search, answer resolution, saved state, and historical overrides to canonical IDs and redirects.
3. Add same-name disambiguation in the consumer UI.
4. Render canonical career and regular-season reveal records.
5. Verify Daily generation and historical puzzles after migration.
6. Add persisted, auditable admin corrections and lineup publication.
7. Continue adding approved enrichment sources only through the season-first ownership model.

## Completion criteria

Player-data cleanup is launch-ready when:

- one real player does not appear as duplicate indistinguishable candidates;
- common searches return the expected baseball name without odd source-only middle names;
- genuine same-name players remain distinct and understandable;
- career years, season rows, rates, and totals pass automated consistency checks;
- unsupported or incomplete data remains explicit rather than estimated;
- every manual correction is centralized, documented, and reproducible;
- runtime consumers use canonical IDs and do not recalculate baseball facts;
- generated artifacts and tests are deterministic.

## Change rule

This specification and the implementation must be updated together whenever canonical identity, display-name, alias, merge, season/career ownership, missing-data, enrichment, or runtime-serving behavior changes.
