alter table public.daily_completed_results enable row level security;

revoke all on table public.daily_completed_results from public, anon, authenticated, service_role;
grant select, insert on table public.daily_completed_results to service_role;

comment on table public.daily_completed_results is
  'Validated anonymous completed Daily results. One immutable first-write-wins row per client submission_id; server provider has SELECT and INSERT only.';
