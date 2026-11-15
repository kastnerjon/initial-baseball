-- Run after the transport migration in an isolated database; rolls back.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '15s';
do $test$
begin
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
rollback;
