-- Private Custom Nine completion admission primitive; not connected to HTTP.
-- One call atomically stores one engine-scored nine-at-bat result or returns its
-- immutable winner. The caller MUST authenticate the signed attempt cookie,
-- reject creator/invalid provenance, and compute summary/points with the engine.
-- Historic stateless tokens never have a completed private attempt-ledger row.

create function public.admit_custom_nine_completed_attempt(
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
  v_attempt public.custom_nine_attempt_states%rowtype;
  v_submission_id text;
  v_points_sum numeric;
begin
  -- Serialize retries/races by the durable challenge + browser attempt.
  -- A missing, active or otherwise invalid attempt MUST NOT contribute.
  select * into v_attempt
  from public.custom_nine_attempt_states
  where challenge_id = p_challenge_id
    and browser_key_digest = p_browser_key_digest
  for update;

  if not found or v_attempt.status <> 'completed'
    or v_attempt.completed_at is null
    or jsonb_array_length(v_attempt.terminal_at_bats) <> 9 then
    raise exception 'Ineligible Custom Nine completion.' using errcode = '22023';
  end if;

  if coalesce(array_ndims(p_awarded_points), 0) <> 1
    or coalesce(array_length(p_awarded_points, 1), 0) <> 9
    or array_lower(p_awarded_points, 1) <> 1
    or exists (
      select 1 from unnest(p_awarded_points) as score(points)
      where score.points is null
        or not (score.points between 0 and 4)
        or score.points * 2 <> trunc(score.points * 2)
    )
    or exists (
      select 1
      from jsonb_array_elements(v_attempt.terminal_at_bats) with ordinality as fact(value, slot)
      where (fact.value ->> 'pitchNumber')::integer is distinct from fact.slot::integer
    ) then
    raise exception 'Invalid Custom Nine scored facts.' using errcode = '22023';
  end if;

  select sum(points) into v_points_sum from unnest(p_awarded_points) as score(points);
  if jsonb_typeof(p_summary) is distinct from 'object'
    or jsonb_typeof(p_summary -> 'points') is distinct from 'number'
    or p_summary ->> 'completed' is distinct from 'true'
    or p_summary ->> 'atBatsCompleted' is distinct from '9'
    or p_summary ->> 'totalAtBats' is distinct from '9'
    or (p_summary ->> 'points')::numeric is distinct from v_points_sum then
    raise exception 'Invalid Custom Nine scored summary.' using errcode = '22023';
  end if;

  -- Server-owned attempt UUID, not a browser-selected submission identifier.
  -- The attempt UUID is globally unique in the private attempt ledger.
  v_submission_id := v_attempt.attempt_id::text;

  if exists (
    select 1 from public.custom_nine_completed_results existing
    where existing.submission_id = v_submission_id
  ) then
    -- A retry may only acknowledge the exact immutable accepted result.
    -- Never silently accept a partially written or conflicting prior row.
    if not exists (
      select 1 from public.custom_nine_completed_results existing
      where existing.submission_id = v_submission_id
        and existing.challenge_id = p_challenge_id
        and existing.ruleset_version = 'points-v4'
        and existing.completed_at_bats = v_attempt.terminal_at_bats
        and existing.summary = p_summary
    ) or (
      select count(*) from public.custom_nine_at_bat_results observed
      where observed.attempt_id = v_submission_id
        and observed.challenge_id = p_challenge_id
        and observed.ruleset_version = 'points-v4'
    ) <> 9 or exists (
      select 1
      from jsonb_array_elements(v_attempt.terminal_at_bats)
        with ordinality as fact(value, slot)
      left join public.custom_nine_at_bat_results observed
        on observed.attempt_id = v_submission_id
        and observed.challenge_id = p_challenge_id
        and observed.ruleset_version = 'points-v4'
        and observed.pitch_number = fact.slot::integer
      where observed.awarded_points is distinct from p_awarded_points[fact.slot::integer]
        or observed.initials is distinct from fact.value ->> 'initials'
        or observed.outcome is distinct from fact.value ->> 'outcome'
        or observed.hints_revealed is distinct from (fact.value ->> 'hintsRevealed')::smallint
        or observed.wrong_guesses is distinct from (fact.value ->> 'wrongGuesses')::smallint
        or observed.resolution is distinct from fact.value ->> 'resolution'
    ) then
      raise exception 'Conflicting Custom Nine completion.' using errcode = '23505';
    end if;
    return query select v_submission_id, false;
    return;
  end if;

  -- PostgreSQL executes the function within one transaction: an exception in
  -- either INSERT rolls back the complete score and every at-bat observation.
  insert into public.custom_nine_completed_results (
    submission_id, challenge_id, schema_version, ruleset_version,
    completed_at_bats, summary
  ) values (
    v_submission_id, p_challenge_id, 1, 'points-v4',
    v_attempt.terminal_at_bats, p_summary
  );

  insert into public.custom_nine_at_bat_results (
    attempt_id, challenge_id, schema_version, ruleset_version,
    pitch_number, initials, outcome, hints_revealed, wrong_guesses,
    resolution, awarded_points
  )
  select
    v_submission_id, p_challenge_id, 1, 'points-v4',
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

revoke all on function public.admit_custom_nine_completed_attempt(
  text, text, jsonb, numeric[]
) from public, anon, authenticated;
grant execute on function public.admit_custom_nine_completed_attempt(
  text, text, jsonb, numeric[]
) to service_role;

comment on function public.admit_custom_nine_completed_attempt(
  text, text, jsonb, numeric[]
) is 'Service-role-only atomic Custom Nine admission for an already completed authoritative private attempt; creator-cookie eligibility and engine scoring are enforced by the future server caller. No public result route is enabled.';
