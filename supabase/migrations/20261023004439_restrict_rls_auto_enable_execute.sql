-- Production-only Supabase DDL event-trigger hardening (issue #481).
-- Some isolated QA projects do not install Supabase's ensure_rls helper.
-- Skip those projects rather than inventing a production control-plane function.
-- This migration never disables or replaces the existing event trigger.

do $migration$
declare
  v_helper_oid oid := to_regprocedure('public.rls_auto_enable()');
begin
  if v_helper_oid is null then
    raise notice 'rls_auto_enable() absent; no privilege change needed in this project';
    return;
  end if;

  -- Fail closed if Supabase changes the helper's role or trigger semantics.
  if not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_event_trigger t on t.evtfoid = p.oid
    where p.oid = v_helper_oid
      and p.proowner = 'postgres'::regrole
      and p.prosecdef
      and p.prorettype = 'pg_catalog.event_trigger'::regtype
      and p.proconfig @> array['search_path=pg_catalog']
      and t.evtname = 'ensure_rls'
      and t.evtenabled = 'O'
      and t.evtevent = 'ddl_command_end'
  ) then
    raise exception 'rls_auto_enable event trigger is not the reviewed Supabase helper';
  end if;

  -- Function defaults grant EXECUTE to PUBLIC, hence also anon/authenticated.
  -- The event trigger remains installed and runs as the postgres-owned helper.
  revoke execute on function public.rls_auto_enable()
    from public, anon, authenticated;

  if has_function_privilege('anon', v_helper_oid, 'EXECUTE')
    or has_function_privilege('authenticated', v_helper_oid, 'EXECUTE') then
    raise exception 'rls_auto_enable still executable by public API roles';
  end if;
end;
$migration$;
