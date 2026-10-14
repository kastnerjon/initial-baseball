-- Prospective, private Custom Lineup v2 atomic completed-result admission.
-- REQUIRES hosted and rollback-verified predecessors #401, #403 and #404.
-- This is a database-only primitive, NOT an HTTP endpoint or public feature.
-- Callers MUST validate signed browser attempts, exclude creators/previews, and
-- compute points-v4 scores with the authoritative game engine before invoking.
-- Keep admit_custom_nine_completed_attempt() and v1 exact-nine semantics intact.

create function public.admit_custom_lineup_v2_completed_attempt(
  p_challenge_id text,
  p_browser_key_digest text,
  p_summary jsonb,
  p_awarded_points numeric[]
)
returns table (submission_id text, created boolean)
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_issued_schema smallint;
  v_issued_ruleset text;
  v_at_bats integer;
  v_attempt public.custom_nine_attempt_states%rowtype;
  v_submission_id text;
  v_points_sum numeric;
begin
  -- The frozen issued record, not the client payload, supplies length/version.
  select issued.schema_version, issued.ruleset_version,
         jsonb_array_length(issued.canonical_player_ids)
    into v_issued_schema, v_issued_ruleset, v_at_bats
  from public.custom_nine_issued_challenges issued
  where issued.puzzle_id = p_challenge_id;

  if not found
    or v_issued_schema is distinct from 2
    or v_issued_ruleset is distinct from 'points-v4'
    or v_at_bats not between 1 and 10 then
    raise exception 'Ineligible Custom Lineup v2 challenge.'
      using errcode = '22023';
  end if;

  -- Serialize retries by authoritative challenge/browser first-attempt key.
  -- No result may be accepted without a completed durable attempt.
  select * into v_attempt
  from public.custom_nine_attempt_states
  where challenge_id = p_challenge_id
    and browser_key_digest = p_browser_key_digest
  for update;

  if not found then
    raise exception 'Missing Custom Lineup v2 completed attempt.'
      using errcode = '22023';
  end if;
  if v_attempt.status <> 'completed'
    or v_attempt.completed_at is null
    or jsonb_typeof(v_attempt.terminal_at_bats) is distinct from 'array'
    or jsonb_array_length(v_attempt.terminal_at_bats) <> v_at_bats then
    raise exception 'Ineligible Custom Lineup v2 completion.'
      using errcode = '22023';
  end if;

  if coalesce(array_ndims(p_awarded_points), 0) <> 1
    or coalesce(array_length(p_awarded_points, 1), 0) <> v_at_bats
    or array_lower(p_awarded_points, 1) <> 1
    or exists (
      select 1 from unnest(p_awarded_points) as score(points)
      where score.points is null
        or score.points not between 0 and 4
        or score.points * 2 <> trunc(score.points * 2)
    )
    or exists (
      select 1
      from jsonb_array_elements(v_attempt.terminal_at_bats)
        with ordinality as fact(value, slot)
      where jsonb_typeof(fact.value) is distinct from 'object'
        or jsonb_typeof(fact.value -> 'pitchNumber') is distinct from 'number'
        or (fact.value ->> 'pitchNumber')::numeric is distinct from fact.slot::numeric
    ) then
    raise exception 'Invalid Custom Lineup v2 scored facts.'
      using errcode = '22023';
  end if;

  select sum(points) into v_points_sum
  from unnest(p_awarded_points) as score(points);

  -- Strict points-v4 summary types and exact frozen length/score invariants.
  if jsonb_typeof(p_summary) is distinct from 'object'
    or jsonb_typeof(p_summary -> 'points') is distinct from 'number'
    or jsonb_typeof(p_summary -> 'maximumPoints') is distinct from 'number'
    or jsonb_typeof(p_summary -> 'atBatsCompleted') is distinct from 'number'
    or jsonb_typeof(p_summary -> 'totalAtBats') is distinct from 'number'
    or jsonb_typeof(p_summary -> 'completed') is distinct from 'boolean'
    or jsonb_typeof(p_summary -> 'strikeouts') is distinct from 'number'
    or p_summary -> 'completed' is distinct from 'true'::jsonb
    or (p_summary ->> 'maximumPoints')::numeric is distinct from 4 * v_at_bats
    or (p_summary ->> 'atBatsCompleted')::numeric is distinct from v_at_bats
    or (p_summary ->> 'totalAtBats')::numeric is distinct from v_at_bats
    or (p_summary ->> 'points')::numeric is distinct from v_points_sum
    or (p_summary ->> 'strikeouts')::numeric is distinct from (
      select count(*)::numeric
      from jsonb_array_elements(v_attempt.terminal_at_bats) as fact(value)
      where fact.value ->> 'outcome' = 'K'
    ) then
    raise exception 'Invalid Custom Lineup v2 scored summary.'
      using errcode = '22023';
  end if;

  v_submission_id := v_attempt.attempt_id::text;

  if exists (
    select 1 from public.custom_nine_completed_results existing
    where existing.submission_id = v_submission_id
  ) then
    -- Retry is successful only for EXACTLY the previously admitted record and
    -- exactly N matching per-batter facts/scores. Never repair partial rows.
    if not exists (
      select 1 from public.custom_nine_completed_results existing
      where existing.submission_id = v_submission_id
        and existing.challenge_id = p_challenge_id
        and existing.schema_version = 2
        and existing.ruleset_version = 'points-v4'
        and existing.completed_at_bats = v_attempt.terminal_at_bats
        and existing.summary = p_summary
    ) or (
      select count(*) from public.custom_nine_at_bat_results observed
      where observed.attempt_id = v_submission_id
        and observed.challenge_id = p_challenge_id
        and observed.schema_version = 2
        and observed.ruleset_version = 'points-v4'
    ) <> v_at_bats or exists (
      select 1
      from jsonb_array_elements(v_attempt.terminal_at_bats)
        with ordinality as fact(value, slot)
      left join public.custom_nine_at_bat_results observed
        on observed.attempt_id = v_submission_id
        and observed.challenge_id = p_challenge_id
        and observed.schema_version = 2
        and observed.ruleset_version = 'points-v4'
        and observed.pitch_number = fact.slot::integer
      where observed.awarded_points is distinct from p_awarded_points[fact.slot::integer]
        or observed.initials is distinct from fact.value ->> 'initials'
        or observed.outcome is distinct from fact.value ->> 'outcome'
        or observed.hints_revealed is distinct from (fact.value ->> 'hintsRevealed')::smallint
        or observed.wrong_guesses is distinct from (fact.value ->> 'wrongGuesses')::smallint
        or observed.resolution is distinct from fact.value ->> 'resolution'
    ) then
      raise exception 'Conflicting Custom Lineup v2 completion.'
        using errcode = '23505';
    end if;
    return query select v_submission_id, false;
    return;
  end if;

  -- Single database transaction: an error inserting any of N per-at-bat rows
  -- rolls back the completed result as well. #404 triggers independently
  -- enforce the private issued/terminal match and exact per-slot facts.
  insert into public.custom_nine_completed_results (
    submission_id, challenge_id, schema_version, ruleset_version,
    completed_at_bats, summary
  ) values (
    v_submission_id, p_challenge_id, 2, 'points-v4',
    v_attempt.terminal_at_bats, p_summary
  );

  insert into public.custom_nine_at_bat_results (
    attempt_id, challenge_id, schema_version, ruleset_version,
    pitch_number, initials, outcome, hints_revealed, wrong_guesses,
    resolution, awarded_points
  )
  select
    v_submission_id, p_challenge_id, 2, 'points-v4',
    fact.slot::smallint, fact.value ->> 'initials',
    fact.value ->> 'outcome',
    (fact.value ->> 'hintsRevealed')::smallint,
    (fact.value ->> 'wrongGuesses')::smallint,
    fact.value ->> 'resolution',
    p_awarded_points[fact.slot::integer]
  from jsonb_array_elements(v_attempt.terminal_at_bats)
    with ordinality as fact(value, slot);

  return query select v_submission_id, true;
end;
$function$;

revoke all on function public.admit_custom_lineup_v2_completed_attempt(
  text, text, jsonb, numeric[]
) from public, anon, authenticated;
grant execute on function public.admit_custom_lineup_v2_completed_attempt(
  text, text, jsonb, numeric[]
) to service_role;

comment on function public.admit_custom_lineup_v2_completed_attempt(
  text, text, jsonb, numeric[]
) is 'Private invoker-only atomic admission for an authoritative completed Custom v2 first attempt; the issued challenge sets exact N and 4*N maximum. Future server caller must authenticate signed attempt, exclude creator and compute points-v4 with engine. No public endpoint, results reader or competition switch is activated.';
