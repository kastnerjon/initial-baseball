-- Source-staged only. Requires independent review and explicit hosted release approval.
-- Database time is authoritative at each row write, even after lock waits.
-- Additive secondary-edition guard; preserve the existing integrity/issuer trigger.
create function public.guard_official_daily_editorial_future_date_write()
returns trigger
language plpgsql security invoker set search_path = ''
as $guard$
declare
  v_pacific_today date;
begin
  -- Scheduled -> issued is the independent immutable-publication transition.
  -- Its existing row-locking issuer + integrity trigger remain authoritative.
  if tg_op = 'INSERT' or (
      tg_op = 'UPDATE' and old.status in ('draft', 'scheduled')
      and new.status <> 'issued'
  ) then
    -- now()/CURRENT_DATE are transaction-start, and statement_timestamp()
    -- precedes a possible row-lock wait. Use the live database clock instead.
    v_pacific_today :=
      (pg_catalog.clock_timestamp() at time zone 'America/Los_Angeles')::date;
    if new.puzzle_date <= v_pacific_today then
      raise exception 'Official Daily editorial date has elapsed.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$guard$;

revoke all on function public.guard_official_daily_editorial_future_date_write()
  from public, anon, authenticated;

-- The original guard_official_daily_editorial_draft integrity trigger stays
-- in place. BEFORE ROW execution occurs after acquiring the target row lock.
create trigger a_official_daily_editorial_future_date
before insert or update on public.official_daily_editorial_drafts
for each row execute function public.guard_official_daily_editorial_future_date_write();
