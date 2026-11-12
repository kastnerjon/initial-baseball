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
  replacement_id uuid := '00000000-0000-4000-8000-000000000015';
  replacement_selections jsonb;
  replacement_count integer;
  selections jsonb;
  snapshot jsonb;
  invalid_snapshot jsonb;
  result_status text;
  result_id text;
  row_count_after_issue integer;
  bad_id uuid;
  bad_key text;
  bad_edition integer;
  bad_selections jsonb;
  bad_snapshot jsonb;
  bad_player_id text;
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
    (first_id,'2099-04-09',90,'modern',4,'Modern',selections,'fixture-admin','fixture-admin');

  select x.status, x.puzzle_id into result_status,result_id
    from public.issue_official_daily_editorial_draft(first_id,0,snapshot) x;
  if result_status is distinct from 'conflict' or result_id is not null then
    raise exception 'Draft issuance must be rejected';
  end if;

  update public.official_daily_editorial_drafts
     set status='scheduled', edition_number=2, revision=1, updated_at=now()
   where occurrence_id=first_id;

  select x.status,x.puzzle_id into result_status,result_id
    from public.issue_official_daily_editorial_draft(first_id,0,snapshot) x;
  if result_status is distinct from 'conflict' or result_id is not null then raise exception 'Stale revision succeeded'; end if;

  select x.status,x.puzzle_id into result_status,result_id
    from public.issue_official_daily_editorial_draft(first_id,1,invalid_snapshot) x;
  if result_status is distinct from 'conflict' or result_id is not null then raise exception 'Wrong batting-order clues succeeded'; end if;

  -- A direct UPDATE without an immutable publication must not strand a draft
  -- in issued state and prevent a later legitimate retry/issuance.
  begin
    update public.official_daily_editorial_drafts
      set status = 'issued', issued_at = now()
      where occurrence_id = first_id;
    raise exception 'Direct issuance without publication was accepted';
  exception when check_violation then null;
  end;
  if (select status from public.official_daily_editorial_drafts
      where occurrence_id = first_id) <> 'scheduled' then
    raise exception 'Rejected direct issuance changed the draft';
  end if;

  select x.status, x.puzzle_id into result_status,result_id
    from public.issue_official_daily_editorial_draft(first_id,1,snapshot) x;
  if result_status is distinct from 'created'
     or result_id is distinct from ('daily-ed-v1-' || first_id::text) then
    raise exception 'Valid issuance failed';
  end if;
  select count(*) into row_count_after_issue
    from public.official_daily_publications;
  if row_count_after_issue <> 1 then raise exception 'First issuance missing'; end if;

  select x.status, x.puzzle_id into result_status,result_id
    from public.issue_official_daily_editorial_draft(first_id,1,snapshot) x;
  if result_status is distinct from 'existing'
     or result_id is distinct from ('daily-ed-v1-' || first_id::text) then
    raise exception 'Identical retry was not accepted';
  end if;
  select x.status,x.puzzle_id into result_status,result_id
    from public.issue_official_daily_editorial_draft(first_id,1,invalid_snapshot) x;
  if result_status is distinct from 'conflict' or result_id is not null then raise exception 'Conflicting retry accepted'; end if;

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

  -- No writer may fabricate an already-issued draft without a frozen row.
  begin
    insert into public.official_daily_editorial_drafts
      (puzzle_date,puzzle_number,edition_key,edition_number,title,
       selections,status,revision,created_by,updated_by,issued_at)
    values ('2099-04-10',91,'invalid',2,'Invalid',selections,
      'issued',1,'fixture-admin','fixture-admin',now());
    raise exception 'Forged issued draft accepted';
  exception when check_violation then null;
  end;

  -- Identical rosters on the same date have distinct IDs and cohorts.
  insert into public.official_daily_editorial_drafts
    (occurrence_id,puzzle_date,puzzle_number,edition_key,edition_number,title,
      selections,created_by,updated_by)
  values
    (second_id,'2099-04-09',90,'mixed',3,'Mixed',
      selections,'fixture-admin','fixture-admin');
  update public.official_daily_editorial_drafts
    set status='scheduled', revision=1, updated_at=now()
    where occurrence_id=second_id;
  select x.status,x.puzzle_id into result_status,result_id
    from public.issue_official_daily_editorial_draft(second_id,1,snapshot) x;
  if result_status is distinct from 'created'
     or result_id is distinct from ('daily-ed-v1-' || second_id::text) then
    raise exception 'Second edition was not independent';
  end if;
  select count(*) into row_count_after_issue
    from public.official_daily_publications;
  if row_count_after_issue <> 2 then raise exception 'Multiple editions were not stored'; end if;

  -- Even a privileged direct UPDATE cannot turn forged duplicate or blank
  -- canonical player IDs into an issued draft, despite a matching publication.
  for bad_edition in 4..5 loop
    bad_id := case when bad_edition = 4
      then '00000000-0000-4000-8000-000000000013'::uuid
      else '00000000-0000-4000-8000-000000000014'::uuid end;
    bad_key := case when bad_edition = 4 then 'duplicate' else 'blank' end;
    bad_player_id := case when bad_edition = 4 then 'fixture-1' else '' end;
    bad_selections := jsonb_set(selections, '{8,canonicalPlayerId}', to_jsonb(bad_player_id));
    bad_snapshot := jsonb_set(snapshot, '{pitches,8,canonicalPlayerId}', to_jsonb(bad_player_id));

    insert into public.official_daily_editorial_drafts
      (occurrence_id,puzzle_date,puzzle_number,edition_key,edition_number,title,
       selections,created_by,updated_by)
    values (bad_id,'2099-04-09',90,bad_key,bad_edition,'Invalid',
      bad_selections,'fixture-admin','fixture-admin');
    update public.official_daily_editorial_drafts
      set status='scheduled', revision=1, updated_at=now()
      where occurrence_id=bad_id;
    insert into public.official_daily_publications
      (puzzle_id,puzzle_date,puzzle_number,edition_key,edition_number,title,
       schema_version,ruleset_version,clue_snapshot)
    values ('daily-ed-v1-' || bad_id::text,'2099-04-09',90,bad_key,bad_edition,
      'Invalid',1,'points-v4',bad_snapshot);
    begin
      update public.official_daily_editorial_drafts
        set status='issued', issued_at=now()
        where occurrence_id=bad_id;
      raise exception 'Forged issued draft accepted for %',bad_key;
    exception when check_violation then null;
    end;
    if (select status from public.official_daily_editorial_drafts
        where occurrence_id = bad_id) <> 'scheduled' then
      raise exception 'Forged issuance modified the draft for %',bad_key;
    end if;
  end loop;

  begin
    insert into public.official_daily_editorial_drafts
      (puzzle_date,puzzle_number,edition_key,edition_number,title,selections,created_by,updated_by)
    values ('2099-04-09',90,'modern',4,'Conflict',selections,'fixture-admin','fixture-admin');
    raise exception 'Duplicate edition key accepted';
  exception when unique_violation then null;
  end;

  -- #614: only one draft-only single-slot CAS may win. Stale or scheduled
  -- replacement must not modify the other eight immutable ordered slots.
  insert into public.official_daily_editorial_drafts
    (occurrence_id,puzzle_date,puzzle_number,edition_key,edition_number,title,
     selections,created_by,updated_by)
  values (replacement_id,'2099-04-11',92,'slot-edit',2,'Slot Edit',
    selections,'fixture-admin','fixture-admin');
  replacement_selections := jsonb_set(selections,'{3,canonicalPlayerId}',
    '"fixture-44"'::jsonb);
  update public.official_daily_editorial_drafts
    set selections=replacement_selections,revision=1,updated_by='fixture-admin'
    where occurrence_id=replacement_id and status='draft' and revision=0;
  get diagnostics replacement_count = row_count;
  if replacement_count<>1 then raise exception 'Draft slot CAS winner missing'; end if;
  update public.official_daily_editorial_drafts
    set selections=replacement_selections,revision=1
    where occurrence_id=replacement_id and status='draft' and revision=0;
  get diagnostics replacement_count = row_count;
  if replacement_count<>0 then raise exception 'Stale slot edit was admitted'; end if;
  if (select d.revision from public.official_daily_editorial_drafts d
      where d.occurrence_id=replacement_id)<>1
     or (select d.selections->3->>'canonicalPlayerId'
         from public.official_daily_editorial_drafts d
         where d.occurrence_id=replacement_id)<>'fixture-44'
     or (select d.selections
         from public.official_daily_editorial_drafts d
         where d.occurrence_id=replacement_id) is distinct from replacement_selections then
    raise exception 'Slot edit corrupted revision or another slot';
  end if;
  begin
    update public.official_daily_editorial_drafts
      set selections=jsonb_set(replacement_selections, '{3,canonicalPlayerId}',
            '"fixture-45"'::jsonb),revision=1
      where occurrence_id=replacement_id;
    raise exception 'No-bump edit bypassed revision trigger';
  exception when check_violation then null;
  end;
  update public.official_daily_editorial_drafts
    set status='scheduled',revision=2
    where occurrence_id=replacement_id and status='draft' and revision=1;
  get diagnostics replacement_count = row_count;
  if replacement_count<>1 then raise exception 'Draft scheduling CAS failed'; end if;
  update public.official_daily_editorial_drafts
    set selections=replacement_selections,revision=3
    where occurrence_id=replacement_id and status='draft' and revision=2;
  get diagnostics replacement_count = row_count;
  if replacement_count<>0 then raise exception 'Scheduled draft was edited'; end if;
end;
$test$;
rollback;
