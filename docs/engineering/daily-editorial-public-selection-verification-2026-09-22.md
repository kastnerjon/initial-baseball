# Daily editorial public-selection verification — September 22, 2026

Status: scheduled editorial consumption and deterministic missing/draft fallback production-verified

## Scope contract

- **Goal:** record direct hosted evidence that public Daily resolution consumes an eligible scheduled editorial lineup and uses deterministic fallback when an editorial record is missing or still draft.
- **Owning layer:** repository engineering verification/documentation.
- **In scope:** exact GitHub/Vercel baseline, the hosted Supabase editorial states used as probes, production Daily Nine/Classic identity for the scheduled case, authoritative comparison-route identities for scheduled/draft/missing cases, and canonical todo/handoff reconciliation.
- **Out of scope:** runtime code changes, authenticated editor preview/search/replace/revalidate QA, Vercel WAF configuration, comparison browser/mobile lifecycle QA, scoring changes, database migrations, or editorial-row mutations.
- **Acceptance checks:** production is on the exact current main SHA with green CI and clean runtime-error scan; the scheduled row's canonical-ID fingerprint matches the production puzzle identity; draft and missing records resolve to deterministic non-editorial puzzle identities; relevant canonical docs are reconciled.
- **Stop conditions:** any mismatch between stored editorial state and authoritative public identity would require a separate runtime investigation rather than a documentation-only correction.

## Exact hosted baseline

At this checkpoint:

- GitHub `main` is `fd59837376b48fc7a0726fc9840e850f64ec054f` with no open pull requests.
- Push CI run #829 (`35784235727`) completed successfully on that exact SHA.
- Vercel production deployment `dpl_DMLdBZDVaNXmtixUBSKNkHKykZZz` is `READY`, targets production, and reports the same Git commit SHA.
- The canonical production aliases are attached with no alias error.
- The exact deployment's reviewed error/fatal runtime-log window contained no matching entries.

No Supabase schema or data mutation was performed for this verification.

## Scheduled editorial consumption

The hosted `public.daily_editorial_puzzles` row for 2026-09-22 / Daily #149 remained in `scheduled` status at revision 2, with nine ordered manual canonical-player selections and `chatops:assistant` scheduling attribution.

The production Daily Nine and Classic pages both returned HTTP 200 and both bootstrapped the same public puzzle:

- puzzle ID: `daily-2026-09-22-editorial-83a0294e`;
- puzzle number: `149`;
- puzzle date: `2026-09-22`;
- puzzle status: `scheduled`.

The nine canonical IDs from the scheduled Supabase row were independently ordered by slot and passed through the existing `createEditorialDailyPuzzleId` fingerprint algorithm. The resulting fingerprint was `83a0294e`, exactly matching the public production puzzle ID.

The authoritative comparison reads independently bound to that same identity:

- `GET /api/daily/comparison/at-bat?date=2026-09-22&ruleset=points-v3&pitch=1` returned HTTP 200 with puzzle ID `daily-2026-09-22-editorial-83a0294e`.
- `GET /api/daily/comparison/completed?date=2026-09-22&ruleset=points-v3` returned HTTP 200 with the same puzzle ID.
- Both responses retained `Cache-Control: private, no-store`.

Population counts and averages from those probes are intentionally not treated as acceptance facts because they change as people play.

This closes the hosted requirement that a still-scheduled editorial record is actually consumed by the public Daily path rather than merely being valid in unit tests.

## Deterministic fallback for draft and missing records

Two past-date probes after the lineup-quality launch cutoff were chosen so the authoritative server path could be exercised without changing production data.

### Draft record

Supabase contains a real editorial row for 2026-08-01 / Daily #97 with status `draft`.

The live authoritative at-bat comparison route returned HTTP 200 with puzzle ID:

`daily-2026-08-01`

The absence of an `-editorial-` fingerprint confirms that the draft row was not publicly consumed and the deterministic fallback identity was used.

### Missing record

Supabase contains no editorial row for 2026-09-14 / Daily #141.

The same live authoritative route returned HTTP 200 with puzzle ID:

`daily-2026-09-14`

Again, the deterministic non-editorial identity was used.

Both responses were schema-1 points-v3 comparison payloads with `private, no-store`. The zero-result populations observed on these historical probes are not part of the fallback acceptance criterion.

## Source and automated-test alignment

The hosted behavior matches the existing portable/public-source contract:

- `resolvePublicDailyPuzzleSelection` returns deterministic fallback for a missing record, mismatched date, or `draft` status.
- `scheduled` and `published` records resolve through their exact ordered canonical selections.
- `archived` remains deliberately unavailable pending a settled replay policy.
- `publicDailyPuzzleSource.test.ts` already covers exact scheduled/published order and null/draft fallback.

No runtime correction is indicated by this verification.

## Remaining editorial QA

This checkpoint does **not** close the separate authenticated-editor workflow item. Preview/search/replace/revalidate of one future slot still requires exercising that authenticated UI/workflow path.

It also does not alter the existing timed midnight-Pacific rollover evidence or the future permanent-archive policy.

## Decision

Mark the hosted scheduled-consumption and deterministic missing/draft fallback checklist items complete. Keep authenticated-editor slot QA open as its own concern. No runtime PR, migration, or scoring change is justified by this evidence.
