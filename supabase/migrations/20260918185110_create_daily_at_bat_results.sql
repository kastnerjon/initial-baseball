create table public.daily_at_bat_results (
  attempt_id text not null,
  schema_version smallint not null,
  puzzle_id text not null,
  puzzle_date date not null,
  puzzle_number integer not null,
  ruleset_version text not null,
  pitch_number smallint not null,
  initials text not null,
  outcome text not null,
  hints_revealed smallint not null,
  wrong_guesses smallint not null,
  resolution text not null,
  awarded_points smallint not null,
  created_at timestamptz not null default now(),

  constraint daily_at_bat_results_pkey
    primary key (attempt_id, puzzle_id, ruleset_version, pitch_number),
  constraint daily_at_bat_results_attempt_id_format
    check (attempt_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  constraint daily_at_bat_results_schema_version
    check (schema_version = 1),
  constraint daily_at_bat_results_puzzle_id_present
    check (length(btrim(puzzle_id)) > 0),
  constraint daily_at_bat_results_puzzle_number_positive
    check (puzzle_number > 0),
  constraint daily_at_bat_results_ruleset_supported
    check (ruleset_version = 'points-v3'),
  constraint daily_at_bat_results_pitch_number_range
    check (pitch_number between 1 and 9),
  constraint daily_at_bat_results_initials_present
    check (length(btrim(initials)) > 0),
  constraint daily_at_bat_results_outcome_supported
    check (outcome in ('HR', '3B', '2B', '1B', 'BB', 'K')),
  constraint daily_at_bat_results_hints_revealed_range
    check (hints_revealed between 0 and 4),
  constraint daily_at_bat_results_wrong_guesses_range
    check (wrong_guesses between 0 and 3),
  constraint daily_at_bat_results_resolution_supported
    check (resolution in ('correct', 'strikeout', 'give_up')),
  constraint daily_at_bat_results_awarded_points_range
    check (awarded_points between 0 and 7)
);

create index daily_at_bat_results_population_slot_idx
  on public.daily_at_bat_results (puzzle_id, ruleset_version, pitch_number)
  include (awarded_points);

alter table public.daily_at_bat_results enable row level security;

revoke all on table public.daily_at_bat_results
  from public, anon, authenticated, service_role;
grant select, insert on table public.daily_at_bat_results to service_role;

comment on table public.daily_at_bat_results is
  'Engine-normalized anonymous Daily Nine terminal at-bat observations. Immutable first-write-wins per attempt, stable puzzle, ruleset and slot.';
comment on column public.daily_at_bat_results.awarded_points is
  'Engine-derived points stored once for later aggregate reads; never client authority.';
comment on column public.daily_at_bat_results.created_at is
  'Provider receipt time; not part of the immutable gameplay payload or observation key.';
