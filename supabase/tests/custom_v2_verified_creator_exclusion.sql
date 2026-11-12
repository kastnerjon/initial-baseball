-- Rollback-only regression for the two additive verified-creator migrations.
-- Run with a privileged QA/test role after BOTH migrations are installed.
-- Never apply this script as a migration. Fixtures must not survive ROLLBACK.
begin;
set local lock_timeout = '500ms';
set local statement_timeout = '15s';
do $test$
declare
  v_id text := 'custom-lineup-v2-' || gen_random_uuid()::text;
  v_creator_attempt uuid := gen_random_uuid();
  v_friend_attempt uuid := gen_random_uuid();
  v_creator_digest text := repeat('a', 64);
  v_friend_digest text := repeat('b', 64);
  v_missing_auth uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  v_failure_id text := 'custom-lineup-v2-' || gen_random_uuid()::text;
  v_failure_attempt uuid := gen_random_uuid();
  v_failure_digest text := repeat('d', 64);
  v_failure_clues jsonb;
  v_failure_facts jsonb;
  v_failure_summary jsonb;
  v_clues jsonb;
  v_facts jsonb;
  v_summary jsonb;
  v_out record;
  v_rejected boolean;
  v_issued_count bigint;
  v_attempt_count bigint;
  v_result_count bigint;
  v_at_bat_count bigint;
