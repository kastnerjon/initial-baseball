-- Private metadata attached to immutable Custom v2 issuance; no public reads.
-- Historical v1/v2 challenges are preserved without retroactive titles.
-- The creator API must require a name before the public creation flag can turn on.
alter table public.custom_nine_issued_challenges
  add column display_title text;

alter table public.custom_nine_issued_challenges
  add constraint custom_v2_issued_title_shape
  check (
    display_title is null
    or (
      schema_version = 2
      and char_length(display_title) between 3 and 60
      and display_title = btrim(display_title)
      and display_title !~ '[<>[:cntrl:]]'
    )
  );

comment on column public.custom_nine_issued_challenges.display_title is
  'Optional v2-issued title for new named challenges; NULL is retained for historical challenges. Server-side normalized, never a public listing or answer credential.';
