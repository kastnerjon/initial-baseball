-- Isolated QA only, after first-start and this candidate migration.
-- Test fixtures and attempt mutations are rollback-only.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='20s';
DO $permissions$
BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.official_daily_attempt_states'::regclass)
    OR has_function_privilege('anon','public.initialize_official_daily_progression(text,text,uuid,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.advance_official_daily_progression(text,text,uuid,text,text,jsonb,boolean)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.initialize_official_daily_progression(text,text,uuid,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.advance_official_daily_progression(text,text,uuid,text,text,jsonb,boolean)','EXECUTE')
 THEN RAISE EXCEPTION 'Progression CAS grants unsafe'; END IF;
END;
$permissions$;
SET LOCAL ROLE service_role;
DO $checks$
DECLARE
  v_day date := (clock_timestamp() AT TIME ZONE 'America/Los_Angeles')::date;
  v_id text := 'daily-ed-v1-' || gen_random_uuid()::text;
  v_sibling text := 'daily-ed-v1-' || gen_random_uuid()::text;
  v_digest text := repeat('a',64);
  v_attempt uuid;
  v_other uuid;
  v_a text := 'official-daily-competitive-proof-v1.first.sig';
  v_b text := 'official-daily-competitive-proof-v1.second.sig';
  v_c text := 'official-daily-competitive-proof-v1.fork.sig';
  v_snapshot jsonb;
  v_outcome text;
  v_revision bigint;
  v_fact jsonb := '[{"pitchNumber":1,"initials":"HP","outcome":"K","hintsRevealed":1,"wrongGuesses":0,"resolution":"give_up"}]'::jsonb;
  v_full jsonb;
  v_current text;
  v_next text;
  v_final text;
  v_previous text;
  v_index integer;
  v_status text;
  v_bad boolean;
BEGIN
 v_snapshot:=jsonb_build_object('schemaVersion',1,'hintLayout',jsonb_build_array(1,2,3,4),
   'pitches',(SELECT jsonb_agg(jsonb_build_object('pitchNumber',n) ORDER BY n)
                FROM generate_series(1,9) n));
 INSERT INTO public.official_daily_publications
   (puzzle_id,puzzle_date,puzzle_number,edition_key,edition_number,title,
    schema_version,ruleset_version,clue_snapshot)
 VALUES (v_id,v_day,12345,'qa-cas-a',3001,'QA CAS A',1,'points-v4',v_snapshot),
        (v_sibling,v_day,12345,'qa-cas-b',3002,'QA CAS B',1,'points-v4',v_snapshot);
 SELECT attempt_id INTO v_attempt FROM public.reserve_official_daily_attempt(v_id,v_digest);
 SELECT attempt_id INTO v_other FROM public.reserve_official_daily_attempt(v_sibling,v_digest);
 SELECT outcome INTO v_outcome FROM public.initialize_official_daily_progression(v_id,v_digest,v_attempt,v_a);
 IF v_outcome<>'initialized' THEN RAISE EXCEPTION 'Initialize failed'; END IF;
 SELECT outcome INTO v_outcome FROM public.initialize_official_daily_progression(v_id,v_digest,v_attempt,v_c);
 IF v_outcome<>'existing' THEN RAISE EXCEPTION 'Bootstrap retry overwrote origin'; END IF;
 SELECT outcome,revision INTO v_outcome,v_revision
   FROM public.advance_official_daily_progression(v_id,v_digest,v_attempt,v_a,v_b,v_fact,false);
 IF v_outcome<>'advanced' OR v_revision<>1 THEN RAISE EXCEPTION 'CAS first advance failed'; END IF;
 SELECT outcome,revision INTO v_outcome,v_revision
   FROM public.advance_official_daily_progression(v_id,v_digest,v_attempt,v_a,v_b,v_fact,false);
 IF v_outcome<>'existing' OR v_revision<>1 THEN RAISE EXCEPTION 'Lost-response retry advanced twice'; END IF;
 SELECT outcome INTO v_outcome
   FROM public.advance_official_daily_progression(v_id,v_digest,v_attempt,v_a,v_c,v_fact,false);
 IF v_outcome<>'conflict' THEN RAISE EXCEPTION 'Conflicting fork accepted'; END IF;
 v_bad:=false;
 BEGIN
   PERFORM * FROM public.advance_official_daily_progression(
     v_id,v_digest,v_attempt,v_b,v_c,'[{"pitchNumber":2}]'::jsonb,false);
 EXCEPTION WHEN invalid_parameter_value THEN v_bad:=true; END;
 IF NOT v_bad THEN RAISE EXCEPTION 'Changed terminal prefix accepted'; END IF;
 v_bad:=false;
 BEGIN
   PERFORM * FROM public.advance_official_daily_progression(
     v_id,repeat('b',64),v_attempt,v_b,v_c,v_fact,false);
 EXCEPTION WHEN invalid_parameter_value THEN v_bad:=true; END;
 IF NOT v_bad THEN RAISE EXCEPTION 'Wrong browser key gained authority'; END IF;
 IF (SELECT current_progression_token FROM public.official_daily_attempt_states
     WHERE puzzle_id=v_sibling AND browser_key_digest=v_digest) IS NOT NULL THEN
   RAISE EXCEPTION 'Identical-roster sibling state contaminated'; END IF;
 IF (SELECT revision FROM public.official_daily_attempt_states
     WHERE puzzle_id=v_id AND browser_key_digest=v_digest)<>1 THEN
   RAISE EXCEPTION 'Revision drift'; END IF;
 -- Advance exactly one ordered terminal fact at a time, then make the ninth terminal.
 v_current:=v_b;
 FOR v_index IN 2..9 LOOP
   v_next:='official-daily-competitive-proof-v1.step' || v_index::text || '.sig';
   SELECT jsonb_agg(jsonb_build_object('pitchNumber',n,'initials','HP',
            'outcome','K','hintsRevealed',1,'wrongGuesses',0,'resolution','give_up')
            ORDER BY n) INTO v_full FROM generate_series(1,v_index) n;
   SELECT outcome,status INTO v_outcome,v_status
     FROM public.advance_official_daily_progression(
       v_id,v_digest,v_attempt,v_current,v_next,v_full,v_index=9);
   IF v_outcome<>'advanced'
     OR v_status <> CASE WHEN v_index=9 THEN 'completed' ELSE 'active' END
   THEN RAISE EXCEPTION 'Ordered terminal CAS failed on step %',v_index; END IF;
   v_previous:=v_current;
   v_current:=v_next;
 END LOOP;
 SELECT outcome,revision INTO v_outcome,v_revision
   FROM public.advance_official_daily_progression(
     v_id,v_digest,v_attempt,v_previous,v_current,v_full,true);
 IF v_outcome<>'existing' OR v_revision<>9 THEN
    RAISE EXCEPTION 'Final terminal retry duplicated game'; END IF;
 SELECT outcome INTO v_outcome
   FROM public.advance_official_daily_progression(
     v_id,v_digest,v_attempt,v_current,v_c,v_full,true);
 IF v_outcome<>'conflict' THEN
    RAISE EXCEPTION 'Completed attempt admitted another transition'; END IF;
END;
$checks$;
ROLLBACK;
