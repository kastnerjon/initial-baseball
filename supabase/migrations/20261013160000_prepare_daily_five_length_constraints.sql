-- Prepare, but do not activate, five-at-bat Universal Daily issuance.
-- Existing editorial records default to contract 1 (nine players).
-- Future contract 2 (five players) must be explicitly selected by a later
-- server-authoritative editor/issuance implementation.
-- Existing permanent/archive-beta schema-v1/v2 rows remain exact-nine;
-- schema v3 is reserved for future clue-frozen, five-player issuance.
-- No application changes, writes or permissions are enabled here.

alter table public.daily_editorial_puzzles
  add column lineup_contract_version smallint not null default 1;

alter table public.daily_editorial_puzzles
  add constraint daily_editorial_puzzles_lineup_contract_version_check
    check (lineup_contract_version in (1, 2));

alter table public.daily_editorial_puzzles
  drop constraint daily_editorial_puzzles_selections_check;

alter table public.daily_editorial_puzzles
  add constraint daily_editorial_puzzles_selections_check
    check (
      jsonb_typeof(selections) = 'array'
      and (
        (lineup_contract_version = 1 and jsonb_array_length(selections) = 9)
        or (lineup_contract_version = 2 and jsonb_array_length(selections) = 5)
      )
    );

comment on column public.daily_editorial_puzzles.lineup_contract_version is
  '1 = current/historical nine-player editorial lineup (default); 2 = future five-player lineup. Existing version/revision fields retain their original meaning.';

comment on column public.daily_editorial_puzzles.selections is
  'Ordered canonical-player selections; length is nine for lineup contract 1 and five for contract 2. Future contract 2 is not yet issued by the application.';

alter table public.permanent_daily_issued_puzzles
  drop constraint permanent_daily_issued_puzzles_schema_version,
  drop constraint permanent_daily_issued_puzzles_players_array,
  drop constraint permanent_daily_issued_puzzles_clue_snapshot_contract;

alter table public.permanent_daily_issued_puzzles
  add constraint permanent_daily_issued_puzzles_schema_version
    check (
      (series_version = 'permanent-v1' and schema_version in (1, 2, 3))
      or (series_version = 'archive-beta-v1' and schema_version in (2, 3))
    ),
  add constraint permanent_daily_issued_puzzles_players_array
    check (
      jsonb_typeof(canonical_player_ids) = 'array'
      and (
        (schema_version in (1, 2) and jsonb_array_length(canonical_player_ids) = 9)
        or (schema_version = 3 and jsonb_array_length(canonical_player_ids) = 5)
      )
    ),
  add constraint permanent_daily_issued_puzzles_clue_snapshot_contract
    check (
      (schema_version = 1 and clue_snapshot is null)
      or (
        schema_version in (2, 3)
        and clue_snapshot is not null
        and jsonb_typeof(clue_snapshot) = 'object'
        and clue_snapshot ->> 'schemaVersion' = '1'
        and jsonb_typeof(clue_snapshot -> 'hintLayout') = 'array'
        and jsonb_typeof(clue_snapshot -> 'pitches') = 'array'
        and (
          schema_version = 2
          or jsonb_array_length(clue_snapshot -> 'pitches') = 5
        )
      )
    );

comment on column public.permanent_daily_issued_puzzles.canonical_player_ids is
  'Immutable ordered canonical IDs: issued schema v1/v2 require nine players; future clue-frozen schema v3 requires five. Never reinterpret existing issued puzzles.';

comment on column public.permanent_daily_issued_puzzles.clue_snapshot is
  'Schema v1: no snapshot; schema v2: frozen nine-player clues; reserved schema v3: frozen five-player clues (same inner snapshot format).';

comment on table public.permanent_daily_issued_puzzles is
  'Immutable issued Daily puzzles. Legacy permanent-v1 schema v1/v2 and archive-beta-v1 schema v2 remain nine-player. Future schema v3 is five-player and requires a separately reviewed issuance path. service_role remains SELECT/INSERT only.';
