-- A public-facing leaderboard is opt-in; completed gameplay results remain private.
-- Submission IDs are unguessable browser-owned capability IDs, never returned in public rows.
-- All reads and writes go through server-only service-role adapters.
create table public.daily_nine_leaderboard_entries (
  submission_id text primary key
    references public.daily_completed_results(submission_id) on delete restrict,
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint daily_nine_leaderboard_display_name_valid
    check (
      display_name = btrim(display_name)
      and char_length(display_name) between 1 and 32
      and display_name !~ '[[:cntrl:]]'
    )
);

alter table public.daily_nine_leaderboard_entries enable row level security;
revoke all on public.daily_nine_leaderboard_entries from public, anon, authenticated, service_role;
grant select, insert on public.daily_nine_leaderboard_entries to service_role;

comment on table public.daily_nine_leaderboard_entries is
  'Optional public display names for immutable anonymous completed-result submissions; no raw result facts or account identity are published. One entry per submission ID.';

-- Return up to ten display rows (stable submission-time ordering within ties),
-- plus the requesting submission's rank if it falls below the visible ten.
-- Ranking uses the engine-derived score stored with the validated completed result.
-- Standard competition ranks: 1, 1, 3 (no time-based tiebreaker).
create function public.daily_nine_leaderboard_v1(
  p_puzzle_id text,
  p_puzzle_date date,
  p_puzzle_number integer,
  p_ruleset_version text,
  p_own_submission_id text default null
)
returns table (
  display_name text,
  points numeric,
  rank_number bigint,
  submitted_at timestamptz,
  is_own_entry boolean,
  total_entries bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked as (
    select
      entry.submission_id,
      entry.display_name,
      entry.created_at,
      (result.summary ->> 'points')::numeric as points,
      rank() over (
        order by (result.summary ->> 'points')::numeric desc
      ) as rank_number,
      row_number() over (
        order by (result.summary ->> 'points')::numeric desc,
                 entry.created_at asc, entry.submission_id asc
      ) as display_order,
      count(*) over () as total_entries
    from public.daily_nine_leaderboard_entries as entry
    join public.daily_completed_results as result
      on result.submission_id = entry.submission_id
    where result.puzzle_id = p_puzzle_id
      and result.puzzle_date = p_puzzle_date
      and result.puzzle_number = p_puzzle_number
      and result.ruleset_version = p_ruleset_version
      and p_ruleset_version = 'points-v4'
  )
  select
    ranked.display_name,
    ranked.points,
    ranked.rank_number,
    ranked.created_at,
    p_own_submission_id is not null and ranked.submission_id = p_own_submission_id,
    ranked.total_entries
  from ranked
  where ranked.display_order <= 10
     or (p_own_submission_id is not null and ranked.submission_id = p_own_submission_id)
  order by ranked.display_order;
$$;

revoke execute on function public.daily_nine_leaderboard_v1(
  text, date, integer, text, text
) from public, anon, authenticated;
grant execute on function public.daily_nine_leaderboard_v1(
  text, date, integer, text, text
) to service_role;

comment on function public.daily_nine_leaderboard_v1(
  text, date, integer, text, text
) is
  'Service-role-only optional Daily Nine points-v4 leaderboard: ten public display rows plus optional own rank, scoped to immutable exact puzzle/ruleset. No submission IDs exposed.';
