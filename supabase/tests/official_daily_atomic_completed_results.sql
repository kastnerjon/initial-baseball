-- Run after installing the candidate migrations in an isolated QA transaction.
-- Never run this fixture against production. Outer transaction must ROLLBACK.
-- Expects publication table and the private attempt/result schemas.
INSERT INTO public.official_daily_publications
(puzzle_id,puzzle_date,puzzle_number,edition_key,edition_number,title,schema_version,ruleset_version,clue_snapshot)
VALUES ('daily-ed-v1-11111111-1111-4111-8111-111111111111','2026-11-18',1,'qa',1,'QA edition',1,'points-v4',
jsonb_build_object('schemaVersion',1,'hintLayout',jsonb_build_array(1,2,3,4),'pitches',jsonb_build_array(1,2,3,4,5,6,7,8,9)));
INSERT INTO public.official_daily_attempt_states
(puzzle_id,browser_key_digest,attempt_id,revision,current_progression_token,terminal_at_bats,status,completed_at)
VALUES ('daily-ed-v1-11111111-1111-4111-8111-111111111111',repeat('a',64),
'22222222-2222-4222-8222-222222222222',8,'official-daily-competitive-proof-v1.previous',
(SELECT jsonb_agg(jsonb_build_object('pitchNumber',n,'initials','AB','outcome','K',
'hintsRevealed',4,'wrongGuesses',3,'resolution','strikeout') ORDER BY n)
FROM generate_series(1,8) n),'active',NULL);

DO $test$
DECLARE v_rows jsonb; v_completion jsonb; v_facts jsonb; v_result text;
BEGIN
SELECT jsonb_agg(jsonb_build_object('pitchNumber',n,'initials','AB','outcome','K','hintsRevealed',4,'wrongGuesses',3,'resolution','strikeout') ORDER BY n) INTO v_facts FROM generate_series(1,9) n;
SELECT jsonb_agg(jsonb_build_object(
'attempt_id','22222222-2222-4222-8222-222222222222','schema_version',1,
'puzzle_id','daily-ed-v1-11111111-1111-4111-8111-111111111111',
'puzzle_date','2026-11-18','puzzle_number',1,'ruleset_version','points-v4',
'pitch_number',n,'initials','AB','outcome','K','hints_revealed',4,
'wrong_guesses',3,'resolution','strikeout','awarded_points',0.5) ORDER BY n)
INTO v_rows FROM generate_series(1,9) n;
v_completion := jsonb_build_object(
'submission_id','official-daily-ed-v1-11111111-1111-4111-8111-111111111111-22222222-2222-4222-8222-222222222222',
'schema_version',1,'puzzle_id','daily-ed-v1-11111111-1111-4111-8111-111111111111',
'puzzle_date','2026-11-18','puzzle_number',1,'ruleset_version','points-v4',
'completed_at_bats',v_facts,'summary',jsonb_build_object('points',4.5));
v_result := public.advance_and_commit_official_daily_completed_results(
'daily-ed-v1-11111111-1111-4111-8111-111111111111',repeat('a',64),
'22222222-2222-4222-8222-222222222222',
'official-daily-competitive-proof-v1.previous','official-daily-competitive-proof-v1.qa',v_facts,v_rows,v_completion);
IF v_result <> 'created' THEN RAISE EXCEPTION 'First commit must create'; END IF;
v_result := public.advance_and_commit_official_daily_completed_results(
'daily-ed-v1-11111111-1111-4111-8111-111111111111',repeat('a',64),
'22222222-2222-4222-8222-222222222222',
'official-daily-competitive-proof-v1.previous','official-daily-competitive-proof-v1.qa',v_facts,v_rows,v_completion);
IF v_result <> 'existing' THEN RAISE EXCEPTION 'Retry must be idempotent'; END IF;
IF (SELECT count(*) FROM public.daily_at_bat_results WHERE awarded_points=0.5) <> 9
OR (SELECT count(*) FROM public.daily_completed_results) <> 1
THEN RAISE EXCEPTION 'Atomic rows or fractional points lost'; END IF;
BEGIN
PERFORM public.advance_and_commit_official_daily_completed_results(
'daily-ed-v1-11111111-1111-4111-8111-111111111111',repeat('a',64),
'22222222-2222-4222-8222-222222222222','wrong','official-daily-competitive-proof-v1.qa',v_facts,v_rows,v_completion);
RAISE EXCEPTION 'Wrong token was accepted';
EXCEPTION WHEN sqlstate '22023' THEN NULL; END;
BEGIN
PERFORM public.advance_and_commit_official_daily_completed_results(
'daily-ed-v1-11111111-1111-4111-8111-111111111111',repeat('a',64),
'22222222-2222-4222-8222-222222222222',
'official-daily-competitive-proof-v1.previous','official-daily-competitive-proof-v1.qa',v_facts,
jsonb_set(v_rows,'{0,awarded_points}','1'::jsonb),v_completion);
RAISE EXCEPTION 'Conflicting score was accepted';
EXCEPTION WHEN sqlstate '23505' THEN NULL; END;
END $test$;
