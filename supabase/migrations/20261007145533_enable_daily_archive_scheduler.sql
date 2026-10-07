create extension if not exists pg_cron with schema pg_catalog;

-- Reuse the deployed machine credential; never copy its value into migration text.
create or replace function private.dispatch_daily_archive_rollover()
returns bigint
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  chatops_token text;
  request_id bigint;
begin
  select decrypted_secret into chatops_token
  from vault.decrypted_secrets
  where name = 'daily_chatops_token';

  if chatops_token is null or length(chatops_token) < 32 then
    raise exception 'Daily archive transport is not configured.';
  end if;

  select net.http_post(
    url := 'https://initial-baseball-web.vercel.app/admin/daily/archive-beta/rollover',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || chatops_token
    ),
    timeout_milliseconds := 60000
  ) into request_id;
  return request_id;
end;
$$;

revoke all on function private.dispatch_daily_archive_rollover() from public, anon, authenticated;
comment on function private.dispatch_daily_archive_rollover()
is 'Private transport only; the application owns completed-date policy, publication and immutable issuance.';

-- Pacific midnight is 07:00 UTC in daylight time and 08:00 UTC in standard time.
-- Each pass catches up all completed dates; today/future remain app-fenced.
select cron.schedule(
  'daily-archive-rollover',
  '0 7,8 * * *',
  'select private.dispatch_daily_archive_rollover();'
);
