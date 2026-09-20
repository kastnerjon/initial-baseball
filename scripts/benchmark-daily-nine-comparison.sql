\set ON_ERROR_STOP on

\if :{?scale}
\else
\set scale 100
\endif

\echo 'Resetting benchmark population for scale' :scale
truncate table public.daily_at_bat_results, public.daily_completed_results;

insert into public.daily_at_bat_results (
  attempt_id, schema_version, puzzle_id, puzzle_date, puzzle_number, ruleset_version,
  pitch_number, initials, outcome, hints_revealed, wrong_guesses, resolution, awarded_points
)
select
  format('target_%s_%s_%s', :scale, pitch_number, observation_number),
  1, 'benchmark-target', date '2099-01-01', 1, 'points-v3',
  pitch_number, 'AB', 'HR', 0, 0, 'correct',
  ((observation_number - 1) % 8)::smallint
from generate_series(1, 9) as pitch(pitch_number)
cross join generate_series(1, :scale) as observation(observation_number);

insert into public.daily_at_bat_results (
  attempt_id, schema_version, puzzle_id, puzzle_date, puzzle_number, ruleset_version,
  pitch_number, initials, outcome, hints_revealed, wrong_guesses, resolution, awarded_points
)
select
  format('noise_%s_%s_%s', :scale, pitch_number, observation_number),
  1, 'benchmark-noise', date '2099-01-02', 2, 'points-v3',
  pitch_number, 'CD', 'HR', 0, 0, 'correct',
  ((observation_number + 2) % 8)::smallint
from generate_series(1, 9) as pitch(pitch_number)
cross join generate_series(1, :scale) as observation(observation_number);

insert into public.daily_completed_results (
  submission_id, schema_version, puzzle_id, puzzle_date, puzzle_number, ruleset_version,
  completed_at_bats, summary
)
select
  format('target_completed_%s_%s', :scale, observation_number),
  1, 'benchmark-target', date '2099-01-01', 1, 'points-v3',
  '[
    {"pitchNumber":1,"initials":"AA","outcome":"HR","hintsRevealed":0,"wrongGuesses":0,"resolution":"correct"},
    {"pitchNumber":2,"initials":"BB","outcome":"3B","hintsRevealed":1,"wrongGuesses":0,"resolution":"correct"},
    {"pitchNumber":3,"initials":"CC","outcome":"2B","hintsRevealed":0,"wrongGuesses":1,"resolution":"correct"},
    {"pitchNumber":4,"initials":"DD","outcome":"1B","hintsRevealed":2,"wrongGuesses":0,"resolution":"correct"},
    {"pitchNumber":5,"initials":"EE","outcome":"BB","hintsRevealed":0,"wrongGuesses":2,"resolution":"correct"},
    {"pitchNumber":6,"initials":"FF","outcome":"K","hintsRevealed":0,"wrongGuesses":3,"resolution":"strikeout"},
    {"pitchNumber":7,"initials":"GG","outcome":"HR","hintsRevealed":3,"wrongGuesses":0,"resolution":"correct"},
    {"pitchNumber":8,"initials":"HH","outcome":"2B","hintsRevealed":1,"wrongGuesses":1,"resolution":"correct"},
    {"pitchNumber":9,"initials":"II","outcome":"K","hintsRevealed":0,"wrongGuesses":0,"resolution":"give_up"}
  ]'::jsonb,
  jsonb_build_object(
    'points', ((observation_number - 1) % 64),
    'maximumPoints', 63,
    'atBatsCompleted', 9,
    'totalAtBats', 9,
    'completed', true,
    'strikeouts', 2
  )
from generate_series(1, :scale) as observation(observation_number);

insert into public.daily_completed_results (
  submission_id, schema_version, puzzle_id, puzzle_date, puzzle_number, ruleset_version,
  completed_at_bats, summary
)
select
  format('noise_completed_%s_%s', :scale, observation_number),
  1, 'benchmark-noise', date '2099-01-02', 2, 'points-v3',
  '[
    {"pitchNumber":1,"initials":"JJ","outcome":"HR","hintsRevealed":0,"wrongGuesses":0,"resolution":"correct"},
    {"pitchNumber":2,"initials":"KK","outcome":"3B","hintsRevealed":1,"wrongGuesses":0,"resolution":"correct"},
    {"pitchNumber":3,"initials":"LL","outcome":"2B","hintsRevealed":0,"wrongGuesses":1,"resolution":"correct"},
    {"pitchNumber":4,"initials":"MM","outcome":"1B","hintsRevealed":2,"wrongGuesses":0,"resolution":"correct"},
    {"pitchNumber":5,"initials":"NN","outcome":"BB","hintsRevealed":0,"wrongGuesses":2,"resolution":"correct"},
    {"pitchNumber":6,"initials":"OO","outcome":"K","hintsRevealed":0,"wrongGuesses":3,"resolution":"strikeout"},
    {"pitchNumber":7,"initials":"PP","outcome":"HR","hintsRevealed":3,"wrongGuesses":0,"resolution":"correct"},
    {"pitchNumber":8,"initials":"QQ","outcome":"2B","hintsRevealed":1,"wrongGuesses":1,"resolution":"correct"},
    {"pitchNumber":9,"initials":"RR","outcome":"K","hintsRevealed":0,"wrongGuesses":0,"resolution":"give_up"}
  ]'::jsonb,
  jsonb_build_object(
    'points', ((observation_number + 7) % 64),
    'maximumPoints', 63,
    'atBatsCompleted', 9,
    'totalAtBats', 9,
    'completed', true,
    'strikeouts', 2
  )
