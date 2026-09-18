create table public.daily_completed_results (
  submission_id text primary key,
  schema_version smallint not null,
  puzzle_id text not null,
  puzzle_date date not null,
  puzzle_number integer not null,
  ruleset_version text not null,
  completed_at_bats jsonb not null,
  summary jsonb not null,
  created_at timestamptz not null default now(),

  constraint daily_completed_results_submission_id_format
    check (submission_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  constraint daily_completed_results_schema_version
    check (schema_version = 1),
  constraint daily_completed_results_puzzle_id_present
    check (length(btrim(puzzle_id)) > 0),
  constraint daily_completed_results_puzzle_number_positive
    check (puzzle_number > 0),
  constraint daily_completed_results_ruleset_supported
    check (ruleset_version in ('points-v3', 'classic-inning-v1')),
  constraint daily_completed_results_at_bats_array
    check (jsonb_typeof(completed_at_bats) = 'array'),
  constraint daily_completed_results_summary_object
    check (jsonb_typeof(summary) = 'object')
);

create index daily_completed_results_population_idx
  on public.daily_completed_results (puzzle_date, ruleset_version, puzzle_id);

alter table public.daily_completed_results enable row level security;

revoke all on table public.daily_completed_results from public, anon, authenticated;
grant select, insert on table public.daily_completed_results to service_role;

comment on table public.daily_completed_results is
  'Validated anonymous completed Daily results. One immutable first-write-wins row per client submission_id.';
comment on column public.daily_completed_results.completed_at_bats is
  'Ordered engine-normalized native completed-at-bat facts retained for future recomputation.';
comment on column public.daily_completed_results.summary is
  'Engine-derived ruleset-specific summary; never client authority.';
