-- No production fixture or privilege changes; run only after the migration.
begin;
do $test$
declare
  v_before bigint;
  v_id text := 'custom-lineup-v2-' || gen_random_uuid()::text;
begin
  select count(*) into v_before from public.custom_nine_issued_challenges;
  if not (select relrowsecurity from pg_class where oid =
    'public.custom_nine_issued_challenges'::regclass) then
    raise exception 'Issued RLS disabled';
  end if;
  if has_table_privilege('anon','public.custom_nine_issued_challenges','SELECT')
    or has_table_privilege('authenticated','public.custom_nine_issued_challenges','SELECT')
    or has_table_privilege('anon','public.custom_nine_issued_challenges','INSERT') then
    raise exception 'Browser role access widened';
  end if;
  if not exists (select 1 from pg_constraint where
    conrelid = 'public.custom_nine_issued_challenges'::regclass
    and conname = 'custom_v2_owner_capability_digest_shape' and convalidated) then
    raise exception 'Capability digest constraint not validated';
  end if;
  -- A valid v2 issued record can store a digest at the same time as issuance.
  insert into public.custom_nine_issued_challenges (
    puzzle_id, schema_version, ruleset_version, canonical_player_ids,
    clue_snapshot, issued_at, display_title, owner_capability_digest
  ) values (
    v_id,2,'points-v4',jsonb_build_array('test-player-1'),
    jsonb_build_object(
      'schemaVersion',1,
      'hintLayout',jsonb_build_array(
        jsonb_build_object('slot',1,'hintType','main_decade','displayLabel','Decade'),
        jsonb_build_object('slot',2,'hintType','teams','displayLabel','Teams'),
        jsonb_build_object('slot',3,'hintType','position','displayLabel','Position'),
        jsonb_build_object('slot',4,'hintType','stats','displayLabel','Stats')),
      'pitches',jsonb_build_array(jsonb_build_object(
        'pitchNumber',1,'canonicalPlayerId','test-player-1','initials','TP',
        'hintValues',jsonb_build_array('2000s','NYM','2B','HR 22')))),
    now(),'Test Named Puzzle',repeat('a',64)
  );
  if (select count(*) from public.custom_nine_issued_challenges) <> v_before + 1 then
    raise exception 'Capability digest insert failed';
  end if;
  foreach v_id in array array['short','NOTHEX' || repeat('a',58),''] loop
    begin
      update public.custom_nine_issued_challenges
        set owner_capability_digest = v_id
        where display_title='Test Named Puzzle';
      raise exception 'Malformed capability digest accepted';
    exception when check_violation then null;
    end;
  end loop;
  -- Never allow a v1 record to carry a v2 management verifier.
  begin
    update public.custom_nine_issued_challenges set schema_version = 1
      where display_title='Test Named Puzzle';
    raise exception 'Invalid v1 owner capability accepted';
  exception when check_violation then null;
  end;
end $test$;
rollback;
