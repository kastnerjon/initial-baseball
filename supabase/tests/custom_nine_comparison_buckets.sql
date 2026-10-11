-- Run manually *after* the private comparison migration is installed.
-- All fixture writes are in this transaction and MUST roll back, even on success.
-- NEVER run as a standalone migration: this test inserts synthetic scores.
begin;

insert into public.custom_nine_issued_challenges (
  puzzle_id, schema_version, ruleset_version, canonical_player_ids, clue_snapshot, issued_at
)
select id, 1, 'points-v4',
  to_jsonb(array(select 'player-' || n from generate_series(1,9) n)),
  jsonb_build_object(
    'schemaVersion', 1,
    'hintLayout', jsonb_build_array('H1','H2','H3','H4'),
    'pitches', (
      select jsonb_agg(jsonb_build_object(
        'pitchNumber', n, 'initials', 'P' || n,
        'hintValues', jsonb_build_array('one','two','three','four')
      ) order by n) from generate_series(1,9) n
    )
  ), now()
from (values
  ('custom-nine-v1-11111111-1111-4111-8111-111111111111'),
  ('custom-nine-v1-22222222-2222-4222-8222-222222222222')
) as challenge(id);

insert into public.custom_nine_completed_results (
  submission_id, challenge_id, schema_version, ruleset_version, completed_at_bats, summary
) values
('cn-test-a1', 'custom-nine-v1-11111111-1111-4111-8111-111111111111', 1,
 'points-v4', '[{}]'::jsonb, '{"points":10}'::jsonb),
('cn-test-a2', 'custom-nine-v1-11111111-1111-4111-8111-111111111111', 1,
 'points-v4', '[{}]'::jsonb, '{"points":12.5}'::jsonb),
('cn-test-b1', 'custom-nine-v1-22222222-2222-4222-8222-222222222222', 1,
 'points-v4', '[{}]'::jsonb, '{"points":33}'::jsonb);

insert into public.custom_nine_at_bat_results (
  attempt_id, challenge_id, schema_version, ruleset_version,
  pitch_number, initials, outcome, hints_revealed, wrong_guesses,
  resolution, awarded_points
) values
('cn-test-a1','custom-nine-v1-11111111-1111-4111-8111-111111111111',1,'points-v4',1,'P1','HR',0,0,'correct',4),
('cn-test-a2','custom-nine-v1-11111111-1111-4111-8111-111111111111',1,'points-v4',1,'P1','BB',4,0,'correct',0.5),
('cn-test-a1','custom-nine-v1-11111111-1111-4111-8111-111111111111',1,'points-v4',2,'P2','K',0,3,'strikeout',0),
('cn-test-b1','custom-nine-v1-22222222-2222-4222-8222-222222222222',1,'points-v4',1,'P1','2B',2,0,'correct',2),
-- An AB without an accepted completion MUST NOT be a peer.
('cn-test-orphan','custom-nine-v1-11111111-1111-4111-8111-111111111111',1,'points-v4',1,'P1','HR',0,0,'correct',4);

do $assert$
declare
  a constant text := 'custom-nine-v1-11111111-1111-4111-8111-111111111111';
  b constant text := 'custom-nine-v1-22222222-2222-4222-8222-222222222222';
  bucket jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_array(points, result_count) order by points), '[]'::jsonb)
    into bucket from public.custom_nine_at_bat_score_buckets_v1(a, 1, null);
  if bucket <> '[[0.5,1],[4,1]]'::jsonb then
    raise exception 'Custom AB challenge A / orphan exclusion failed: %', bucket;
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(points, result_count) order by points), '[]'::jsonb)
    into bucket from public.custom_nine_at_bat_score_buckets_v1(a, 1, 'cn-test-a1');
  if bucket <> '[[0.5,1]]'::jsonb then
    raise exception 'Custom AB own-result exclusion failed: %', bucket;
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(points, result_count) order by points), '[]'::jsonb)
    into bucket from public.custom_nine_at_bat_score_buckets_v1(a, 2, 'cn-test-a1');
  if bucket <> '[]'::jsonb then
    raise exception 'Custom AB no-other-result behavior failed: %', bucket;
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(points, result_count) order by points), '[]'::jsonb)
    into bucket from public.custom_nine_at_bat_score_buckets_v1(b, 1, null);
  if bucket <> '[[2,1]]'::jsonb then
    raise exception 'Custom AB challenge isolation failed: %', bucket;
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(points, result_count) order by points), '[]'::jsonb)
    into bucket from public.custom_nine_at_bat_score_buckets_v1(a, 10, null);
  if bucket <> '[]'::jsonb then
    raise exception 'Custom invalid pitch admitted: %', bucket;
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(points, result_count) order by points), '[]'::jsonb)
    into bucket from public.custom_nine_completed_score_buckets_v1(a, null);
  if bucket <> '[[10,1],[12.5,1]]'::jsonb then
    raise exception 'Custom completed challenge A buckets failed: %', bucket;
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(points, result_count) order by points), '[]'::jsonb)
    into bucket from public.custom_nine_completed_score_buckets_v1(a, 'cn-test-a1');
  if bucket <> '[[12.5,1]]'::jsonb then
    raise exception 'Custom completed own-result exclusion failed: %', bucket;
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(points, result_count) order by points), '[]'::jsonb)
    into bucket from public.custom_nine_completed_score_buckets_v1(b, null);
  if bucket <> '[[33,1]]'::jsonb then
    raise exception 'Custom completed challenge isolation failed: %', bucket;
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(points, result_count) order by points), '[]'::jsonb)
    into bucket from public.custom_nine_completed_score_buckets_v1(a, 'cn-test-a2');
  if bucket <> '[[10,1]]'::jsonb then
    raise exception 'Custom only-one-peer behavior failed: %', bucket;
  end if;

  if has_function_privilege('anon',
     'public.custom_nine_at_bat_score_buckets_v1(text,smallint,text)', 'execute')
    or has_function_privilege('authenticated',
     'public.custom_nine_completed_score_buckets_v1(text,text)', 'execute')
    or not has_function_privilege('service_role',
     'public.custom_nine_at_bat_score_buckets_v1(text,smallint,text)', 'execute')
    or not has_function_privilege('service_role',
     'public.custom_nine_completed_score_buckets_v1(text,text)', 'execute') then
    raise exception 'Custom comparison function privilege isolation failed';
  end if;
end;
$assert$;

rollback;
