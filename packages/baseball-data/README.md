# @initial-baseball/baseball-data

Player data ingestion, normalization, canonicalization, enrichment, and serving-artifact generation.

## Current live runtime

The canonical runtime payload supplies live player search, identity resolution, and reveal records. `createFileSystemCanonicalRuntimeAccessor` validates the index and redirects, resolves legacy IDs, and lazily loads deterministic reveal shards on the server.

The legacy `baseballPlayers` exports remain temporarily for Daily recognizability selection, historical overrides, and hint construction. They are no longer the browser search universe or reveal-stat source. WAR is not included.

The live web game consumes the canonical runtime payload. Further data work should improve the canonical pipeline or remove the remaining legacy Daily-selection inputs rather than creating a second runtime dataset.

## Canonical pipeline

The replacement pipeline generates these layers in order:

1. reviewed canonical identity snapshot;
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

The web app consumes the runtime payload through the server-side accessor. Strict generation and consumer QA run before the production web build.

## Reviewed identity inputs

Production and preview builds do not fetch Chadwick data. They materialize the committed reviewed identity snapshot under `data/canonical/identity-snapshot/`, then run the remaining canonical pipeline entirely from repository inputs.

The explicit refresh workflow is:

1. update `data/canonical/chadwick-source.json` to a reviewed Chadwick commit and expected source hashes;
2. run `pnpm data:identities` to generate identity candidates from that pinned revision;
3. inspect the identity reports;
4. run `pnpm --filter @initial-baseball/baseball-data update:canonical-identity-snapshot`;
5. commit the reviewed source pin and snapshot;
6. let CI regenerate the pinned identities and verify they exactly match the committed snapshot.

`pnpm data:runtime` consumes the committed snapshot and does not require GitHub or raw Chadwick availability.

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

Canonical reveal records are sharded by canonical player ID. Server consumers load the lightweight index once and only the relevant reveal shard after resolution. Browser clients use guarded web routes rather than downloading the complete index or shards.

See:

- `docs/data/canonical-career-enrichment.md`
- `docs/data/canonical-runtime-payload.md`

## Principles

- Gameplay never calls external baseball APIs live.
- Data is imported and normalized ahead of time.
- The UI formats canonical values but does not derive or reinterpret baseball facts.
- Missing statistics remain nullable and can later be corrected through approved data or admin overrides.
- Search aliases do not determine reveal display names.
