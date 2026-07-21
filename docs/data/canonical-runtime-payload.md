# Canonical Runtime Payload

The canonical runtime payload is the live serving contract between the baseball-data pipeline and server consumers. It joins canonical identity, season cards, career cards, enrichment, and team display identity without asking the UI to recompute baseball facts.

## Generated files

The generator writes `packages/baseball-data/reports/canonical-runtime-payload/`:

- `player-index.json`: a lightweight searchable index;
- `legacy-redirects.json`: valid legacy-ID redirects plus explicit exclusions;
- `reveal-shard-manifest.json`: shard paths, counts, sizes, and hashes;
- `reveal-shards/00.json` through `reveal-shards/ff.json`: full player reveal records;
- compact JSON serving files plus JSON and Markdown QA reports.

## Player index

Each index row contains the canonical ID, Lahman ID, canonical display name, search aliases, player type, primary position, career range, season count, source team IDs, fan-facing team identities, Hall of Fame status, and reveal-shard path.

Longer source names remain search aliases. The display payload deliberately excludes `legalName`, preventing a longer source name from replacing the intended display name. The reveal therefore shows `David Ortiz`, while longer names can still match in search.

## Team identity and display

Lahman `teamID` values remain in `teamIds` for provenance and source joins. They are not assumed to be public abbreviations.

The runtime generator resolves every `(season, teamID)` through committed Lahman `Teams.csv` and adds `teamIdentities` containing:

- `sourceTeamId`: the original Lahman team identifier;
- `abbreviation`: the fan-facing Baseball Reference abbreviation from `teamIDBR`, with `teamIDretro` and the source ID used only as explicit source fallbacks;
- `displayName`: the season-specific team name after explicit, reviewed corrections for known stale source labels.

Season context is mandatory because the same franchise can have different public identities over time. Corrections are keyed by season and source ID in baseball-data rather than patched in React. Career team identities preserve historically distinct names for data consumers; fan-facing abbreviation lists deduplicate repeated abbreviations at the presentation boundary. Web, admin, reveal, and future clients consume this common representation rather than maintaining independent string maps.

## Reveal records

Each reveal record contains a career summary and one ordered row per regular season. Career and season rows include the applicable batting, pitching, advanced, achievement, source-team, fan-facing team, and position fields.

The runtime generator only joins validated canonical records. It does not derive statistics. Unsupported fields remain `null` until their upstream enrichment is populated.

## Sharding

Canonical IDs use the form `ibp_<20 hexadecimal characters>`. Reveal records are assigned to 256 stable shards using the first two characters after `ibp_`.

The baseball-data runtime accessor loads the index and redirects on the server, validates shard identity, and lazily caches only requested reveal shards. The browser searches through a route and never downloads the complete index or a reveal shard. This avoids loading every player's identity or season history into the initial browser bundle while keeping the underlying contract portable.

## Compatibility

`teamIdentities` remains optional in the TypeScript representation of schema-1 payloads because previously generated schema-1 artifacts did not contain the field. Current generation always emits and validates it. The web view-model boundary falls back to source `teamIds` for an older artifact instead of throwing; current canonical artifacts use fan-facing abbreviations.

## Redirects

A legacy redirect is published only when its canonical target has a runtime reveal. Redirects without a reveal target are retained in `excludedRedirects` with a reason instead of silently pointing to a missing record.

## QA contract

Strict generation verifies one index row and one reveal per career card, one runtime season row per canonical season card, exact identity and enrichment joins, stable shard assignment, valid redirect targets, exclusion of legal names from display payloads, complete team-display coverage, and preservation of source team IDs.

Consumer QA covers David Ortiz, Mariano Rivera, Shohei Ohtani, Ken Griffey Jr., David Wright, Willie Mays, Roy Campanella, all distinct Ben Taylor records, Dodgers/Yankees/Mets/Angels display identities, the audited 2016-and-later Angels name correction, redirects, and explicit redirect exclusions. Presentation QA additionally requires unique career abbreviations and safe fallback for older schema-1 artifacts.

## Web serving boundary

The initial Daily page receives a public puzzle containing initials and display configuration only. Search results expose canonical IDs plus disambiguation context. Hint routes return one requested hint. Guess resolution canonicalizes submitted legacy or canonical IDs and returns full reveal data only for a correct answer, third strike, or Give Up. Action routes reject unpublished future Daily dates. The UI may format canonical values and deduplicate presentation labels, but it does not recalculate or reinterpret baseball facts.
