# Permanent Daily archive clue materialization

Status: implemented; exact-head CI and Preview pending

## Scope contract

- **Goal:** materialize each issued schema-v2 permanent Daily with the exact initials, hint layout, labels, and values frozen at issuance.
- **Primary owner:** `apps/web` server-side archive materialization. The portable Daily read service is widened only to return the existing v1/v2 record union it already receives from its repository.
- **In scope:** v1/v2 read-service support with defensive cloning and identity checks; schema-v2 materialization from its persisted clue snapshot; unchanged schema-v1 materialization; focused tests; and canonical documentation updates.
- **Out of scope:** migrations, table/privilege/policy changes, issuance behavior, row creation or rewriting, routes/navigation, launch date/epoch, scoring/ruleset selection, initials-generation changes, results, browser persistence, and history UI.
- **Acceptance checks:** v2 runtime hints and public initials exactly match stored snapshot data even when current player records would generate different clues; v2 labels/order come from the stored layout; canonical answer IDs/order remain exact; current player lookup remains required for gameplay/reveal identity and fails closed when unavailable; v1 continues to materialize through the existing Daily path; no new permanent row is written.
- **Stop conditions:** needing a schema change, rewriting stored rows, changing player identity/facts, changing scoring or route/token behavior, or exposing answer data through public puzzle/bootstrap payloads becomes a separate decision and PR.

## Architecture

The immutable record already stores a discriminated v1/v2 union. `packages/daily` owns query validation, provider identity checks, and defensive record cloning; the read service must return the stored version without dropping v2 or rebuilding clues. The web archive materializer owns the conversion to gameplay shape.

For v1 rows, retain current behavior: resolve each canonical player and construct the public pitch through `createDailyPuzzlePitch` and the current shared hint configuration. For v2 rows, resolve the same canonical player for display/reveal identity, but take `hintConfig`, each pitch's public `initials`, and each hint value exclusively from `clueSnapshot`. Do not call the mutable hint formatter for v2. Keep scoring and the current stats/reveal data outside the frozen clue contract.

This changes no Supabase schema, privileges, data, issuance path, or public route. The production issued-puzzle table must remain empty until the separately authorized permanent-launch process.

## Verification

- Focused `packages/daily` read tests prove v1/v2 reads, query identity validation, null behavior, and defensive copies including nested v2 clues.
- Focused web materialization tests prove exact v2 clue preservation despite changed current player clues, unchanged v1 behavior, and fail-closed unavailable/misaligned players.
- Run web and Daily tests/typechecks/builds, repository file-size and documentation-impact gates, then required exact-head CI and Preview.
- Read-only Supabase verification confirms zero issued rows and unchanged RLS/service-role SELECT/INSERT-only posture.

## Documentation impact

Updated `docs/START-HERE.md`, `tasks/todo.md`, and the September 24 archive/gameplay roadmap to record that archive reads now consume schema-v2 clue snapshots while keeping the schema-v1 path.

## Implemented behavior

The portable issued-puzzle reader now returns defensive v1/v2 record copies after query-identity validation. The web materializer keeps the v1 gameplay path unchanged; for v2 it takes pitch initials, hint values, hint order, and display labels from the persisted snapshot while resolving current canonical player records for answer/reveal identity. Existing per-slot outcome mapping remains the current Daily behavior because it is not part of the frozen clue snapshot. Missing players or a clue/player-order mismatch fail closed.
