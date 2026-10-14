-- Additive prerequisite for private Custom Lineup v2 issuance (1 through 10).
-- Custom Nine v1 IDs, exact-nine validation, historical records and URLs remain unchanged.
-- The SQL-only change does NOT permit v2 gameplay, result admission or public creation.
-- Existing Custom result/attempt tables and v1 RPCs remain exact-nine and disabled by flags.

create function public.custom_lineup_v2_issued_shape_valid(
  p_canonical_player_ids jsonb,
  p_clue_snapshot jsonb
)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $function$
declare
  v_count integer;
  v_slot integer;
  v_hint_index integer;
  v_id text;
  v_hint_type text;
  v_hint jsonb;
  v_pitch jsonb;
  v_value jsonb;
  v_seen_ids text[] := array[]::text[];
  v_seen_hint_types text[] := array[]::text[];
begin
  if jsonb_typeof(p_canonical_player_ids) is distinct from 'array'
    or jsonb_typeof(p_clue_snapshot) is distinct from 'object' then
    return false;
  end if;

  v_count := jsonb_array_length(p_canonical_player_ids);
  if v_count not between 1 and 10
    or jsonb_typeof(p_clue_snapshot -> 'schemaVersion') is distinct from 'number'
    or (p_clue_snapshot ->> 'schemaVersion')::numeric <> 1
    or jsonb_typeof(p_clue_snapshot -> 'hintLayout') is distinct from 'array'
    or jsonb_array_length(p_clue_snapshot -> 'hintLayout') <> 4
    or jsonb_typeof(p_clue_snapshot -> 'pitches') is distinct from 'array'
    or jsonb_array_length(p_clue_snapshot -> 'pitches') <> v_count then
    return false;
  end if;

  -- Keep the existing public four-slot clue vocabulary and its exact ordering.
  for v_slot in 0..3 loop
    v_hint := p_clue_snapshot -> 'hintLayout' -> v_slot;
    if jsonb_typeof(v_hint) is distinct from 'object'
      or jsonb_typeof(v_hint -> 'slot') is distinct from 'number'
      or (v_hint ->> 'slot')::numeric <> v_slot + 1
      or jsonb_typeof(v_hint -> 'hintType') is distinct from 'string'
      or jsonb_typeof(v_hint -> 'displayLabel') is distinct from 'string'
      or length(btrim(v_hint ->> 'displayLabel')) = 0 then
      return false;
    end if;
    v_hint_type := v_hint ->> 'hintType';
    if v_hint_type not in ('main_decade', 'teams', 'position', 'stats')
      or v_hint_type = any(v_seen_hint_types) then
      return false;
    end if;
    v_seen_hint_types := array_append(v_seen_hint_types, v_hint_type);
  end loop;

  -- Each future clue pitch must match the exact canonical batting order.
  for v_slot in 0..v_count-1 loop
    v_value := p_canonical_player_ids -> v_slot;
    if jsonb_typeof(v_value) is distinct from 'string' then
      return false;
    end if;
    v_id := p_canonical_player_ids ->> v_slot;
    if length(v_id) not between 1 and 200
      or btrim(v_id) <> v_id
      or v_id = any(v_seen_ids) then
      return false;
    end if;
    v_seen_ids := array_append(v_seen_ids, v_id);

    v_pitch := p_clue_snapshot -> 'pitches' -> v_slot;
    if jsonb_typeof(v_pitch) is distinct from 'object'
      or jsonb_typeof(v_pitch -> 'pitchNumber') is distinct from 'number'
      or (v_pitch ->> 'pitchNumber')::numeric <> v_slot + 1
      or jsonb_typeof(v_pitch -> 'canonicalPlayerId') is distinct from 'string'
      or v_pitch ->> 'canonicalPlayerId' <> v_id
      or jsonb_typeof(v_pitch -> 'initials') is distinct from 'string'
      or length(btrim(v_pitch ->> 'initials')) = 0
      or jsonb_typeof(v_pitch -> 'hintValues') is distinct from 'array'
      or jsonb_array_length(v_pitch -> 'hintValues') <> 4 then
      return false;
    end if;

    for v_hint_index in 0..3 loop
      v_value := v_pitch -> 'hintValues' -> v_hint_index;
      if jsonb_typeof(v_value) is distinct from 'string'
        or length(btrim(v_pitch -> 'hintValues' ->> v_hint_index)) = 0 then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$function$;

