-- Source-only rollback acceptance for #528. Run only after the additive
-- display migration and all Custom v2 predecessors are installed in isolated QA.
-- Does not issue a real challenge or persist identity/score records.
begin;
set local lock_timeout = '500ms';
set local statement_timeout = '15s';

do $test$
declare
  v_puzzle_id text := 'custom-lineup-v2-' || gen_random_uuid()::text;
  v_first uuid := gen_random_uuid();
  v_second uuid := gen_random_uuid();
  v_first_digest text := repeat('a', 64);
  v_second_digest text := repeat('b', 64);
  v_missing_digest text := repeat('c', 64);
  v_clues jsonb;
  v_facts jsonb;
  v_summary jsonb;
  v_created boolean;
  v_rejected boolean;
  v_before bigint;
  v_observed_mode text;
  v_observed_name text;
begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.custom_lineup_v2_completion_displays'::regclass
      and relrowsecurity
  ) or exists (
    select 1 from pg_policy
    where polrelid = 'public.custom_lineup_v2_completion_displays'::regclass
  ) then raise exception 'Display projection privacy policy widened'; end if;

  if has_table_privilege('anon','public.custom_lineup_v2_completion_displays','SELECT')
    or has_table_privilege('authenticated','public.custom_lineup_v2_completion_displays','SELECT')
    or has_table_privilege('anon','public.custom_lineup_v2_completion_displays','INSERT')
    or has_table_privilege('authenticated','public.custom_lineup_v2_completion_displays','INSERT')
    or has_table_privilege('service_role','public.custom_lineup_v2_completion_displays','INSERT')
    or has_table_privilege('service_role','public.custom_lineup_v2_completion_displays','UPDATE')
    or has_table_privilege('service_role','public.custom_lineup_v2_completion_displays','DELETE')
    or has_function_privilege('anon',
      'public.record_custom_lineup_v2_completion_display(text,text,text,text)','EXECUTE')
    or has_function_privilege('authenticated',
      'public.record_custom_lineup_v2_completion_display(text,text,text,text)','EXECUTE')
    or not has_function_privilege('service_role',
      'public.record_custom_lineup_v2_completion_display(text,text,text,text)','EXECUTE')
    or not exists (
      select 1 from pg_proc p
      where p.oid = 'public.record_custom_lineup_v2_completion_display(text,text,text,text)'::regprocedure
        and p.prosecdef
    )
  then raise exception 'Guest/consumer privilege leaked, direct INSERT allowed, or private writer unavailable'; end if;

  if has_function_privilege('anon',
      'public.read_custom_lineup_v2_completion_display(text,text)','EXECUTE')
    or has_function_privilege('authenticated',
      'public.read_custom_lineup_v2_completion_display(text,text)','EXECUTE')
    or not has_function_privilege('service_role',
      'public.read_custom_lineup_v2_completion_display(text,text)','EXECUTE')
  then raise exception 'Completion display reader privileges widened'; end if;

  select count(*) into v_before
  from public.custom_lineup_v2_completion_displays;

  v_clues := jsonb_build_object(
    'schemaVersion',1,
    'hintLayout',jsonb_build_array(
      jsonb_build_object('slot',1,'hintType','main_decade','displayLabel','Decade'),
      jsonb_build_object('slot',2,'hintType','teams','displayLabel','Teams'),
      jsonb_build_object('slot',3,'hintType','position','displayLabel','Position'),
      jsonb_build_object('slot',4,'hintType','stats','displayLabel','Stats')),
    'pitches',jsonb_build_array(
      jsonb_build_object('pitchNumber',1,'canonicalPlayerId','fixture-player-1',
      'initials','FP','hintValues',jsonb_build_array('2000s','Mets','SS','HR 123'))));
  v_facts := jsonb_build_array(jsonb_build_object(
    'pitchNumber',1,'initials','FP','outcome','HR',
    'hintsRevealed',0,'wrongGuesses',0,'resolution','correct'));
  v_summary := jsonb_build_object(
    'points',4,'maximumPoints',4,'atBatsCompleted',1,
    'totalAtBats',1,'completed',true,'strikeouts',0);

  insert into public.custom_nine_issued_challenges (
    puzzle_id,schema_version,ruleset_version,canonical_player_ids,
    clue_snapshot,issued_at,display_title
  ) values (
    v_puzzle_id,2,'points-v4',jsonb_build_array('fixture-player-1'),
    v_clues,now(),'Display Projection QA'
  );

  insert into public.custom_nine_attempt_states (
    challenge_id,browser_key_digest,attempt_id,revision,
    current_progression_token,terminal_at_bats,status,completed_at
  ) values
    (v_puzzle_id,v_first_digest,v_first,1,'first-token',v_facts,'completed',now()),
    (v_puzzle_id,v_second_digest,v_second,1,'second-token',v_facts,'completed',now()),
    (v_puzzle_id,v_missing_digest,gen_random_uuid(),0,'pending', '[]'::jsonb,'active',null);

  if exists (
    select 1 from public.read_custom_lineup_v2_completion_display(
      v_puzzle_id,v_first_digest)
  ) then raise exception 'Readback revealed incomplete or unadmitted attempt'; end if;

  -- A completed attempt alone is not enough. An admitted completion plus
  -- all per-batter score rows must exist before accepting any display choice.
  v_rejected := false;
  begin
    perform * from public.record_custom_lineup_v2_completion_display(
      v_puzzle_id,v_first_digest,'named','Guest Hero');
  exception when invalid_parameter_value then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Unadmitted attempt accepted a name'; end if;

  insert into public.custom_nine_completed_results (
    submission_id,challenge_id,schema_version,ruleset_version,
    completed_at_bats,summary
  ) values
    (v_first::text,v_puzzle_id,2,'points-v4',v_facts,v_summary),
    (v_second::text,v_puzzle_id,2,'points-v4',v_facts,v_summary);

  v_rejected := false;
  begin
    perform * from public.record_custom_lineup_v2_completion_display(
      v_puzzle_id,v_first_digest,'named','Guest Hero');
  exception when invalid_parameter_value then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Completion lacking its AB rows admitted a name'; end if;

  insert into public.custom_nine_at_bat_results (
    attempt_id,challenge_id,schema_version,ruleset_version,pitch_number,
    initials,outcome,hints_revealed,wrong_guesses,resolution,awarded_points
  ) values
    (v_first::text,v_puzzle_id,2,'points-v4',1,'FP','HR',0,0,'correct',4),
    (v_second::text,v_puzzle_id,2,'points-v4',1,'FP','HR',0,0,'correct',4);

  -- Immutable at-bat trigger rejects a terminal fact mismatch before writer access.
  v_rejected := false;
  begin
    update public.custom_nine_at_bat_results
    set initials = 'FX'
    where attempt_id = v_first::text and challenge_id = v_puzzle_id
      and schema_version = 2 and pitch_number = 1;
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Immutable at-bat trigger accepted terminal initials mismatch';
  end if;

  -- Simulate a privileged data-corruption case: every immutable terminal
  -- fact still matches and all N rows exist, but the score total does not.
  -- The name writer must not bless that inconsistent result.
  update public.custom_nine_at_bat_results
  set awarded_points = 0
  where attempt_id = v_first::text and challenge_id = v_puzzle_id
    and schema_version = 2 and pitch_number = 1;
  v_rejected := false;
  begin
    perform * from public.record_custom_lineup_v2_completion_display(
      v_puzzle_id,v_first_digest,'named','Forged Award');
  exception when invalid_parameter_value then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Full-count terminal match with wrong point total was admitted';
  end if;
  update public.custom_nine_at_bat_results
  set awarded_points = 4
  where attempt_id = v_first::text and challenge_id = v_puzzle_id
    and schema_version = 2 and pitch_number = 1;

  -- Inputs must not be auto-trimmed or treated as authority; malformed or
  -- guessed credentials fail without producing any projection row.
  v_rejected := false;
  begin
    perform * from public.record_custom_lineup_v2_completion_display(
      v_puzzle_id,v_first_digest,'named',' Guest Hero ');
  exception when invalid_parameter_value then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Untrimmed name accepted'; end if;

  v_rejected := false;
  begin
    perform * from public.record_custom_lineup_v2_completion_display(
      v_puzzle_id,v_first_digest,'named', repeat('x',33));
  exception when invalid_parameter_value then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Oversized name accepted'; end if;

  v_rejected := false;
  begin
    perform * from public.record_custom_lineup_v2_completion_display(
      v_puzzle_id,v_first_digest,'named', E'Guest\nName');
  exception when invalid_parameter_value then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Control-containing name accepted'; end if;

  v_rejected := false;
  begin
    perform * from public.record_custom_lineup_v2_completion_display(
      v_puzzle_id,v_first_digest,'anonymous','Leak This Name');
  exception when invalid_parameter_value then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Anonymous name persisted'; end if;

  v_rejected := false;
  begin
    perform * from public.record_custom_lineup_v2_completion_display(
      v_puzzle_id,v_missing_digest,'named','Unadmitted');
  exception when invalid_parameter_value then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Incomplete saved attempt accepted'; end if;

  v_rejected := false;
  begin
    perform * from public.record_custom_lineup_v2_completion_display(
      v_puzzle_id,repeat('d',64),'named','Impersonation');
  exception when invalid_parameter_value then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Foreign browser digest accepted'; end if;

  select created into v_created from public.record_custom_lineup_v2_completion_display(
    v_puzzle_id,v_first_digest,'named','Guest Hero');
  if v_created is distinct from true then raise exception 'First name not inserted'; end if;
  select created into v_created from public.record_custom_lineup_v2_completion_display(
    v_puzzle_id,v_first_digest,'named','Guest Hero');
  if v_created is distinct from false then raise exception 'Exact retry not idempotent'; end if;

  v_rejected := false;
  begin
    perform * from public.record_custom_lineup_v2_completion_display(
      v_puzzle_id,v_first_digest,'named','Other Guest');
  exception when unique_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Previously named result renamed'; end if;

  v_rejected := false;
  begin
    perform * from public.record_custom_lineup_v2_completion_display(
      v_puzzle_id,v_first_digest,'anonymous',null);
  exception when unique_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Named result reset to anonymous'; end if;

  select display_mode, display_name into v_observed_mode, v_observed_name
  from public.read_custom_lineup_v2_completion_display(v_puzzle_id,v_first_digest);
  if not found or v_observed_mode is distinct from 'named'
    or v_observed_name is distinct from 'Guest Hero'
  then raise exception 'Named first result was not readable by its exact browser'; end if;
  if exists (
    select 1 from public.read_custom_lineup_v2_completion_display(
      v_puzzle_id,repeat('d',64))
  ) then raise exception 'Foreign digest read back another guest name'; end if;
  if exists (
    select 1 from public.read_custom_lineup_v2_completion_display(
      'custom-lineup-v2-' || gen_random_uuid()::text,v_first_digest)
  ) then raise exception 'Another challenge read back guest name'; end if;

  -- Corruption after saving a name must not authorize its later readback.
  update public.custom_nine_at_bat_results
  set awarded_points = 0
  where attempt_id = v_first::text and challenge_id = v_puzzle_id
    and schema_version = 2 and pitch_number = 1;
  if exists (
    select 1 from public.read_custom_lineup_v2_completion_display(
      v_puzzle_id,v_first_digest)
  ) then raise exception 'Readback accepted an inconsistent point total'; end if;
  update public.custom_nine_at_bat_results
  set awarded_points = 4
  where attempt_id = v_first::text and challenge_id = v_puzzle_id
    and schema_version = 2 and pitch_number = 1;

  select created into v_created from public.record_custom_lineup_v2_completion_display(
    v_puzzle_id,v_second_digest,'anonymous',null);
  if v_created is distinct from true then raise exception 'Anonymous result was not stored'; end if;
  select created into v_created from public.record_custom_lineup_v2_completion_display(
    v_puzzle_id,v_second_digest,'anonymous',null);
  if v_created is distinct from false then raise exception 'Anonymous retry not idempotent'; end if;
  -- The first Anonymous choice cannot be replaced with a name.
  v_rejected := false;
  begin
    perform * from public.record_custom_lineup_v2_completion_display(
      v_puzzle_id,v_second_digest,'named','Guest Hero');
  exception when unique_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Anonymous result changed to named'; end if;


  select display_mode, display_name into v_observed_mode, v_observed_name
  from public.read_custom_lineup_v2_completion_display(v_puzzle_id,v_second_digest);
  if not found or v_observed_mode is distinct from 'anonymous'
    or v_observed_name is not null
  then raise exception 'Anonymous display readback leaked a name'; end if;

  if not exists (select 1 from public.custom_lineup_v2_completion_displays
    where submission_id=v_first::text and display_mode='named'
      and display_name='Guest Hero')
    or not exists (select 1 from public.custom_lineup_v2_completion_displays
    where submission_id=v_second::text and display_mode='anonymous'
      and display_name is null)
    or (select count(*) from public.custom_lineup_v2_completion_displays) <> v_before + 2
  then raise exception 'Projection changed immutable score/result assignment'; end if;

  update public.custom_nine_attempt_states set creator_seen=true
  where challenge_id=v_puzzle_id and browser_key_digest=v_second_digest;
  v_rejected := false;
  begin
    perform * from public.record_custom_lineup_v2_completion_display(
      v_puzzle_id,v_second_digest,'anonymous',null);
  exception when invalid_parameter_value then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Creator-excluded retry accepted'; end if;

  if exists (
    select 1 from public.read_custom_lineup_v2_completion_display(
      v_puzzle_id,v_second_digest)
  ) then raise exception 'Creator-excluded browser can read an old display'; end if;

  if not exists (select 1 from public.custom_nine_completed_results
    where submission_id=v_first::text and challenge_id=v_puzzle_id
      and summary=v_summary and completed_at_bats=v_facts)
    or (select count(*) from public.custom_nine_at_bat_results
      where challenge_id=v_puzzle_id) <> 2
  then raise exception 'Display choice altered authoritative scoring facts'; end if;
end;
$test$;
rollback;
