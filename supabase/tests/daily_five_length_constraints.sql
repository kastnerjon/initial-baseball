-- Run only after installing migration 20261013160000; this fixture is
-- transactional and leaves no issued/editorial rows behind.
begin;

do $test$
declare
  five_ids jsonb;
  nine_ids jsonb;
  five_selections jsonb;
  nine_selections jsonb;
  five_pitches jsonb;
  nine_pitches jsonb;
  five_clues jsonb;
  nine_clues jsonb;
  hints jsonb := '[{"slot":1,"hintType":"main_decade","displayLabel":"Era"},{"slot":2,"hintType":"teams","displayLabel":"Teams"},{"slot":3,"hintType":"position","displayLabel":"Position"},{"slot":4,"hintType":"stats","displayLabel":"Stats"}]'::jsonb;
begin
  select jsonb_agg('fixture-player-' || i order by i),
         jsonb_agg(jsonb_build_object('slot', i, 'canonicalPlayerId', 'fixture-player-' || i, 'source', 'manual') order by i),
         jsonb_agg(jsonb_build_object('pitchNumber',i,'canonicalPlayerId','fixture-player-' || i,'initials','FP','hintValues',jsonb_build_array('a','b','c','d')) order by i)
    into five_ids, five_selections, five_pitches
    from generate_series(1, 5) as i;
  select jsonb_agg('fixture-player-' || i order by i),
         jsonb_agg(jsonb_build_object('slot', i, 'canonicalPlayerId', 'fixture-player-' || i, 'source', 'manual') order by i),
         jsonb_agg(jsonb_build_object('pitchNumber',i,'canonicalPlayerId','fixture-player-' || i,'initials','FP','hintValues',jsonb_build_array('a','b','c','d')) order by i)
    into nine_ids, nine_selections, nine_pitches
    from generate_series(1, 9) as i;
  five_clues := jsonb_build_object('schemaVersion',1,'hintLayout',hints,'pitches',five_pitches);
  nine_clues := jsonb_build_object('schemaVersion',1,'hintLayout',hints,'pitches',nine_pitches);

  -- Legacy defaults and versioned five-player editorial rows both work.
  insert into public.daily_editorial_puzzles
    (id,puzzle_date,puzzle_number,status,selections,created_at,created_by,updated_at,updated_by)
  values ('length-fixture-nine','2099-01-01',999990,'draft',nine_selections,now(),'fixture',now(),'fixture');
  insert into public.daily_editorial_puzzles
    (id,puzzle_date,puzzle_number,status,selections,lineup_contract_version,created_at,created_by,updated_at,updated_by)
  values ('length-fixture-five','2099-01-02',999991,'draft',five_selections,2,now(),'fixture',now(),'fixture');

  begin
    insert into public.daily_editorial_puzzles
      (id,puzzle_date,puzzle_number,status,selections,created_at,created_by,updated_at,updated_by)
    values ('invalid-five-legacy','2099-01-03',999992,'draft',five_selections,now(),'fixture',now(),'fixture');
    raise exception 'Legacy editorial contract incorrectly admitted five players.';
  exception when check_violation then null;
  end;
  begin
    insert into public.daily_editorial_puzzles
      (id,puzzle_date,puzzle_number,status,selections,lineup_contract_version,created_at,created_by,updated_at,updated_by)
    values ('invalid-nine-new','2099-01-04',999993,'draft',nine_selections,2,now(),'fixture',now(),'fixture');
    raise exception 'Future editorial contract incorrectly admitted nine players.';
  exception when check_violation then null;
  end;

  -- Historical issued v2 preserves nine, and only new schema v3 admits five.
  insert into public.permanent_daily_issued_puzzles
    (series_version,daily_number,puzzle_date,schema_version,puzzle_id,canonical_player_ids,clue_snapshot,issued_at)
  values ('archive-beta-v1',999990,'2099-01-05',2,'archive-beta-v1-daily-999990',nine_ids,nine_clues,now());
  insert into public.permanent_daily_issued_puzzles
    (series_version,daily_number,puzzle_date,schema_version,puzzle_id,canonical_player_ids,clue_snapshot,issued_at)
  values ('archive-beta-v1',999991,'2099-01-06',3,'archive-beta-v1-daily-999991',five_ids,five_clues,now());

  begin
    insert into public.permanent_daily_issued_puzzles
      (series_version,daily_number,puzzle_date,schema_version,puzzle_id,canonical_player_ids,clue_snapshot,issued_at)
    values ('archive-beta-v1',999992,'2099-01-07',2,'archive-beta-v1-daily-999992',five_ids,five_clues,now());
    raise exception 'Issued schema v2 incorrectly admitted five players.';
  exception when check_violation then null;
  end;
  begin
    insert into public.permanent_daily_issued_puzzles
      (series_version,daily_number,puzzle_date,schema_version,puzzle_id,canonical_player_ids,clue_snapshot,issued_at)
    values ('archive-beta-v1',999993,'2099-01-08',3,'archive-beta-v1-daily-999993',nine_ids,nine_clues,now());
    raise exception 'Issued schema v3 incorrectly admitted nine players.';
  exception when check_violation then null;
  end;
  begin
    insert into public.permanent_daily_issued_puzzles
      (series_version,daily_number,puzzle_date,schema_version,puzzle_id,canonical_player_ids,clue_snapshot,issued_at)
    values ('archive-beta-v1',999994,'2099-01-09',3,'archive-beta-v1-daily-999994',five_ids,null,now());
    raise exception 'Issued schema v3 incorrectly admitted an absent clue snapshot.';
  exception when check_violation then null;
  end;
end
$test$;

rollback;
