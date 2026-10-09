-- Private, append-only immutable Custom Nine issued challenges.
-- Creation and materialization are authoritative only in server-side Daily code.
-- This table stores answer IDs and future hints: never grant browser-role access.
create table public.custom_nine_issued_challenges (
  puzzle_id text primary key,
  schema_version smallint not null,
  ruleset_version text not null,
  canonical_player_ids jsonb not null,
  clue_snapshot jsonb not null,
  issued_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint custom_nine_issued_challenges_id_format
    check (
      puzzle_id ~ '^custom-nine-v1-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ),
  constraint custom_nine_issued_challenges_schema_version
    check (schema_version = 1),
  constraint custom_nine_issued_challenges_ruleset_version
    check (ruleset_version = 'points-v4'),
  constraint custom_nine_issued_challenges_nine_players
    check (
      jsonb_typeof(canonical_player_ids) = 'array'
      and jsonb_array_length(canonical_player_ids) = 9
    ),
  constraint custom_nine_issued_challenges_frozen_clue_shape
    check (
      coalesce(
        jsonb_typeof(clue_snapshot) = 'object'
        and clue_snapshot ->> 'schemaVersion' = '1'
        and jsonb_typeof(clue_snapshot -> 'hintLayout') = 'array'
        and jsonb_array_length(clue_snapshot -> 'hintLayout') = 4
        and jsonb_typeof(clue_snapshot -> 'pitches') = 'array'
        and jsonb_array_length(clue_snapshot -> 'pitches') = 9
        and jsonb_typeof(clue_snapshot #> '{pitches,0,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,0,hintValues}') = 4
        and jsonb_typeof(clue_snapshot #> '{pitches,1,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,1,hintValues}') = 4
        and jsonb_typeof(clue_snapshot #> '{pitches,2,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,2,hintValues}') = 4
        and jsonb_typeof(clue_snapshot #> '{pitches,3,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,3,hintValues}') = 4
        and jsonb_typeof(clue_snapshot #> '{pitches,4,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,4,hintValues}') = 4
        and jsonb_typeof(clue_snapshot #> '{pitches,5,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,5,hintValues}') = 4
        and jsonb_typeof(clue_snapshot #> '{pitches,6,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,6,hintValues}') = 4
        and jsonb_typeof(clue_snapshot #> '{pitches,7,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,7,hintValues}') = 4
        and jsonb_typeof(clue_snapshot #> '{pitches,8,hintValues}') = 'array'
        and jsonb_array_length(clue_snapshot #> '{pitches,8,hintValues}') = 4,
        false
      )
    )
);

alter table public.custom_nine_issued_challenges enable row level security;

revoke all on table public.custom_nine_issued_challenges
  from public, anon, authenticated, service_role;
grant select, insert on table public.custom_nine_issued_challenges to service_role;

comment on table public.custom_nine_issued_challenges is
  'Private first-write-wins Custom Nine challenges with canonical answers and frozen future hints. Service-role SELECT/INSERT only; no anonymous access or application update/delete.';
comment on column public.custom_nine_issued_challenges.canonical_player_ids is
  'The exact private ordered nine-player answer identities; never return this column to anonymous clients.';
comment on column public.custom_nine_issued_challenges.clue_snapshot is
  'Private frozen four-hint-per-player snapshot; only the currently authorized batter may receive its hints via later signed progression.';
