-- Disposable structural harness for two-connection creator/admission race tests.
-- NOT a production clone. The admission/creator function bodies are loaded
-- from the exact committed migrations, rather than copied into this fixture.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create table auth.users (id uuid primary key);

create table public.custom_nine_issued_challenges (
  puzzle_id text primary key,
  schema_version smallint not null,
  ruleset_version text not null,
  canonical_player_ids jsonb not null,
  clue_snapshot jsonb not null,
  issued_at timestamptz not null,
  display_title text,
  owner_capability_digest text
);
create table public.custom_nine_attempt_states (
  challenge_id text not null references public.custom_nine_issued_challenges(puzzle_id),
  browser_key_digest text not null,
  attempt_id uuid not null unique,
  revision integer not null,
  current_progression_token text not null,
  terminal_at_bats jsonb,
  status text not null,
  completed_at timestamptz,
  primary key (challenge_id, browser_key_digest)
);
create table public.custom_nine_completed_results (
  submission_id text primary key,
  challenge_id text not null,
  schema_version smallint not null,
  ruleset_version text not null,
  completed_at_bats jsonb not null,
  summary jsonb not null
);
create table public.custom_nine_at_bat_results (
  attempt_id text not null,
  challenge_id text not null,
  schema_version smallint not null,
  ruleset_version text not null,
  pitch_number smallint not null,
  initials text not null,
  outcome text not null,
  hints_revealed smallint not null,
  wrong_guesses smallint not null,
  resolution text not null,
  awarded_points numeric not null,
  primary key (attempt_id, pitch_number)
);

insert into public.custom_nine_issued_challenges
  (puzzle_id, schema_version, ruleset_version, canonical_player_ids,
   clue_snapshot, issued_at, display_title)
select id, 2, 'points-v4', '["fixture-player"]'::jsonb,
       '{}'::jsonb, now(), id
from (values ('race-marker-first'), ('race-admission-first')) as fixtures(id);

insert into public.custom_nine_attempt_states
  (challenge_id, browser_key_digest, attempt_id, revision,
   current_progression_token, terminal_at_bats, status, completed_at)
values
 ('race-marker-first', repeat('a', 64), '00000000-0000-4000-8000-000000000101', 1,
  'complete', '[{"pitchNumber":1,"initials":"FP","outcome":"HR","hintsRevealed":0,"wrongGuesses":0,"resolution":"correct"}]'::jsonb,
  'completed', now()),
 ('race-admission-first', repeat('b', 64), '00000000-0000-4000-8000-000000000102', 1,
  'complete', '[{"pitchNumber":1,"initials":"FP","outcome":"HR","hintsRevealed":0,"wrongGuesses":0,"resolution":"correct"}]'::jsonb,
  'completed', now());

-- Catch only the specifically intended creator rejection. Any other SQLSTATE
-- bubbles up and fails the test. This wrapper is never deployed to Supabase.
create function public.race_try_admit(p_id text, p_digest text)
returns text language plpgsql security invoker set search_path = ''
as $test$
begin
  perform * from public.admit_custom_lineup_v2_completed_attempt(
    p_id, p_digest,
    '{"points":4,"maximumPoints":4,"atBatsCompleted":1,"totalAtBats":1,"completed":true,"strikeouts":0}'::jsonb,
    array[4::numeric]);
  return 'admitted';
exception when invalid_parameter_value then
  return 'rejected';
end;
$test$;
