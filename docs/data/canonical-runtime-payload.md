# Canonical Runtime Payload

The canonical runtime payload is the serving contract between the baseball-data pipeline and future web, mobile, and server consumers. It joins canonical identity, season cards, career cards, and enrichment without asking the UI to recompute baseball facts.

This PR creates a shadow artifact only. The live game still uses the legacy generated dataset until a separate runtime migration.

## Generated files

The generator writes `packages/baseball-data/reports/canonical-runtime-payload/`:

- `player-index.json`: a lightweight searchable index;
- `legacy-redirects.json`: valid legacy-ID redirects plus explicit exclusions;
- `reveal-shard-manifest.json`: shard paths, counts, sizes, and hashes;
- `reveal-shards/00.json` through `reveal-shards/ff.json`: full player reveal records;
- JSON and Markdown QA reports.

## Player index

Each index row contains the canonical ID, Lahman ID, canonical display name, search aliases, player type, primary position, career range, season count, team IDs, Hall of Fame status, and reveal-shard path.

Longer source names remain search aliases. The display payload deliberately excludes `legalName`, preventing a longer source name from replacing the intended display name. The reveal therefore shows `David Ortiz`, while longer names can still match in search.

## Reveal records

Each reveal record contains a career summary and one ordered row per regular season. Career and season rows include the applicable batting, pitching, advanced, achievement, team, and position fields.

The runtime generator only joins validated canonical records. It does not derive statistics. Unsupported fields remain `null` until their upstream enrichment is populated.

## Sharding

Canonical IDs use the form `ibp_<20 hexadecimal characters>`. Reveal records are assigned to 256 stable shards using the first two characters after `ibp_`.

A client loads the player index, reads the selected player's shard path, fetches that shard, and retrieves the record by canonical ID. This avoids loading every player's season history into the initial browser bundle and keeps the contract portable across web, mobile, and server code.

## Redirects

A legacy redirect is published only when its canonical target has a runtime reveal. Redirects without a reveal target are retained in `excludedRedirects` with a reason instead of silently pointing to a missing record.

## QA contract

Strict generation verifies one index row and one reveal per career card, one runtime season row per canonical season card, exact identity and enrichment joins, stable shard assignment, valid redirect targets, and exclusion of legal names from display payloads.

Regression cases cover David Ortiz, Mariano Rivera, Shohei Ohtani, Ken Griffey Jr., and David Wright.

## Next step

A later PR will migrate web search, reveals, and saved-state resolution to this contract. The UI may format canonical values, but it should not recalculate or reinterpret them.
