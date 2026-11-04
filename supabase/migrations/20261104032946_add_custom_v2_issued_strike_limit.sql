-- Immutable per-issued-challenge strike cap. This is persistence only:
-- clients and issuance must not enable nondefault gameplay until progression,
-- receipts and score/admission consumers are reviewed end to end.
-- PostgreSQL 17 adds this constant-default column without rewriting existing rows.
-- Every previously issued v1/v2 challenge remains a three-strike game.
alter table public.custom_nine_issued_challenges
  add column strike_limit smallint not null default 3;

alter table public.custom_nine_issued_challenges
  add constraint custom_nine_issued_challenges_strike_limit_by_schema
  check (
    (schema_version = 1 and strike_limit = 3)
    or (schema_version = 2 and strike_limit between 1 and 3)
  );

comment on column public.custom_nine_issued_challenges.strike_limit is
  'Immutable whole-lineup strikes per out (1, 2, 3 for v2; exactly 3 for v1). Existing issued rows backfill to 3. Service-role INSERT/SELECT only; never accept a client-supplied rule. Gameplay issuance of 1/2 remains disabled until separate reviewed progression rollout.';

-- Do not alter RLS, existing grants, scoring, attempts, or result tables.
-- No production deployment or feature activation is authorized by this DDL.
