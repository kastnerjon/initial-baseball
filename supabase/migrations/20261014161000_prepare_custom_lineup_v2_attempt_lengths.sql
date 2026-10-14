-- Prospective Custom Lineup v2 (1..10) private first-attempt state lengths.
-- REQUIRES prior hosted migration: prepare_custom_lineup_v2_issued_challenges (#401).
-- Does not create a v2 server consumer, scoring/admission RPC, or public endpoint.
-- Retain existing Custom Nine v1 attempt rows and exact-nine completion semantics.

-- A CHECK cannot safely look up the immutable issued challenge's answer count.
-- Perform the cross-row check with an invoker trigger; the issued table is
-- already service-role SELECT-only and its canonical order is immutable.
create function public.validate_custom_lineup_attempt_length()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_issued_schema smallint;
  v_at_bats integer;
  v_terminal_count integer;
begin
  select issued.schema_version,
         jsonb_array_length(issued.canonical_player_ids)
    into v_issued_schema, v_at_bats
  from public.custom_nine_issued_challenges as issued
  where issued.puzzle_id = new.challenge_id;

  if not found
    or v_issued_schema not in (1, 2)
    or (v_issued_schema = 1 and v_at_bats <> 9)
    or (v_issued_schema = 2 and v_at_bats not between 1 and 10) then
    raise exception 'Missing or unsupported Custom challenge.'
      using errcode = '23514';
  end if;

  if jsonb_typeof(new.terminal_at_bats) is distinct from 'array' then
    raise exception 'Invalid Custom terminal facts.' using errcode = '23514';
  end if;
  v_terminal_count := jsonb_array_length(new.terminal_at_bats);

  if v_terminal_count > v_at_bats
    or (new.status = 'active'
        and (new.completed_at is not null or v_terminal_count >= v_at_bats))
    or (new.status = 'completed'
        and (new.completed_at is null or v_terminal_count <> v_at_bats))
    or new.status not in ('active', 'completed') then
    raise exception 'Custom attempt length does not match its issued challenge.'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.validate_custom_lineup_attempt_length()
  from public, anon, authenticated, service_role;
grant execute on function public.validate_custom_lineup_attempt_length()
  to service_role;

-- Widen only the structural ceiling; the trigger applies exact v1/v2 limits.
-- Every existing v1 row (0..8 active, 9 completed) remains valid unchanged.
alter table public.custom_nine_attempt_states
  drop constraint custom_nine_attempt_states_terminal_shape,
  drop constraint custom_nine_attempt_states_status,
  add constraint custom_nine_attempt_states_terminal_shape
    check (jsonb_typeof(terminal_at_bats) = 'array'
      and jsonb_array_length(terminal_at_bats) between 0 and 10),
  add constraint custom_nine_attempt_states_status
    check (
      (status = 'active' and completed_at is null
        and jsonb_array_length(terminal_at_bats) < 10)
      or
      (status = 'completed' and completed_at is not null
        and jsonb_array_length(terminal_at_bats) between 1 and 10)
    );

create trigger custom_lineup_attempt_length_guard
before insert or update of challenge_id, terminal_at_bats, status, completed_at
on public.custom_nine_attempt_states
for each row
execute function public.validate_custom_lineup_attempt_length();

comment on function public.validate_custom_lineup_attempt_length() is
  'Service-role-only, invoker cross-row attempt length guard: derive exact terminal count from immutable private issued Custom v1/v2 challenge, not a client-selected N. No scoring/admission or public access.';

comment on trigger custom_lineup_attempt_length_guard
on public.custom_nine_attempt_states is
  'Prevents early completion and extra terminal at-bats for either Custom Nine v1 or Custom Lineup v2; authoritative length comes from issued challenge.';

-- Preserve existing attempt key, token, revision, unique index, RLS and grants.
-- All Custom competition gates remain default disabled.
