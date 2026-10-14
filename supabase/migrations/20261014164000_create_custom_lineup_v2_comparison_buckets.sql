-- Private Custom Lineup v2 1–10 score buckets. No public/HTTP read or flag change.
-- Requires hosted #401/#403/#404/#405. Trusted server derives self exclusion.
create function public.custom_lineup_v2_at_bat_score_buckets_v1(
  p_challenge_id text, p_pitch_number smallint,
  p_excluded_submission_id text default null
)
returns table (points numeric, result_count bigint)
language sql stable security invoker set search_path = ''
as $function$
  select ab.awarded_points, count(*)::bigint
  from public.custom_nine_at_bat_results ab
  join public.custom_nine_completed_results done
    on done.submission_id = ab.attempt_id
   and done.challenge_id = ab.challenge_id
   and done.schema_version = 2
   and done.ruleset_version = 'points-v4'
  join public.custom_nine_issued_challenges issued
    on issued.puzzle_id = done.challenge_id
   and issued.schema_version = 2
   and issued.ruleset_version = 'points-v4'
  where ab.challenge_id = p_challenge_id
    and ab.schema_version = 2
    and ab.ruleset_version = 'points-v4'
    and ab.pitch_number = p_pitch_number
    and p_pitch_number between 1 and jsonb_array_length(issued.canonical_player_ids)
    and (p_excluded_submission_id is null or done.submission_id <> p_excluded_submission_id)
  group by ab.awarded_points order by ab.awarded_points;
$function$;

create function public.custom_lineup_v2_completed_score_buckets_v1(
  p_challenge_id text, p_excluded_submission_id text default null
)
returns table (points numeric, result_count bigint)
language sql stable security invoker set search_path = ''
as $function$
  select (done.summary ->> 'points')::numeric, count(*)::bigint
  from public.custom_nine_completed_results done
  join public.custom_nine_issued_challenges issued
    on issued.puzzle_id = done.challenge_id
   and issued.schema_version = 2
   and issued.ruleset_version = 'points-v4'
  where done.challenge_id = p_challenge_id
    and done.schema_version = 2
    and done.ruleset_version = 'points-v4'
    and (p_excluded_submission_id is null or done.submission_id <> p_excluded_submission_id)
  group by (done.summary ->> 'points')::numeric
  order by (done.summary ->> 'points')::numeric;
$function$;

-- Function creation defaults to PUBLIC EXECUTE; explicitly isolate browser roles.
revoke all on function public.custom_lineup_v2_at_bat_score_buckets_v1(text,smallint,text)
  from public, anon, authenticated, service_role;
revoke all on function public.custom_lineup_v2_completed_score_buckets_v1(text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.custom_lineup_v2_at_bat_score_buckets_v1(text,smallint,text)
  to service_role;
grant execute on function public.custom_lineup_v2_completed_score_buckets_v1(text,text)
  to service_role;

comment on function public.custom_lineup_v2_at_bat_score_buckets_v1(text,smallint,text) is
  'Service-only, schema-v2 immutable challenge length 1–10 AB buckets; accepted completions only; self-exclusion trusted server-side.';
comment on function public.custom_lineup_v2_completed_score_buckets_v1(text,text) is
  'Service-only, schema-v2 exact challenge completed-score buckets; no anonymous/HTTP access.';
