-- Rollback-only SQL acceptance for the immutable issued strike-limit column.
-- Run only after the reviewed schema migration on disposable or isolated QA.
begin;
do $test$
declare
  v_n integer;
  v_count bigint;
  v_id text;
  v_ids jsonb;
  v_pitches jsonb;
  v_snapshot jsonb;
  v_legacy_snapshot jsonb;
  v_seen smallint;
  v_rejected boolean;
begin
  select count(*) into v_count from public.custom_nine_issued_challenges;
  if exists (
    select 1 from public.custom_nine_issued_challenges
    where strike_limit is distinct from 3
  ) then
    raise exception 'Previously issued challenges were reinterpreted';
  end if;

  v_ids := jsonb_build_array('test-player-1');
  v_pitches := jsonb_build_array(jsonb_build_object(
    'pitchNumber', 1, 'canonicalPlayerId', 'test-player-1',
    'initials', 'TP', 'hintValues', jsonb_build_array('2000s', 'NYM', 'SS', 'HR 22')
  ));
  v_snapshot := jsonb_build_object(
    'schemaVersion', 1,
    'hintLayout', jsonb_build_array(
      jsonb_build_object('slot', 1, 'hintType', 'main_decade', 'displayLabel', 'Decade'),
      jsonb_build_object('slot', 2, 'hintType', 'teams', 'displayLabel', 'Teams'),
      jsonb_build_object('slot', 3, 'hintType', 'position', 'displayLabel', 'Position'),
      jsonb_build_object('slot', 4, 'hintType', 'stats', 'displayLabel', 'Stats')
    ),
    'pitches', v_pitches
  );

  -- Omitting the field must remain indistinguishable from historical v2.
  v_id := 'custom-lineup-v2-' || gen_random_uuid()::text;
  insert into public.custom_nine_issued_challenges (
    puzzle_id, schema_version, ruleset_version,
    canonical_player_ids, clue_snapshot, issued_at
  ) values (v_id, 2, 'points-v4', v_ids, v_snapshot, now())
  returning strike_limit into v_seen;
  if v_seen <> 3 then raise exception 'Implicit v2 cap is not three'; end if;

  for v_n in 1..3 loop
    v_id := 'custom-lineup-v2-' || gen_random_uuid()::text;
    insert into public.custom_nine_issued_challenges (
      puzzle_id, schema_version, ruleset_version, strike_limit,
      canonical_player_ids, clue_snapshot, issued_at
    ) values (v_id, 2, 'points-v4', v_n, v_ids, v_snapshot, now())
    returning strike_limit into v_seen;
    if v_seen <> v_n then raise exception 'Explicit v2 cap % was not stored', v_n; end if;
  end loop;

  -- Explicit NULL must not silently fall back to the column default.
  v_rejected := false;
  begin
    insert into public.custom_nine_issued_challenges (
      puzzle_id, schema_version, ruleset_version, strike_limit,
      canonical_player_ids, clue_snapshot, issued_at
    ) values (
      'custom-lineup-v2-' || gen_random_uuid()::text,
      2, 'points-v4', null, v_ids, v_snapshot, now()
    );
  exception when not_null_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Explicit null cap accepted'; end if;

  foreach v_n in array array[0, 4, -1] loop
    v_rejected := false;
    begin
      insert into public.custom_nine_issued_challenges (
        puzzle_id, schema_version, ruleset_version, strike_limit,
        canonical_player_ids, clue_snapshot, issued_at
      ) values (
        'custom-lineup-v2-' || gen_random_uuid()::text,
        2, 'points-v4', v_n, v_ids, v_snapshot, now()
      );
    exception when check_violation then v_rejected := true;
    end;
    if not v_rejected then raise exception 'Invalid v2 cap % accepted', v_n; end if;
  end loop;

  -- A v1 challenge is always exactly nine players and cannot opt into 1/2.
  select jsonb_agg('legacy-player-' || i order by i)
    into v_ids from generate_series(1,9) as i;
  select jsonb_agg(jsonb_build_object(
    'pitchNumber', i, 'initials', 'L' || i,
    'hintValues', jsonb_build_array('a', 'b', 'c', 'd')
  ) order by i) into v_pitches from generate_series(1,9) as i;
  v_legacy_snapshot := jsonb_build_object(
    'schemaVersion', 1,
    'hintLayout', jsonb_build_array('H1', 'H2', 'H3', 'H4'),
    'pitches', v_pitches
  );
  v_rejected := false;
  begin
    insert into public.custom_nine_issued_challenges (
      puzzle_id, schema_version, ruleset_version, strike_limit,
      canonical_player_ids, clue_snapshot, issued_at
    ) values (
      'custom-nine-v1-' || gen_random_uuid()::text,
      1, 'points-v4', 2, v_ids, v_legacy_snapshot, now()
    );
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Legacy v1 accepted a nondefault cap'; end if;

  v_id := 'custom-nine-v1-' || gen_random_uuid()::text;
  insert into public.custom_nine_issued_challenges (
    puzzle_id, schema_version, ruleset_version,
    canonical_player_ids, clue_snapshot, issued_at
  ) values (v_id, 1, 'points-v4', v_ids, v_legacy_snapshot, now())
  returning strike_limit into v_seen;
  if v_seen <> 3 then raise exception 'Legacy v1 cap was changed'; end if;

  if has_table_privilege('anon', 'public.custom_nine_issued_challenges', 'select')
    or has_table_privilege('authenticated', 'public.custom_nine_issued_challenges', 'select')
    or has_table_privilege('service_role', 'public.custom_nine_issued_challenges', 'update')
    or not has_table_privilege('service_role', 'public.custom_nine_issued_challenges', 'insert')
  then raise exception 'Private issued-table grants changed'; end if;

  if (select count(*) from public.custom_nine_issued_challenges) <> v_count + 5 then
    raise exception 'Unexpected count after valid fixtures';
  end if;
end;
$test$;
rollback;
