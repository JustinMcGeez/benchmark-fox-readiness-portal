-- ============================================================================
-- Benchmark Fox Readiness Portal — client profile fields + assignment
-- soft-delete (006)
-- Target: Supabase / Postgres
--
-- Task 07 (Real client CRUD + assignments). APPEND-ONLY: 001–005 are never
-- edited.
--
-- WHAT THIS MIGRATION DOES
--   1. Adds the org-basics columns the Create Client wizard captures and the
--      client record persists: CAGE code, DIB role (prime/sub), contract types,
--      and primary contact (name / email / title). All NON-CUI engagement
--      metadata (HARD RULE: no CUI, no evidence files — see 001). Nullable /
--      defaulted so existing rows (the demo client) keep working.
--   2. Adds client_assignments.deleted_at so an assignment can be REMOVED by
--      soft-delete (the app never hard-deletes — removals set a timestamp). The
--      assignment list filters deleted_at is null; re-assigning clears it.
--
-- No auth dependency: this migration only adds columns, so (unlike 004/005) it
-- applies cleanly to bare Postgres (CI) and a real Supabase project alike. The
-- 004 RLS policies cover every column of clients / client_assignments already,
-- so the new columns inherit the same tenancy boundary with no policy change.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Client engagement profile fields (captured by the Create Client wizard).
-- ----------------------------------------------------------------------------
alter table clients
  add column if not exists cage_code             text,
  add column if not exists dib_role              text,   -- Prime | Subcontractor | Both | Unknown
  add column if not exists contract_types        jsonb not null default '[]'::jsonb,  -- ['FAR 52.204-21', ...]
  add column if not exists primary_contact_name  text,
  add column if not exists primary_contact_email text,
  add column if not exists primary_contact_title text;

comment on column clients.contract_types is
  'Applicable contract clause types (FAR/DFARS) — NON-CUI engagement metadata.';

-- ----------------------------------------------------------------------------
-- 2. Assignment soft-delete (removeAssignment never hard-deletes).
-- ----------------------------------------------------------------------------
alter table client_assignments
  add column if not exists deleted_at timestamptz;

comment on column client_assignments.deleted_at is
  'Soft-delete timestamp. removeAssignment sets this; the app filters '
  'deleted_at is null. Re-assigning the same (client, profile) clears it.';

-- ----------------------------------------------------------------------------
-- 3. Honor the soft-delete in the tenancy helpers (004). Without this, a
-- removed assignment row would still grant access — making removeAssignment a
-- no-op at the RLS layer. Redefining the SECURITY DEFINER helpers to ignore
-- soft-deleted rows closes that gap. (No policy changes: every per-client
-- policy already roots in these two helpers.)
--
-- Only the Supabase stack (with auth.uid()) ever reaches this migration — 004
-- raises and aborts on bare Postgres, so current_profile_id() exists here.
-- Signatures are unchanged, so the existing policies keep referencing them.
-- ----------------------------------------------------------------------------
create or replace function is_assigned_to_client(target_client uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select is_bf_admin() or exists (
    select 1 from client_assignments ca
    where ca.client_id = target_client
      and ca.profile_id = current_profile_id()
      and ca.deleted_at is null
  );
$$;

create or replace function can_write_client(target_client uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select is_bf_admin() or (
    is_bf_consultant() and exists (
      select 1 from client_assignments ca
      where ca.client_id = target_client
        and ca.profile_id = current_profile_id()
        and ca.deleted_at is null
    )
  );
$$;

commit;
