-- Run only on isolated QA. All fixture counters are rolled back.
begin;
do $test$
declare
  v_allowed boolean;
  v_retry integer;
  v_count integer;
  v_n integer;
  v_now bigint := floor(extract(epoch from statement_timestamp()))::bigint;
  v_day bigint := (v_now / 86400) * 86400;
  v_window bigint := (v_now / 600) * 600;
  v_day_text text := to_char(pg_catalog.to_timestamp(v_day) at time zone 'UTC', 'YYYY-MM-DD');
  v_actual_day text;
  v_key text := repeat('a', 64);
  v_other text := repeat('b', 64);
  v_invalid text;
begin
  -- QA-only assertion avoids deleting unrelated counters in a reused DB.
  if exists (select 1 from public.custom_lineup_creation_budgets) then
    raise exception 'QA creation budgets must start empty.';
  end if;
  foreach v_invalid in array array[null, '', 'raw-ip', repeat('A',64), repeat('a',63), repeat('a',65)] loop
    begin
      perform * from public.reserve_custom_lineup_creation_budget(v_invalid,v_day_text);
      raise exception 'Malformed key unexpectedly accepted.';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  if exists (select 1 from public.custom_lineup_creation_budgets) then
    raise exception 'Invalid key wrote a counter.';
  end if;

  -- A pre-midnight digest claiming yesterday cannot reserve today's quota.
  select allowed, retry_after_seconds, server_utc_day
    into v_allowed, v_retry, v_actual_day
    from public.reserve_custom_lineup_creation_budget(v_key,'1999-01-01');
  if v_allowed is distinct from false or v_retry <> 0 or v_actual_day <> v_day_text then
    raise exception 'UTC day disagreement must be retriable and non-admitting.';
  end if;
  if exists(select 1 from public.custom_lineup_creation_budgets) then
    raise exception 'Mismatched day consumed quota.';
  end if;
  foreach v_invalid in array array['not-a-date','2026-99-99','2026-02-29'] loop
    begin
      perform * from public.reserve_custom_lineup_creation_budget(v_key,v_invalid);
      raise exception 'Invalid UTC day unexpectedly accepted: %', v_invalid;
    exception when invalid_parameter_value then null;
    end;
  end loop;

  for v_n in 1..10 loop
    select allowed, retry_after_seconds into v_allowed, v_retry
      from public.reserve_custom_lineup_creation_budget(v_key,v_day_text);
    if v_allowed is distinct from true or v_retry <> 0 then
      raise exception 'Client budget rejected before threshold.';
    end if;
  end loop;
  for v_n in 1..3 loop
    select allowed, retry_after_seconds into v_allowed, v_retry
      from public.reserve_custom_lineup_creation_budget(v_key,v_day_text);
    if v_allowed is distinct from false or v_retry not between 1 and 600 then
      raise exception 'Client ceiling/retry invalid.';
    end if;
  end loop;
  select admitted_count into v_count from public.custom_lineup_creation_budgets
    where bucket_key = 'global' and window_start = v_day;
  if v_count <> 10 then raise exception 'Denied requests consumed global quota.'; end if;
  select allowed into v_allowed from public.reserve_custom_lineup_creation_budget(v_other,v_day_text);
  if v_allowed is distinct from true then raise exception 'Clients not isolated.'; end if;

  -- Seed an expired prior-window counter; the next real reservation removes it.
  insert into public.custom_lineup_creation_budgets values
    (v_key, v_window - 600, v_window, 10);
  perform * from public.reserve_custom_lineup_creation_budget(v_other,v_day_text);
  if exists (select 1 from public.custom_lineup_creation_budgets where window_end <= v_now) then
    raise exception 'Expired counters not removed.';
  end if;

  update public.custom_lineup_creation_budgets set admitted_count = 999
    where bucket_key = 'global' and window_start = v_day;
  select allowed into v_allowed from public.reserve_custom_lineup_creation_budget(v_other,v_day_text);
  if v_allowed is distinct from true then raise exception 'Final global slot rejected.'; end if;
  select allowed, retry_after_seconds into v_allowed, v_retry
    from public.reserve_custom_lineup_creation_budget(repeat('c',64),v_day_text);
  if v_allowed is distinct from false or v_retry not between 1 and 86400 then
    raise exception 'Global ceiling/retry invalid.';
  end if;
  if exists (select 1 from public.custom_lineup_creation_budgets where bucket_key = repeat('c',64)) then
    raise exception 'Global denial added a subject.';
  end if;

  if has_function_privilege('anon', 'public.reserve_custom_lineup_creation_budget(text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.reserve_custom_lineup_creation_budget(text,text)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.reserve_custom_lineup_creation_budget(text,text)', 'EXECUTE') then
    raise exception 'RPC grants invalid.';
  end if;
  if exists (select 1 from pg_roles r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) p
    where r.rolname in ('anon','authenticated')
      and has_table_privilege(r.rolname, 'public.custom_lineup_creation_budgets', p)) then
    raise exception 'Browser role has private table access.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.custom_lineup_creation_budgets'::regclass)
    or (select prosecdef from pg_proc where oid = 'public.reserve_custom_lineup_creation_budget(text,text)'::regprocedure) then
    raise exception 'RLS/invoker boundary invalid.';
  end if;
end;
$test$;
-- Exercise the actual service-role privilege path, not just postgres.
update public.custom_lineup_creation_budgets set admitted_count = 999 where bucket_key = 'global';
set local role service_role;
do $role_test$
declare v_allowed boolean;
begin
  select allowed into v_allowed from public.reserve_custom_lineup_creation_budget(repeat('d',64),to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD'));
  if v_allowed is distinct from true then raise exception 'Service role admission failed.'; end if;
  select allowed into v_allowed from public.reserve_custom_lineup_creation_budget(repeat('e',64),to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD'));
  if v_allowed is distinct from false then raise exception 'Service role ceiling failed.'; end if;
end;
$role_test$;
reset role;
rollback;
