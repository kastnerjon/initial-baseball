-- Rollback-only, isolated test of additive issued title constraints and permissions.
begin;
do $test$
declare
  v_legacy_count bigint;
  v_current_count bigint;
  v_title_count bigint;
  v_null_count bigint;
begin
  select count(*) into v_current_count from public.custom_nine_issued_challenges;
  select count(*) into v_legacy_count from public.custom_nine_issued_challenges where schema_version = 1;
  select count(*) into v_title_count from public.custom_nine_issued_challenges
    where display_title is not null;
  select count(*) into v_null_count from public.custom_nine_issued_challenges
    where display_title is null;
  if v_current_count <> v_title_count + v_null_count then
    raise exception 'Additive title column lost old issued records';
  end if;
  if (select count(*) from public.custom_nine_issued_challenges where schema_version = 1)
    <> v_legacy_count then
    raise exception 'Legacy rows changed';
  end if;
  if has_table_privilege('anon','public.custom_nine_issued_challenges','SELECT')
    or has_table_privilege('authenticated','public.custom_nine_issued_challenges','SELECT') then
    raise exception 'Answer-bearing table exposed to browser roles';
  end if;
  if not (select relrowsecurity from pg_class where oid =
    'public.custom_nine_issued_challenges'::regclass) then
    raise exception 'Issued challenge RLS disabled';
  end if;
  -- Exercise title constraints against a real valid one-player v2 issued row.
  -- The whole fixture is rolled back; no synthetic game enters production.
  with player as (
    select jsonb_build_array('test-player-1') as ids
  ), hints as (
    select jsonb_build_object(
      'schemaVersion',1,
      'hintLayout',jsonb_build_array(
        jsonb_build_object('slot',1,'hintType','main_decade','displayLabel','Decade'),
        jsonb_build_object('slot',2,'hintType','teams','displayLabel','Teams'),
        jsonb_build_object('slot',3,'hintType','position','displayLabel','Position'),
        jsonb_build_object('slot',4,'hintType','stats','displayLabel','Stats')
      ),
      'pitches',jsonb_build_array(jsonb_build_object(
        'pitchNumber',1,'canonicalPlayerId','test-player-1','initials','TP',
        'hintValues',jsonb_build_array('2000s','NYM','2B','HR 22')
      ))
    ) as snapshot
  )
  insert into public.custom_nine_issued_challenges(
    puzzle_id,schema_version,ruleset_version,canonical_player_ids,
    clue_snapshot,issued_at,display_title
  )
  select 'custom-lineup-v2-' || gen_random_uuid()::text,2,'points-v4',
    player.ids,hints.snapshot,now(),'Named Test Lineup'
  from player,hints;
  if (select count(*) from public.custom_nine_issued_challenges) <> v_current_count + 1 then
    raise exception 'Named v2 issued row failed insert';
  end if;
  begin
    update public.custom_nine_issued_challenges set display_title='aa'
      where display_title='Named Test Lineup';
    raise exception 'Short title unexpectedly accepted';
  exception when check_violation then null;
  end;
  begin
    update public.custom_nine_issued_challenges set display_title='<script>'
      where display_title='Named Test Lineup';
    raise exception 'Markup title unexpectedly accepted';
  exception when check_violation then null;
  end;
  begin
    update public.custom_nine_issued_challenges set display_title=repeat('a',61)
      where display_title='Named Test Lineup';
    raise exception 'Overlong title unexpectedly accepted';
  exception when check_violation then null;
  end;
  if not exists (
    select 1 from pg_constraint
    where conname = 'custom_v2_issued_title_shape'
      and conrelid = 'public.custom_nine_issued_challenges'::regclass
      and convalidated
  ) then raise exception 'Title constraint not validated'; end if;
end $test$;
rollback;
