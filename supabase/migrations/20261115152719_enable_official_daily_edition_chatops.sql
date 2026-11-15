-- QA-only synchronous, private HTTP transport; NOT approved for production.
-- Isolate the HTTP extension in a non-exposed schema to prevent public role access.
create schema if not exists private_http;
revoke all on schema private_http from public, anon, authenticated;
create extension if not exists http with schema private_http;
create schema if not exists private;
revoke all on schema private from public;

create function private.dispatch_official_daily_edition_chatops(p_request jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
declare
  chatops_token text;
  chatops_origin text;
  http_reply private_http.http_response;
  reply_body jsonb;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object'
      or octet_length(p_request::text) > 8192 then
    raise exception 'Invalid Daily edition ChatOps request.';
  end if;
  select decrypted_secret into chatops_token
    from vault.decrypted_secrets where name = 'daily_chatops_token';
  select decrypted_secret into chatops_origin
    from vault.decrypted_secrets where name = 'daily_edition_chatops_origin';
  -- QA-only hostname allowlist; production and caller-specified origins are denied.
  if chatops_token is null or chatops_origin is distinct from
    'https://initial-baseball-web-git-qa-officia-2a5bf9-kastnerjons-projects.vercel.app' then
    raise exception 'Daily ChatOps transport is not configured.';
  end if;
  -- Use a bounded synchronous call. Neither headers, body nor reply are
  -- queued in an asynchronous shared database request/response table.
  perform private_http.http_set_curlopt('CURLOPT_TIMEOUT_MS', '10000');
  begin
    select h.* into http_reply
      from private_http.http(row(
        'POST'::text,
        chatops_origin || '/admin/daily/editions/chatops',
        array[
          row('Content-Type', 'application/json')::private_http.http_header,
          row('Authorization', 'Bearer ' || chatops_token)::private_http.http_header
        ]::private_http.http_header[],
        'application/json'::text,
        p_request::text
      )::private_http.http_request) h;
  exception when others then
    perform private_http.http_reset_curlopt();
    raise exception 'Daily ChatOps transport unavailable.';
  end;
  perform private_http.http_reset_curlopt();
  if http_reply.status is null or http_reply.status < 100 or http_reply.status > 599
      or http_reply.content is null or octet_length(http_reply.content) > 32768 then
    raise exception 'Daily ChatOps transport unavailable.';
  end if;
  begin
    reply_body := http_reply.content::jsonb;
  exception when others then
    raise exception 'Daily ChatOps transport unavailable.';
  end;
  if jsonb_typeof(reply_body) <> 'object' then
    raise exception 'Daily ChatOps transport unavailable.';
  end if;
  return jsonb_build_object('httpStatus', http_reply.status, 'body', reply_body);
end;
$$;

revoke all on function private.dispatch_official_daily_edition_chatops(jsonb) from public;
revoke all on function private.dispatch_official_daily_edition_chatops(jsonb) from anon;
revoke all on function private.dispatch_official_daily_edition_chatops(jsonb) from authenticated;
comment on function private.dispatch_official_daily_edition_chatops(jsonb)
is 'QA-only private synchronous transport; application owns editorial validation/writes.';
