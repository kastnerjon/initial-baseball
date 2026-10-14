-- Additive Custom Lineup v2 private result-shape predecessor.
-- Requires issued-challenge v2 (#401) and attempt-state v2 (#403) hosted first.
-- Does NOT enable v2 submission, RPC admission, comparisons or public reads.
-- Keep historic Custom Nine v1 row constraints and admission behavior intact.

alter table public.custom_nine_completed_results
  drop constraint custom_nine_completed_results_schema,
  drop constraint custom_nine_completed_results_at_bats,
  drop constraint custom_nine_completed_results_summary,
  add constraint custom_nine_completed_results_schema
    check (schema_version in (1, 2)),
  add constraint custom_nine_completed_results_at_bats
    check (
      jsonb_typeof(completed_at_bats) = 'array'
      and (
        (schema_version = 1 and jsonb_array_length(completed_at_bats) between 1 and 9)
        or (schema_version = 2 and jsonb_array_length(completed_at_bats) between 1 and 10)
      )
    ),
  add constraint custom_nine_completed_results_summary
    check (
      jsonb_typeof(summary) = 'object'
      and jsonb_typeof(summary -> 'points') = 'number'
      and (
        (schema_version = 1 and (summary ->> 'points')::numeric between 0 and 36)
        or (schema_version = 2 and (summary ->> 'points')::numeric between 0 and 40)
      )
      and (summary ->> 'points')::numeric * 2
          = trunc((summary ->> 'points')::numeric * 2)
    );

alter table public.custom_nine_at_bat_results
  drop constraint custom_nine_at_bat_results_schema,
  drop constraint custom_nine_at_bat_results_pitch,
  add constraint custom_nine_at_bat_results_schema
    check (schema_version in (1, 2)),
  add constraint custom_nine_at_bat_results_pitch
    check (
      (schema_version = 1 and pitch_number between 1 and 9)
      or (schema_version = 2 and pitch_number between 1 and 10)
    );

-- Existing v1 RPC still inserts schema_version=1 and exactly nine observations.
-- A v2 result must match its issued challenge and completed private attempt.
-- No browser- or caller-selected total is consulted as authority.
create function public.validate_custom_lineup_completed_result()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_schema smallint;
  v_count integer;
  v_terminal jsonb;
  v_points numeric;
begin
  select i.schema_version, jsonb_array_length(i.canonical_player_ids)
    into v_schema, v_count
  from public.custom_nine_issued_challenges i
  where i.puzzle_id = new.challenge_id
    and i.ruleset_version = new.ruleset_version;

  if not found or v_schema is distinct from new.schema_version then
    raise exception 'Custom result schema does not match issued challenge.'
      using errcode = '23514';
  end if;
  if v_schema = 1 then return new; end if;

  select a.terminal_at_bats into v_terminal
  from public.custom_nine_attempt_states a
  where a.challenge_id = new.challenge_id
    and a.attempt_id::text = new.submission_id
    and a.status = 'completed'
    and a.completed_at is not null;

  if not found
    or jsonb_array_length(new.completed_at_bats) <> v_count
    or new.completed_at_bats is distinct from v_terminal then
    raise exception 'Custom v2 result requires the exact completed attempt.'
      using errcode = '23514';
  end if;

  if jsonb_typeof(new.summary -> 'points') is distinct from 'number'
    or jsonb_typeof(new.summary -> 'maximumPoints') is distinct from 'number'
    or jsonb_typeof(new.summary -> 'atBatsCompleted') is distinct from 'number'
    or jsonb_typeof(new.summary -> 'totalAtBats') is distinct from 'number'
    or jsonb_typeof(new.summary -> 'strikeouts') is distinct from 'number'
    or new.summary -> 'completed' is distinct from 'true'::jsonb then
    raise exception 'Custom v2 result summary is incomplete.'
      using errcode = '23514';
  end if;

  v_points := (new.summary ->> 'points')::numeric;
  if (new.summary ->> 'maximumPoints')::numeric is distinct from 4 * v_count
    or (new.summary ->> 'atBatsCompleted')::numeric is distinct from v_count
    or (new.summary ->> 'totalAtBats')::numeric is distinct from v_count
    or v_points not between 0 and 4 * v_count
    or v_points * 2 <> trunc(v_points * 2)
    or (new.summary ->> 'strikeouts')::numeric is distinct from (
      select count(*)::numeric
      from jsonb_array_elements(v_terminal) as fact(value)
      where fact.value ->> 'outcome' = 'K'
    ) or exists (
      select 1 from jsonb_array_elements(v_terminal) with ordinality as fact(value, slot)
      where jsonb_typeof(fact.value) is distinct from 'object'
        or jsonb_typeof(fact.value -> 'pitchNumber') is distinct from 'number'
        or (fact.value ->> 'pitchNumber')::numeric is distinct from fact.slot
    ) then
    raise exception 'Custom v2 result summary or pitch order mismatch.'
      using errcode = '23514';
  end if;
  return new;
end;
$function$;

create function public.validate_custom_lineup_at_bat_result()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_schema smallint;
  v_count integer;
  v_terminal jsonb;
  v_fact jsonb;
begin
  select i.schema_version, jsonb_array_length(i.canonical_player_ids)
    into v_schema, v_count
  from public.custom_nine_issued_challenges i
  where i.puzzle_id = new.challenge_id
    and i.ruleset_version = new.ruleset_version;
  if not found or v_schema is distinct from new.schema_version then
    raise exception 'Custom at-bat schema does not match issued challenge.'
      using errcode = '23514';
  end if;
  if v_schema = 1 then return new; end if;

  select c.completed_at_bats into v_terminal
  from public.custom_nine_completed_results c
  where c.submission_id = new.attempt_id
    and c.challenge_id = new.challenge_id
    and c.schema_version = 2
    and c.ruleset_version = new.ruleset_version;

  if not found or new.pitch_number > v_count then
    raise exception 'Custom v2 at-bat has no matching completed challenge slot.'
      using errcode = '23514';
  end if;
  v_fact := v_terminal -> (new.pitch_number - 1);
  if v_fact is null
    or (v_fact ->> 'pitchNumber')::integer is distinct from new.pitch_number
    or v_fact ->> 'initials' is distinct from new.initials
    or v_fact ->> 'outcome' is distinct from new.outcome
    or (v_fact ->> 'hintsRevealed')::smallint is distinct from new.hints_revealed
    or (v_fact ->> 'wrongGuesses')::smallint is distinct from new.wrong_guesses
    or v_fact ->> 'resolution' is distinct from new.resolution then
    raise exception 'Custom v2 at-bat does not match immutable terminal facts.'
      using errcode = '23514';
  end if;
  return new;
end;
$function$;

-- Trigger functions require no direct browser EXECUTE access.
revoke all on function public.validate_custom_lineup_completed_result()
  from public, anon, authenticated, service_role;
revoke all on function public.validate_custom_lineup_at_bat_result()
  from public, anon, authenticated, service_role;
grant execute on function public.validate_custom_lineup_completed_result() to service_role;
grant execute on function public.validate_custom_lineup_at_bat_result() to service_role;

create trigger custom_lineup_completed_result_guard
before insert or update on public.custom_nine_completed_results
for each row execute function public.validate_custom_lineup_completed_result();

create trigger custom_lineup_at_bat_result_guard
before insert or update on public.custom_nine_at_bat_results
for each row execute function public.validate_custom_lineup_at_bat_result();

comment on table public.custom_nine_completed_results is
  'Append-only private Custom v1 nine-player and v2 1–10-player completions. V2 must match completed authoritative attempt and exact issued challenge N. Admission RPC not yet enabled.';
comment on table public.custom_nine_at_bat_results is
  'Append-only private Custom v1/v2 per-batter outcomes. V2 pitch and terminal facts checked against same challenge completion. No browser access.';
-- No changes to RLS, privileges, indices, existing Custom v1 admission/comparison RPCs.
