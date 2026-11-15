-- Private transport only; the authenticated service owns all editorial writes.
-- Supabase recommends installing pg_net outside public even though its runtime queue lives in net.
create extension if not exists pg_net with schema extensions;
create schema if not exists private;
revoke all on schema private from public;

create function private.dispatch_official_daily_edition_chatops(p_request jsonb)
returns bigint language plpgsql security invoker set search_path = pg_catalog
as $$
declare
  chatops_token text;
  chatops_origin text;
  request_id bigint;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object'
      or octet_length(p_request::text) > 8192 then
    raise exception 'Invalid Daily edition ChatOps request.';
  end if;
  select decrypted_secret into chatops_token
    from vault.decrypted_secrets where name = 'daily_chatops_token';
  select decrypted_secret into chatops_origin
    from vault.decrypted_secrets where name = 'daily_edition_chatops_origin';
  -- This staged transport is QA-only. Production needs a separate reviewed path.
  -- A misplaced QA secret can never direct this function to the production site.
  if chatops_token is null or chatops_origin is distinct from
    'https://initial-baseball-web-git-qa-officia-2a5bf9-kastnerjons-projects.vercel.app' then
    raise exception 'Daily ChatOps transport is not configured.';
  end if;
  select net.http_post(
    url := chatops_origin || '/admin/daily/editions/chatops', body := p_request,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || chatops_token), timeout_milliseconds := 10000
  ) into request_id;
  return request_id;
end;
$$;

revoke all on function private.dispatch_official_daily_edition_chatops(jsonb) from public;
revoke all on function private.dispatch_official_daily_edition_chatops(jsonb) from anon;
revoke all on function private.dispatch_official_daily_edition_chatops(jsonb) from authenticated;
comment on function private.dispatch_official_daily_edition_chatops(jsonb)
is 'Private transport-only bridge; no editorial mutations occur here.';
