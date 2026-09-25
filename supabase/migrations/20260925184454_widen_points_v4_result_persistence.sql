alter table public.daily_completed_results
  drop constraint daily_completed_results_ruleset_supported,
  add constraint daily_completed_results_ruleset_supported
    check (ruleset_version in ('points-v3', 'points-v4', 'classic-inning-v1')),
  add constraint daily_completed_results_points_summary_range
    check (
      case
        when ruleset_version = 'classic-inning-v1' then true
        when coalesce(jsonb_typeof(summary -> 'points'), '') <> 'number' then false
        when ruleset_version = 'points-v3' then
          (summary ->> 'points')::numeric = trunc((summary ->> 'points')::numeric)
          and (summary ->> 'points')::numeric between 0 and 63
        when ruleset_version = 'points-v4' then
          (summary ->> 'points')::numeric = trunc((summary ->> 'points')::numeric)
          and (summary ->> 'points')::numeric between -9 and 36
        else false
      end
    );

alter table public.daily_at_bat_results
  drop constraint daily_at_bat_results_ruleset_supported,
  drop constraint daily_at_bat_results_awarded_points_range,
  add constraint daily_at_bat_results_ruleset_supported
    check (ruleset_version in ('points-v3', 'points-v4')),
  add constraint daily_at_bat_results_awarded_points_range
    check (
      (ruleset_version = 'points-v3' and awarded_points between 0 and 7)
      or (ruleset_version = 'points-v4' and awarded_points between -1 and 4)
    );

comment on table public.daily_completed_results is
  'Validated anonymous completed Daily results. Immutable first-write-wins rows retain exact ruleset identity; server provider has SELECT and INSERT only.';

comment on column public.daily_at_bat_results.awarded_points is
  'Engine-derived exact-ruleset points stored once for later aggregate reads; points-v3 is 0..7 and points-v4 is -1..4.';
