-- Additive first-write-wins Custom v2 completion display projection (#528).
-- Source staged only. Requires all Custom v2 result/attempt and creator_seen
-- migrations in an isolated production-shaped QA database before rehearsal.
-- This does NOT change score facts, existing RPCs, account ownership, or APIs.
-- No production DDL/flags are authorized by source review alone.

create table public.custom_lineup_v2_completion_displays (
  submission_id text primary key
    references public.custom_nine_completed_results (submission_id) on delete restrict,
  display_mode text not null,
  display_name text,
  created_at timestamptz not null default now(),
  constraint custom_v2_completion_display_mode_check check (
    (display_mode = 'anonymous' and display_name is null)
    or
    (display_mode = 'named' and display_name is not null
      and display_name = btrim(display_name)
      and char_length(display_name) between 1 and 32
      and octet_length(display_name) <= 96
      and display_name !~ '[[:cntrl:]]')
  )
);

comment on table public.custom_lineup_v2_completion_displays is
  'Private append-only display/privacy choice for an already admitted Custom v2 completion. Submission ID is a server-issued first-attempt UUID; score facts remain immutable. Anonymous records never store a name. No public reader or feature is enabled.';
comment on column public.custom_lineup_v2_completion_displays.display_name is
  'Unverified plain-text presentation only, never an account identity, authorization proof or competition key. Render escaped. Input must first pass the shared JS UTF-16 1-32 character validator.';

alter table public.custom_lineup_v2_completion_displays enable row level security;
revoke all on table public.custom_lineup_v2_completion_displays
  from public, anon, authenticated, service_role;
grant select, insert on table public.custom_lineup_v2_completion_displays to service_role;
-- No UPDATE/DELETE grants and no RLS policy: only trusted server/service access.
-- The projection has no challenge_id to spoof: the immutable completed-result FK
-- uniquely determines its challenge; future readers must join on submission_id.

create function public.record_custom_lineup_v2_completion_display(
  p_challenge_id text,
  p_browser_key_digest text,
  p_display_mode text,
  p_display_name text
)
returns table (created boolean)
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_attempt public.custom_nine_attempt_states%rowtype;
  v_count integer;
  v_created integer;
  v_existing_mode text;
  v_existing_name text;
begin
  -- Validate names and intent before touching private data. Server callers
  -- must additionally run parseCompletionDisplayName (JS UTF-16 policy).
  if p_challenge_id is null
    or p_challenge_id !~ '^custom-lineup-v2-[0-9a-f-]{36}$'
    or p_browser_key_digest is null
    or p_browser_key_digest !~ '^[0-9a-f]{64}$'
    or p_display_mode is null
    or not (p_display_mode in ('named', 'anonymous'))
    or (p_display_mode = 'anonymous' and p_display_name is not null)
    or (p_display_mode = 'named' and (
      p_display_name is null or p_display_name <> btrim(p_display_name)
      or char_length(p_display_name) not between 1 and 32
      or octet_length(p_display_name) > 96
      or p_display_name ~ '[[:cntrl:]]'
    )) then
    raise exception 'Invalid Custom completion display choice.'
      using errcode = '22023';
  end if;

  -- Exact challenge-scoped random browser capability; never accept a caller-
  -- supplied submission_id. Serialize with the pre-existing admission RPC
  -- and sticky creator recognition under the SAME attempt row lock.
  select * into v_attempt
  from public.custom_nine_attempt_states a
  where a.challenge_id = p_challenge_id
    and a.browser_key_digest = p_browser_key_digest
  for update;
  if not found
    or v_attempt.creator_seen
    or v_attempt.status <> 'completed'
    or v_attempt.completed_at is null
    or jsonb_typeof(v_attempt.terminal_at_bats) is distinct from 'array' then
    raise exception 'Custom completion display is not eligible.'
      using errcode = '22023';
  end if;
  v_count := jsonb_array_length(v_attempt.terminal_at_bats);
  if v_count not between 1 and 10
    or not exists (
      select 1 from public.custom_nine_completed_results result
      where result.submission_id = v_attempt.attempt_id::text
        and result.challenge_id = p_challenge_id
        and result.schema_version = 2
        and result.ruleset_version = 'points-v4'
        and result.completed_at_bats = v_attempt.terminal_at_bats
    )
    or (select count(*) from public.custom_nine_at_bat_results ab
      where ab.attempt_id = v_attempt.attempt_id::text
        and ab.challenge_id = p_challenge_id
        and ab.schema_version = 2
        and ab.ruleset_version = 'points-v4') <> v_count
    or exists (
      select 1
      from jsonb_array_elements(v_attempt.terminal_at_bats)
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
    ) then
    raise exception 'Custom completion display requires an admitted first result.'
      using errcode = '22023';
  end if;

  insert into public.custom_lineup_v2_completion_displays (
    submission_id, display_mode, display_name
  ) values (v_attempt.attempt_id::text, p_display_mode, p_display_name)
  on conflict (submission_id) do nothing;
  get diagnostics v_created = row_count;

  if v_created = 1 then
    return query select true;
    return;
  end if;

  select d.display_mode, d.display_name
    into v_existing_mode, v_existing_name
  from public.custom_lineup_v2_completion_displays d
  where d.submission_id = v_attempt.attempt_id::text;
  if not found
    or v_existing_mode is distinct from p_display_mode
    or v_existing_name is distinct from p_display_name then
    raise exception 'Conflicting Custom completion display choice.'
      using errcode = '23505';
  end if;
  return query select false;
end;
$function$;

revoke all on function public.record_custom_lineup_v2_completion_display(
  text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.record_custom_lineup_v2_completion_display(
  text, text, text, text
) to service_role;

comment on function public.record_custom_lineup_v2_completion_display(
  text, text, text, text
) is
  'Service-only, challenge-and-browser-bound first-write-wins display/Anonymous choice for an already admitted noncreator Custom v2 result. Locks the first-attempt row, checks complete N-row score admission and returns only created status. No public HTTP, account nickname or scoring admission.';
