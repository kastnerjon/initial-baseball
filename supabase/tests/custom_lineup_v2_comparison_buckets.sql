-- Run ONLY as one transaction after the new migration is hosted. No fixtures persist.
begin;
do $check$
declare
 n integer; i integer; challenge text; attempt uuid; other uuid; legacy text;
 one_five text; five_first text; five_second text;
 ids jsonb; pitches jsonb; snapshot jsonb; facts jsonb; other_facts jsonb;
 bucket jsonb; baseline bigint[];
begin
 baseline := array[
   (select count(*) from public.custom_nine_issued_challenges),
   (select count(*) from public.custom_nine_attempt_states),
   (select count(*) from public.custom_nine_completed_results),
   (select count(*) from public.custom_nine_at_bat_results)
 ];
 for n in select unnest(array[1,2,3,4,5,6,7,8,9,10]) loop
   challenge := 'custom-lineup-v2-' || gen_random_uuid()::text;
   attempt := gen_random_uuid();
   select jsonb_agg('player-'||s order by s) into ids from generate_series(1,n) s;
   select jsonb_agg(jsonb_build_object('pitchNumber',s,'canonicalPlayerId','player-'||s,
      'initials','P'||s,'hintValues',jsonb_build_array('2000s','Mets','SS','HR 123')) order by s)
     into pitches from generate_series(1,n) s;
   snapshot := jsonb_build_object('schemaVersion',1,'hintLayout',jsonb_build_array(
     jsonb_build_object('slot',1,'hintType','main_decade','displayLabel','Decade'),
     jsonb_build_object('slot',2,'hintType','teams','displayLabel','Teams'),
     jsonb_build_object('slot',3,'hintType','position','displayLabel','Position'),
     jsonb_build_object('slot',4,'hintType','stats','displayLabel','Stats')),
     'pitches',pitches);
   select jsonb_agg(jsonb_build_object('pitchNumber',s,'initials','P'||s,
     'outcome','HR','hintsRevealed',0,'wrongGuesses',0,'resolution','correct') order by s)
     into facts from generate_series(1,n) s;
   insert into public.custom_nine_issued_challenges
     (puzzle_id,schema_version,ruleset_version,canonical_player_ids,clue_snapshot,issued_at)
     values (challenge,2,'points-v4',ids,snapshot,now());
   insert into public.custom_nine_attempt_states
     (challenge_id,browser_key_digest,attempt_id,revision,
      current_progression_token,terminal_at_bats,status,completed_at)
     values (challenge,md5(attempt::text)||md5(attempt::text||'-digest'),
       attempt,n,'fixture-token',facts,'completed',now());
   insert into public.custom_nine_completed_results
     (submission_id,challenge_id,schema_version,ruleset_version,completed_at_bats,summary)
     values (attempt::text,challenge,2,'points-v4',facts,jsonb_build_object(
       'points',4*n,'maximumPoints',4*n,'atBatsCompleted',n,
       'totalAtBats',n,'completed',true,'strikeouts',0));
   for i in 1..n loop
     insert into public.custom_nine_at_bat_results
       (attempt_id,challenge_id,schema_version,ruleset_version,pitch_number,initials,
        outcome,hints_revealed,wrong_guesses,resolution,awarded_points)
       values (attempt::text,challenge,2,'points-v4',i,'P'||i,'HR',0,0,'correct',4);
   end loop;
   select coalesce(jsonb_agg(jsonb_build_array(points,result_count)),'[]'::jsonb)
      into bucket from public.custom_lineup_v2_at_bat_score_buckets_v1(challenge,n::smallint,null);
   if bucket <> '[[4,1]]'::jsonb then raise exception 'N=% final-slot bucket: %',n,bucket; end if;
   select coalesce(jsonb_agg(jsonb_build_array(points,result_count)),'[]'::jsonb)
      into bucket from public.custom_lineup_v2_at_bat_score_buckets_v1(challenge,(n+1)::smallint,null);
   if bucket <> '[]'::jsonb then raise exception 'N=% out-of-range pitch: %',n,bucket; end if;
   select coalesce(jsonb_agg(jsonb_build_array(points,result_count)),'[]'::jsonb)
      into bucket from public.custom_lineup_v2_completed_score_buckets_v1(challenge,null);
   if bucket <> jsonb_build_array(jsonb_build_array(4*n,1)) then
     raise exception 'N=% completed bucket: %',n,bucket;
   end if;
   select coalesce(jsonb_agg(jsonb_build_array(points,result_count)),'[]'::jsonb)
      into bucket from public.custom_lineup_v2_completed_score_buckets_v1(challenge,attempt::text);
   if bucket <> '[]'::jsonb then raise exception 'N=% zero-peer exclusion: %',n,bucket; end if;
   if n = 5 then
     one_five := challenge; five_first := attempt::text;
     other := gen_random_uuid(); five_second := other::text;
     select jsonb_agg(jsonb_build_object('pitchNumber',s,'initials','P'||s,
       'outcome','BB','hintsRevealed',4,'wrongGuesses',0,'resolution','correct') order by s)
       into other_facts from generate_series(1,5) s;
     insert into public.custom_nine_attempt_states
       (challenge_id,browser_key_digest,attempt_id,revision,current_progression_token,
        terminal_at_bats,status,completed_at)
       values (challenge,md5(other::text)||md5(other::text||'-digest'),
         other,5,'fixture-token',other_facts,'completed',now());
     insert into public.custom_nine_completed_results
       (submission_id,challenge_id,schema_version,ruleset_version,completed_at_bats,summary)
       values (other::text,challenge,2,'points-v4',other_facts,jsonb_build_object(
         'points',2.5,'maximumPoints',20,'atBatsCompleted',5,
         'totalAtBats',5,'completed',true,'strikeouts',0));
     for i in 1..5 loop
       insert into public.custom_nine_at_bat_results
         (attempt_id,challenge_id,schema_version,ruleset_version,pitch_number,initials,
          outcome,hints_revealed,wrong_guesses,resolution,awarded_points)
         values (other::text,challenge,2,'points-v4',i,'P'||i,'BB',4,0,'correct',0.5);
     end loop;
   end if;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_array(points,result_count) order by points),'[]'::jsonb)
   into bucket from public.custom_lineup_v2_at_bat_score_buckets_v1(one_five,5::smallint,null);
 if bucket <> '[[0.5,1],[4,1]]'::jsonb then raise exception 'Half-point peer AB: %',bucket; end if;
 select coalesce(jsonb_agg(jsonb_build_array(points,result_count) order by points),'[]'::jsonb)
   into bucket from public.custom_lineup_v2_at_bat_score_buckets_v1(one_five,5::smallint,five_first);
 if bucket <> '[[0.5,1]]'::jsonb then raise exception 'AB peer exclusion: %',bucket; end if;
 select coalesce(jsonb_agg(jsonb_build_array(points,result_count) order by points),'[]'::jsonb)
   into bucket from public.custom_lineup_v2_completed_score_buckets_v1(one_five,null);
 if bucket <> '[[2.5,1],[20,1]]'::jsonb then raise exception 'Completed peers: %',bucket; end if;
 select coalesce(jsonb_agg(jsonb_build_array(points,result_count) order by points),'[]'::jsonb)
   into bucket from public.custom_lineup_v2_completed_score_buckets_v1(one_five,five_second);
 if bucket <> '[[20,1]]'::jsonb then raise exception 'Completed one-peer exclusion: %',bucket; end if;

 legacy := 'custom-nine-v1-' || gen_random_uuid()::text;
 select jsonb_agg('legacy-player-'||s order by s) into ids from generate_series(1,9) s;
 select jsonb_agg(jsonb_build_object('pitchNumber',s,'initials','L'||s,
   'hintValues',jsonb_build_array('one','two','three','four')) order by s)
   into pitches from generate_series(1,9) s;
 insert into public.custom_nine_issued_challenges
   (puzzle_id,schema_version,ruleset_version,canonical_player_ids,clue_snapshot,issued_at)
   values (legacy,1,'points-v4',ids,jsonb_build_object('schemaVersion',1,
     'hintLayout',jsonb_build_array('H1','H2','H3','H4'),'pitches',pitches),now());
 insert into public.custom_nine_completed_results
   (submission_id,challenge_id,schema_version,ruleset_version,completed_at_bats,summary)
   values ('v1-fixture',legacy,1,'points-v4','[{}]'::jsonb,'{"points":4}'::jsonb);
 insert into public.custom_nine_at_bat_results
   (attempt_id,challenge_id,schema_version,ruleset_version,pitch_number,initials,
    outcome,hints_revealed,wrong_guesses,resolution,awarded_points)
   values ('v1-fixture',legacy,1,'points-v4',1,'L1','HR',0,0,'correct',4);
 select coalesce(jsonb_agg(jsonb_build_array(points,result_count)),'[]'::jsonb)
   into bucket from public.custom_lineup_v2_completed_score_buckets_v1(legacy,null);
 if bucket <> '[]'::jsonb then raise exception 'Legacy v1 leaked into v2'; end if;
 select coalesce(jsonb_agg(jsonb_build_array(points,result_count)),'[]'::jsonb)
   into bucket from public.custom_nine_completed_score_buckets_v1(one_five,null);
 if bucket <> '[]'::jsonb then raise exception 'V2 leaked into v1'; end if;
 select coalesce(jsonb_agg(jsonb_build_array(points,result_count)),'[]'::jsonb)
   into bucket from public.custom_nine_completed_score_buckets_v1(legacy,null);
 if bucket <> '[[4,1]]'::jsonb then raise exception 'Historical v1 changed'; end if;
 if has_function_privilege('anon','public.custom_lineup_v2_at_bat_score_buckets_v1(text,smallint,text)','execute')
   or has_function_privilege('authenticated','public.custom_lineup_v2_at_bat_score_buckets_v1(text,smallint,text)','execute')
   or has_function_privilege('anon','public.custom_lineup_v2_completed_score_buckets_v1(text,text)','execute')
   or has_function_privilege('authenticated','public.custom_lineup_v2_completed_score_buckets_v1(text,text)','execute')
   or not has_function_privilege('service_role','public.custom_lineup_v2_at_bat_score_buckets_v1(text,smallint,text)','execute')
   or not has_function_privilege('service_role','public.custom_lineup_v2_completed_score_buckets_v1(text,text)','execute') then
     raise exception 'Comparison EXECUTE role isolation failed';
 end if;
 if (select count(*) from public.custom_nine_issued_challenges) <> baseline[1]+11
   or (select count(*) from public.custom_nine_attempt_states) <> baseline[2]+11
   or (select count(*) from public.custom_nine_completed_results) <> baseline[3]+12
   or (select count(*) from public.custom_nine_at_bat_results) <> baseline[4]+61 then
    raise exception 'Fixture population inconsistent';
 end if;
end;
$check$;
rollback;
