-- Staged first-attempt authority for Custom Nine: operational server state only.
-- This is NOT a competitive result-write capability; endpoints are unchanged.
-- One row per immutable challenge and challenge-scoped random browser credential.
-- A later server adapter MUST use revision + token matching in its UPDATE predicate
-- to enforce atomic compare-and-swap; this migration only provides the storage.
create table public.custom_nine_attempt_states (
  challenge_id text not null
    references public.custom_nine_issued_challenges (puzzle_id),
  browser_key_digest text not null,
  attempt_id uuid not null,
  revision bigint not null default 0,
  current_progression_token text not null,
  terminal_at_bats jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint custom_nine_attempt_states_pkey
    primary key (challenge_id, browser_key_digest),
  constraint custom_nine_attempt_states_attempt_unique unique (attempt_id),
  constraint custom_nine_attempt_states_browser_digest
    check (browser_key_digest ~ '^[0-9a-f]{64}$'),
  constraint custom_nine_attempt_states_revision
    check (revision >= 0),
  constraint custom_nine_attempt_states_progression
    check (octet_length(current_progression_token) between 1 and 4096),
  constraint custom_nine_attempt_states_terminal_shape
    check (jsonb_typeof(terminal_at_bats) = 'array'
      and jsonb_array_length(terminal_at_bats) between 0 and 9),
  constraint custom_nine_attempt_states_status
    check (
      (status = 'active' and completed_at is null
        and jsonb_array_length(terminal_at_bats) < 9)
      or
      (status = 'completed' and completed_at is not null
        and jsonb_array_length(terminal_at_bats) = 9)
    )
);

-- The existing issued-challenge ID and one per-browser row key make a
-- challenge-local authority. A browser clearing its cookie can create a new
-- anonymous identity: no account-grade uniqueness is claimed.
comment on table public.custom_nine_attempt_states is
  'Private mutable in-progress state for the first Custom Nine attempt per challenge-scoped anonymous browser credential. Later server code must use CAS on revision and current token; no browser writes or competition yet.';
comment on column public.custom_nine_attempt_states.browser_key_digest is
  'SHA-256 hex of a random challenge-specific HttpOnly browser credential (not a user fingerprint or cross-challenge identity).';
comment on column public.custom_nine_attempt_states.current_progression_token is
  'Server-issued Custom-only signed continuation token; no canonical answer IDs or hints. Later writes require exact current token and revision match.';
comment on column public.custom_nine_attempt_states.terminal_at_bats is
  'Server-normalized terminal facts appended as actions are authoritatively committed. Not a competitive score result.';

alter table public.custom_nine_attempt_states enable row level security;
revoke all on table public.custom_nine_attempt_states
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.custom_nine_attempt_states to service_role;
-- No SELECT/INSERT/UPDATE/DELETE for anon/authenticated, no DELETE for service_role.
-- No RLS policies: service-role-only Next server adapter will enforce challenge
-- eligibility and creator-cookie exclusion before any later result contribution.
