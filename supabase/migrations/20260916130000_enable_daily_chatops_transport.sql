create extension if not exists pg_net;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.dispatch_daily_lineup_chatops(
  p_puzzle_date text,
  p_canonical_player_ids text[],
  p_schedule boolean
)
returns bigint
language plpgsql
security invoker
set search_path = pg_catalog, public, vault, net
as $$
declare
  chatops_token text;
  request_id bigint;
begin
  select decrypted_secret
  into chatops_token
  from vault.decrypted_secrets
  where name = 'daily_chatops_token';

  if chatops_token is null then
    raise exception 'Daily ChatOps transport is not configured.';
  end if;

  select net.http_post(
    url := 'https://initial-baseball-web.vercel.app/admin/daily/chatops',
    body := jsonb_build_object(
      'puzzleDate', p_puzzle_date,
      'canonicalPlayerIds', to_jsonb(p_canonical_player_ids),
      'schedule', p_schedule
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || chatops_token
    ),
    timeout_milliseconds := 10000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function private.dispatch_daily_lineup_chatops(text, text[], boolean) from public;
revoke all on function private.dispatch_daily_lineup_chatops(text, text[], boolean) from anon;
revoke all on function private.dispatch_daily_lineup_chatops(text, text[], boolean) from authenticated;

comment on function private.dispatch_daily_lineup_chatops(text, text[], boolean)
is 'Private transport-only bridge to the Initial Baseball Daily ChatOps server route. Domain lifecycle remains in the application.';
