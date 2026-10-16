-- Rollback-only test for atomic Custom Lineup v2 admission.
-- Requires hosted #401, #403, #404 and this migration, in that order.
-- Run with a privileged migration/test role; no fixture survives ROLLBACK.
begin;
do $test$
declare
  v_n integer;
  v_id text;
  v_attempt uuid;
  v_digest text;
  v_ids jsonb;
  v_pitches jsonb;
  v_clues jsonb;
  v_facts jsonb;
  v_summary jsonb;
  v_scores numeric[];
  v_out record;
  v_rejected boolean;
  v_initial_completed integer;
  v_initial_at_bats integer;
  v_initial_issued integer;
  v_initial_attempts integer;
  v_legacy_id text;
  v_legacy_attempt uuid;
  v_legacy_digest text;
begin
  select count(*) into v_initial_issued from public.custom_nine_issued_challenges;
  select count(*) into v_initial_attempts from public.custom_nine_attempt_states;
  select count(*) into v_initial_completed from public.custom_nine_completed_results;
  select count(*) into v_initial_at_bats from public.custom_nine_at_bat_results;

  for v_n in select unnest(array[1,2,3,4,5,6,7,8,9,10]) loop
    v_attempt := gen_random_uuid();
    v_id := 'custom-lineup-v2-' || v_attempt::text;
    v_digest := md5(v_id) || md5(v_id || '-browser');
    select jsonb_agg('fixture-player-' || slot order by slot)
      into v_ids from generate_series(1, v_n) as slot;
    select jsonb_agg(
      jsonb_build_object(
        'pitchNumber', slot, 'canonicalPlayerId', 'fixture-player-' || slot,
        'initials', 'P' || slot,
        'hintValues', jsonb_build_array('2000s','Mets','SS','HR 123')
      ) order by slot
    ) into v_pitches from generate_series(1, v_n) as slot;
    v_clues := jsonb_build_object(
      'schemaVersion', 1,
      'hintLayout', jsonb_build_array(
        jsonb_build_object('slot',1,'hintType','main_decade','displayLabel','Decade'),
        jsonb_build_object('slot',2,'hintType','teams','displayLabel','Teams'),
        jsonb_build_object('slot',3,'hintType','position','displayLabel','Position'),
        jsonb_build_object('slot',4,'hintType','stats','displayLabel','Stats')
      ),
      'pitches', v_pitches
    );

    select jsonb_agg(
      jsonb_build_object(
        'pitchNumber',slot, 'initials','P' || slot,
        'outcome','HR', 'hintsRevealed',0, 'wrongGuesses',0,
        'resolution','correct'
      ) order by slot
    ) into v_facts from generate_series(1, v_n) as slot;
    v_scores := array_fill(4::numeric, array[v_n]);
    v_summary := jsonb_build_object(
      'points',4 * v_n, 'maximumPoints',4 * v_n,
      'atBatsCompleted',v_n, 'totalAtBats',v_n,
      'completed',true, 'strikeouts',0
    );

    insert into public.custom_nine_issued_challenges(
      puzzle_id,schema_version,ruleset_version,canonical_player_ids,
      clue_snapshot,issued_at
    ) values (v_id,2,'points-v4',v_ids,v_clues,now());

    -- An active private attempt must never contribute a result.
    insert into public.custom_nine_attempt_states(
      challenge_id,browser_key_digest,attempt_id,revision,
      current_progression_token,terminal_at_bats,status
    ) values (v_id,v_digest,v_attempt,0,'fixture-token','[]'::jsonb,'active');
    v_rejected := false;
    begin
      perform * from public.admit_custom_lineup_v2_completed_attempt(
        v_id,v_digest,v_summary,v_scores);
    exception when invalid_parameter_value then v_rejected := true;
    end;
    if not v_rejected then raise exception 'Active attempt admitted, N=%',v_n; end if;

    update public.custom_nine_attempt_states
    set terminal_at_bats=v_facts,status='completed',
        completed_at=now(),revision=v_n
    where challenge_id=v_id and browser_key_digest=v_digest;

    -- A score list must be complete, bounded, and half-point aligned.
    v_rejected := false;
    begin
      perform * from public.admit_custom_lineup_v2_completed_attempt(
        v_id,v_digest,v_summary,v_scores[1:v_n - 1]);
    exception when invalid_parameter_value then v_rejected := true;
    end;
    if not v_rejected then raise exception 'Short score array admitted, N=%',v_n; end if;

    v_rejected := false;
    begin
      perform * from public.admit_custom_lineup_v2_completed_attempt(
        v_id,v_digest,jsonb_set(v_summary,'{maximumPoints}',to_jsonb(4*v_n + 4)),v_scores);
    exception when invalid_parameter_value then v_rejected := true;
    end;
    if not v_rejected then raise exception 'Wrong maximum admitted, N=%',v_n; end if;

    v_rejected := false;
    begin
      perform * from public.admit_custom_lineup_v2_completed_attempt(
        v_id,v_digest,jsonb_set(v_summary,'{totalAtBats}',to_jsonb(v_n + 1)),v_scores);
    exception when invalid_parameter_value then v_rejected := true;
    end;
    if not v_rejected then raise exception 'Wrong total admitted, N=%',v_n; end if;

    v_rejected := false;
    begin
      perform * from public.admit_custom_lineup_v2_completed_attempt(
        v_id,v_digest,jsonb_set(v_summary,'{points}',to_jsonb(4*v_n - 0.5)),v_scores);
    exception when invalid_parameter_value then v_rejected := true;
    end;
    if not v_rejected then raise exception 'Wrong sum admitted, N=%',v_n; end if;

    select * into v_out from public.admit_custom_lineup_v2_completed_attempt(
      v_id,v_digest,v_summary,v_scores);
    if v_out.submission_id <> v_attempt::text or v_out.created is distinct from true then
      raise exception 'First accepted completion wrong, N=%',v_n;
    end if;

    select * into v_out from public.admit_custom_lineup_v2_completed_attempt(
      v_id,v_digest,v_summary,v_scores);
    if v_out.submission_id <> v_attempt::text or v_out.created is distinct from false then
      raise exception 'Idempotent replay incorrectly created, N=%',v_n;
    end if;

    -- Changed points/summary must never alter or acknowledge accepted winner.
    v_rejected := false;
    begin
      perform * from public.admit_custom_lineup_v2_completed_attempt(
        v_id,v_digest,
        jsonb_set(v_summary,'{points}',to_jsonb(4*v_n - 0.5)),
        array_prepend(3.5::numeric,v_scores[2:v_n]));
    exception when unique_violation then v_rejected := true;
    end;
    if not v_rejected then raise exception 'Conflicting replay admitted, N=%',v_n; end if;

    if (select count(*) from public.custom_nine_at_bat_results
        where challenge_id=v_id and schema_version=2) <> v_n
      or (select count(*) from public.custom_nine_completed_results
        where challenge_id=v_id and schema_version=2) <> 1 then
      raise exception 'Atomic result count mismatch, N=%',v_n;
    end if;
  end loop;

  -- A completed historical Custom Nine v1 attempt must NOT enter v2 admission.
  v_legacy_attempt := gen_random_uuid();
  v_legacy_id := 'custom-nine-v1-' || v_legacy_attempt::text;
  v_legacy_digest := md5(v_legacy_id) || md5(v_legacy_id || '-browser');
  select jsonb_agg('fixture-player-' || slot order by slot)
    into v_ids from generate_series(1, 9) slot;
  select jsonb_agg(jsonb_build_object(
    'pitchNumber',slot, 'canonicalPlayerId','fixture-player-' || slot,
    'initials','P' || slot,
    'hintValues',jsonb_build_array('2000s','Mets','SS','HR 123')
  ) order by slot) into v_pitches from generate_series(1,9) slot;
  v_clues := jsonb_set(v_clues,'{pitches}',v_pitches);
  select jsonb_agg(jsonb_build_object(
    'pitchNumber',slot,'initials','P' || slot,'outcome','HR',
    'hintsRevealed',0,'wrongGuesses',0,'resolution','correct'
  ) order by slot) into v_facts from generate_series(1,9) slot;
  insert into public.custom_nine_issued_challenges(
    puzzle_id,schema_version,ruleset_version,canonical_player_ids,clue_snapshot,issued_at
  ) values(v_legacy_id,1,'points-v4',v_ids,v_clues,now());
  insert into public.custom_nine_attempt_states(
    challenge_id,browser_key_digest,attempt_id,revision,current_progression_token,
    terminal_at_bats,status,completed_at
  ) values(v_legacy_id,v_legacy_digest,v_legacy_attempt,9,'fixture-token',v_facts,'completed',now());
  v_rejected := false;
  begin
    perform * from public.admit_custom_lineup_v2_completed_attempt(
      v_legacy_id,v_legacy_digest,
      jsonb_build_object('points',36,'maximumPoints',36,'atBatsCompleted',9,
        'totalAtBats',9,'completed',true,'strikeouts',0),
      array_fill(4::numeric,array[9]));
  exception when invalid_parameter_value then v_rejected := true;
  end;
  if not v_rejected then raise exception 'v1 puzzle admitted via v2 function'; end if;
  select * into v_out from public.admit_custom_nine_completed_attempt(
    v_legacy_id,v_legacy_digest,
    jsonb_build_object('points',36,'maximumPoints',36,'atBatsCompleted',9,
      'totalAtBats',9,'completed',true,'strikeouts',0),
    array_fill(4::numeric,array[9]));
  if v_out.created is distinct from true then
    raise exception 'Existing v1 admission regressed';
  end if;

  if (select count(*) from public.custom_nine_issued_challenges)
      <> v_initial_issued + 11
    or (select count(*) from public.custom_nine_attempt_states)
      <> v_initial_attempts + 11
    or (select count(*) from public.custom_nine_completed_results)
      <> v_initial_completed + 11
    or (select count(*) from public.custom_nine_at_bat_results)
      <> v_initial_at_bats + 64 then
    raise exception 'Unexpected private Custom result population';
  end if;

  if has_function_privilege('anon',
       'public.admit_custom_lineup_v2_completed_attempt(text,text,jsonb,numeric[])','execute')
    or has_function_privilege('authenticated',
       'public.admit_custom_lineup_v2_completed_attempt(text,text,jsonb,numeric[])','execute')
    or not has_function_privilege('service_role',
       'public.admit_custom_lineup_v2_completed_attempt(text,text,jsonb,numeric[])','execute')
    or has_table_privilege('anon','public.custom_nine_completed_results','select')
    or has_table_privilege('authenticated','public.custom_nine_at_bat_results','insert') then
    raise exception 'Custom v2 admission privileges changed';
  end if;
end;
$test$;
rollback;
