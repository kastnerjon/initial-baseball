-- Staged, service-only editorial drafts for new official Daily editions.
-- The legacy primary editor and the immutable publication table are untouched.
create table public.official_daily_editorial_drafts (
  occurrence_id uuid primary key default gen_random_uuid(),
  puzzle_date date not null check (isfinite(puzzle_date)),
  puzzle_number integer not null check (puzzle_number > 0),
  edition_key text not null check (
    length(edition_key) <= 64 and edition_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  -- Until the explicitly approved primary cutover, 1 remains the legacy primary.
  edition_number integer not null check (edition_number >= 2),
  title text not null check (
    length(title) between 3 and 60 and title = btrim(title) and title !~ '[<>[:cntrl:]]'
  ),
  selections jsonb not null check (
    (jsonb_typeof(selections) = 'array' and jsonb_array_length(selections) = 9) is true
  ),
  status text not null default 'draft' check (status in ('draft','scheduled','issued')),
  revision integer not null default 0 check (revision >= 0),
  created_by text not null check (length(btrim(created_by)) > 0),
  created_at timestamptz not null default now(),
  updated_by text not null check (length(btrim(updated_by)) > 0),
  updated_at timestamptz not null default now(),
  issued_at timestamptz,
  unique (puzzle_date, edition_key),
  unique (puzzle_date, edition_number),
  constraint official_daily_editorial_issued_at_match
    check ((status = 'issued') = (issued_at is not null))
);

alter table public.official_daily_editorial_drafts enable row level security;
revoke all on table public.official_daily_editorial_drafts
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.official_daily_editorial_drafts to service_role;

-- A scheduled draft can be edited only with a bumped revision. Issuance locks
-- every content field and the revision, and an issued draft can never change.
create function public.guard_official_daily_editorial_draft_update()
returns trigger language plpgsql security invoker set search_path = ''
as $guard$
begin
  if old.status = 'issued'
     or row(new.occurrence_id, new.puzzle_date, new.puzzle_number,
            new.edition_key, new.edition_number)
        is distinct from
        row(old.occurrence_id, old.puzzle_date, old.puzzle_number,
            old.edition_key, old.edition_number) then
    raise exception 'Official Daily editorial identity is immutable.'
      using errcode = '23514';
  end if;
  if new.status = 'issued' then
    if old.status <> 'scheduled' or new.revision <> old.revision
       or new.issued_at is null
       or (to_jsonb(new) - 'status' - 'issued_at')
          is distinct from (to_jsonb(old) - 'status' - 'issued_at') then
      raise exception 'Invalid official Daily issuance transition.'
        using errcode = '23514';
    end if;
  elsif new.revision <> old.revision + 1 or new.issued_at is not null
        or (old.status = 'scheduled' and new.status not in ('draft','scheduled')) then
    raise exception 'Official Daily editorial revision transition rejected.'
      using errcode = '23514';
  end if;
  return new;
end;
$guard$;

revoke all on function public.guard_official_daily_editorial_draft_update()
  from public, anon, authenticated;
create trigger guard_official_daily_editorial_draft
before update on public.official_daily_editorial_drafts
for each row execute function public.guard_official_daily_editorial_draft_update();

-- An atomic, server-only schedule/issuance transaction. Canonical clue values
-- are constructed and validated by packages/daily on the server, not in SQL.
-- This function checks immutable editorial identity and order under a row lock.
create function public.issue_official_daily_editorial_draft(
  p_occurrence_id uuid,
  p_expected_revision integer,
  p_clue_snapshot jsonb
) returns table (status text, puzzle_id text)
language plpgsql security invoker set search_path = ''
as $issue$
declare
  v_draft public.official_daily_editorial_drafts%rowtype;
  v_puzzle_id text;
  v_existing public.official_daily_publications%rowtype;
  v_added integer;
begin
  select * into v_draft from public.official_daily_editorial_drafts
   where occurrence_id = p_occurrence_id for update;
  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;
  if p_expected_revision is null or p_expected_revision < 0
     or v_draft.revision <> p_expected_revision then
    return query select 'conflict'::text, null::text;
    return;
  end if;
  v_puzzle_id := 'daily-ed-v1-' || v_draft.occurrence_id::text;
  if jsonb_typeof(p_clue_snapshot) is distinct from 'object'
     or jsonb_typeof(p_clue_snapshot -> 'pitches') is distinct from 'array'
     or jsonb_typeof(v_draft.selections) is distinct from 'array' then
    return query select 'conflict'::text, null::text;
    return;
  end if;
  if jsonb_array_length(p_clue_snapshot -> 'pitches') <> 9
     or jsonb_array_length(v_draft.selections) <> 9 then
    return query select 'conflict'::text, null::text;
    return;
  end if;
  if exists (
    select 1 from
      jsonb_array_elements(v_draft.selections) with ordinality s(selection, slot)
      join jsonb_array_elements(p_clue_snapshot -> 'pitches') with ordinality p(pitch, slot)
      using (slot)
    where jsonb_typeof(s.selection) is distinct from 'object'
       or jsonb_typeof(p.pitch) is distinct from 'object'
       or s.selection ->> 'slot' is distinct from s.slot::text
       or p.pitch ->> 'pitchNumber' is distinct from p.slot::text
       or nullif(btrim(s.selection ->> 'canonicalPlayerId'), '') is null
       or s.selection ->> 'canonicalPlayerId'
          is distinct from p.pitch ->> 'canonicalPlayerId'
  ) or (
    select count(distinct s.selection ->> 'canonicalPlayerId') <> 9
      from jsonb_array_elements(v_draft.selections) as s(selection)
  ) then
    return query select 'conflict'::text, null::text;
    return;
  end if;

  if v_draft.status = 'issued' then
    select * into v_existing from public.official_daily_publications
     where public.official_daily_publications.puzzle_id = v_puzzle_id;
    if found
       and v_existing.puzzle_date = v_draft.puzzle_date
       and v_existing.puzzle_number = v_draft.puzzle_number
       and v_existing.edition_key = v_draft.edition_key
       and v_existing.edition_number = v_draft.edition_number
       and v_existing.title = v_draft.title
       and v_existing.schema_version = 1
       and v_existing.ruleset_version = 'points-v4'
       and v_existing.clue_snapshot = p_clue_snapshot then
      return query select 'existing'::text, v_puzzle_id;
      return;
    end if;
    return query select 'conflict'::text, null::text;
    return;
  end if;
  if v_draft.status <> 'scheduled' then
    return query select 'conflict'::text, null::text;
    return;
  end if;

  insert into public.official_daily_publications
    (puzzle_id, puzzle_date, puzzle_number, edition_key, edition_number,
     title, schema_version, ruleset_version, clue_snapshot)
  values
    (v_puzzle_id, v_draft.puzzle_date, v_draft.puzzle_number,
     v_draft.edition_key, v_draft.edition_number, v_draft.title,
     1, 'points-v4', p_clue_snapshot)
  on conflict do nothing;
  get diagnostics v_added = row_count;
  if v_added <> 1 then
    return query select 'conflict'::text, null::text;
    return;
  end if;
  update public.official_daily_editorial_drafts
     set status = 'issued', issued_at = now()
   where occurrence_id = p_occurrence_id;
  return query select 'created'::text, v_puzzle_id;
end;
$issue$;

revoke all on function public.issue_official_daily_editorial_draft(uuid, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.issue_official_daily_editorial_draft(uuid, integer, jsonb)
  to service_role;
