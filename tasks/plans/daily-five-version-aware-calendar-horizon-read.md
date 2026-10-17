# Daily Five — version-aware editorial calendar horizon read

Status: Read-only staging; no Daily Nine scheduling or Daily Five write activation.

## Scope contract

- **Goal:** Inspect an inclusive bounded future Daily editorial horizon across contracts 1 (nine) and 2 (five), explicitly distinguishing unoccupied dates without treating unknown or malformed inventory as nine-player inventory.
- **Owning layer:** `apps/web` server-only Supabase editorial calendar read adapter and authenticated admin read route.
- **In scope:** Extend the existing minimal occupancy metadata reader with a bounded 1–31 day horizon; preserve the existing single-date query; deterministic ordered date slots, null for actual gaps, mixed-version metadata, malformed/unknown-version/date/duplicate/out-of-range/provider failure closed; authenticated no-store range query and focused tests; canonical documentation.
- **Out of scope:** Any Daily Nine horizon generator/repository/editor/scheduling behavior, backfills, issuing or publishing five-player puzzles, database migration, actual draft writes, calendar uniqueness changes, player selection retrieval, public API or UI, Custom, Archive and Classic.
- **Acceptance:** Focused mixed-version range and API auth/error tests, existing single-date regression, web typecheck, repository-wide checks, one bounded independent review, exact PR-head CI and READY Vercel Preview. Merge requires the review gate; verify main/push CI, production, routes and runtime after merge.
- **Stop conditions:** A change to legacy nine-player lifecycle, production writes, issuance, a database schema change, new dependencies or activation is required.

## Architecture and compatibility

Existing `supabaseDailyEditorialCalendarOccupancy` owns date-only metadata inspection. It intentionally never selects full editorial puzzle rows, canonical player IDs, hints or clues. Unlike the contract-1-only editorial repository, it decodes contract 1 and 2 explicitly and rejects unexpected versions or lifecycle states. It performs only a filtered, bounded read over the existing date-unique table. Both horizon and single-date modes require Daily admin Basic auth and return `private, no-store`.

This is a preparatory read boundary, **not a cutover**: Daily Nine's current seven-day generation, editorial storage, publication and issuance remain untouched and may still fail closed on encountering a contract-2 row. The separate write flag `DAILY_FIVE_DRAFT_WRITES_ENABLED` remains OFF. The next separately scoped change must design transactional cutover and mixed-version issuance before any five-player calendar writes.
