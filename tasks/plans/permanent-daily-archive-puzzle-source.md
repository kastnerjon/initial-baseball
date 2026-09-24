# Permanent Daily archive puzzle source

Status: implemented server archive source boundary

## Scope contract

- **Goal:** compose the existing server permanent-puzzle reader with the existing materializer into one reusable gameplay-ready archive puzzle source.
- **Owning layer:** `apps/web` server-only composition.
- **In scope:** number/date source methods, one constructed permanent read service, materialization of non-null frozen rows, null preservation for not-yet-issued puzzles, focused tests, and canonical documentation.
- **Out of scope:** progression-token/runtime bootstrap, public routes/navigation, launch-date/epoch configuration, browser saves/history, result submission/comparison, scoring/ruleset selection, migrations, or new persistence behavior.
- **Acceptance checks:** number/date queries delegate unchanged to the existing reader; non-null snapshots pass through the existing materializer; null remains null without materialization; materialization/read failures propagate without reinterpretation.
- **Stop conditions:** any runtime/token contract change, route/API contract, launch policy, browser persistence, or database change becomes a separate PR.

## Composition rule

`createServerPermanentDailyArchivePuzzleSource` constructs the existing server permanent-puzzle read service once and exposes:

- `getByNumber({ seriesVersion, dailyNumber })`
- `getByDate({ seriesVersion, puzzleDate })`

Each successful frozen read is passed directly to `materializePermanentDailyIssuedPuzzle`. Missing rows stay `null`.

This layer does not validate permanent identities itself, query Supabase directly, or construct hints/player facts. Those responsibilities remain in the portable read service, Supabase provider, and materializer respectively.

## Why this is separate from runtime

The source establishes one authoritative path from durable archive identity to a gameplay-ready `DailyPuzzle`. Progression-token/bootstrap behavior already has an existing Daily runtime abstraction and should be composed against this source in a separate bounded PR rather than creating a second engine or mixing route behavior into storage/materialization wiring.

## Next boundary

Server archive runtime composition is implemented in `tasks/plans/permanent-daily-archive-runtime.md`. Before public archive navigation/routes, isolate archive browser persistence/session identity from current Daily and retained game modes; keep the permanent launch epoch separate.
