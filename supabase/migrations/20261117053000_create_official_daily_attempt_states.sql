-- Durable first-start authority for *secondary* official Daily editions.
-- Source only: no public route, gameplay change, production install or scoring switch.
CREATE TABLE public.official_daily_attempt_states (
  puzzle_id text NOT NULL REFERENCES public.official_daily_publications(puzzle_id),
  browser_key_digest text NOT NULL CHECK (browser_key_digest ~ '^[0-9a-f]{64}$'),
  attempt_id uuid NOT NULL DEFAULT gen_random_uuid(),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  current_progression_token text,
  terminal_at_bats jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  CONSTRAINT official_daily_attempt_states_pkey PRIMARY KEY (puzzle_id,browser_key_digest),
  CONSTRAINT official_daily_attempt_states_attempt_unique UNIQUE (attempt_id),
  CONSTRAINT official_daily_attempt_token_size CHECK (
    current_progression_token IS NULL OR
    octet_length(current_progression_token) BETWEEN 1 AND 4096
  ),
  CONSTRAINT official_daily_attempt_token_revision CHECK (
    revision = 0 OR current_progression_token IS NOT NULL
  ),
  CONSTRAINT official_daily_attempt_terminal_shape CHECK (
    jsonb_typeof(terminal_at_bats) = 'array'
    AND jsonb_array_length(terminal_at_bats) BETWEEN 0 AND 9
  ),
  CONSTRAINT official_daily_attempt_status_shape CHECK (
    (status = 'active' AND completed_at IS NULL AND
     jsonb_array_length(terminal_at_bats) < 9)
    OR (status = 'completed' AND completed_at IS NOT NULL AND
        jsonb_array_length(terminal_at_bats) = 9 AND
        current_progression_token IS NOT NULL)
  ),
  CONSTRAINT official_daily_attempt_timestamp_order CHECK (updated_at >= started_at)
);
ALTER TABLE public.official_daily_attempt_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.official_daily_attempt_states
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON TABLE public.official_daily_attempt_states TO service_role;
-- Only progression data may change. Immutable first-start identity, edition,
-- browser digest and DB-issued start time cannot be rewritten by service code.
GRANT UPDATE (revision,current_progression_token,terminal_at_bats,status,updated_at,completed_at)
  ON TABLE public.official_daily_attempt_states TO service_role;
COMMENT ON TABLE public.official_daily_attempt_states IS
  'Private first-start authority for exact issued Daily edition and anonymous browser digest. No unique-person claim. CAS, authenticated gameplay and score admission are separately gated.';

-- Two separate SQL statements (insert, subsequent select) preserve conflict
-- winner visibility under READ COMMITTED. The publication owns date/ruleset.
CREATE FUNCTION public.reserve_official_daily_attempt(
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
  v_inserted integer;
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

  -- An existing eligible first start can be read after Pacific midnight.
  RETURN QUERY SELECT a.attempt_id,a.puzzle_id,p.puzzle_date,p.ruleset_version,
                      a.browser_key_digest,a.started_at,a.revision,a.status
    FROM public.official_daily_attempt_states a
    JOIN public.official_daily_publications p ON p.puzzle_id=a.puzzle_id
    WHERE a.puzzle_id=p_puzzle_id AND a.browser_key_digest=p_browser_key_digest;
  IF FOUND THEN RETURN; END IF;

  -- New starts are allowed only on the exact released Pacific date. Neither
  -- old archive starts nor tomorrow's edition can create a competitive row.
  IF v_day <> (clock_timestamp() AT TIME ZONE 'America/Los_Angeles')::date THEN
    RAISE EXCEPTION 'Official Daily new start window elapsed.' USING errcode='22023';
  END IF;
  INSERT INTO public.official_daily_attempt_states(puzzle_id,browser_key_digest)
    VALUES (p_puzzle_id,p_browser_key_digest)
    ON CONFLICT ON CONSTRAINT official_daily_attempt_states_pkey DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  -- A request blocked on a DB uniqueness lock across midnight must not
  -- create a late fresh attempt; an existing conflict winner is still valid.
  IF v_inserted=1 AND
    v_day <> (clock_timestamp() AT TIME ZONE 'America/Los_Angeles')::date THEN
    RAISE EXCEPTION 'Official Daily new start crossed date boundary.' USING errcode='22023';
  END IF;
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
