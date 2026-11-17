-- Run on isolated QA after applying the candidate migration. ROLLBACK cleans fixtures.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='20s';
DO $permissions$
BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class
         WHERE oid='public.official_daily_attempt_states'::regclass)
    OR has_table_privilege('anon','public.official_daily_attempt_states','SELECT')
    OR has_table_privilege('authenticated','public.official_daily_attempt_states','INSERT')
    OR has_function_privilege('anon','public.reserve_official_daily_attempt(text,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.reserve_official_daily_attempt(text,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.reserve_official_daily_attempt(text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Daily first-start authority grants unsafe'; END IF;
END;
$permissions$;
SET LOCAL ROLE service_role;
DO $checks$
DECLARE
  v_day date := (clock_timestamp() AT TIME ZONE 'America/Los_Angeles')::date;
  v_a text := 'daily-ed-v1-' || gen_random_uuid()::text;
  v_b text := 'daily-ed-v1-' || gen_random_uuid()::text;
  v_yesterday text := 'daily-ed-v1-' || gen_random_uuid()::text;
  v_tomorrow text := 'daily-ed-v1-' || gen_random_uuid()::text;
  v_digest text := repeat('a',64);
  v_a_attempt uuid;
  v_repeat uuid;
  v_other uuid;
  v_snapshot jsonb;
  v_blocked boolean;
BEGIN
  v_snapshot := jsonb_build_object('schemaVersion',1,
    'hintLayout',jsonb_build_array(1,2,3,4),
    'pitches',(SELECT jsonb_agg(jsonb_build_object('pitchNumber',n) ORDER BY n)
               FROM generate_series(1,9) n));
  -- Both same-day editions deliberately have identical rosters and clues.
  INSERT INTO public.official_daily_publications
    (puzzle_id,puzzle_date,puzzle_number,edition_key,edition_number,title,
     schema_version,ruleset_version,clue_snapshot)
  VALUES
    (v_a,v_day,12345,'qa-first',2100,'QA First',1,'points-v4',v_snapshot),
    (v_b,v_day,12345,'qa-second',2101,'QA Second',1,'points-v4',v_snapshot),
    (v_yesterday,v_day-1,12344,'qa-old',2102,'QA Old',1,'points-v4',v_snapshot),
    (v_tomorrow,v_day+1,12346,'qa-next',2103,'QA Next',1,'points-v4',v_snapshot);
  SELECT r.attempt_id INTO v_a_attempt
    FROM public.reserve_official_daily_attempt(v_a,v_digest) r;
  SELECT r.attempt_id INTO v_repeat
    FROM public.reserve_official_daily_attempt(v_a,v_digest) r;
  SELECT r.attempt_id INTO v_other
    FROM public.reserve_official_daily_attempt(v_b,v_digest) r;
  IF v_a_attempt IS NULL OR v_a_attempt <> v_repeat OR v_a_attempt=v_other THEN
    RAISE EXCEPTION 'First-start retry/sibling identity failed';
  END IF;
  SELECT r.attempt_id INTO v_other
    FROM public.reserve_official_daily_attempt(v_a,repeat('b',64)) r;
  IF v_other=v_a_attempt OR
     (SELECT count(*) FROM public.official_daily_attempt_states
      WHERE puzzle_id=v_a) <> 2 THEN
    RAISE EXCEPTION 'Browser digest uniqueness failed';
  END IF;
  v_blocked:=false;
  BEGIN
    PERFORM * FROM public.reserve_official_daily_attempt(v_yesterday,v_digest);
  EXCEPTION WHEN invalid_parameter_value THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'New archive start accepted'; END IF;
  v_blocked:=false;
  BEGIN
    PERFORM * FROM public.reserve_official_daily_attempt(v_tomorrow,v_digest);
  EXCEPTION WHEN invalid_parameter_value THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Future edition start accepted'; END IF;
  v_blocked:=false;
  BEGIN
    PERFORM * FROM public.reserve_official_daily_attempt(v_a,'bad');
  EXCEPTION WHEN invalid_parameter_value THEN v_blocked:=true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'Invalid digest accepted'; END IF;
  -- An existing old winner is eligible for readback; new old rows are not.
  INSERT INTO public.official_daily_attempt_states(puzzle_id,browser_key_digest)
    VALUES(v_yesterday,v_digest);
  SELECT r.attempt_id INTO v_other
    FROM public.reserve_official_daily_attempt(v_yesterday,v_digest) r;
  IF v_other IS NULL THEN RAISE EXCEPTION 'Existing old attempt lost'; END IF;
END;
$checks$;
ROLLBACK;
