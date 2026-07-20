# @initial-baseball/baseball-data

Player data ingestion, normalization, canonicalization, enrichment, and serving-artifact generation.

## Current live dataset

`baseballPlayers` is still the dataset consumed by the live game. It is a broad Chadwick-derived search universe enriched from committed Lahman data.

- It supports player-name search and legacy player lookup.
- It includes generated role, position, decade, team, career statline, and Daily-eligibility fields where source coverage is available.
- It is primarily built around MLB players with post-1950 played-year coverage, plus inducted Hall of Fame players even when they played before 1950.
- Some records still use fallback values when matching or Lahman coverage is incomplete.
- WAR is not included.

The live dataset is being replaced in stages. Until runtime migration is complete, changes to the canonical pipeline do not automatically change the game.

## Canonical shadow pipeline

The replacement pipeline now generates these layers in order:

1. canonical identities;
2. Lahman-first canonical player universe and legacy redirects;
3. canonical season source facts;
4. canonical player-season aggregates;
5. canonical season cards;
6. canonical career aggregates;
7. canonical career cards;
8. canonical season and career enrichment;
9. canonical runtime payload.

The runtime payload joins the validated layers into:

- a lightweight player index for search and selection;
- deterministic reveal shards containing career summaries and one row per regular season;
- legacy-ID redirects whose targets have valid runtime reveal records.

The runtime payload remains a shadow artifact. The web app does not consume it yet.

## Data ownership

- Canonical identity owns display names, aliases, and source mappings.
- Season cards own regular-season counting statistics, teams, and positions.
- Season enrichment owns season-level derived and sourced values such as OPS and future WAR, OPS+, ERA+, awards, All-Star selections, and league-leading flags.
- Career cards own career counting summaries and references to regular seasons.
- Career enrichment owns validated career derived values and Hall of Fame metadata.
- The runtime payload joins these layers but does not recalculate baseball facts.

Longer legal or source names may remain aliases for search. Runtime reveal records expose only the canonical display name, preventing names such as a longer David Ortiz source name from appearing in the game.

## Missing-data rules

Null and zero are different.

- A known zero remains `0`.
- An unavailable value remains `null`.
- OBP, SLG, and OPS are produced only when every contributing Lahman batting source row includes every required component.
- Mixed known and unknown source rows do not produce a partial rate statistic.
- Unsupported values such as WAR, OPS+, ERA+, awards, and All-Star selections remain explicitly `null` until an approved source or derivation is added.

## Daily-eligible exports

The legacy exports remain:

- `baseballPlayers`: the full searchable and guessable legacy universe;
- `dailyEligiblePlayers`: the generated Daily-answer pool;
- `coreDailyEligiblePlayers`: the safest default Daily-answer pool;
- `extendedDailyEligiblePlayers`: a harder future or custom-answer pool.

The current `core`, `extended`, and `none` thresholds are product heuristics. Future admin tooling may force-include or force-exclude players.

## Runtime serving design

Canonical reveal records are sharded by canonical player ID. A client can load the lightweight index, read a player's shard path, and fetch only the relevant reveal shard. This keeps initial browser payloads smaller and gives web, mobile, and server consumers the same data contract.

See:

- `docs/data/canonical-career-enrichment.md`
- `docs/data/canonical-runtime-payload.md`

## Principles

- Gameplay never calls external baseball APIs live.
- Data is imported and normalized ahead of time.
- The UI formats canonical values but does not derive or reinterpret baseball facts.
- Missing statistics remain nullable and can later be corrected through approved data or admin overrides.
- Search aliases do not determine reveal display names.
