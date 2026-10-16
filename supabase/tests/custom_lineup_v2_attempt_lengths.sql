-- Rollback-only verification, run AFTER #401 and this migration are hosted.
-- No synthetic challenges, attempts or answers may persist.
begin;

do $test$
declare
  v_n integer;
  v_id text;
  v_ids jsonb;
  v_pitches jsonb;
  v_snapshot jsonb;
  v_facts jsonb;
  v_partial jsonb;
  v_extra jsonb;
  v_digest text;
  v_attempt uuid;
  v_rejected boolean;
  v_base_attempt_count integer;
  v_base_challenge_count integer;
begin
  select count(*) into v_base_attempt_count
    from public.custom_nine_attempt_states;
  select count(*) into v_base_challenge_count
    from public.custom_nine_issued_challenges;

  -- Test both variable v2 sizes and historical exact-nine v1.
  for v_n in select unnest(array[1,2,3,4,5,6,7,8,9,10,-9]) loop
    select jsonb_agg('fixture-player-' || i order by i)
      into v_ids from generate_series(1, abs(v_n)) as i;
    select jsonb_agg(jsonb_build_object(
      'pitchNumber', i,
      'canonicalPlayerId', 'fixture-player-' || i,
      'initials', 'P' || i,
      'hintValues', jsonb_build_array('2000s', 'Mets', 'SS', 'HR 123')
    ) order by i)
      into v_pitches from generate_series(1, abs(v_n)) as i;

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

    if v_n < 0 then
      v_id := 'custom-nine-v1-' || gen_random_uuid()::text;
    else
      v_id := 'custom-lineup-v2-' || gen_random_uuid()::text;
    end if;

    insert into public.custom_nine_issued_challenges (
      puzzle_id, schema_version, ruleset_version,
      canonical_player_ids, clue_snapshot, issued_at
    ) values (
      v_id, case when v_n < 0 then 1 else 2 end,
      'points-v4', v_ids, v_snapshot, now()
    );

    v_digest := md5(v_id) || md5(v_id || '-browser');
    v_attempt := gen_random_uuid();
    insert into public.custom_nine_attempt_states (
      challenge_id, browser_key_digest, attempt_id, revision,
      current_progression_token, terminal_at_bats, status
    ) values (v_id, v_digest, v_attempt, 0, 'fixture-token', '[]'::jsonb, 'active');

    select coalesce(jsonb_agg(
      jsonb_build_object('pitchNumber', i) order by i
    ), '[]'::jsonb)
    into v_partial from generate_series(1, abs(v_n) - 1) as i;

    update public.custom_nine_attempt_states
    set terminal_at_bats = v_partial
    where challenge_id = v_id and browser_key_digest = v_digest;

    -- An incomplete challenge cannot be reported as completed.
    v_rejected := false;
    begin
      update public.custom_nine_attempt_states
      set status = 'completed', completed_at = now()
      where challenge_id = v_id and browser_key_digest = v_digest;
    exception when check_violation then v_rejected := true;
    end;
    if not v_rejected then
      raise exception 'Early completion accepted for length %', v_n;
    end if;

    select jsonb_agg(jsonb_build_object('pitchNumber', i) order by i)
      into v_facts from generate_series(1, abs(v_n)) as i;

    -- A fully resolved attempt must no longer be active.
    v_rejected := false;
    begin
      update public.custom_nine_attempt_states
      set terminal_at_bats = v_facts
      where challenge_id = v_id and browser_key_digest = v_digest;
    exception when check_violation then v_rejected := true;
    end;
    if not v_rejected then
      raise exception 'Overlong active attempt accepted for length %', v_n;
    end if;

    -- A genuinely complete attempt is admitted to the private ledger only.
    update public.custom_nine_attempt_states
    set terminal_at_bats = v_facts, status = 'completed', completed_at = now()
    where challenge_id = v_id and browser_key_digest = v_digest;
    if (select jsonb_array_length(terminal_at_bats)
        from public.custom_nine_attempt_states
        where challenge_id = v_id and browser_key_digest = v_digest) <> abs(v_n) then
      raise exception 'Stored terminal count wrong for length %', v_n;
    end if;

    -- Even completed challenges cannot be enlarged past their own length.
    v_extra := v_facts || jsonb_build_array(
      jsonb_build_object('pitchNumber', abs(v_n) + 1)
    );
    v_rejected := false;
    begin
      update public.custom_nine_attempt_states
      set terminal_at_bats = v_extra
      where challenge_id = v_id and browser_key_digest = v_digest;
    exception when check_violation then v_rejected := true;
    end;
    if not v_rejected then
      raise exception 'Extra terminal fact accepted for length %', v_n;
    end if;
  end loop;

  if (select count(*) from public.custom_nine_attempt_states)
       <> v_base_attempt_count + 11
    or (select count(*) from public.custom_nine_issued_challenges)
       <> v_base_challenge_count + 11 then
    raise exception 'Unexpected Custom fixture row population';
  end if;

  if has_table_privilege('anon', 'public.custom_nine_attempt_states', 'select')
    or has_table_privilege('authenticated', 'public.custom_nine_attempt_states', 'update')
    or not has_table_privilege('service_role', 'public.custom_nine_attempt_states', 'update')
    or has_function_privilege('anon',
         'public.validate_custom_lineup_attempt_length()', 'execute')
    or has_function_privilege('authenticated',
         'public.validate_custom_lineup_attempt_length()', 'execute')
    or not has_function_privilege('service_role',
         'public.validate_custom_lineup_attempt_length()', 'execute') then
    raise exception 'Custom attempt privileges changed';
  end if;
end;
$test$;

rollback;
