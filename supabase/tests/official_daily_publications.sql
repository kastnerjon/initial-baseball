-- Run with ON_ERROR_STOP on an isolated database after applying the migration.
begin;
do $test$
declare
  r text;
  p text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.official_daily_publications'::regclass) then
    raise exception 'Issued publications require RLS';
  end if;
  foreach r in array array['anon','authenticated','service_role'] loop
    foreach p in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      if has_table_privilege(r, 'public.official_daily_publications', p)
         <> (r = 'service_role' and p in ('SELECT','INSERT')) then
        raise exception 'Unexpected % privilege for %', p, r;
      end if;
    end loop;
  end loop;
end;
$test$;

set local role service_role;
do $test$
declare
  first_id constant text := 'daily-ed-v1-00000000-0000-4000-8000-000000000001';
  second_id constant text := 'daily-ed-v1-00000000-0000-4000-8000-000000000002';
  puzzle_day constant date := '2099-04-09';
  snapshot jsonb;
  row_count_after_retry integer;
begin
  snapshot := jsonb_build_object(
    'schemaVersion', 1,
    'hintLayout', (select jsonb_agg(jsonb_build_object('slot', n, 'hintType', hint, 'displayLabel', hint) order by n)
      from unnest(array['main_decade','teams','position','stats']) with ordinality hints(hint,n)),
    'pitches', (select jsonb_agg(jsonb_build_object('pitchNumber', n, 'canonicalPlayerId', 'fixture-' || n,
      'initials', 'AB', 'hintValues', array['1980s','NYM','CF','3 HR']) order by n) from generate_series(1,9) n)
  );
  insert into public.official_daily_publications
    (puzzle_id,puzzle_date,puzzle_number,edition_key,edition_number,title,schema_version,ruleset_version,clue_snapshot)
  values
    (first_id,puzzle_day,90,'modern',1,'Modern',1,'points-v4',snapshot),
    (second_id,puzzle_day,90,'mixed',2,'Mixed',1,'points-v4',snapshot);

  insert into public.official_daily_publications select * from public.official_daily_publications
    where puzzle_id = first_id on conflict (puzzle_id) do nothing;
  get diagnostics row_count_after_retry = row_count;
  if row_count_after_retry <> 0 then raise exception 'Retry inserted a duplicate'; end if;

  begin
    insert into public.official_daily_publications
      select 'daily-ed-v1-00000000-0000-4000-8000-000000000003',puzzle_day,90,'modern',3,'Another',1,'points-v4',snapshot,now();
    raise exception 'Duplicate edition key accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.official_daily_publications
      select 'daily-ed-v1-00000000-0000-4000-8000-000000000003',puzzle_day,90,'third',2,'Another',1,'points-v4',snapshot,now();
    raise exception 'Duplicate edition number accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.official_daily_publications
      select 'daily-ed-v1-00000000-0000-4000-8000-000000000003',puzzle_day,90,'third',3,'Another',1,'points-v4',snapshot - 'pitches',now();
    raise exception 'Missing pitch array accepted';
  exception when check_violation then null;
  end;
  begin
    update public.official_daily_publications set title = 'Replacement' where puzzle_id = first_id;
    raise exception 'Service writer replaced a published puzzle';
  exception when insufficient_privilege then null;
  end;
end;
$test$;
rollback;
