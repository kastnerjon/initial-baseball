-- Source-only monotonic progression for one durable secondary official Daily attempt.
-- The service authenticates/signs the token. These functions serialize state; they
-- do NOT prove gameplay, expose a browser endpoint, or admit competitive scores.
CREATE FUNCTION public.initialize_official_daily_progression(
  p_puzzle_id text, p_browser_key_digest text, p_attempt_id uuid,
  p_initial_token text
)
RETURNS TABLE (
  outcome text, attempt_id uuid, puzzle_id text, browser_key_digest text,
  started_at timestamptz, revision bigint, current_progression_token text,
  terminal_at_bats jsonb, status text
)
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = ''
AS $fn$
DECLARE
  v_row public.official_daily_attempt_states%ROWTYPE;
  v_outcome text;
BEGIN
  IF p_initial_token IS NULL
     OR octet_length(p_initial_token) NOT BETWEEN 1 AND 4096
     OR p_initial_token NOT LIKE 'official-daily-competitive-proof-v1.%'
  THEN
    RAISE EXCEPTION 'Invalid initial official Daily progression.' USING errcode='22023';
  END IF;
  SELECT a.* INTO v_row
    FROM public.official_daily_attempt_states a
    WHERE a.puzzle_id=p_puzzle_id AND a.browser_key_digest=p_browser_key_digest
      AND a.attempt_id=p_attempt_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown official Daily progression owner.' USING errcode='22023';
  END IF;
  IF v_row.current_progression_token IS NULL
     AND v_row.revision=0 AND v_row.status='active'
     AND v_row.terminal_at_bats='[]'::jsonb
  THEN
    UPDATE public.official_daily_attempt_states a
      SET current_progression_token=p_initial_token,
          updated_at=greatest(clock_timestamp(),a.started_at)
      WHERE a.puzzle_id=p_puzzle_id AND a.browser_key_digest=p_browser_key_digest
        AND a.attempt_id=p_attempt_id;
    v_outcome:='initialized';
  ELSIF v_row.current_progression_token IS NOT NULL THEN
    v_outcome:='existing';
  ELSE
    RAISE EXCEPTION 'Invalid official Daily initial state.' USING errcode='55000';
  END IF;
  RETURN QUERY SELECT v_outcome,a.attempt_id,a.puzzle_id,a.browser_key_digest,
                      a.started_at,a.revision,a.current_progression_token,
                      a.terminal_at_bats,a.status
    FROM public.official_daily_attempt_states a
    WHERE a.puzzle_id=p_puzzle_id AND a.browser_key_digest=p_browser_key_digest
      AND a.attempt_id=p_attempt_id;
END;
$fn$;

CREATE FUNCTION public.advance_official_daily_progression(
  p_puzzle_id text, p_browser_key_digest text, p_attempt_id uuid,
  p_expected_token text, p_next_token text,
  p_terminal_at_bats jsonb, p_completed boolean
)
RETURNS TABLE (
  outcome text, attempt_id uuid, puzzle_id text, browser_key_digest text,
  started_at timestamptz, revision bigint, current_progression_token text,
  terminal_at_bats jsonb, status text
)
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = ''
AS $fn$
DECLARE
  v_row public.official_daily_attempt_states%ROWTYPE;
  v_outcome text;
  v_new_len integer;
  v_old_len integer;
BEGIN
  IF p_expected_token IS NULL OR p_next_token IS NULL
     OR p_expected_token=p_next_token
     OR octet_length(p_expected_token) NOT BETWEEN 1 AND 4096
     OR octet_length(p_next_token) NOT BETWEEN 1 AND 4096
     OR p_expected_token NOT LIKE 'official-daily-competitive-proof-v1.%'
     OR p_next_token NOT LIKE 'official-daily-competitive-proof-v1.%'
     OR p_completed IS NULL
     OR p_terminal_at_bats IS NULL OR jsonb_typeof(p_terminal_at_bats)<>'array'
  THEN
    RAISE EXCEPTION 'Invalid official Daily progression transition.' USING errcode='22023';
  END IF;
  v_new_len := jsonb_array_length(p_terminal_at_bats);
  IF v_new_len NOT BETWEEN 0 AND 9 OR p_completed<>(v_new_len=9) THEN
    RAISE EXCEPTION 'Invalid official Daily terminal shape.' USING errcode='22023';
  END IF;
  SELECT a.* INTO v_row
    FROM public.official_daily_attempt_states a
    WHERE a.puzzle_id=p_puzzle_id AND a.browser_key_digest=p_browser_key_digest
      AND a.attempt_id=p_attempt_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown official Daily progression owner.' USING errcode='22023';
  END IF;
  IF v_row.current_progression_token=p_next_token
     AND v_row.terminal_at_bats=p_terminal_at_bats
     AND (v_row.status='completed')=p_completed
  THEN
    v_outcome:='existing'; -- Lost-response same transition; no new revision.
  ELSIF v_row.status<>'active'
        OR v_row.current_progression_token IS DISTINCT FROM p_expected_token
  THEN
    v_outcome:='conflict'; -- Stale or forked branch; never overwrite the winner.
  ELSE
    v_old_len:=jsonb_array_length(v_row.terminal_at_bats);
    IF v_new_len NOT BETWEEN v_old_len AND v_old_len+1 OR v_row.revision>=36
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(v_row.terminal_at_bats)
           WITH ORDINALITY AS old_fact(value,position)
         WHERE old_fact.value IS DISTINCT FROM
               p_terminal_at_bats->(old_fact.position::integer-1)
       )
    THEN
      RAISE EXCEPTION 'Non-monotonic official Daily terminal facts.' USING errcode='22023';
    END IF;
    UPDATE public.official_daily_attempt_states a
      SET revision=a.revision+1,
          current_progression_token=p_next_token,
          terminal_at_bats=p_terminal_at_bats,
          status=CASE WHEN p_completed THEN 'completed' ELSE 'active' END,
          completed_at=CASE WHEN p_completed THEN clock_timestamp() ELSE NULL END,
          updated_at=greatest(clock_timestamp(),a.started_at)
      WHERE a.puzzle_id=p_puzzle_id AND a.browser_key_digest=p_browser_key_digest
        AND a.attempt_id=p_attempt_id;
    v_outcome:='advanced';
  END IF;
  RETURN QUERY SELECT v_outcome,a.attempt_id,a.puzzle_id,a.browser_key_digest,
                      a.started_at,a.revision,a.current_progression_token,
                      a.terminal_at_bats,a.status
    FROM public.official_daily_attempt_states a
    WHERE a.puzzle_id=p_puzzle_id AND a.browser_key_digest=p_browser_key_digest
      AND a.attempt_id=p_attempt_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.initialize_official_daily_progression(text,text,uuid,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.advance_official_daily_progression(text,text,uuid,text,text,jsonb,boolean)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.initialize_official_daily_progression(text,text,uuid,text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_official_daily_progression(text,text,uuid,text,text,jsonb,boolean)
  TO service_role;
COMMENT ON FUNCTION public.initialize_official_daily_progression(text,text,uuid,text) IS
  'Service-role-only first signed state, serialized by the existing attempt row; no public scoring path.';
COMMENT ON FUNCTION public.advance_official_daily_progression(text,text,uuid,text,text,jsonb,boolean) IS
  'Service-role-only one-step progression compare-and-swap with ordered terminal prefix and idempotent retry; does not authenticate proof HMAC.';
