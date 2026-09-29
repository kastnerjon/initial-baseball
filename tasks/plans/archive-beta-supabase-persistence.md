# Archive-beta Supabase persistence

Status: implemented and hosted-verified on branch; merge pending

## Scope contract

- **Goal:** widen the existing append-only issued-puzzle Supabase persistence boundary so exact `archive-beta-v1` schema-v2 rows can be encoded, inserted and read without changing permanent behavior or issuing any real beta puzzle.
- **Owning layers:** `apps/web` Supabase adapter + one additive/backward-compatible Supabase migration.
- **In scope:** beta row codec; shared repository mechanics where they remove duplication; archive-beta write/read provider factories; permanent regression coverage; migration constraints that allow exactly `permanent-v1` schema v1/v2 and `archive-beta-v1` schema v2; series-consistent puzzle IDs; unchanged RLS/grants; hosted migration verification while row count remains zero; canonical docs.
- **Out of scope:** editorial issuance composition, configured beta epoch, writing real puzzle data, recurring issuance, archive routes/gameplay/results/history, reset/delete tooling, or permanent launch policy.
- **Acceptance checks:** permanent codec/repository tests remain green; beta schema-v2 row round-trips defensively; beta schema-v1/future-schema/wrong-series/wrong-ID rows fail closed; insert uses plain INSERT (no update/upsert); unique conflict reads the immutable winner by exact series+number; beta reads are exact-series; hosted constraints match the intended series/schema/ID contract; table remains empty; anon/authenticated retain no table privileges; service_role retains SELECT/INSERT only.
- **Stop conditions:** do not issue a real beta row in this PR. Any editorial/materialization/composition change belongs to the following authoritative issuance PR.

## Migration decision

Keep the existing table name `public.permanent_daily_issued_puzzles` to avoid a table rename and unrelated production risk. Widen the contents contract only:

- `series_version in ('permanent-v1', 'archive-beta-v1')`;
- permanent rows may be schema 1 or 2;
- archive-beta rows must be schema 2;
- `puzzle_id` must equal `series_version || '-daily-' || daily_number` (stronger than a loose regex);
- the existing clue-snapshot schema contract remains authoritative;
- primary/unique keys stay series-aware exactly as today;
- RLS and grants stay append-only and unchanged.

The migration is safe to apply before application activation because the table is empty at the starting checkpoint and existing permanent code remains valid under the widened constraints.


## Starting hosted checkpoint

Before this PR's migration, the production issued-puzzle table had zero rows. Existing constraints allowed only `permanent-v1`; RLS was enabled; service-role application privileges were SELECT/INSERT only. The migration is deliberately capability-only: hosted verification must leave the table at zero rows.


## Hosted verification

Production Supabase migration `allow_archive_beta_issued_puzzles` applied successfully. Post-migration verification confirmed:

- `series_version` permits only `permanent-v1` and `archive-beta-v1`;
- the series/schema constraint permits permanent schema 1/2 and beta schema 2 only;
- `puzzle_id` is constrained to exact `series_version || '-daily-' || daily_number`;
- the existing clue-snapshot, nine-player, uniqueness and positive-number constraints remain present;
- RLS remains enabled;
- among application roles, only `service_role` has table privileges, exactly SELECT and INSERT;
- row count remains zero for both permanent and archive-beta series.

The security advisor reports the table's intentional RLS-with-no-policies posture as informational because application access is service-role-only. Other advisor warnings concern unrelated pre-existing project objects and are outside this PR.
