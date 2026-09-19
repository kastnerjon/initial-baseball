create or replace function public.daily_nine_at_bat_comparison(
  p_puzzle_id text,
  p_puzzle_date date,
  p_puzzle_number integer,
  p_ruleset_version text,
  p_pitch_number smallint
)
returns table (
  resolved_at_bat_count bigint,
  awarded_points_sum bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*)::bigint as resolved_at_bat_count,
    coalesce(sum(result.awarded_points), 0)::bigint as awarded_points_sum
  from public.daily_at_bat_results as result
  where result.puzzle_id = p_puzzle_id
    and result.puzzle_date = p_puzzle_date
    and result.puzzle_number = p_puzzle_number
    and result.ruleset_version = p_ruleset_version
    and result.pitch_number = p_pitch_number
    and p_ruleset_version = 'points-v3';
$$;

create or replace function public.daily_nine_completed_score_buckets(
  p_puzzle_id text,
  p_puzzle_date date,
  p_puzzle_number integer,
  p_ruleset_version text
)
returns table (
  points smallint,
  result_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (result.summary->>'points')::smallint as points,
    count(*)::bigint as result_count
  from public.daily_completed_results as result
  where result.puzzle_id = p_puzzle_id
    and result.puzzle_date = p_puzzle_date
    and result.puzzle_number = p_puzzle_number
    and result.ruleset_version = p_ruleset_version
    and p_ruleset_version = 'points-v3'
  group by (result.summary->>'points')::smallint
  order by points;
$$;

revoke execute on function public.daily_nine_at_bat_comparison(
  text, date, integer, text, smallint
) from PUBLIC, anon, authenticated;
grant execute on function public.daily_nine_at_bat_comparison(
  text, date, integer, text, smallint
) to service_role;

revoke execute on function public.daily_nine_completed_score_buckets(
  text, date, integer, text
) from PUBLIC, anon, authenticated;
grant execute on function public.daily_nine_completed_score_buckets(
  text, date, integer, text
) to service_role;

comment on function public.daily_nine_at_bat_comparison(
  text, date, integer, text, smallint
) is 'Service-role-only Daily Nine comparison aggregate for one exact resolved-at-bat population.';

comment on function public.daily_nine_completed_score_buckets(
  text, date, integer, text
) is 'Service-role-only Daily Nine completed-game score buckets for one exact points-v3 population.';
