alter table public.permanent_daily_issued_puzzles
  add column clue_snapshot jsonb;

alter table public.permanent_daily_issued_puzzles
  drop constraint permanent_daily_issued_puzzles_schema_version;

alter table public.permanent_daily_issued_puzzles
  add constraint permanent_daily_issued_puzzles_schema_version
    check (schema_version in (1, 2)),
  add constraint permanent_daily_issued_puzzles_clue_snapshot_contract
    check (
      (
        schema_version = 1
        and clue_snapshot is null
      )
      or
      (
        schema_version = 2
        and clue_snapshot is not null
        and jsonb_typeof(clue_snapshot) = 'object'
        and clue_snapshot ->> 'schemaVersion' = '1'
        and jsonb_typeof(clue_snapshot -> 'hintLayout') = 'array'
        and jsonb_typeof(clue_snapshot -> 'pitches') = 'array'
      )
    );

comment on column public.permanent_daily_issued_puzzles.clue_snapshot is
  'Schema-v2 immutable public clue snapshot: exact hint layout, initials, and materialized hint values. Null for schema-v1 rows.';

comment on table public.permanent_daily_issued_puzzles is
  'Immutable issued permanent Daily puzzles. Schema v1 freezes identity/order; schema v2 also freezes public clues. Application access remains append-only: service_role has SELECT and INSERT only.';
