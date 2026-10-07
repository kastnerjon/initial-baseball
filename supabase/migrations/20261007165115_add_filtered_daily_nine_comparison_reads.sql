create function public.daily_nine_at_bat_score_buckets_v2(
  p_puzzle_id text,
  p_puzzle_date date,
  p_puzzle_number integer,
  p_ruleset_version text,
  p_pitch_number smallint,
  p_excluded_result_id text
)
returns table (
  points numeric,
  result_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    result.awarded_points as points,
    count(*)::bigint as result_count
  from public.daily_at_bat_results as result
  where result.puzzle_id = p_puzzle_id
    and result.puzzle_date = p_puzzle_date
    and result.puzzle_number = p_puzzle_number
    and result.ruleset_version = p_ruleset_version
    and result.pitch_number = p_pitch_number
    and p_ruleset_version in ('points-v3', 'points-v4')
    and (p_excluded_result_id is null or result.attempt_id <> p_excluded_result_id)
  group by result.awarded_points
  order by points;
$$;

create function public.daily_nine_completed_score_buckets_v2(
  p_puzzle_id text,
  p_puzzle_date date,
  p_puzzle_number integer,
  p_ruleset_version text,
  p_excluded_result_id text
)
returns table (
  points numeric,
  result_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (result.summary->>'points')::numeric as points,
    count(*)::bigint as result_count
  from public.daily_completed_results as result
  where result.puzzle_id = p_puzzle_id
    and result.puzzle_date = p_puzzle_date
    and result.puzzle_number = p_puzzle_number
    and result.ruleset_version = p_ruleset_version
    and p_ruleset_version in ('points-v3', 'points-v4')
    and (p_excluded_result_id is null or result.submission_id <> p_excluded_result_id)
  group by (result.summary->>'points')::numeric
  order by points;
$$;

revoke execute on function public.daily_nine_at_bat_score_buckets_v2(
  text, date, integer, text, smallint, text
) from PUBLIC, anon, authenticated;
grant execute on function public.daily_nine_at_bat_score_buckets_v2(
  text, date, integer, text, smallint, text
) to service_role;

revoke execute on function public.daily_nine_completed_score_buckets_v2(
  text, date, integer, text, text
) from PUBLIC, anon, authenticated;
grant execute on function public.daily_nine_completed_score_buckets_v2(
  text, date, integer, text, text
) to service_role;

comment on function public.daily_nine_at_bat_score_buckets_v2(
  text, date, integer, text, smallint, text
) is 'Service-role-only Daily Nine exact-slot score buckets with optional anonymous result-ID exclusion; persisted engine-derived points are not rescored.';

comment on function public.daily_nine_completed_score_buckets_v2(
  text, date, integer, text, text
) is 'Service-role-only Daily Nine completed score buckets with optional anonymous result-ID exclusion; persisted engine-derived points are not rescored.';
