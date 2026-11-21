-- Allow the first scored start of any released edition, retaining the original attempt on retries.
CREATE OR REPLACE FUNCTION public.reserve_official_daily_attempt(
  p_puzzle_id text, p_browser_key_digest text
)
RETURNS TABLE (
  attempt_id uuid, puzzle_id text, puzzle_date date,
  ruleset_version text, browser_key_digest text,
  started_at timestamptz, revision bigint, status text
)
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_day date;
  v_today date;
BEGIN
  IF p_puzzle_id IS NULL OR
    p_puzzle_id !~ '^daily-ed-v1-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR p_browser_key_digest IS NULL OR
    p_browser_key_digest !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid official Daily reservation key.' USING errcode='22023';
  END IF;
  SELECT p.puzzle_date INTO v_day
    FROM public.official_daily_publications p
    WHERE p.puzzle_id=p_puzzle_id AND p.ruleset_version='points-v4';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown official Daily publication.' USING errcode='22023';
  END IF;
  v_today := (clock_timestamp() AT TIME ZONE 'America/Los_Angeles')::date;
  IF v_day > v_today THEN
    RAISE EXCEPTION 'Official Daily not yet released.' USING errcode='22023';
  END IF;

  INSERT INTO public.official_daily_attempt_states(puzzle_id,browser_key_digest)
    VALUES (p_puzzle_id,p_browser_key_digest)
    ON CONFLICT ON CONSTRAINT official_daily_attempt_states_pkey DO NOTHING;
  RETURN QUERY SELECT a.attempt_id,a.puzzle_id,p.puzzle_date,p.ruleset_version,
                      a.browser_key_digest,a.started_at,a.revision,a.status
    FROM public.official_daily_attempt_states a
    JOIN public.official_daily_publications p ON p.puzzle_id=a.puzzle_id
    WHERE a.puzzle_id=p_puzzle_id AND a.browser_key_digest=p_browser_key_digest;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Official Daily reservation unavailable.' USING errcode='55000';
  END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.reserve_official_daily_attempt(text,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.reserve_official_daily_attempt(text,text)
  TO service_role;
COMMENT ON FUNCTION public.reserve_official_daily_attempt(text,text) IS
  'Service-only first-start insert-or-return; immutable publication sets date and ruleset, no public transport or score authority.';
