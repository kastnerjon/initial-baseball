-- Disposable isolated-QA regression for the additive secondary editorial date guard.
-- Apply the candidate migration in QA first, then run this entire fixture in ROLLBACK.
-- Real Pacific midnight lock-wait acceptance remains a separate hosted release gate.
begin;

set local lock_timeout = '2s';
set local statement_timeout = '20s';

do $checks$
begin
  if to_regprocedure('public.guard_official_daily_editorial_future_date_write()') is null then
    raise exception 'Future-date row guard missing';
  end if;
  if has_function_privilege('anon', 'public.guard_official_daily_editorial_future_date_write()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.guard_official_daily_editorial_future_date_write()', 'EXECUTE')
    or not (select relrowsecurity from pg_class where oid='public.official_daily_editorial_drafts'::regclass) then
    raise exception 'Guard execution permissions or editorial RLS unexpectedly relaxed';
  end if;
  if not exists (select 1 from pg_trigger
        where tgrelid='public.official_daily_editorial_drafts'::regclass
          and tgname='a_official_daily_editorial_future_date'
          and tgenabled in ('O','A'))
    or not exists (select 1 from pg_trigger
        where tgrelid='public.official_daily_editorial_drafts'::regclass
          and tgname='guard_official_daily_editorial_draft'
          and tgenabled in ('O','A')) then
    raise exception 'The new and original editorial integrity guards must coexist';
  end if;
  if ('2026-03-08T07:59:59Z'::timestamptz at time zone 'America/Los_Angeles')::date <> date '2026-03-07'
    or ('2026-03-08T08:00:00Z'::timestamptz at time zone 'America/Los_Angeles')::date <> date '2026-03-08'
    or ('2026-11-01T06:59:59Z'::timestamptz at time zone 'America/Los_Angeles')::date <> date '2026-10-31'
    or ('2026-11-01T07:00:00Z'::timestamptz at time zone 'America/Los_Angeles')::date <> date '2026-11-01' then
    raise exception 'Pacific midnight / DST conversion incorrect';
  end if;
end;
$checks$;

-- Use the *real* migration trigger on a disposable shadow table. These rows
-- test elapsed-day status transitions without weakening actual QA constraints.
create temporary table qa_elapsed_date (
  id integer primary key,
  puzzle_date date not null,
  status text not null
) on commit drop;
insert into qa_elapsed_date values
  (1, (clock_timestamp() at time zone 'America/Los_Angeles')::date - 1, 'draft'),
  (2, (clock_timestamp() at time zone 'America/Los_Angeles')::date - 1, 'scheduled');
create trigger qa_elapsed_date_guard before update on qa_elapsed_date
for each row execute function public.guard_official_daily_editorial_future_date_write();
do $elapsed$
declare
  v_rejected boolean;
begin
  v_rejected := false;
  begin
    update qa_elapsed_date set status='scheduled' where id=1;
  exception when check_violation then v_rejected := true; end;
  if not v_rejected or (select status from qa_elapsed_date where id=1) <> 'draft' then
    raise exception 'Elapsed draft scheduling was not rejected atomically';
  end if;
  v_rejected := false;
  begin
    update qa_elapsed_date set status='draft' where id=2;
  exception when check_violation then v_rejected := true; end;
  if not v_rejected or (select status from qa_elapsed_date where id=2) <> 'scheduled' then
    raise exception 'Elapsed scheduled edition was editable';
  end if;
  -- Actual immutable issuer can still finalize an already scheduled row
  -- after its day. Only the date guard is attached to this shadow table.
  update qa_elapsed_date set status='issued' where id=2;
  if (select status from qa_elapsed_date where id=2) <> 'issued' then
    raise exception 'Legitimate after-date issuance was blocked';
  end if;
end;
$elapsed$;