begin
  select count(*) into v_issued_count from public.custom_nine_issued_challenges;
  select count(*) into v_attempt_count from public.custom_nine_attempt_states;
  select count(*) into v_result_count from public.custom_nine_completed_results;
  select count(*) into v_at_bat_count from public.custom_nine_at_bat_results;

  if not exists (select 1 from pg_attribute
      where attrelid='public.custom_nine_issued_challenges'::regclass
        and attname='creator_account_id' and not attisdropped)
    or not exists (select 1 from pg_attribute
      where attrelid='public.custom_nine_attempt_states'::regclass
        and attname='creator_seen' and attnotnull and not attisdropped)
    or not exists (select 1 from pg_constraint
      where conrelid='public.custom_nine_issued_challenges'::regclass
        and conname='custom_v2_verified_creator_shape' and convalidated)
    or not exists (select 1 from pg_constraint
      where conrelid='public.custom_nine_issued_challenges'::regclass
        and conname='custom_nine_issued_challenges_creator_account_id_fkey'
        and convalidated)
    or not exists (select 1 from pg_trigger
      where tgrelid='public.custom_nine_attempt_states'::regclass
        and tgname='custom_creator_seen_monotonic' and tgenabled='O')
  then raise exception 'Creator schema, constraint, or trigger missing'; end if;

  -- RLS-without-policy is deliberate: all Custom data is private to service_role.
  if (select count(*) from pg_class where oid in (
      'public.custom_nine_issued_challenges'::regclass,
      'public.custom_nine_attempt_states'::regclass,
      'public.custom_nine_completed_results'::regclass,
      'public.custom_nine_at_bat_results'::regclass
    ) and relrowsecurity) <> 4
    or exists (select 1 from pg_policy where polrelid in (
      'public.custom_nine_issued_challenges'::regclass,
      'public.custom_nine_attempt_states'::regclass,
      'public.custom_nine_completed_results'::regclass,
      'public.custom_nine_at_bat_results'::regclass))
  then raise exception 'Private Custom RLS unexpectedly disabled or policy widened'; end if;

  -- SECURITY INVOKER admission needs table grants, not merely RPC EXECUTE.
  if not has_table_privilege('service_role','public.custom_nine_issued_challenges','SELECT')
    or not has_table_privilege('service_role','public.custom_nine_attempt_states','SELECT')
    or not has_table_privilege('service_role','public.custom_nine_completed_results','SELECT')
    or not has_table_privilege('service_role','public.custom_nine_completed_results','INSERT')
    or not has_table_privilege('service_role','public.custom_nine_at_bat_results','SELECT')
    or not has_table_privilege('service_role','public.custom_nine_at_bat_results','INSERT')
  then raise exception 'Service-role admission table grant missing'; end if;

  if has_table_privilege('anon','public.custom_nine_issued_challenges','SELECT')
    or has_table_privilege('authenticated','public.custom_nine_issued_challenges','SELECT')
    or has_table_privilege('anon','public.custom_nine_attempt_states','UPDATE')
    or has_table_privilege('authenticated','public.custom_nine_attempt_states','UPDATE')
    or has_function_privilege('anon',
      'public.admit_custom_lineup_v2_completed_attempt(text,text,jsonb,numeric[])','EXECUTE')
    or has_function_privilege('authenticated',
      'public.admit_custom_lineup_v2_completed_attempt(text,text,jsonb,numeric[])','EXECUTE')
    or has_function_privilege('anon','public.guard_custom_creator_seen()','EXECUTE')
    or has_function_privilege('authenticated','public.guard_custom_creator_seen()','EXECUTE')
    or not has_function_privilege('service_role',
      'public.admit_custom_lineup_v2_completed_attempt(text,text,jsonb,numeric[])','EXECUTE')
  then raise exception 'Private Custom grants widened or service grant missing'; end if;

  v_clues := jsonb_build_object(
    'schemaVersion',1,
    'hintLayout',jsonb_build_array(
      jsonb_build_object('slot',1,'hintType','main_decade','displayLabel','Decade'),
      jsonb_build_object('slot',2,'hintType','teams','displayLabel','Teams'),
      jsonb_build_object('slot',3,'hintType','position','displayLabel','Position'),
      jsonb_build_object('slot',4,'hintType','stats','displayLabel','Stats')),
    'pitches',jsonb_build_array(jsonb_build_object(
      'pitchNumber',1,'canonicalPlayerId','fixture-player-1',
      'initials','FP','hintValues',jsonb_build_array('2000s','Mets','SS','HR 123'))));
  v_facts := jsonb_build_array(jsonb_build_object(
    'pitchNumber',1,'initials','FP','outcome','HR',
    'hintsRevealed',0,'wrongGuesses',0,'resolution','correct'));
  v_summary := jsonb_build_object(
    'points',4,'maximumPoints',4,'atBatsCompleted',1,
    'totalAtBats',1,'completed',true,'strikeouts',0);

  insert into public.custom_nine_issued_challenges(
    puzzle_id,schema_version,ruleset_version,canonical_player_ids,
    clue_snapshot,issued_at,display_title,owner_capability_digest)
  values (v_id,2,'points-v4',jsonb_build_array('fixture-player-1'),
          v_clues,now(),'Creator QA Regression',repeat('c',64));

  -- Historical owner capabilities must never coexist with verified UUID ownership.
  v_rejected := false;
  begin
    update public.custom_nine_issued_challenges
      set creator_account_id=v_missing_auth where puzzle_id=v_id;
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Dual owner modes accepted'; end if;

  -- No claimed Auth UUID may be stored without an actual auth.users parent.
  update public.custom_nine_issued_challenges
    set owner_capability_digest=null where puzzle_id=v_id;
  v_rejected := false;
  begin
    update public.custom_nine_issued_challenges
      set creator_account_id=v_missing_auth where puzzle_id=v_id;
  exception when foreign_key_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Missing Auth owner accepted'; end if;
  update public.custom_nine_issued_challenges
    set owner_capability_digest=repeat('c',64) where puzzle_id=v_id;

  insert into public.custom_nine_attempt_states(
    challenge_id,browser_key_digest,attempt_id,revision,
    current_progression_token,terminal_at_bats,status,completed_at)
  values
    (v_id,v_creator_digest,v_creator_attempt,1,'creator-token',v_facts,'completed',now()),
    (v_id,v_friend_digest,v_friend_attempt,1,'friend-token',v_facts,'completed',now());

  if (select count(*) from public.custom_nine_attempt_states
      where challenge_id=v_id and not creator_seen) <> 2
  then raise exception 'Creator marker default is not false'; end if;

  update public.custom_nine_attempt_states
    set creator_seen=true
    where challenge_id=v_id and browser_key_digest=v_creator_digest;

  -- The same row lock used for admission must reject recognized creator play.
  v_rejected := false;
  begin
    perform * from public.admit_custom_lineup_v2_completed_attempt(
      v_id,v_creator_digest,v_summary,array[4::numeric]);
  exception when invalid_parameter_value then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Creator attempt admitted'; end if;

  v_rejected := false;
  begin
    update public.custom_nine_attempt_states
      set creator_seen=false
      where challenge_id=v_id and browser_key_digest=v_creator_digest;
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Sticky creator status cleared'; end if;

  update public.custom_nine_attempt_states
    set revision=revision+1
    where challenge_id=v_id and browser_key_digest=v_creator_digest;
  if not (select creator_seen from public.custom_nine_attempt_states
      where challenge_id=v_id and browser_key_digest=v_creator_digest)
  then raise exception 'Creator exclusion lost during unrelated update'; end if;

  select * into v_out from public.admit_custom_lineup_v2_completed_attempt(
    v_id,v_friend_digest,v_summary,array[4::numeric]);
  if v_out.submission_id is distinct from v_friend_attempt::text
    or v_out.created is distinct from true
  then raise exception 'Independent guest completion rejected'; end if;

  select * into v_out from public.admit_custom_lineup_v2_completed_attempt(
    v_id,v_friend_digest,v_summary,array[4::numeric]);
  if v_out.created is distinct from false
  then raise exception 'Identical guest retry created duplicate'; end if;

  -- Creator recognized after a valid completion may not replay competitively.
  update public.custom_nine_attempt_states
    set creator_seen=true
    where challenge_id=v_id and browser_key_digest=v_friend_digest;
  v_rejected := false;
  begin
    perform * from public.admit_custom_lineup_v2_completed_attempt(
      v_id,v_friend_digest,v_summary,array[4::numeric]);
  exception when invalid_parameter_value then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Previously admitted creator retry accepted'; end if;

  -- A post-admission creator mark may prevent replay, but must not rewrite
  -- the already-stored guest summary, facts, or awarded score.
  if not exists (select 1 from public.custom_nine_completed_results r
      where r.submission_id=v_friend_attempt::text and r.challenge_id=v_id
        and r.summary=v_summary and r.completed_at_bats=v_facts)
    or not exists (select 1 from public.custom_nine_at_bat_results r
      where r.attempt_id=v_friend_attempt::text and r.challenge_id=v_id
        and r.pitch_number=1 and r.awarded_points=4
        and r.initials='FP' and r.outcome='HR' and r.hints_revealed=0
        and r.wrong_guesses=0 and r.resolution='correct')
  then raise exception 'Stored guest result was rewritten'; end if;

  -- Force an INSERT failure on batter two, after completed-result admission has
  -- begun. The first batter/result must not escape the failed function call.
  v_failure_clues := jsonb_set(v_clues,'{pitches}',jsonb_build_array(
    v_clues #> '{pitches,0}',
    jsonb_build_object('pitchNumber',2,'canonicalPlayerId','fixture-player-2',
      'initials','F2','hintValues',jsonb_build_array('2000s','Mets','SS','HR 222'))));
  v_failure_facts := jsonb_build_array(
    v_facts -> 0,
    jsonb_build_object('pitchNumber',2,'initials','F2','outcome','HR',
      'hintsRevealed',0,'wrongGuesses',4,'resolution','correct'));
  v_failure_summary := jsonb_build_object(
    'points',8,'maximumPoints',8,'atBatsCompleted',2,
    'totalAtBats',2,'completed',true,'strikeouts',0);
  insert into public.custom_nine_issued_challenges(
    puzzle_id,schema_version,ruleset_version,canonical_player_ids,
    clue_snapshot,issued_at,display_title)
  values (v_failure_id,2,'points-v4',
    jsonb_build_array('fixture-player-1','fixture-player-2'),
    v_failure_clues,now(),'Atomic Failure QA');
  insert into public.custom_nine_attempt_states(
    challenge_id,browser_key_digest,attempt_id,revision,
    current_progression_token,terminal_at_bats,status,completed_at)
  values (v_failure_id,v_failure_digest,v_failure_attempt,2,
    'failure-token',v_failure_facts,'completed',now());
  v_rejected := false;
  begin
    perform * from public.admit_custom_lineup_v2_completed_attempt(
      v_failure_id,v_failure_digest,v_failure_summary,array[4::numeric,4::numeric]);
  exception when check_violation then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Invalid batter two unexpectedly admitted'; end if;
  if exists (select 1 from public.custom_nine_completed_results
      where challenge_id=v_failure_id)
    or exists (select 1 from public.custom_nine_at_bat_results
      where challenge_id=v_failure_id)
  then raise exception 'Partial result survived failed batter insertion'; end if;

  if (select count(*) from public.custom_nine_issued_challenges) <> v_issued_count+2
    or (select count(*) from public.custom_nine_attempt_states) <> v_attempt_count+3
    or (select count(*) from public.custom_nine_completed_results) <> v_result_count+1
    or (select count(*) from public.custom_nine_at_bat_results) <> v_at_bat_count+1
    or (select count(*) from public.custom_nine_completed_results
        where challenge_id=v_id) <> 1
    or (select count(*) from public.custom_nine_at_bat_results
        where challenge_id=v_id) <> 1
  then raise exception 'Creator/guest atomic result populations changed'; end if;
end;
$test$;
rollback;
