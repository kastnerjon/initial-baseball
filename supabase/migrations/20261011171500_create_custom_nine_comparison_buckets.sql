-- Private, challenge-scoped Custom Nine score buckets; no anonymous/HTTP reader.
-- These are scored points-v4 facts from accepted completions only.
-- The caller MUST derive own-result exclusion from a verified challenge cookie
-- and never trust a browser-selected submission ID for exclusion/eligibility.

create function public.custom_nine_at_bat_score_buckets_v1(
  p_challenge_id text,
  p_pitch_number smallint,
  p_excluded_submission_id text default null
)
returns table (points numeric, result_count bigint)
language sql
stable
security invoker
set search_path = ''
as $function$
  select ab.awarded_points as points, count(*)::bigint as result_count
  from public.custom_nine_at_bat_results as ab
  join public.custom_nine_completed_results as completed
    on completed.submission_id = ab.attempt_id
    and completed.challenge_id = ab.challenge_id
    and completed.ruleset_version = 'points-v4'
    and completed.schema_version = 1
  where ab.challenge_id = p_challenge_id
    and ab.ruleset_version = 'points-v4'
    and ab.schema_version = 1
    and ab.pitch_number = p_pitch_number
    and p_pitch_number between 1 and 9
    and (
      p_excluded_submission_id is null
      or completed.submission_id <> p_excluded_submission_id
    )
  group by ab.awarded_points
  order by points;
$function$;

create function public.custom_nine_completed_score_buckets_v1(
  p_challenge_id text,
  p_excluded_submission_id text default null
)
returns table (points numeric, result_count bigint)
language sql
stable
security invoker
set search_path = ''
as $function$
  select (completed.summary ->> 'points')::numeric as points,
    count(*)::bigint as result_count
  from public.custom_nine_completed_results as completed
  where completed.challenge_id = p_challenge_id
    and completed.schema_version = 1
    and completed.ruleset_version = 'points-v4'
    and (
      p_excluded_submission_id is null
      or completed.submission_id <> p_excluded_submission_id
    )
  group by (completed.summary ->> 'points')::numeric
  order by points;
$function$;

-- Functions are not executable by browser/Data API roles (nor PUBLIC).
-- They use the existing service-role SELECT privileges and RLS policies.
revoke all on function public.custom_nine_at_bat_score_buckets_v1(
  text, smallint, text
) from public, anon, authenticated, service_role;
revoke all on function public.custom_nine_completed_score_buckets_v1(
  text, text
) from public, anon, authenticated, service_role;
grant execute on function public.custom_nine_at_bat_score_buckets_v1(
  text, smallint, text
) to service_role;
grant execute on function public.custom_nine_completed_score_buckets_v1(
  text, text
) to service_role;

comment on function public.custom_nine_at_bat_score_buckets_v1(
  text, smallint, text
) is 'Service-role-only, exact Custom challenge and slot points-v4 buckets. Joins accepted completions so unmatched/legacy AB observations cannot enter peer AVG/BEAT. Caller derives exclusion from verified signed browser identity.';
comment on function public.custom_nine_completed_score_buckets_v1(
  text, text
) is 'Service-role-only exact Custom challenge points-v4 completed-game buckets with optional trusted self-exclusion; separate from Daily Nine and Archive.';
