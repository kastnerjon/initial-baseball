-- Service-only anonymous management credential verifier, independent of the
-- shareable puzzle ID and creator-preview/first-attempt cookies.
-- Existing v1, admin v2 and issued challenges retain NULL.
alter table public.custom_nine_issued_challenges
  add column owner_capability_digest text;

alter table public.custom_nine_issued_challenges
  add constraint custom_v2_owner_capability_digest_shape
  check (
    owner_capability_digest is null
    or (
      schema_version = 2
      and owner_capability_digest ~ '^[0-9a-f]{64}$'
    )
  );

comment on column public.custom_nine_issued_challenges.owner_capability_digest is
  'Optional SHA-256 digest of a cryptographically random 32-byte anonymous creator management capability, issued only with the challenge. Never store or expose the plaintext capability. NULL preserves older private/admin challenges.';
