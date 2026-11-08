-- Private readback of an already-admitted Custom v2 completion display.
-- Depends on 20261108171500 source-stage immutable projection; not a public API.
-- Exact signed challenge/browser credential validation is still a future server
-- caller responsibility; this role-only function never accepts submission IDs.

create function public.read_custom_lineup_v2_completion_display(
  p_challenge_id text,
  p_browser_key_digest text
)
returns table (display_mode text, display_name text)
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_attempt public.custom_nine_attempt_states%rowtype;
  v_count integer;
begin
  -- Never disclose whether another browser/challenge has completed a score.
  if p_challenge_id is null
    or p_challenge_id !~ '^custom-lineup-v2-[0-9a-f-]{36}$'
    or p_browser_key_digest is null
    or p_browser_key_digest !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  -- Same lock order as completion admission, sticky creator marker and
  -- display write: avoid racing a new exclusion across a read/return boundary.
  select * into v_attempt
  from public.custom_nine_attempt_states a
  where a.challenge_id = p_challenge_id
    and a.browser_key_digest = p_browser_key_digest
  for update;
  if not found or v_attempt.creator_seen
    or v_attempt.status <> 'completed'
    or v_attempt.completed_at is null
    or jsonb_typeof(v_attempt.terminal_at_bats) is distinct from 'array' then
    return;
  end if;
  v_count := jsonb_array_length(v_attempt.terminal_at_bats);
  if v_count not between 1 and 10 then return; end if;

  return query
    select d.display_mode, d.display_name
    from public.custom_lineup_v2_completion_displays d
    join public.custom_nine_completed_results r
      on r.submission_id = d.submission_id
      and r.challenge_id = p_challenge_id
      and r.schema_version = 2
      and r.ruleset_version = 'points-v4'
      and r.completed_at_bats = v_attempt.terminal_at_bats
    where d.submission_id = v_attempt.attempt_id::text
      -- Mirror the writer's score-integrity gate even after an approved name
      -- was saved: corrupt awarded-point totals must fail closed on readback.
      and (r.summary ->> 'points')::numeric = (
        select coalesce(sum(ab.awarded_points), 0)
        from public.custom_nine_at_bat_results ab
        where ab.attempt_id = v_attempt.attempt_id::text
          and ab.challenge_id = p_challenge_id
          and ab.schema_version = 2
          and ab.ruleset_version = 'points-v4'
      )
      and (select count(*) from public.custom_nine_at_bat_results ab
        where ab.attempt_id = v_attempt.attempt_id::text
          and ab.challenge_id = p_challenge_id
          and ab.schema_version = 2
          and ab.ruleset_version = 'points-v4') = v_count
      and not exists (
        select 1 from jsonb_array_elements(v_attempt.terminal_at_bats)
          with ordinality as fact(value, slot)
        left join public.custom_nine_at_bat_results ab
          on ab.attempt_id = v_attempt.attempt_id::text
          and ab.challenge_id = p_challenge_id
          and ab.schema_version = 2
          and ab.ruleset_version = 'points-v4'
          and ab.pitch_number = fact.slot::integer
        where ab.attempt_id is null
          or ab.initials is distinct from fact.value ->> 'initials'
          or ab.outcome is distinct from fact.value ->> 'outcome'
          or ab.hints_revealed is distinct from (fact.value ->> 'hintsRevealed')::smallint
          or ab.wrong_guesses is distinct from (fact.value ->> 'wrongGuesses')::smallint
          or ab.resolution is distinct from fact.value ->> 'resolution'
      );
end;
$function$;

revoke all on function public.read_custom_lineup_v2_completion_display(
  text, text
) from public, anon, authenticated, service_role;
grant execute on function public.read_custom_lineup_v2_completion_display(
  text, text
) to service_role;

comment on function public.read_custom_lineup_v2_completion_display(
  text, text
) is
  'Service-role-only, challenge-and-browser-key scoped first-result display readback. Locks same attempt as creator exclusion and admission. Returns only named/Anonymous text; no score, ID, clue or public access. Requires separately verified signed cookie and default-OFF HTTP gates.';
