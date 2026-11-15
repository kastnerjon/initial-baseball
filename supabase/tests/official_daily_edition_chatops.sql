-- Run after the transport migration in an isolated database; rolls back.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '15s';
do $test$
begin
  if not exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_net' and n.nspname = 'extensions'
  ) then
    raise exception 'pg_net extension must be outside public';
  end if;
  if has_function_privilege('anon', 'private.dispatch_official_daily_edition_chatops(jsonb)', 'EXECUTE')
      or has_function_privilege('authenticated', 'private.dispatch_official_daily_edition_chatops(jsonb)', 'EXECUTE') then
    raise exception 'public roles can execute private transport';
  end if;
  begin
    perform private.dispatch_official_daily_edition_chatops(null);
    raise exception 'null unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'Invalid Daily edition ChatOps request.' then raise; end if;
  end;
  begin
    perform private.dispatch_official_daily_edition_chatops('[]'::jsonb);
    raise exception 'array unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'Invalid Daily edition ChatOps request.' then raise; end if;
  end;
  begin
    perform private.dispatch_official_daily_edition_chatops(jsonb_build_object('x', repeat('x', 9000)));
    raise exception 'oversized payload unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'Invalid Daily edition ChatOps request.' then raise; end if;
  end;
end;
$test$;

-- Test with disposable Vault entries only; do not alter pre-existing credentials.
do $test$
declare
  queued_before bigint;
  queued_after bigint;
  origin_id uuid;
  request_id bigint;
begin
  if exists (select 1 from vault.secrets where name in ('daily_chatops_token', 'daily_edition_chatops_origin')) then
    raise exception 'Refusing fixture: ChatOps Vault names already exist.';
  end if;
  perform vault.create_secret('disposable-qa-token', 'daily_chatops_token');
  origin_id := vault.create_secret('https://initial-baseball-web.vercel.app', 'daily_edition_chatops_origin');
  select count(*) into queued_before from net.http_request_queue;
  begin
    perform private.dispatch_official_daily_edition_chatops('{"action":"preview"}'::jsonb);
    raise exception 'Production origin unexpectedly accepted.';
  exception when raise_exception then
    if sqlerrm <> 'Daily ChatOps transport is not configured.' then raise; end if;
  end;
  select count(*) into queued_after from net.http_request_queue;
  if queued_after <> queued_before then
    raise exception 'Production request unexpectedly queued.';
  end if;
  perform vault.update_secret(origin_id,
    'https://initial-baseball-web-git-qa-officia-2a5bf9-kastnerjons-projects.vercel.app',
    'daily_edition_chatops_origin');
  request_id := private.dispatch_official_daily_edition_chatops('{"action":"preview"}'::jsonb);
  if not exists (select 1 from net.http_request_queue where id = request_id
      and url = 'https://initial-baseball-web-git-qa-officia-2a5bf9-kastnerjons-projects.vercel.app/admin/daily/editions/chatops') then
    raise exception 'Expected QA request was not queued.';
  end if;
end;
$test$;
rollback;
