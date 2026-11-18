-- Source-only atomic result admission for completed secondary official Daily attempts.
-- Call only after server-side HMAC, canonical puzzle and engine-score validation.
-- This RPC does not authenticate its JSON inputs and MUST NOT be exposed publicly.
CREATE FUNCTION public.commit_official_daily_completed_results(
  p_puzzle_id text, p_browser_key_digest text, p_attempt_id uuid,
  p_expected_token text, p_at_bat_rows jsonb, p_completion_row jsonb
)
RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = ''
AS $fn$
DECLARE
  v_attempt public.official_daily_attempt_states%ROWTYPE;
  v_pub public.official_daily_publications%ROWTYPE;
  v_row jsonb;
  v_existing jsonb;
  v_completion_id text;
  v_inserted integer := 0;
  v_total_inserted integer := 0;
  v_slot integer;
BEGIN
  IF p_expected_token IS NULL OR p_at_bat_rows IS NULL
     OR jsonb_typeof(p_at_bat_rows) <> 'array'
     OR jsonb_array_length(p_at_bat_rows) <> 9
     OR p_completion_row IS NULL OR jsonb_typeof(p_completion_row) <> 'object'
  THEN
    RAISE EXCEPTION 'Invalid official Daily completion envelope.' USING errcode='22023';
  END IF;
  -- Lock the canonical attempt first. Concurrent identical commits serialize;
  -- conflicting scorecards never overwrite the first accepted result.
  SELECT * INTO v_attempt FROM public.official_daily_attempt_states
    WHERE puzzle_id=p_puzzle_id AND browser_key_digest=p_browser_key_digest
      AND attempt_id=p_attempt_id FOR UPDATE;
  IF NOT FOUND OR v_attempt.status <> 'completed'
     OR v_attempt.current_progression_token IS DISTINCT FROM p_expected_token
  THEN
    RAISE EXCEPTION 'Official Daily completion is not canonical.' USING errcode='22023';
  END IF;
  SELECT * INTO v_pub FROM public.official_daily_publications
    WHERE puzzle_id=p_puzzle_id;
  IF NOT FOUND OR v_pub.ruleset_version <> 'points-v4' THEN
    RAISE EXCEPTION 'Unknown official Daily result edition.' USING errcode='22023';
  END IF;
  v_completion_id := 'official-' || p_puzzle_id || '-' || p_attempt_id::text;
  IF p_completion_row->>'submission_id' IS DISTINCT FROM v_completion_id
     OR p_completion_row->>'puzzle_id' IS DISTINCT FROM p_puzzle_id
     OR p_completion_row->>'puzzle_date' IS DISTINCT FROM v_pub.puzzle_date::text
     OR p_completion_row->>'puzzle_number' IS DISTINCT FROM v_pub.puzzle_number::text
     OR p_completion_row->>'ruleset_version' IS DISTINCT FROM 'points-v4'
     OR p_completion_row->>'schema_version' IS DISTINCT FROM '1'
     OR p_completion_row->'completed_at_bats' IS DISTINCT FROM v_attempt.terminal_at_bats
     OR jsonb_typeof(p_completion_row->'summary') <> 'object'
  THEN
    RAISE EXCEPTION 'Official Daily completion identity mismatch.' USING errcode='22023';
  END IF;
  FOR v_slot IN 1..9 LOOP
    v_row := p_at_bat_rows->(v_slot-1);
    IF jsonb_typeof(v_row) <> 'object'
       OR v_row->>'attempt_id' IS DISTINCT FROM p_attempt_id::text
       OR v_row->>'schema_version' IS DISTINCT FROM '1'
       OR v_row->>'puzzle_id' IS DISTINCT FROM p_puzzle_id
       OR v_row->>'puzzle_date' IS DISTINCT FROM v_pub.puzzle_date::text
       OR v_row->>'puzzle_number' IS DISTINCT FROM v_pub.puzzle_number::text
       OR v_row->>'ruleset_version' IS DISTINCT FROM 'points-v4'
       OR v_row->>'pitch_number' IS DISTINCT FROM v_slot::text
       OR (v_attempt.terminal_at_bats->(v_slot-1)->>'pitchNumber') IS DISTINCT FROM v_slot::text
       OR (v_row->'initials') IS DISTINCT FROM
          (v_attempt.terminal_at_bats->(v_slot-1)->'initials')
       OR (v_row->'outcome') IS DISTINCT FROM
          (v_attempt.terminal_at_bats->(v_slot-1)->'outcome')
       OR (v_row->'hints_revealed') IS DISTINCT FROM
          (v_attempt.terminal_at_bats->(v_slot-1)->'hintsRevealed')
       OR (v_row->'wrong_guesses') IS DISTINCT FROM
          (v_attempt.terminal_at_bats->(v_slot-1)->'wrongGuesses')
       OR (v_row->'resolution') IS DISTINCT FROM
          (v_attempt.terminal_at_bats->(v_slot-1)->'resolution')
    THEN
      RAISE EXCEPTION 'Official Daily terminal fact mismatch.' USING errcode='22023';
    END IF;
    INSERT INTO public.daily_at_bat_results (
      attempt_id,schema_version,puzzle_id,puzzle_date,puzzle_number,
      ruleset_version,pitch_number,initials,outcome,hints_revealed,
      wrong_guesses,resolution,awarded_points
    ) VALUES (
      v_row->>'attempt_id',(v_row->>'schema_version')::smallint,
      v_row->>'puzzle_id',(v_row->>'puzzle_date')::date,
      (v_row->>'puzzle_number')::integer,v_row->>'ruleset_version',
      (v_row->>'pitch_number')::smallint,v_row->>'initials',v_row->>'outcome',
      (v_row->>'hints_revealed')::smallint,(v_row->>'wrong_guesses')::smallint,
      v_row->>'resolution',(v_row->>'awarded_points')::numeric(4,1)
    ) ON CONFLICT ON CONSTRAINT daily_at_bat_results_pkey DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_total_inserted := v_total_inserted + v_inserted;
    SELECT jsonb_build_object(
      'attempt_id',attempt_id,'schema_version',schema_version,
      'puzzle_id',puzzle_id,'puzzle_date',puzzle_date,
      'puzzle_number',puzzle_number,'ruleset_version',ruleset_version,
      'pitch_number',pitch_number,'initials',initials,'outcome',outcome,
      'hints_revealed',hints_revealed,'wrong_guesses',wrong_guesses,
      'resolution',resolution,'awarded_points',awarded_points
    ) INTO v_existing FROM public.daily_at_bat_results
      WHERE attempt_id=p_attempt_id::text AND puzzle_id=p_puzzle_id
        AND ruleset_version='points-v4' AND pitch_number=v_slot;
    IF v_existing IS DISTINCT FROM v_row THEN
      RAISE EXCEPTION 'Conflicting official Daily at-bat result.' USING errcode='23505';
    END IF;
  END LOOP;
  INSERT INTO public.daily_completed_results (
    submission_id,schema_version,puzzle_id,puzzle_date,puzzle_number,
    ruleset_version,completed_at_bats,summary
  ) VALUES (
    v_completion_id,1,p_puzzle_id,v_pub.puzzle_date,v_pub.puzzle_number,
    'points-v4',v_attempt.terminal_at_bats,p_completion_row->'summary'
  ) ON CONFLICT ON CONSTRAINT daily_completed_results_pkey DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  v_total_inserted := v_total_inserted + v_inserted;
  SELECT jsonb_build_object(
    'submission_id',submission_id,'schema_version',schema_version,
    'puzzle_id',puzzle_id,'puzzle_date',puzzle_date,
    'puzzle_number',puzzle_number,'ruleset_version',ruleset_version,
    'completed_at_bats',completed_at_bats,'summary',summary
  ) INTO v_existing FROM public.daily_completed_results
    WHERE submission_id=v_completion_id;
  IF v_existing IS DISTINCT FROM p_completion_row THEN
    RAISE EXCEPTION 'Conflicting official Daily completion result.' USING errcode='23505';
  END IF;
  RETURN CASE WHEN v_total_inserted=0 THEN 'existing' ELSE 'created' END;
END;
$fn$;
REVOKE ALL ON FUNCTION public.commit_official_daily_completed_results(
  text,text,uuid,text,jsonb,jsonb
) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.commit_official_daily_completed_results(
  text,text,uuid,text,jsonb,jsonb
) TO service_role;
COMMENT ON FUNCTION public.commit_official_daily_completed_results(
  text,text,uuid,text,jsonb,jsonb
) IS 'Private atomic nine-at-bat plus completion commit. Caller must validate HMAC, edition and engine-derived points; no public ingress.';
