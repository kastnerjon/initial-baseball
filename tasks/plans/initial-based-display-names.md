# Initial-based canonical display/search names

## Scope contract

- **Goal:** show and find `JD Davis`, `CC Sabathia` and similarly abbreviated given names without artificial periods/spaces.
- **Owning layer:** `packages/baseball-data` canonical universe generation. Existing engine search consumes the generated canonical name and aliases without a new ranking or normalization rule.
- **In scope:** compact only leading runs of two or more dotted uppercase initials, preserve source display spelling as an alias, canonical generation/identity regressions, search compatibility regressions, runtime index/reveal QA, canonical docs.
- **Out of scope:** legacy gameplay-name cleanup, puzzle initials/clue changes, scoring, result writes, database migrations, persistence, archive comparison/history, general name cleanup and visual redesign.
- **Acceptance:** compact/spaced-dotted queries and legal-name aliases resolve to the same canonical answer ID; compact names agree in index/reveal; ordinary names/interior initials/accents/suffixes remain intact; canonical IDs/source mappings/redirects remain stable; initials-only queries stay blocked; strict pipeline and runtime QA have no new critical issue; focused tests and required CI/build/file-size/Preview gates pass.
- **Stop conditions:** a requirement to change gameplay names/clues, identity or source snapshots, persistence or another primary owning layer must be split rather than absorbed.

## Architecture and compatibility

`buildUniversePlayer` selects any suffix-qualified source name first, then compacts the leading initial run and retains the original selected spelling through existing alias deduplication. It never joins players by display name. Both canonical index and reveal generation inherit this one canonical display policy through the existing pipeline. No generated snapshot is edited and no source refresh is needed.

The current gameplay lookup uses the separate legacy `Player` data/name adapter. It is deliberately unchanged: changing those tokens could alter current/historical clues. Schema-2 issued puzzles retain their frozen clue facts. No Daily/React-specific name patch or duplicate strict-lower/search implementation is introduced.

## Validation and release

Focused universe and engine-search regressions cover compact, dotted/spaced, ordinary and suffix-bearing names; runtime consumer QA includes JD Davis and CC Sabathia. Review generation output for unchanged player/identity/redirect populations and inspect representative records. One bounded fresh-eyes review on exact PR head, exact-head CI plus READY Preview, expected-head merge, then exact main/push CI/production/canonical routes/error logs and open-PR verification are required. Supabase is read-only posture verification only; this change has no SQL.

Local full-universe comparison against main `1954fd0`: 98 canonical display names compacted across 13,622 universe players. All canonical IDs and every field other than displayName/aliases matched by ID; identity/compatibility redirects matched exactly. Each changed name retained its original spelling as an alias. Strict generation through runtime payload passed with zero new critical issues. Generated JD Davis and CC Sabathia index/reveal names agree.

Focused universe tests (23) and engine-search tests (19), full workspace tests, typecheck, lint, file-size checks, runtime consumer QA (13,620 players), and production web build/hidden-answer QA passed locally. Build-generated save totals and Next config rewrites were excluded from the diff.
