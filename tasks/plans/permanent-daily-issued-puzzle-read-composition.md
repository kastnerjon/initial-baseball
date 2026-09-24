# Permanent Daily issued-puzzle server read composition

Status: implemented server composition boundary

## Scope contract

- **Goal:** compose the portable permanent-puzzle read service with the existing server-only Supabase provider for later archive gameplay.
- **Owning layer:** `apps/web` server-only composition.
- **In scope:** one service-role Supabase client, construction of the existing read repository, delegation to the portable read service, focused composition tests, and canonical documentation.
- **Out of scope:** public routes/navigation, launch-date/epoch configuration, deriving current permanent identity, canonical player/reveal materialization, gameplay bootstrap, browser persistence/history, scoring, migrations, or new privileges.
- **Acceptance checks:** number/date reads flow through the portable service; both use the repository created from the same server client; nullable not-issued results remain null; portable query validation still occurs before provider access.
- **Stop conditions:** any player-data materialization, route/API contract, launch policy, browser persistence, or database change becomes a separate PR.

## Composition

`createServerPermanentDailyIssuedPuzzleReadService` is the web/server wiring seam. It creates the existing server Supabase client, passes that client to `createSupabasePermanentDailyIssuedPuzzleReadRepository`, and wraps the repository with `createPermanentDailyIssuedPuzzleReadService`.

The composition layer adds no archive semantics. Validation of series/date/number and provider identity remains in `packages/daily`; SQL/query behavior and strict row decoding remain in the Supabase adapter.

Construction itself does not read a puzzle. Callers explicitly choose `getByNumber` or `getByDate`.

## Deliberate exclusions

This service returns the immutable issued-puzzle contract: permanent identity, exact ordered canonical player IDs, and first issue timestamp. Gameplay materialization is implemented separately in `tasks/plans/permanent-daily-puzzle-materialization.md`, so this reader remains persistence composition only.

No launch epoch is configured or inferred, and there is still no public archive route.

## Next boundary

Compose this server reader with the separate permanent-puzzle materializer into one archive puzzle source/runtime seam. Still do not add public navigation/route behavior or choose the permanent launch epoch.
