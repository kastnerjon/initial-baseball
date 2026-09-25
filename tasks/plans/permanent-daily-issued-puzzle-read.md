# Permanent Daily issued-puzzle read contract

Status: implemented portable read boundary

## Scope contract

- **Goal:** define provider-neutral reads for already-frozen permanent Daily puzzles without requiring launch-epoch configuration.
- **Owning layer:** `packages/daily`.
- **In scope:** read-only queries by permanent series + Daily number and permanent series + puzzle date, nullable not-issued results, defensive identity checks, focused tests, exports, and canonical documentation.
- **Out of scope:** Supabase/web implementation, routes/navigation, launch-date/epoch configuration, deriving permanent identity from today's date, gameplay materialization, browser saves/history, scoring, or beta-history import.
- **Acceptance checks:** valid number/date reads return the frozen puzzle or null; invalid query shapes fail before provider access; a provider returning the wrong stable identity fails closed; returned puzzle data is defensively copied.
- **Stop conditions:** provider SQL/query behavior, route semantics, launch configuration, or gameplay composition becomes a separate PR.

## Contract

The read repository exposes two durable keys already stored on every frozen permanent puzzle:

- `getByNumber({ seriesVersion, dailyNumber })`
- `getByDate({ seriesVersion, puzzleDate })`

This deliberately does not accept or infer a launch epoch. An epoch is necessary when deriving which date corresponds to an arbitrary permanent number, but it is not necessary to retrieve an already-issued row whose date and number are persisted immutably.

The service validates the supported `permanent-v1` series, positive safe Daily numbers, and real `YYYY-MM-DD` calendar dates before provider access. Missing rows return `null`. Non-null provider results must match the requested stable key or the service fails closed.

The read port is separate from the first-write-wins repository. Issuance-only consumers therefore do not need read methods, and future archive-read implementations remain independently replaceable.

## Supabase implementation

The server-only provider implementation is recorded in `tasks/plans/permanent-daily-issued-puzzle-supabase-read.md`. It queries the existing immutable table by the durable unique number/date keys and reuses the established strict row codec; this portable module remains provider-agnostic.

## Next boundary

Server-only read composition and canonical gameplay materialization are implemented in `tasks/plans/permanent-daily-issued-puzzle-read-composition.md` and `tasks/plans/permanent-daily-archive-clue-materialization.md`. The materializer supports v1 backward reads and consumes persisted v2 clues. Keep the public archive route and launch-epoch decision separate.
