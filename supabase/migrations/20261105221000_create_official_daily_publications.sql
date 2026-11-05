-- Immutable, private issuance ledger. The existing primary and numbered archive
-- keep their own tables. No reader, schedule or public access is enabled here.
create table public.official_daily_publications (
  puzzle_id text primary key check (
    puzzle_id ~ '^daily-ed-v1-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  puzzle_date date not null check (isfinite(puzzle_date)),
  puzzle_number integer not null check (puzzle_number > 0),
  edition_key text not null check (
    length(edition_key) <= 64 and edition_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  edition_number integer not null check (edition_number > 0),
  title text not null check (
    length(title) between 3 and 60 and title = btrim(title) and title !~ '[<>[:cntrl:]]'
  ),
  schema_version smallint not null check (schema_version = 1),
  ruleset_version text not null check (ruleset_version = 'points-v4'),
  clue_snapshot jsonb not null,
  issued_at timestamptz not null default now(),
  unique (puzzle_date, edition_key),
  unique (puzzle_date, edition_number),
  -- The private server constructor validates individual slots, players and hints.
  -- Enforce the v1 nine-pitch envelope again at the storage boundary.
  constraint official_daily_publication_clue_shape check ((
    jsonb_typeof(clue_snapshot) = 'object'
    and clue_snapshot -> 'schemaVersion' = '1'::jsonb
    and jsonb_typeof(clue_snapshot -> 'hintLayout') = 'array'
    and jsonb_array_length(clue_snapshot -> 'hintLayout') = 4
    and jsonb_typeof(clue_snapshot -> 'pitches') = 'array'
    and jsonb_array_length(clue_snapshot -> 'pitches') = 9
  ) is true)
);

alter table public.official_daily_publications enable row level security;
revoke all on table public.official_daily_publications from public, anon, authenticated, service_role;
grant select, insert on table public.official_daily_publications to service_role;
