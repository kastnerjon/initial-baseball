-- Dedicated immutable Custom Nine competitive populations.
-- A permanent challenge has no calendar puzzle date or Universal puzzle number.
-- These tables are deliberately NOT read by Daily/Archive comparison RPCs.
-- No writes are enabled until server-side admission and creator-exclusion checks exist.

create table public.custom_nine_completed_results (
  submission_id text primary key,
  challenge_id text not null references public.custom_nine_issued_challenges (puzzle_id),
  schema_version smallint not null,
  ruleset_version text not null,
  completed_at_bats jsonb not null,
  summary jsonb not null,
  created_at timestamptz not null default now(),

  constraint custom_nine_completed_results_submission_id_format
    check (submission_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  constraint custom_nine_completed_results_schema
    check (schema_version = 1),
  constraint custom_nine_completed_results_ruleset
    check (ruleset_version = 'points-v4'),
  constraint custom_nine_completed_results_at_bats
    check (
      jsonb_typeof(completed_at_bats) = 'array'
      and jsonb_array_length(completed_at_bats) between 1 and 9
    ),
  constraint custom_nine_completed_results_summary
    check (
      jsonb_typeof(summary) = 'object'
      and jsonb_typeof(summary -> 'points') = 'number'
      and (summary ->> 'points')::numeric between 0 and 36
      and (summary ->> 'points')::numeric * 2
          = trunc((summary ->> 'points')::numeric * 2)
    )
);

create index custom_nine_completed_results_population_idx
  on public.custom_nine_completed_results (challenge_id, ruleset_version);

create table public.custom_nine_at_bat_results (
  attempt_id text not null,
  challenge_id text not null references public.custom_nine_issued_challenges (puzzle_id),
  schema_version smallint not null,
  ruleset_version text not null,
  pitch_number smallint not null,
  initials text not null,
  outcome text not null,
  hints_revealed smallint not null,
  wrong_guesses smallint not null,
  resolution text not null,
  awarded_points numeric(4,1) not null,
  created_at timestamptz not null default now(),

  constraint custom_nine_at_bat_results_pkey
    primary key (attempt_id, challenge_id, ruleset_version, pitch_number),
  constraint custom_nine_at_bat_results_attempt_id_format
    check (attempt_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  constraint custom_nine_at_bat_results_schema
    check (schema_version = 1),
  constraint custom_nine_at_bat_results_ruleset
    check (ruleset_version = 'points-v4'),
  constraint custom_nine_at_bat_results_pitch
    check (pitch_number between 1 and 9),
  constraint custom_nine_at_bat_results_initials
    check (length(btrim(initials)) > 0),
  constraint custom_nine_at_bat_results_outcome
    check (outcome in ('HR', '3B', '2B', '1B', 'BB', 'K')),
  constraint custom_nine_at_bat_results_hint_depth
    check (hints_revealed between 0 and 4),
  constraint custom_nine_at_bat_results_wrong_guesses
    check (wrong_guesses between 0 and 3),
  constraint custom_nine_at_bat_results_resolution
    check (resolution in ('correct', 'strikeout', 'give_up')),
  constraint custom_nine_at_bat_results_points
    check (
      awarded_points between 0 and 4
      and awarded_points * 2 = trunc(awarded_points * 2)
    )
);

create index custom_nine_at_bat_results_population_idx
  on public.custom_nine_at_bat_results (challenge_id, ruleset_version, pitch_number)
  include (awarded_points);

alter table public.custom_nine_completed_results enable row level security;
alter table public.custom_nine_at_bat_results enable row level security;

revoke all on table public.custom_nine_completed_results
  from public, anon, authenticated, service_role;
revoke all on table public.custom_nine_at_bat_results
  from public, anon, authenticated, service_role;
grant select, insert on table public.custom_nine_completed_results to service_role;
grant select, insert on table public.custom_nine_at_bat_results to service_role;

comment on table public.custom_nine_completed_results is
  'Private, append-only Custom Nine completed scores, keyed to one immutable issued challenge; competitive creator-exclusion admission must precede writes. Not included in Daily/Archive populations.';
comment on table public.custom_nine_at_bat_results is
  'Private, append-only Custom Nine resolved at-bat scores, scoped by issued challenge and pitch. No creator previews, Universal or Archive observations.';
comment on column public.custom_nine_completed_results.summary is
  'Engine-derived points-v4 summary only; never accept unvalidated browser-supplied scoring facts.';
comment on column public.custom_nine_at_bat_results.awarded_points is
  'Engine-derived points-v4 half-point score for a single terminal batter; not a client scoring authority.';