-- Avoid the default PUBLIC function EXECUTE grant on the exposed public schema.
revoke all on function public.custom_lineup_v2_issued_shape_valid(jsonb,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.custom_lineup_v2_issued_shape_valid(jsonb,jsonb)
  to service_role;

alter table public.custom_nine_issued_challenges
  drop constraint custom_nine_issued_challenges_id_format,
  drop constraint custom_nine_issued_challenges_schema_version,
  drop constraint custom_nine_issued_challenges_nine_players,
  drop constraint custom_nine_issued_challenges_frozen_clue_shape,

  add constraint custom_nine_issued_challenges_id_format
    check (
      (schema_version = 1 and puzzle_id ~
        '^custom-nine-v1-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      or
      (schema_version = 2 and puzzle_id ~
        '^custom-lineup-v2-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
    ),
  add constraint custom_nine_issued_challenges_schema_version
    check (schema_version in (1, 2)),
  add constraint custom_nine_issued_challenges_players_by_schema
    check (
      jsonb_typeof(canonical_player_ids) = 'array'
      and (
        (schema_version = 1 and jsonb_array_length(canonical_player_ids) = 9)
        or (schema_version = 2 and jsonb_array_length(canonical_player_ids) between 1 and 10)
      )
    ),
  add constraint custom_nine_issued_challenges_frozen_clue_shape
    check (coalesce(
      (
        schema_version = 1
        and jsonb_typeof(clue_snapshot) = 'object'
        and clue_snapshot ->> 'schemaVersion' = '1'
        and jsonb_typeof(clue_snapshot -> 'hintLayout') = 'array'
        and jsonb_array_length(clue_snapshot -> 'hintLayout') = 4
        and jsonb_typeof(clue_snapshot -> 'pitches') = 'array'
        and jsonb_array_length(clue_snapshot -> 'pitches') = 9
        and jsonb_typeof(clue_snapshot #> '{pitches,0,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,0,hintValues}') = 4
        and jsonb_typeof(clue_snapshot #> '{pitches,1,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,1,hintValues}') = 4
        and jsonb_typeof(clue_snapshot #> '{pitches,2,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,2,hintValues}') = 4
        and jsonb_typeof(clue_snapshot #> '{pitches,3,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,3,hintValues}') = 4
        and jsonb_typeof(clue_snapshot #> '{pitches,4,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,4,hintValues}') = 4
        and jsonb_typeof(clue_snapshot #> '{pitches,5,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,5,hintValues}') = 4
        and jsonb_typeof(clue_snapshot #> '{pitches,6,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,6,hintValues}') = 4
        and jsonb_typeof(clue_snapshot #> '{pitches,7,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,7,hintValues}') = 4
        and jsonb_typeof(clue_snapshot #> '{pitches,8,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,8,hintValues}') = 4
      )
      or
      (
        schema_version = 2
        and public.custom_lineup_v2_issued_shape_valid(canonical_player_ids, clue_snapshot)
      ),
      false
    ));

comment on table public.custom_nine_issued_challenges is
  'Private immutable Custom challenges: legacy v1 nine players, prospective v2 one to ten players. Service-role SELECT/INSERT only; no public creation/reads.';

comment on column public.custom_nine_issued_challenges.canonical_player_ids is
  'Private ordered canonical answers: v1 exactly nine, v2 exactly one through ten unique players. Never expose to anonymous clients.';

comment on function public.custom_lineup_v2_issued_shape_valid(jsonb,jsonb) is
  'Immutable JSON shape validator for prospective private Custom v2 challenges. Not an admission, publication, scoring or player-data authority.';

-- No changes to result/attempt RLS, append-only permissions or v1 RPCs.
-- No version-2 producer/consumer should deploy before all later SQL/RPC steps.