from generate_series(1, :scale) as observation(observation_number);

analyze public.daily_at_bat_results;
analyze public.daily_completed_results;

select format(
  'CHECK|scale=%s|at_bat_target_rows=%s|completed_target_rows=%s',
  :scale,
  (select count(*) from public.daily_at_bat_results where puzzle_id = 'benchmark-target'),
  (select count(*) from public.daily_completed_results where puzzle_id = 'benchmark-target')
);

select format(
  'SIZE|scale=%s|relation=daily_at_bat_results|heap_bytes=%s|index_bytes=%s|total_bytes=%s',
  :scale,
  pg_relation_size('public.daily_at_bat_results'),
  pg_indexes_size('public.daily_at_bat_results'),
  pg_total_relation_size('public.daily_at_bat_results')
);

select format(
  'SIZE|scale=%s|relation=daily_completed_results|heap_bytes=%s|index_bytes=%s|total_bytes=%s',
  :scale,
  pg_relation_size('public.daily_completed_results'),
  pg_indexes_size('public.daily_completed_results'),
  pg_total_relation_size('public.daily_completed_results')
);

select format(
  'CHECK|scale=%s|shape=at_bat|resolved_count=%s',
  :scale,
  (
    select resolved_at_bat_count
    from public.daily_nine_at_bat_comparison(
      'benchmark-target', date '2099-01-01', 1, 'points-v3', 1::smallint
    )
  )
);

select format(
  'CHECK|scale=%s|shape=completed|bucket_count=%s|completed_count=%s',
  :scale, buckets, completed_count
)
from (
  select count(*) as buckets, coalesce(sum(result_count), 0) as completed_count
  from public.daily_nine_completed_score_buckets(
    'benchmark-target', date '2099-01-01', 1, 'points-v3'
  )
) as completed_check;

select format('PLAN|scale=%s|shape=at_bat', :scale);
explain (analyze, buffers, settings, summary)
select *
from public.daily_nine_at_bat_comparison(
  'benchmark-target', date '2099-01-01', 1, 'points-v3', 1::smallint
);

select format('PLAN|scale=%s|shape=completed', :scale);
explain (analyze, buffers, settings, summary)
select *
from public.daily_nine_completed_score_buckets(
  'benchmark-target', date '2099-01-01', 1, 'points-v3'
);

create temp table benchmark_latency (
  shape text not null,
  sample_number integer not null,
  elapsed_ms double precision not null
) on commit preserve rows;

create or replace function pg_temp.run_comparison_benchmark()
returns table (
  shape text,
  p50_ms double precision,
  p95_ms double precision,
  minimum_ms double precision,
  maximum_ms double precision
)
language plpgsql
as $$
declare
  sample integer;
  started_at timestamptz;
  elapsed double precision;
begin
  truncate table benchmark_latency;

  for sample in 1..10 loop
    perform * from public.daily_nine_at_bat_comparison(
      'benchmark-target', date '2099-01-01', 1, 'points-v3', 1::smallint
    );
    perform * from public.daily_nine_completed_score_buckets(
      'benchmark-target', date '2099-01-01', 1, 'points-v3'
    );
  end loop;

  for sample in 1..100 loop
    started_at := clock_timestamp();
    perform * from public.daily_nine_at_bat_comparison(
      'benchmark-target', date '2099-01-01', 1, 'points-v3', 1::smallint
    );
    elapsed := extract(epoch from (clock_timestamp() - started_at)) * 1000;
    insert into benchmark_latency values ('at_bat', sample, elapsed);

    started_at := clock_timestamp();
    perform * from public.daily_nine_completed_score_buckets(
      'benchmark-target', date '2099-01-01', 1, 'points-v3'
    );
    elapsed := extract(epoch from (clock_timestamp() - started_at)) * 1000;
    insert into benchmark_latency values ('completed', sample, elapsed);
  end loop;

  return query
  select
    measurement.shape,
    percentile_cont(0.50) within group (order by measurement.elapsed_ms),
    percentile_cont(0.95) within group (order by measurement.elapsed_ms),
    min(measurement.elapsed_ms),
    max(measurement.elapsed_ms)
  from benchmark_latency as measurement
  group by measurement.shape
  order by measurement.shape;
end;
$$;

select format(
  'RESULT|scale=%s|shape=%s|p50_ms=%s|p95_ms=%s|min_ms=%s|max_ms=%s',
  :scale,
  shape,
  round(p50_ms::numeric, 3),
  round(p95_ms::numeric, 3),
  round(minimum_ms::numeric, 3),
  round(maximum_ms::numeric, 3)
)
from pg_temp.run_comparison_benchmark();
