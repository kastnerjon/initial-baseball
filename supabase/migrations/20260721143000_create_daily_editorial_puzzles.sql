-- Current Daily editorial persistence for the provider-neutral DailyPuzzleRepository.
-- This table is intentionally separate from the inactive legacy daily_puzzles scaffold.
-- Player names, statistics, hints, and reveal data remain owned by baseball-data.

create table public.daily_editorial_puzzles (
  id text primary key,
  puzzle_date date not null unique,
  puzzle_number integer not null unique check (puzzle_number > 0),
  version integer not null default 1 check (version > 0),
  revision integer not null default 0 check (revision >= 0),
  status text not null check (status in ('draft', 'scheduled', 'published', 'archived')),
  selections jsonb not null check (
    jsonb_typeof(selections) = 'array'
    and jsonb_array_length(selections) = 9
  ),
  created_at timestamptz not null,
  created_by text not null check (btrim(created_by) <> ''),
  updated_at timestamptz not null,
  updated_by text not null check (btrim(updated_by) <> ''),
  scheduled_at timestamptz,
  scheduled_by text check (scheduled_by is null or btrim(scheduled_by) <> ''),
  published_at timestamptz,
  published_by text check (published_by is null or btrim(published_by) <> ''),
  archived_at timestamptz,
  archived_by text check (archived_by is null or btrim(archived_by) <> ''),
  constraint daily_editorial_puzzles_lifecycle_audit_check check (
    (
      status = 'draft'
      and scheduled_at is null and scheduled_by is null
      and published_at is null and published_by is null
      and archived_at is null and archived_by is null
    )
    or (
      status = 'scheduled'
      and scheduled_at is not null and scheduled_by is not null
      and published_at is null and published_by is null
      and archived_at is null and archived_by is null
    )
    or (
      status = 'published'
      and scheduled_at is not null and scheduled_by is not null
      and published_at is not null and published_by is not null
      and archived_at is null and archived_by is null
    )
    or (
      status = 'archived'
      and scheduled_at is not null and scheduled_by is not null
      and published_at is not null and published_by is not null
      and archived_at is not null and archived_by is not null
    )
  )
);

comment on table public.daily_editorial_puzzles is
  'Current canonical-ID-only Daily editorial records governed by packages/daily lifecycle rules.';
comment on column public.daily_editorial_puzzles.selections is
  'Exactly nine {slot, canonicalPlayerId, source} records; baseball facts are joined at read time.';
comment on column public.daily_editorial_puzzles.revision is
  'Optimistic concurrency revision used by compare-and-swap repository updates.';

alter table public.daily_editorial_puzzles enable row level security;

-- Admin authentication is a later decision. Until explicit policies are added,
-- only a server-side service-role client may access editorial puzzle records.
revoke all on table public.daily_editorial_puzzles from anon, authenticated;
grant select, insert, update on table public.daily_editorial_puzzles to service_role;
