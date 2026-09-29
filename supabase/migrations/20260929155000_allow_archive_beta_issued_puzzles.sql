alter table public.permanent_daily_issued_puzzles
  drop constraint permanent_daily_issued_puzzles_series_version,
  drop constraint permanent_daily_issued_puzzles_schema_version,
  drop constraint permanent_daily_issued_puzzles_puzzle_id_format;

alter table public.permanent_daily_issued_puzzles
  add constraint permanent_daily_issued_puzzles_series_version
    check (series_version in ('permanent-v1', 'archive-beta-v1')),
  add constraint permanent_daily_issued_puzzles_schema_version
    check (
      (
        series_version = 'permanent-v1'
        and schema_version in (1, 2)
      )
      or
      (
        series_version = 'archive-beta-v1'
        and schema_version = 2
      )
    ),
  add constraint permanent_daily_issued_puzzles_puzzle_id_format
    check (
      puzzle_id = series_version || '-daily-' || daily_number::text
    );

comment on table public.permanent_daily_issued_puzzles is
  'Immutable issued Daily puzzles for permanent-v1 and pre-launch archive-beta-v1. Permanent rows may use schema v1/v2; archive-beta rows require clue-frozen schema v2. Application access remains append-only: service_role has SELECT and INSERT only.';

comment on column public.permanent_daily_issued_puzzles.series_version is
  'Exact issued-puzzle series namespace. Supported values: permanent-v1 and archive-beta-v1.';

comment on column public.permanent_daily_issued_puzzles.puzzle_id is
  'Stable series-qualified identity: series_version || ''-daily-'' || daily_number.';
