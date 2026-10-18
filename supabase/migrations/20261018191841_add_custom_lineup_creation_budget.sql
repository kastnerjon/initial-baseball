-- Private prerequisite for the upcoming no-sign-in Custom creator.
-- This does not authorize issuance, expose an HTTP route or enable gameplay.
create table public.custom_lineup_creation_budgets (
  bucket_key text not null,
  window_start bigint not null check (window_start >= 0),
  window_end bigint not null,
  admitted_count integer not null default 0 check (admitted_count between 0 and 1000),
  primary key (bucket_key, window_start),
  check (bucket_key = 'global' or bucket_key ~ '^[0-9a-f]{64}$'),
  check (window_end = window_start + case when bucket_key = 'global' then 86400 else 600 end),
  check (window_start % case when bucket_key = 'global' then 86400 else 600 end = 0),
  check (bucket_key = 'global' or admitted_count <= 10)
);
create index custom_lineup_creation_budgets_expiry_idx
  on public.custom_lineup_creation_budgets (window_end);
alter table public.custom_lineup_creation_budgets enable row level security;
revoke all on public.custom_lineup_creation_budgets from public, anon, authenticated;
grant select, insert, update, delete on public.custom_lineup_creation_budgets to service_role;

-- Only a trusted server may supply a day-scoped HMAC of a verified client IP.
-- No raw IPs or browser-supplied identifiers belong in this table.
create function public.reserve_custom_lineup_creation_budget(p_client_digest text)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_now bigint;
  v_day bigint;
  v_window bigint;
  v_global integer;
  v_client integer;
begin
  if p_client_digest is null or p_client_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid creation budget key.' using errcode = '22023';
  end if;

  -- Stable namespace for this feature, independent of date/client/window.
  -- Serializes lazy expiry too, avoiding cross-midnight cleanup deadlocks.
  perform pg_catalog.pg_advisory_xact_lock(1768055618, 1129660977);
  -- Choose windows AFTER waiting so queued requests cannot resurrect stale
  -- counters using a timestamp captured before the lock was acquired.
  v_now := floor(extract(epoch from clock_timestamp()))::bigint;
  v_day := (v_now / 86400) * 86400;
  v_window := (v_now / 600) * 600;

  insert into public.custom_lineup_creation_budgets (bucket_key, window_start, window_end)
    values ('global', v_day, v_day + 86400)
    on conflict do nothing;
  -- Counter mutation and reservation stay in this same transaction.
  select b.admitted_count into v_global
    from public.custom_lineup_creation_budgets b
    where b.bucket_key = 'global' and b.window_start = v_day
    for update;

  -- Delete only this feature's expired counters, never challenges or results.
  -- No new subjects are inserted once the global ceiling has been reached.
  delete from public.custom_lineup_creation_budgets b where b.window_end <= v_now;
  if v_global >= 1000 then
    return query select false, (v_day + 86400 - v_now)::integer;
    return;
  end if;

  insert into public.custom_lineup_creation_budgets (bucket_key, window_start, window_end)
    values (p_client_digest, v_window, v_window + 600)
    on conflict do nothing;
  select b.admitted_count into v_client
    from public.custom_lineup_creation_budgets b
    where b.bucket_key = p_client_digest and b.window_start = v_window
    for update;
  if v_client >= 10 then
    return query select false, (v_window + 600 - v_now)::integer;
    return;
  end if;

  update public.custom_lineup_creation_budgets b set admitted_count = b.admitted_count + 1
    where (b.bucket_key = 'global' and b.window_start = v_day)
      or (b.bucket_key = p_client_digest and b.window_start = v_window);
  return query select true, 0;
end;
$function$;

revoke all on function public.reserve_custom_lineup_creation_budget(text)
  from public, anon, authenticated;
grant execute on function public.reserve_custom_lineup_creation_budget(text) to service_role;
comment on table public.custom_lineup_creation_budgets is
  'Private expiring abuse counters only; no raw IP, account, player or challenge identity. Cleared lazily on the next reservation.';
