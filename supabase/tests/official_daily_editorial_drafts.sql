-- Disposable PostgreSQL 17 test. Every fixture is rolled back.
begin;
do $checks$
begin
  if not (select relrowsecurity from pg_class
          where oid='public.official_daily_editorial_drafts'::regclass) then
    raise exception 'Draft table must have RLS';
  end if;
  if has_table_privilege('anon','public.official_daily_editorial_drafts','SELECT')
     or has_table_privilege('authenticated','public.official_daily_editorial_drafts','INSERT')
     or has_function_privilege('anon',
       'public.issue_official_daily_editorial_draft(uuid,integer,jsonb)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.issue_official_daily_editorial_draft(uuid,integer,jsonb)','EXECUTE')
     or not has_function_privilege('service_role',
       'public.issue_official_daily_editorial_draft(uuid,integer,jsonb)','EXECUTE') then
    raise exception 'Official Daily draft or issuer privileges are unsafe';
  end if;
end;
$checks$;

set local role service_role;
do $test$
declare
  first_id uuid := '00000000-0000-4000-8000-000000000011';
  second_id uuid := '00000000-0000-4000-8000-000000000012';
  selections jsonb;
  snapshot jsonb;
  invalid_snapshot jsonb;
  result_status text;
  result_id text;
  row_count_after_issue integer;
begin
  selections := (select jsonb_agg(jsonb_build_object(
      'slot', n, 'canonicalPlayerId', 'fixture-' || n, 'source', 'manual') order by n)
    from generate_series(1,9) n);
  snapshot := jsonb_build_object(
    'schemaVersion', 1,
    'hintLayout', (select jsonb_agg(jsonb_build_object(
      'slot', n, 'hintType', hint, 'displayLabel', hint) order by n)
      from unnest(array['main_decade','teams','position','stats'])
        with ordinality h(hint,n)),
    'pitches', (select jsonb_agg(jsonb_build_object(
      'pitchNumber', n, 'canonicalPlayerId', 'fixture-' || n,
      'initials', 'AB', 'hintValues', array['1980s','NYM','CF','3 HR']) order by n)
      from generate_series(1,9) n)
  );
  invalid_snapshot := jsonb_set(snapshot, '{pitches,0,canonicalPlayerId}', '"wrong-player"');

  insert into public.official_daily_editorial_drafts
    (occurrence_id,puzzle_date,puzzle_number,edition_key,edition_number,title,
      selections,created_by,updated_by)
  values
    (first_id,'2099-04-09',90,'modern',2,'Modern',selections,'fixture-admin','fixture-admin');

  select x.status, x.puzzle_id into result_status,result_id
    from public.issue_official_daily_editorial_draft(first_id,0,snapshot) x;
  if result_status <> 'conflict' or result_id is not null then
    raise exception 'Draft issuance must be rejected';
  end if;

  update public.official_daily_editorial_drafts
     set status='scheduled', revision=1, updated_at=now()
   where occurrence_id=first_id;

  select x.status into result_status
    from public.issue_official_daily_editorial_draft(first_id,0,snapshot) x;
  if result_status <> 'conflict' then raise exception 'Stale revision succeeded'; end if;

  select x.status into result_status
    from public.issue_official_daily_editorial_draft(first_id,1,invalid_snapshot) x;
  if result_status <> 'conflict' then raise exception 'Wrong batting-order clues succeeded'; end if;

  select x.status, x.puzzle_id into result_status,result_id
    from public.issue_official_daily_editorial_draft(first_id,1,snapshot) x;
  if result_status <> 'created'
     or result_id <> 'daily-ed-v1-' || first_id::text then
    raise exception 'Valid issuance failed';
  end if;
  select count(*) into row_count_after_issue
    from public.official_daily_publications;
  if row_count_after_issue <> 1 then raise exception 'First issuance missing'; end if;

  select x.status, x.puzzle_id into result_status,result_id
    from public.issue_official_daily_editorial_draft(first_id,1,snapshot) x;
  if result_status <> 'existing'
     or result_id <> 'daily-ed-v1-' || first_id::text then
    raise exception 'Identical retry was not accepted';
  end if;
  select x.status into result_status
    from public.issue_official_daily_editorial_draft(first_id,1,invalid_snapshot) x;
  if result_status <> 'conflict' then raise exception 'Conflicting retry accepted'; end if;

  begin
    update public.official_daily_editorial_drafts
      set title='Replacement',revision=2 where occurrence_id=first_id;
    raise exception 'Issued editorial content was mutable';
  exception when check_violation then null;
  end;
  begin
    update public.official_daily_publications
      set title='Replacement' where puzzle_id='daily-ed-v1-' || first_id::text;
    raise exception 'Published content was mutable';
  exception when insufficient_privilege then null;
  end;

  -- Identical rosters on the same date have distinct IDs and cohorts.
  insert into public.official_daily_editorial_drafts
    (occurrence_id,puzzle_date,puzzle_number,edition_key,edition_number,title,
      selections,status,revision,created_by,updated_by)
  values
    (second_id,'2099-04-09',90,'mixed',3,'Mixed',
      selections,'scheduled',1,'fixture-admin','fixture-admin');
  select x.status,x.puzzle_id into result_status,result_id
    from public.issue_official_daily_editorial_draft(second_id,1,snapshot) x;
  if result_status <> 'created'
     or result_id = 'daily-ed-v1-' || first_id::text then
    raise exception 'Second edition was not independent';
  end if;
  select count(*) into row_count_after_issue
    from public.official_daily_publications;
  if row_count_after_issue <> 2 then raise exception 'Multiple editions were not stored'; end if;

  begin
    insert into public.official_daily_editorial_drafts
      (puzzle_date,puzzle_number,edition_key,edition_number,title,selections,created_by,updated_by)
    values ('2099-04-09',90,'modern',4,'Conflict',selections,'fixture-admin','fixture-admin');
    raise exception 'Duplicate edition key accepted';
  exception when unique_violation then null;
  end;
end;
$test$;
rollback;
