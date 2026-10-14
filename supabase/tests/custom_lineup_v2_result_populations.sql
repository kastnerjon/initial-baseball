-- Transaction-rollback-only validation. Depends on #401, #403 and this migration.
-- No fixture challenge, answer, attempt or score survives this transaction.
begin;
do $test$
declare
  v_n integer;
  v_schema smallint;
  v_slot integer;
  v_id text;
  v_attempt uuid;
  v_ids jsonb;
  v_pitches jsonb;
  v_snapshot jsonb;
  v_terminal jsonb;
  v_summary jsonb;
  v_digest text;
  v_rejected boolean;
  v_start_issued bigint;
  v_start_attempt bigint;
  v_start_completed bigint;
  v_start_ab bigint;
begin
  select count(*) into v_start_issued from public.custom_nine_issued_challenges;
  select count(*) into v_start_attempt from public.custom_nine_attempt_states;
  select count(*) into v_start_completed from public.custom_nine_completed_results;
  select count(*) into v_start_ab from public.custom_nine_at_bat_results;

  for v_n in select unnest(array[1,5,9,10,-9]) loop
    v_schema := case when v_n < 0 then 1 else 2 end;
    v_attempt := gen_random_uuid();
    v_digest := md5(v_attempt::text) || md5(v_attempt::text || '-digest');
    v_id := (case when v_schema = 1 then 'custom-nine-v1-' else 'custom-lineup-v2-' end)
      || v_attempt::text;
    select jsonb_agg('player-' || i order by i) into v_ids
    from generate_series(1,abs(v_n)) as i;
    select jsonb_agg(jsonb_build_object(
      'pitchNumber',i,'canonicalPlayerId','player-' || i,
      'initials','P' || i, 'hintValues',jsonb_build_array('2000s','Mets','SS','HR 123')
    ) order by i) into v_pitches
    from generate_series(1,abs(v_n)) as i;
    v_snapshot := jsonb_build_object(
      'schemaVersion',1,
      'hintLayout',jsonb_build_array(
        jsonb_build_object('slot',1,'hintType','main_decade','displayLabel','Decade'),
        jsonb_build_object('slot',2,'hintType','teams','displayLabel','Teams'),
        jsonb_build_object('slot',3,'hintType','position','displayLabel','Position'),
        jsonb_build_object('slot',4,'hintType','stats','displayLabel','Stats')
      ),
      'pitches',v_pitches
    );
    select jsonb_agg(jsonb_build_object(
      'pitchNumber',i,'initials','P' || i,'outcome','HR',
      'hintsRevealed',0,'wrongGuesses',0,'resolution','correct'
    ) order by i) into v_terminal
    from generate_series(1,abs(v_n)) as i;
    v_summary := jsonb_build_object(
      'points',4*abs(v_n),'maximumPoints',4*abs(v_n),
      'atBatsCompleted',abs(v_n),'totalAtBats',abs(v_n),
      'completed',true,'strikeouts',0
    );

    insert into public.custom_nine_issued_challenges (
      puzzle_id,schema_version,ruleset_version,canonical_player_ids,clue_snapshot,issued_at
    ) values (v_id,v_schema,'points-v4',v_ids,v_snapshot,now());
    insert into public.custom_nine_attempt_states (
      challenge_id,browser_key_digest,attempt_id,revision,
      current_progression_token,terminal_at_bats,status,completed_at
    ) values (
      v_id,v_digest,v_attempt,abs(v_n),'fixture-token',
      v_terminal,'completed',now()
    );

    if v_schema = 2 then
      -- A real challenge can only record its own completed attempt UUID.
      v_rejected := false;
      begin
        insert into public.custom_nine_completed_results(
          submission_id,challenge_id,schema_version,ruleset_version,completed_at_bats,summary
        ) values (
          gen_random_uuid()::text,v_id,2,'points-v4',v_terminal,v_summary
        );
      exception when check_violation then v_rejected := true;
      end;
      if not v_rejected then raise exception 'Unbacked completion accepted N=%',v_n; end if;

      -- The summary must use 4*N, not a caller-supplied nine-player maximum.
      v_rejected := false;
      begin
        insert into public.custom_nine_completed_results(
          submission_id,challenge_id,schema_version,ruleset_version,completed_at_bats,summary
        ) values (
          v_attempt::text,v_id,2,'points-v4',v_terminal,
          jsonb_set(v_summary,'{maximumPoints}',to_jsonb(4*abs(v_n) + 4))
        );
      exception when check_violation then v_rejected := true;
      end;
      if not v_rejected then raise exception 'Invalid maximum accepted N=%',v_n; end if;

      v_rejected := false;
      begin
        insert into public.custom_nine_completed_results(
          submission_id,challenge_id,schema_version,ruleset_version,completed_at_bats,summary
        ) values (
          v_attempt::text,v_id,2,'points-v4',v_terminal,
          jsonb_set(v_summary,'{points}',to_jsonb(4*abs(v_n) + 0.5))
        );
      exception when check_violation then v_rejected := true;
      end;
      if not v_rejected then raise exception 'Over-max score accepted N=%',v_n; end if;

      v_rejected := false;
      begin
        insert into public.custom_nine_completed_results(
          submission_id,challenge_id,schema_version,ruleset_version,completed_at_bats,summary
        ) values (
          v_attempt::text,v_id,2,'points-v4',
          v_terminal - (abs(v_n)-1),v_summary
        );
      exception when check_violation then v_rejected := true;
      end;
      if not v_rejected then raise exception 'Short completion accepted N=%',v_n; end if;
    end if;

    insert into public.custom_nine_completed_results (
      submission_id,challenge_id,schema_version,ruleset_version,completed_at_bats,summary
    ) values (
      v_attempt::text,v_id,v_schema,'points-v4',v_terminal,v_summary
    );

    for v_slot in 1..abs(v_n) loop
      insert into public.custom_nine_at_bat_results (
        attempt_id,challenge_id,schema_version,ruleset_version,
        pitch_number,initials,outcome,hints_revealed,
        wrong_guesses,resolution,awarded_points
      ) values (
        v_attempt::text,v_id,v_schema,'points-v4',
        v_slot,'P' || v_slot,'HR',0,0,'correct',4
      );
    end loop;

    if v_schema = 2 then
      v_rejected := false;
      begin
        insert into public.custom_nine_at_bat_results (
          attempt_id,challenge_id,schema_version,ruleset_version,
          pitch_number,initials,outcome,hints_revealed,
          wrong_guesses,resolution,awarded_points
        ) values (
          v_attempt::text,v_id,2,'points-v4',
          case when abs(v_n)<10 then abs(v_n)+1 else 1 end,
          'WRONG','HR',0,0,'correct',4
        );
      exception when check_violation then v_rejected := true;
                 when unique_violation then v_rejected := true;
      end;
      if not v_rejected then raise exception 'Extra/mismatched result accepted N=%',v_n; end if;
    end if;
  end loop;

  if (select count(*) from public.custom_nine_issued_challenges) <> v_start_issued + 5
    or (select count(*) from public.custom_nine_attempt_states) <> v_start_attempt + 5
    or (select count(*) from public.custom_nine_completed_results) <> v_start_completed + 5
    or (select count(*) from public.custom_nine_at_bat_results) <> v_start_ab + 34 then
    raise exception 'Unexpected Custom result fixture population';
  end if;
  if has_table_privilege('anon','public.custom_nine_completed_results','select')
    or has_table_privilege('authenticated','public.custom_nine_at_bat_results','insert')
    or not has_table_privilege('service_role','public.custom_nine_completed_results','insert')
    or not has_table_privilege('service_role','public.custom_nine_at_bat_results','insert')
    or has_function_privilege('anon',
         'public.validate_custom_lineup_completed_result()','execute')
    or has_function_privilege('authenticated',
         'public.validate_custom_lineup_at_bat_result()','execute') then
    raise exception 'Custom private result access grants changed';
  end if;
end;
$test$;
rollback;
