-- Rollback-only hosted verification AFTER the Custom v2 issued-table migration.
-- Synthetic challenge rows must never persist; review this before execution.
begin;

do $test$
declare
  v_n integer;
  v_ids jsonb;
  v_pitches jsonb;
  v_snapshot jsonb;
  v_id text;
  v_legacy_id text := 'custom-nine-v1-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  v_current_count integer;
  v_caught boolean;
  v_invalid_ids jsonb;
begin
  select count(*) into v_current_count
  from public.custom_nine_issued_challenges;

  for v_n in select unnest(array[1,5,9,10]) loop
    select jsonb_agg('test-player-' || idx order by idx)
      into v_ids from generate_series(1,v_n) as idx;
    select jsonb_agg(jsonb_build_object(
      'pitchNumber', idx, 'canonicalPlayerId', 'test-player-' || idx,
      'initials', 'T' || idx,
      'hintValues', jsonb_build_array('2000s','NYM','2B','HR 22')
    ) order by idx)
      into v_pitches from generate_series(1,v_n) as idx;
    v_snapshot := jsonb_build_object(
      'schemaVersion', 1,
      'hintLayout', jsonb_build_array(
        jsonb_build_object('slot',1,'hintType','main_decade','displayLabel','Decade'),
        jsonb_build_object('slot',2,'hintType','teams','displayLabel','Teams'),
        jsonb_build_object('slot',3,'hintType','position','displayLabel','Position'),
        jsonb_build_object('slot',4,'hintType','stats','displayLabel','Stats')
      ),
      'pitches', v_pitches
    );
    if not public.custom_lineup_v2_issued_shape_valid(v_ids, v_snapshot) then
      raise exception 'Valid Custom % fixture rejected',v_n;
    end if;

    v_id := 'custom-lineup-v2-' || gen_random_uuid()::text;
    insert into public.custom_nine_issued_challenges(
      puzzle_id, schema_version, ruleset_version,
      canonical_player_ids, clue_snapshot, issued_at
    ) values(v_id, 2, 'points-v4', v_ids, v_snapshot, now());

    if (select jsonb_array_length(canonical_player_ids)
        from public.custom_nine_issued_challenges where puzzle_id=v_id) <> v_n then
      raise exception 'Stored Custom v2 length incorrect for %',v_n;
    end if;
  end loop;

  -- The old schema-v1 record remains valid and exact-nine, with the old URL format.
  select jsonb_agg('test-player-' || idx order by idx)
    into v_ids from generate_series(1,9) as idx;
  select jsonb_agg(jsonb_build_object(
    'pitchNumber', idx, 'initials', 'T' || idx,
    'hintValues',jsonb_build_array('a','b','c','d')
  ) order by idx) into v_pitches from generate_series(1,9) as idx;
  v_snapshot := jsonb_build_object('schemaVersion',1,
    'hintLayout',jsonb_build_array('H1','H2','H3','H4'),
    'pitches',v_pitches);

  insert into public.custom_nine_issued_challenges(
    puzzle_id,schema_version,ruleset_version,
    canonical_player_ids,clue_snapshot,issued_at
  ) values(v_legacy_id,1,'points-v4',v_ids,v_snapshot,now());

  v_caught := false;
  begin
    insert into public.custom_nine_issued_challenges(
      puzzle_id,schema_version,ruleset_version,
      canonical_player_ids,clue_snapshot,issued_at
    ) values ('custom-nine-v1-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      1,'points-v4',v_ids - 8,v_snapshot,now());
  exception when check_violation then v_caught := true;
  end;
  if not v_caught then raise exception 'v1 five/eight-player regression'; end if;

  -- Validator must reject 0/11, duplicates, mismatched order, and missing hints.
  if public.custom_lineup_v2_issued_shape_valid('[]'::jsonb, v_snapshot)
    or public.custom_lineup_v2_issued_shape_valid(
      to_jsonb(array(select 'x' from generate_series(1,11))),v_snapshot) then
    raise exception 'Zero/eleven Custom length accepted';
  end if;
  v_invalid_ids := jsonb_set(v_ids,'{1}',v_ids->0);
  if public.custom_lineup_v2_issued_shape_valid(v_invalid_ids,v_snapshot) then
    raise exception 'Duplicate Custom identities accepted';
  end if;

  select jsonb_agg(jsonb_build_object(
    'pitchNumber',idx,'canonicalPlayerId','test-player-' || idx,
    'initials','T' || idx,'hintValues',jsonb_build_array('a','b','c','d')
  ) order by idx) into v_pitches from generate_series(1,9) as idx;
  v_snapshot := jsonb_build_object('schemaVersion',1,
    'hintLayout',jsonb_build_array(
      jsonb_build_object('slot',1,'hintType','main_decade','displayLabel','Decade'),
      jsonb_build_object('slot',2,'hintType','teams','displayLabel','Teams'),
      jsonb_build_object('slot',3,'hintType','position','displayLabel','Position'),
      jsonb_build_object('slot',4,'hintType','stats','displayLabel','Stats')
    ),'pitches',v_pitches);
  if public.custom_lineup_v2_issued_shape_valid(
    v_ids,jsonb_set(v_snapshot,'{pitches,0,canonicalPlayerId}','"WRONG"'::jsonb))
    or public.custom_lineup_v2_issued_shape_valid(
    v_ids,jsonb_set(v_snapshot,'{pitches,0,hintValues}','["a"]'::jsonb))
    or public.custom_lineup_v2_issued_shape_valid(
    v_ids,jsonb_set(v_snapshot,'{pitches,0,pitchNumber}','2'::jsonb)) then
    raise exception 'Invalid frozen Custom clues accepted';
  end if;

  if (select count(*) from public.custom_nine_issued_challenges)
    <> v_current_count + 5 then
    raise exception 'Unexpected Custom fixture row count';
  end if;
  if has_table_privilege('anon','public.custom_nine_issued_challenges','select')
    or has_table_privilege('authenticated','public.custom_nine_issued_challenges','insert')
    or not has_table_privilege('service_role','public.custom_nine_issued_challenges','insert')
    or has_function_privilege('anon','public.custom_lineup_v2_issued_shape_valid(jsonb,jsonb)','execute')
    or has_function_privilege('authenticated','public.custom_lineup_v2_issued_shape_valid(jsonb,jsonb)','execute')
    or not has_function_privilege('service_role','public.custom_lineup_v2_issued_shape_valid(jsonb,jsonb)','execute') then
    raise exception 'Custom SQL privileges changed';
  end if;
end;
$test$;

rollback;
