-- Isolated QA SQL fixture; all changes roll back, NO outgoing HTTP.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '15s';
do $test$
declare
  proc_id oid;
  definition text;
  sample private_http.http_request;
begin
  if not exists (select 1 from pg_extension e join pg_namespace n
      on n.oid = e.extnamespace where e.extname = 'http' and n.nspname = 'private_http') then
    raise exception 'HTTP extension must be isolated in private_http';
  end if;
  if has_schema_privilege('anon', 'private_http', 'USAGE')
     or has_schema_privilege('authenticated', 'private_http', 'USAGE')
     or has_schema_privilege('anon', 'private', 'USAGE') then
    raise exception 'HTTP or dispatch schema exposed to public database roles';
  end if;
  if has_function_privilege('anon', 'private.dispatch_official_daily_edition_chatops(jsonb)', 'EXECUTE')
      or has_function_privilege('authenticated', 'private.dispatch_official_daily_edition_chatops(jsonb)', 'EXECUTE') then
    raise exception 'Public database roles can invoke ChatOps';
  end if;
  select 'private.dispatch_official_daily_edition_chatops(jsonb)'::regprocedure::oid into proc_id;
  if pg_get_function_result(proc_id) <> 'jsonb' then
    raise exception 'Expected synchronous JSON HTTP response';
  end if;
  definition := pg_get_functiondef(proc_id);
  if strpos(definition, 'net.http_post(') > 0
      or strpos(definition, 'private_http.http(') = 0 then
    raise exception 'Dispatch must use the private synchronous HTTP function';
  end if;
  sample := row('POST'::text, 'https://example.invalid/never-sent'::text,
    array[row('Authorization','Bearer synthetic-qa-only')::private_http.http_header],
    'application/json'::text,'{"action":"preview"}'::text)::private_http.http_request;
  if sample.uri <> 'https://example.invalid/never-sent' then
    raise exception 'Request composite construction failed';
  end if;
  begin
    perform private.dispatch_official_daily_edition_chatops(null);
    raise exception 'Null request unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'Invalid Daily edition ChatOps request.' then raise; end if;
  end;
  begin
    perform private.dispatch_official_daily_edition_chatops('[]'::jsonb);
    raise exception 'Array request unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'Invalid Daily edition ChatOps request.' then raise; end if;
  end;
  begin
    perform private.dispatch_official_daily_edition_chatops(jsonb_build_object('x', repeat('x', 9000)));
    raise exception 'Oversized request unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'Invalid Daily edition ChatOps request.' then raise; end if;
  end;
end;
$test$;
do $test$
declare
  origin_id uuid;
begin
  if exists (select 1 from vault.secrets
      where name in ('daily_chatops_token', 'daily_edition_chatops_origin')) then
    raise exception 'Refusing fixture: ChatOps Vault names already exist';
  end if;
  perform vault.create_secret('synthetic-qa-only-token', 'daily_chatops_token');
  origin_id := vault.create_secret('https://initial-baseball-web.vercel.app',
                                  'daily_edition_chatops_origin');
  begin
    perform private.dispatch_official_daily_edition_chatops('{"action":"preview"}'::jsonb);
    raise exception 'Production origin unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'Daily ChatOps transport is not configured.' then raise; end if;
  end;
  perform vault.update_secret(origin_id,
    'https://initial-baseball-web-git-qa-officia-2a5bf9-kastnerjons-projects.vercel.app',
    'daily_edition_chatops_origin');
  -- The successful request path requires separate protected hosted HTTP testing.
  -- Deliberately do not make a network call in the rollback-only fixture.
end;
$test$;
rollback;