-- The real QA table, including its original integrity/issuer guards, is
-- exercised only with synthetic, transaction-rolled-back records.
set local role service_role;
do $service$
declare
  v_id uuid := gen_random_uuid();
  v_same_day uuid := gen_random_uuid();
  v_today date := (clock_timestamp() at time zone 'America/Los_Angeles')::date;
  v_future date := (clock_timestamp() at time zone 'America/Los_Angeles')::date + 366;
  v_selections jsonb;
  v_snapshot jsonb;
  v_blocked boolean := false;
  v_status text;
  v_puzzle_id text;
begin
  v_selections := (select jsonb_agg(jsonb_build_object(
    'slot', i, 'canonicalPlayerId', 'qa-synthetic-' || i, 'source','manual') order by i)
    from generate_series(1,9) i);
  begin
    insert into public.official_daily_editorial_drafts
      (occurrence_id,puzzle_date,puzzle_number,edition_key,edition_number,title,
       selections,created_by,updated_by)
    values (v_same_day,v_today,999999,'qa-guard-today',2147483599,
      'Synthetic same day',v_selections,'qa-fixture','qa-fixture');
  exception when check_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'Current Pacific date insert accepted'; end if;

  insert into public.official_daily_editorial_drafts
    (occurrence_id,puzzle_date,puzzle_number,edition_key,edition_number,title,
     selections,created_by,updated_by)
  values (v_id,v_future,999998,'qa-guard-future',2147483600,
    'Synthetic future',v_selections,'qa-fixture','qa-fixture');

  update public.official_daily_editorial_drafts
    set title='Synthetic future revised', revision=1, updated_by='qa-fixture'
    where occurrence_id=v_id;
  update public.official_daily_editorial_drafts
    set status='scheduled', revision=2, updated_by='qa-fixture'
    where occurrence_id=v_id;
  update public.official_daily_editorial_drafts
    set status='draft', revision=3, updated_by='qa-fixture'
    where occurrence_id=v_id;
  update public.official_daily_editorial_drafts
    set status='scheduled', revision=4, updated_by='qa-fixture'
    where occurrence_id=v_id;
  if not exists (select 1 from public.official_daily_editorial_drafts
      where occurrence_id=v_id and status='scheduled' and revision=4
        and title='Synthetic future revised') then
    raise exception 'Original future draft lifecycle or revision increments regressed';
  end if;

  v_snapshot := jsonb_build_object(
    'schemaVersion', 1,
    'hintLayout', (select jsonb_agg(jsonb_build_object(
      'slot',i, 'hintType',hint, 'displayLabel',hint) order by i)
      from unnest(array['main_decade','teams','position','stats'])
        with ordinality h(hint,i)),
    'pitches', (select jsonb_agg(jsonb_build_object(
      'pitchNumber',i,'canonicalPlayerId','qa-synthetic-' || i,
      'initials','AB','hintValues',array['1980s','NYM','CF','3 HR']) order by i)
      from generate_series(1,9) i)
  );
  select x.status,x.puzzle_id into v_status,v_puzzle_id
    from public.issue_official_daily_editorial_draft(v_id,4,v_snapshot) x;
  if v_status <> 'created' or v_puzzle_id <> 'daily-ed-v1-' || v_id::text then
    raise exception 'Existing immutable issue path was blocked';
  end if;
  if not exists (select 1 from public.official_daily_editorial_drafts
      where occurrence_id=v_id and status='issued' and revision=4) then
    raise exception 'Issued draft state/revision changed incorrectly';
  end if;
  select x.status,x.puzzle_id into v_status,v_puzzle_id
    from public.issue_official_daily_editorial_draft(v_id,4,v_snapshot) x;
  if v_status <> 'existing' or v_puzzle_id <> 'daily-ed-v1-' || v_id::text then
    raise exception 'Idempotent issuer retry no longer works';
  end if;
  v_blocked := false;
  begin
    update public.official_daily_editorial_drafts
       set title='Unauthorized mutation',revision=5 where occurrence_id=v_id;
  exception when check_violation then v_blocked := true; end;
  if not v_blocked then raise exception 'Existing issued immutability regressed'; end if;
end;
$service$;

rollback;
