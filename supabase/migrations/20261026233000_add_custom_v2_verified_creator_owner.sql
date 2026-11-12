-- Additive verified-account ownership on the SAME immutable issued row.
-- Application obtains the UUID only from Supabase Auth getUser(), never JSON.
-- Existing anonymous/admin issued puzzles remain NULL with intact owner codes.
-- No public/browser table grants, update path, or Custom feature activation.
alter table public.custom_nine_issued_challenges
  add column creator_account_id uuid
  references auth.users(id) on delete set null;

alter table public.custom_nine_issued_challenges
  add constraint custom_v2_verified_creator_shape
  check (
    creator_account_id is null
    or (schema_version = 2 and owner_capability_digest is null)
  );

create index custom_v2_verified_creator_recent_idx
  on public.custom_nine_issued_challenges
  (creator_account_id, issued_at desc, puzzle_id)
  where creator_account_id is not null;

comment on column public.custom_nine_issued_challenges.creator_account_id is
  'Server-verified Supabase Auth UUID supplied only by the trusted issuance service. Atomic with immutable puzzle creation. NULL for legacy/admin/anonymous puzzles or after account deletion. Never expose the answer-bearing row to browser roles.';

-- Preserve service-role SELECT/INSERT-only grants and existing RLS.
-- Account deletion leaves immutable issued puzzles/results intact, with no owner.
