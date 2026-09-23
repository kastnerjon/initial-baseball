create table public.permanent_daily_issued_puzzles (
  series_version text not null,
  daily_number integer not null,
  puzzle_date date not null,
  schema_version smallint not null,
  puzzle_id text not null,
  canonical_player_ids jsonb not null,
  issued_at timestamptz not null,
  created_at timestamptz not null default now(),

  primary key (series_version, daily_number),
  constraint permanent_daily_issued_puzzles_date_unique
    unique (series_version, puzzle_date),
  constraint permanent_daily_issued_puzzles_puzzle_id_unique
    unique (puzzle_id),
  constraint permanent_daily_issued_puzzles_series_version
    check (series_version = 'permanent-v1'),
  constraint permanent_daily_issued_puzzles_schema_version
    check (schema_version = 1),
  constraint permanent_daily_issued_puzzles_daily_number_positive
    check (daily_number > 0),
  constraint permanent_daily_issued_puzzles_puzzle_id_format
    check (puzzle_id ~ '^permanent-v1-daily-[1-9][0-9]*$'),
  constraint permanent_daily_issued_puzzles_players_array
    check (
      jsonb_typeof(canonical_player_ids) = 'array'
      and jsonb_array_length(canonical_player_ids) = 9
    )
);

create index permanent_daily_issued_puzzles_date_idx
  on public.permanent_daily_issued_puzzles (puzzle_date);

alter table public.permanent_daily_issued_puzzles enable row level security;

revoke all on table public.permanent_daily_issued_puzzles
  from public, anon, authenticated, service_role;
grant select, insert on table public.permanent_daily_issued_puzzles to service_role;

comment on table public.permanent_daily_issued_puzzles is
  'Immutable issued permanent Daily puzzles. Application access is append-only: service_role has SELECT and INSERT only.';
comment on column public.permanent_daily_issued_puzzles.canonical_player_ids is
  'Exact ordered nine canonical player IDs frozen at first issue; later lineup generation must not rewrite this array.';
comment on column public.permanent_daily_issued_puzzles.issued_at is
  'Portable first-successful-issue timestamp; exact retries preserve the original value.';
