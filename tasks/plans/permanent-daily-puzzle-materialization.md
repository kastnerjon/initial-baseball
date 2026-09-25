# Permanent Daily gameplay puzzle materialization

Status: implemented web materialization boundary

## Scope contract

- **Goal:** turn one already-frozen permanent Daily snapshot into the minimum gameplay-ready `DailyPuzzle` shape without changing its answers or choosing launch policy.
- **Owning layer:** `apps/web` server-side gameplay materialization.
- **In scope:** canonical-ID player lookup shared with current public Daily editorial materialization, exact frozen-order pitch construction, current shared hint/stats configuration, fail-closed missing-player behavior, focused tests, and canonical documentation.
- **Out of scope:** Supabase reads/writes, archive routes/navigation, launch-date/epoch configuration, deriving today's permanent identity, progression tokens/bootstrap, browser saves/history, result submission/comparison, scoring/ruleset selection, migrations, or new data contracts.
- **Acceptance checks:** puzzle ID/date/number come from the immutable snapshot; pitch order exactly matches frozen canonical IDs; player identity/hints reuse current Daily pitch construction; unavailable frozen IDs fail instead of substituting generated players; no launch or ruleset field is introduced.
- **Stop conditions:** needing a new canonical fact contract, new hint-formatting system, persistence change, route/API contract, or launch-product decision becomes a separate PR.

## Materialization rule

The permanent issued-puzzle row is authoritative for **answer identity and order**. Materialization must never rerun lineup generation.

For each frozen canonical ID, the web layer resolves the same gameplay-ready `Player` record used by the current scheduled/published editorial Daily path and passes it through the existing `createDailyPuzzlePitch` adapter. The materializer then restores the canonical ID on the resulting player identity.

This deliberately reuses the current Daily hint construction rather than creating a second teams/decade/stats formatter from canonical runtime records. A second formatter would be an unnecessary drift risk.

If a frozen canonical ID is no longer available in the current gameplay-ready canonical player lookup, materialization fails closed. It never falls back to a newly generated player.

## Puzzle metadata

The materialized puzzle uses:

- the immutable permanent puzzle ID;
- the immutable permanent Daily number/date;
- `published` as the playable runtime status;
- current shared default Daily hint/stats configuration.

The immutable snapshot currently freezes answers, not a beta game/ruleset or hint-profile version. Final launch game/ruleset policy remains an explicit later decision.

## Next boundary

Server-only reader + materializer composition is implemented as the archive puzzle source in `tasks/plans/permanent-daily-archive-puzzle-source.md`. Next compose that source with the existing Daily runtime/progression-token machinery. Keep public navigation/routes, browser history, and the permanent launch epoch separate.

## Archive clue immutability follow-on

The archive materializer now accepts the persisted v1/v2 union. Schema-v1 records keep this plan's current-player clue construction; schema-v2 records use their frozen hint layout, labels, public initials, and values while resolving canonical player identity for runtime/reveal behavior. No scoring is frozen. Scope: `tasks/plans/permanent-daily-archive-clue-materialization.md`.
