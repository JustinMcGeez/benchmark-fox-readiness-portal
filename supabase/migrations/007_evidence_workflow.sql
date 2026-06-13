-- ============================================================================
-- Benchmark Fox Readiness Portal — Evidence lifecycle workflow (007)
-- Target: Supabase / Postgres
--
-- Task 08 (Evidence lifecycle workflow). APPEND-ONLY: 001–006 are never edited.
--
-- WHAT THIS MIGRATION DOES
--   1. Adds the evidence_items columns the workflow needs:
--        objective_ids  jsonb  — NIST SP 800-171A objective ids this evidence
--                                 covers (METADATA only; [] = whole control).
--        description    text   — what's needed (the request brief).
--        due_date       date   — when requested evidence is due.
--        expires_on     date   — drives the read-time Expired derivation in
--                                 src/lib/evidenceWorkflow.ts (no cron).
--      Still METADATA + secure external links only — NO file column exists
--      (HARD RULE from 001; this migration does not add one).
--   2. Adds a ROLE-BASED TRANSITION GUARD so evidence_uploader (and client-role
--      users) cannot perform REVIEW transitions, even though 004 lets them
--      INSERT/UPDATE evidence metadata for their assigned client.
--
-- WHY A TRIGGER (not a pure RLS policy):
--   An RLS UPDATE policy can see OLD (USING) or NEW (WITH CHECK) but cannot
--   express "the status column may change only along uploader-legal moves" —
--   that requires comparing OLD.status to NEW.status in one predicate, which RLS
--   cannot do. A BEFORE INSERT/UPDATE trigger can, so the role boundary lives
--   there. The legal STATE MACHINE itself stays in the app
--   (src/lib/evidenceWorkflow.ts, validated by the repository's transition());
--   this trigger only enforces the ROLE half: review outcomes are staff-only.
--   It is defense-in-depth — the UI already hides the buttons.
--
-- Requires the 004/005 helpers (current_profile_id, is_bf_staff) and the
-- Supabase auth schema, so it is auth-guarded like 004/005. On bare Postgres 004
-- already aborts, so this never runs there; the `rls` CI job applies it via
-- `supabase start` and scripts/test-rls.mjs enforces the boundary.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Guard: meaningless without the auth schema (the trigger reads the session).
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('auth.users') is null then
    raise exception
      '007_evidence_workflow requires the Supabase auth schema (auth.uid()). Apply against a Supabase project / local stack, not bare Postgres.';
  end if;
end
$$;

-- ============================================================================
-- 1. Evidence workflow columns (METADATA only). Defaulted/nullable so existing
-- rows (the demo client's seeded evidence) keep working.
-- ============================================================================
alter table evidence_items
  add column if not exists objective_ids jsonb not null default '[]'::jsonb,
  add column if not exists description   text,
  add column if not exists due_date      date,
  add column if not exists expires_on    date;

comment on column evidence_items.objective_ids is
  'NIST SP 800-171A objective ids this evidence covers (METADATA only). [] = the '
  'evidence maps to the control overall. No file bytes are ever stored.';
comment on column evidence_items.expires_on is
  'Evidence expiry date. Read-time only: src/lib/evidenceWorkflow.ts derives an '
  'Accepted item past this date to Expired (no cron job).';

-- ============================================================================
-- 2. Review-only statuses — the SINGLE SQL source of truth, kept in lockstep
-- with REVIEWER_ONLY_STATUSES in src/lib/evidenceWorkflow.ts. Only Benchmark Fox
-- staff (admin/consultant) may move an item into one of these.
-- ============================================================================
create or replace function is_reviewer_only_evidence_status(p_status text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_status in ('In Review', 'Accepted', 'Needs Revision', 'Rejected');
$$;

revoke execute on function is_reviewer_only_evidence_status(text) from public;
grant  execute on function is_reviewer_only_evidence_status(text) to authenticated;

-- ============================================================================
-- 3. Transition guard — BEFORE INSERT/UPDATE on evidence_items.
-- SECURITY DEFINER so it can resolve the caller's role via the 004/005 helpers
-- regardless of the caller's own grants; search_path pinned.
-- ============================================================================
create or replace function evidence_guard_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- An UPDATE that does not touch status (metadata / link edit) is unaffected.
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  -- System / service_role writes (no authenticated profile) and Benchmark Fox
  -- staff (admin/consultant) may set any status. The app enforces the legal
  -- state machine; this guard only gates the ROLE half.
  if current_profile_id() is null or is_bf_staff() then
    return new;
  end if;

  -- Authenticated NON-staff (evidence_uploader / client roles): may not move
  -- evidence into a review-only status (In Review / Accepted / Needs Revision /
  -- Rejected). They may still set Requested / Uploaded / Missing / Expired.
  if is_reviewer_only_evidence_status(new.status::text) then
    raise exception
      'Only Benchmark Fox staff may move evidence to "%" (review transition).', new.status
      using errcode = '42501';   -- insufficient_privilege (matches RLS denials)
  end if;

  return new;
end;
$$;

revoke execute on function evidence_guard_transition() from public;

drop trigger if exists trg_evidence_guard_transition on evidence_items;
create trigger trg_evidence_guard_transition
  before insert or update on evidence_items
  for each row execute function evidence_guard_transition();

commit;
