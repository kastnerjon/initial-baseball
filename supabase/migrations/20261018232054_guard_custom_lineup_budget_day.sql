-- Midnight-safe server-only replacement for the Custom creation budget RPC.
-- The earlier single-argument primitive has no production callers (public
-- creator remains OFF); remove it so stale workers fail closed rather than
-- silently bypassing this UTC-day consistency check.
drop function public.reserve_custom_lineup_creation_budget(text);

create function public.reserve_custom_lineup_creation_budget(p_client_digest text, p_claimed_utc_day text)
returns table (allowed boolean, retry_after_seconds integer, server_utc_day text)
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
  v_authoritative_day text;
begin
  if p_client_digest is null or p_client_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid creation budget key.' using errcode = '22023';
  end if;
  if p_claimed_utc_day is null or p_claimed_utc_day !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Invalid claimed budget date.' using errcode = '22023';
  end if;
  -- A well-shaped date can still be impossible (e.g. February 29 in a
  -- non-leap year). Reject it as bad input, never as retryable clock skew.
  begin
    perform p_claimed_utc_day::date;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'Invalid claimed budget date.' using errcode = '22023';
  end;

  -- Stable namespace for this feature, independent of date/client/window.
  -- Serializes lazy expiry too, avoiding cross-midnight cleanup deadlocks.
  perform pg_catalog.pg_advisory_xact_lock(1768055618, 1129660977);
  -- Choose windows AFTER waiting so queued requests cannot resurrect stale
  -- counters using a timestamp captured before the lock was acquired.
  v_now := floor(extract(epoch from clock_timestamp()))::bigint;
  v_day := (v_now / 86400) * 86400;
  v_window := (v_now / 600) * 600;
  v_authoritative_day := to_char(pg_catalog.to_timestamp(v_day) at time zone 'UTC', 'YYYY-MM-DD');

  -- Do not let app clock skew or pre-midnight lock waits create two digest
  -- identities in the same DB-owned 10-minute window. No quota consumed.
  if p_claimed_utc_day <> v_authoritative_day then
    return query select false, 0, v_authoritative_day;
    return;
  end if;

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
    return query select false, (v_day + 86400 - v_now)::integer, v_authoritative_day;
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
    return query select false, (v_window + 600 - v_now)::integer, v_authoritative_day;
    return;
  end if;

  update public.custom_lineup_creation_budgets b set admitted_count = b.admitted_count + 1
    where (b.bucket_key = 'global' and b.window_start = v_day)
      or (b.bucket_key = p_client_digest and b.window_start = v_window);
  return query select true, 0, v_authoritative_day;
end;
$function$;

revoke all on function public.reserve_custom_lineup_creation_budget(text,text)
  from public, anon, authenticated;
grant execute on function public.reserve_custom_lineup_creation_budget(text,text) to service_role;
