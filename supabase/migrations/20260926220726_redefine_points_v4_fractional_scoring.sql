alter table public.daily_at_bat_results
  drop constraint daily_at_bat_results_awarded_points_range,
  alter column awarded_points type numeric(4,1) using awarded_points::numeric(4,1),
  add constraint daily_at_bat_results_awarded_points_range
    check (
      (ruleset_version = 'points-v3'
        and awarded_points = trunc(awarded_points)
        and awarded_points between 0 and 7)
      or
      (ruleset_version = 'points-v4'
        and awarded_points between 0 and 4
        and awarded_points * 2 = trunc(awarded_points * 2))
    );

alter table public.daily_completed_results
  drop constraint daily_completed_results_points_summary_range,
  add constraint daily_completed_results_points_summary_range
    check (
      case
        when ruleset_version = 'classic-inning-v1' then true
        when coalesce(jsonb_typeof(summary -> 'points'), '') <> 'number' then false
        when ruleset_version = 'points-v3' then
          (summary ->> 'points')::numeric = trunc((summary ->> 'points')::numeric)
          and (summary ->> 'points')::numeric between 0 and 63
        when ruleset_version = 'points-v4' then
          (summary ->> 'points')::numeric between 0 and 36
          and (summary ->> 'points')::numeric * 2
            = trunc((summary ->> 'points')::numeric * 2)
        else false
      end
    );

drop function public.daily_nine_at_bat_comparison(
  text, date, integer, text, smallint
);

create function public.daily_nine_at_bat_comparison(
  p_puzzle_id text,
  p_puzzle_date date,
  p_puzzle_number integer,
  p_ruleset_version text,
  p_pitch_number smallint
)
returns table (
  resolved_at_bat_count bigint,
  awarded_points_sum numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*)::bigint as resolved_at_bat_count,
    coalesce(sum(result.awarded_points), 0::numeric) as awarded_points_sum
  from public.daily_at_bat_results as result
  where result.puzzle_id = p_puzzle_id
    and result.puzzle_date = p_puzzle_date
    and result.puzzle_number = p_puzzle_number
    and result.ruleset_version = p_ruleset_version
    and result.pitch_number = p_pitch_number
    and p_ruleset_version in ('points-v3', 'points-v4');
$$;

drop function public.daily_nine_completed_score_buckets(
  text, date, integer, text
);

create function public.daily_nine_completed_score_buckets(
  p_puzzle_id text,
  p_puzzle_date date,
  p_puzzle_number integer,
  p_ruleset_version text
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
  group by (result.summary->>'points')::numeric
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
) is 'Service-role-only Daily Nine comparison aggregate for one exact supported ruleset and resolved-at-bat population.';

comment on function public.daily_nine_completed_score_buckets(
  text, date, integer, text
) is 'Service-role-only Daily Nine completed-game score buckets for one exact supported ruleset population.';

comment on column public.daily_at_bat_results.awarded_points is
  'Engine-derived exact-ruleset points stored once for later aggregate reads; points-v3 is integer 0..7 and points-v4 is 0..4 in 0.5-point steps.';
